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
        .describe("O texto exato da âncora encontrada no texto"),
      trecho: z
        .string()
        .describe("A frase onde a âncora aparece (para contexto)"),
      target_topic: z
        .string()
        .describe("O tópico alvo que esta âncora se refere"),
      score: z.number().describe("Relevância da âncora (0-1)"),
    })
  ),
});

/**
 * Tenta encontrar a localização real da âncora no texto e retorna um contexto verdadeiro.
 * Útil quando o LLM alucina levemente a frase de contexto (trecho).
 */
function recoverRealContext(content: string, anchor: string): string | null {
  const contentLower = normalizeText(content);
  const anchorLower = normalizeText(anchor);
  
  const index = contentLower.indexOf(anchorLower);
  
  // Tenta match exato primeiro
  if (index !== -1) {
    const start = Math.max(0, index - 50);
    const end = Math.min(content.length, index + anchor.length + 50);
    return "..." + content.slice(start, end).replace(/\n/g, " ") + "...";
  }

  // Se falhar, não tenta fuzzy pesado aqui para não criar contexto falso.
  // O fuzzyContains já validou que "existe algo parecido".
  // Podemos tentar achar a posição aproximada se necessário, mas por segurança retornamos null
  // e deixamos o fluxo principal decidir.
  
  return null;
}

/**
 * Verifica se o contexto parece ser uma frase natural ou apenas uma lista/menu/tag.
 */
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
  targets: { url: string; clusters: string[] }[],
  originUrl: string,
  maxInlinks: number = 3,
  targetContents: Record<string, string> = {}
): Promise<AnchorOpportunity[]> {
  const model = await getLLM();
  const structuredLLM = model.withStructuredOutput(anchorSchema);

  const targetsDescription = targets
    .map((t) => `- URL: ${t.url}\n  Tópicos: ${t.clusters.join(", ")}`)
    .join("\n\n");

  // Aumentei um pouco o limite seguro
  const truncatedContent = content.slice(0, 25000);

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `Você é um especialista em SEO e Link Building.
      
      Sua missão é ler o texto e encontrar termos ou frases curtas que sirvam de âncora para os Tópicos Alvo.
      
      OBJETIVO:
      Encontre onde podemos inserir links para os tópicos listados de forma semântica e contextual.
      
      REGRAS CRÍTICAS:
      1. A âncora DEVE estar presente no texto ORIGINAL.
      2. NÃO BUSQUE APENAS MATCH EXATO. Procure sinônimos, variações e termos relacionados que indiquem o mesmo assunto.
         - Exemplo: Se o tópico é "Marketing Digital", âncoras válidas são "estratégias online", "publicidade na web", "vendas pela internet".
      3. A âncora deve ser natural dentro da frase (nada de "clique aqui", "saiba mais").
      4. A âncora deve ter relação semântica forte com o tópico alvo.
      5. Ignore títulos (H1-H6) e rodapés.
      
      Retorne JSON com as oportunidades encontradas.`,
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
      Priorize variações semânticas ricas em vez de apenas repetir a palavra-chave exata.
      Retorne JSON.`,
    ],
  ]);

  const chain = prompt.pipe(structuredLLM);

  console.log(`[Anchor Selector] Iniciando análise para ${originUrl} com ${truncatedContent.length} caracteres.`);

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
    // Validação básica de tamanho
    const wordCount = opp.anchor.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount > 8) continue;

    // Validação de Nome de Arquivo de Imagem
    if (/\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff)$/i.test(opp.anchor.trim())) {
       continue;
    }

    // 1. Validação e Recuperação (Self-Healing)
    let finalTrecho = opp.trecho;
    
    // Agora usamos fuzzyContains mais permissivo (Levenshtein)
    if (!fuzzyContains(content, opp.anchor)) {
       console.warn(`[Anchor Selector] Âncora ALUCINADA (não existe no texto): "${opp.anchor}"`);
       continue;
    }

    // Se o trecho não bate, tentamos recuperar o contexto real
    if (!fuzzyContains(content, opp.trecho)) {
        const recovered = recoverRealContext(content, opp.anchor);
        if (recovered) {
            finalTrecho = recovered;
        } else {
             // Se não conseguiu recuperar o contexto exato, mas a âncora existe (validada acima),
             // mantemos o trecho original do LLM se ele parecer razoável, ou tentamos recriar um dummy.
             // Por segurança, vamos pular se não conseguirmos validar o contexto, para evitar erros no CSV.
            continue;
        }
    }

    // 2. Validação de Naturalidade (Anti-Menu/Lista)
    if (!isNaturalSentence(finalTrecho)) {
       continue;
    }

    // 3. Validação de Heading
    if (html) {
      const aLower = normalizeText(opp.anchor);
      const inHeading = headingTexts.some(h => {
          const hLower = normalizeText(h);
          return hLower.includes(aLower) || aLower.includes(hLower);
      });
      if (inHeading) {
        continue;
      }
    }
    
    // 4. Validação de Navegação
    const trechoLower = normalizeText(finalTrecho);
    const badPatterns = ["leia tambem", "veja tambem", "confira tambem", "posts relacionados", "saiba mais", "tags:", "categorias:"];
    if (badPatterns.some(p => trechoLower.includes(p))) {
        continue;
    }

    // Match do Tópico
    const target = targets.find(
      (t) =>
        t.clusters.includes(opp.target_topic) ||
        opp.target_topic.includes(t.clusters[0])
    );

    const bestTarget =
      target ||
      targets.find((t) =>
        t.clusters.some(
          (c) => opp.target_topic.includes(c) || c.includes(opp.target_topic)
        )
      );

    if (bestTarget && bestTarget.url !== originUrl) {
        
        // 5. Validação no Conteúdo do Pilar (Target) - RELAXADA
        let pillarCtx: string | undefined = undefined;
        const pillarContent = targetContents[bestTarget.url];
        
        if (pillarContent) {
            const recoveredPillarCtx = recoverRealContext(pillarContent, opp.anchor);
            
            if (recoveredPillarCtx) {
                pillarCtx = recoveredPillarCtx;
            } else {
                // AQUI ESTAVA O PROBLEMA: Antes fazíamos `continue`, descartando tudo.
                // Agora apenas marcamos como não encontrado.
                pillarCtx = "Termo não encontrado exatamente no destino (link semântico)";
                // Opcional: tentar fuzzy search no pilar também?
                if (fuzzyContains(pillarContent, opp.anchor)) {
                   pillarCtx = "Termo encontrado (variação semântica/fuzzy)";
                }
            }
        } else {
             pillarCtx = "Conteúdo do pilar não carregado";
        }

      opportunities.push({
        anchor: opp.anchor,
        trecho: finalTrecho,
        pillarContext: pillarCtx,
        origem: originUrl,
        destino: bestTarget.url,
        score: opp.score,
        reason: `Tópico: ${opp.target_topic}`,
      });
    }
  }

  return opportunities;
}
