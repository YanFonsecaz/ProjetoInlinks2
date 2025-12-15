import { fuzzyContains, normalizeText } from "@/utils/text-matcher";
import { z } from "zod";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { getLLM } from "@/core/llm";
import { AnchorOpportunity } from "@/types";

const anchorSchema = z.object({
  opportunities: z.array(
    z.object({
      anchor: z
        .string()
        .describe("O texto exato da âncora (ou o novo texto sugerido)"),
      trecho: z
        .string()
        .describe("A frase completa onde a âncora aparece ou será inserida"),
      type: z
        .enum(['exact', 'rewrite', 'insert'])
        .describe("Tipo de oportunidade: 'exact' (já existe), 'rewrite' (ajustar frase existente), 'insert' (novo parágrafo)"),
      original_text: z
        .string()
        .optional()
        .describe("O texto original que será substituído (apenas para 'rewrite')"),
      pillar_context: z
        .string()
        .optional()
        .describe("Justificativa semântica para a inserção ou reescrita"),
      target_topic: z
        .string()
        .describe("O tópico alvo que esta âncora se refere"),
      score: z.number().describe("Relevância da âncora (0-1)"),
    })
  ),
});

/**
 * Tenta encontrar a localização real da âncora no texto e retorna um contexto verdadeiro.
 */
function recoverRealContext(content: string, anchor: string): string | null {
  const contentLower = normalizeText(content);
  const anchorLower = normalizeText(anchor);
  
  const index = contentLower.indexOf(anchorLower);
  if (index === -1) return null;

  const start = Math.max(0, index - 50);
  const end = Math.min(content.length, index + anchor.length + 50);
  
  return "..." + content.slice(start, end).replace(/\n/g, " ") + "...";
}

function isNaturalSentence(text: string): boolean {
  if (!text) return false;
  if ((text.match(/\|/g) || []).length > 1) return false;
  if ((text.match(/•/g) || []).length > 1) return false;
  if (text.length < 20) return false;
  return true;
}

export async function findAnchorOpportunities(
  content: string,
  html: string | undefined,
  targets: { url: string; clusters: string[]; theme?: string; intencao?: string }[],
  originUrl: string,
  maxInlinks: number = 3
): Promise<AnchorOpportunity[]> {
  const model = await getLLM();
  const structuredLLM = model.withStructuredOutput(anchorSchema);

  const targetsDescription = targets
    .map((t) => `- URL: ${t.url}\n  Tópicos: ${t.clusters.join(", ")}\n  Tema: ${t.theme || "N/A"}\n  Intenção: ${t.intencao || "N/A"}`)
    .join("\n\n");

  const truncatedContent = content.slice(0, 15000);

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `Você é um especialista em SEO e Link Building Estratégico.
      
      Sua missão é encontrar ou criar oportunidades de linkagem interna no texto fornecido para os Tópicos Alvo.
      
      PRIORIDADE DE AÇÃO:
      1. EXACT (Prioridade Alta): Encontre frases ou termos que JÁ EXISTEM no texto e têm alta afinidade semântica com o alvo.
      2. REWRITE (Prioridade Média): Se houver um parágrafo semanticamente relacionado mas sem âncora boa, sugira uma leve reescrita para incluir a âncora de forma natural.
      3. INSERT (Prioridade Baixa): Se o texto permitir e houver forte justificativa semântica, sugira um novo parágrafo curto para conectar com o tópico alvo.
      
      REGRAS PARA INLINKS:
      - Justificativa Semântica Clara: O link deve fazer sentido no contexto.
      - Fluidez: O texto deve permanecer natural.
      - Não alterar sentido original: Mantenha a voz e objetivo do texto.
      - Ignore títulos (H1-H6) e rodapés para links 'exact'.
      
      Para 'rewrite' ou 'insert', preencha o campo 'pillar_context' explicando o porquê.
      Para 'rewrite', forneça o 'original_text' que será alterado.
      
      Retorne JSON com as oportunidades.`,
    ],
    [
      "human",
      `Texto para Análise:
      {content}
      
      ---
      
      Tópicos Alvo (URLs para linkar):
      {targets}
      
      ---
      
      Encontre até {maxInlinks} melhores oportunidades.
      Retorne JSON.`,
    ],
  ]);

  const chain = prompt.pipe(structuredLLM);

  const result = await chain.invoke({
    content: truncatedContent,
    targets: targetsDescription,
    maxInlinks: maxInlinks.toString(),
  });

  const opportunities: AnchorOpportunity[] = [];
  
  let headingTexts: string[] = [];
  if (html) {
    const cheerio = await import("cheerio");
    const $ = cheerio.load(html);
    $("h1, h2, h3, h4, h5, h6").each((_, el) => {
      const text = $(el).text();
      if (text) headingTexts.push(text);
    });
  }

  for (const opp of result.opportunities) {
    // Se for 'exact', aplicamos validações estritas de existência
    if (opp.type === 'exact') {
        const wordCount = opp.anchor.trim().split(/\s+/).filter(Boolean).length;
        if (wordCount > 8) continue;

        let finalTrecho = opp.trecho;
        
        if (!fuzzyContains(content, opp.anchor)) {
            continue; 
        }

        if (!fuzzyContains(content, opp.trecho)) {
            const recovered = recoverRealContext(content, opp.anchor);
            if (recovered) {
                finalTrecho = recovered;
            } else {
                continue;
            }
        }

        if (!isNaturalSentence(finalTrecho)) continue;

        if (html) {
            const aLower = normalizeText(opp.anchor);
            const inHeading = headingTexts.some(h => {
                const hLower = normalizeText(h);
                return hLower.includes(aLower) || aLower.includes(hLower);
            });
            if (inHeading) continue;
        }
        
        opp.trecho = finalTrecho;
    } 
    else if (opp.type === 'rewrite') {
        if (opp.original_text && !fuzzyContains(content, opp.original_text)) {
             console.warn(`[Anchor Selector] Rewrite falhou: Texto original não encontrado: "${opp.original_text}"`);
             continue;
        }
    }

    const target = targets.find(
      (t) =>
        t.clusters.includes(opp.target_topic) ||
        opp.target_topic.includes(t.clusters[0]) ||
        (t.theme && opp.target_topic.includes(t.theme))
    );

    const bestTarget =
      target ||
      targets.find((t) =>
        t.clusters.some(
          (c) => opp.target_topic.includes(c) || c.includes(opp.target_topic)
        )
      );

    if (bestTarget && bestTarget.url !== originUrl) {
      opportunities.push({
        anchor: opp.anchor,
        trecho: opp.trecho,
        origem: originUrl,
        destino: bestTarget.url,
        score: opp.score,
        reason: opp.pillar_context || `Tópico: ${opp.target_topic}`,
        type: opp.type as 'exact' | 'rewrite' | 'insert',
        original_text: opp.original_text,
        pillar_context: opp.pillar_context,
        target_topic: opp.target_topic
      });
    }
  }

  return opportunities;
}
