import { normalizeText } from "@/utils/text-matcher";
import { normalizeUrlForMetadata } from "@/utils/url-normalizer";
import { z } from "zod";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { getLLM } from "@/core/llm";
import { AnchorOpportunity } from "@/types";
import { getVectorStore } from "@/core/vector-store";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "@langchain/core/documents";
import { validateOpportunitiesInDOM } from "./dom_validator"; // Multi-Agent: Importando o Validator

const anchorSchema = z.object({
  opportunities: z.array(
    z.object({
      anchor: z
        .string()
        .describe("O texto exato da âncora (ou o novo texto sugerido)"),
      trecho: z
        .string()
        .describe("A frase completa onde a âncora aparece ou será inserida"),
      type: z.string().describe("Tipo de oportunidade: 'exact'"),
      original_text: z
        .string()
        .nullable()
        .optional()
        .describe(
          "O texto original que será substituído (apenas para 'rewrite')"
        ),
      pillar_context: z
        .string()
        .nullable()
        .optional()
        .describe("Justificativa semântica para a inserção ou reescrita"),
      target_url: z
        .string()
        .describe("A URL exata do destino escolhido da lista fornecida"),
      target_topic: z
        .string()
        .describe("O nome do tópico para qual a âncora aponta"),
      score: z.number().describe("Relevância da âncora (0-1)"),
    })
  ),
});

/**
 * Tenta encontrar a localização real da âncora no texto e retorna um contexto verdadeiro.
 */
/**
 * Encontra a frase completa que contém a âncora.
 * Expande para os lados até encontrar pontuação final (. ? ! \n)
 */
// Helper para limpar texto para busca
function searchNormalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[#*_`]/g, "")
    .trim();
}

/**
 * Encontra a frase completa que contém a âncora.
 * Expande para os lados até encontrar pontuação final (. ? ! \n)
 */
function extractSentenceWithAnchor(
  content: string,
  anchor: string
): string | null {
  // Limpar a âncora de caracteres especiais que o LLM pode ter inserido (ex: #)
  const cleanAnchor = searchNormalize(anchor);
  const contentLower = content.toLowerCase();

  // Tentar encontrar a âncora limpa
  let searchIndex = 0;
  let index = -1;

  while (true) {
    index = contentLower.indexOf(cleanAnchor, searchIndex);
    if (index === -1) {
      // Tentar match ainda mais solto (sem espaços múltiplos) se falhar o exato
      // Mas por enquanto, falhamos.
      return null;
    }

    // VERIFICAÇÃO DE MARKDOWN LINK: [Anchor](url) ou [Anchor]
    // Se a âncora está envelopada por [] e seguida de ( ou é parte de um link
    const prevChar = index > 0 ? content[index - 1] : "";
    const nextChar =
      index + cleanAnchor.length < content.length
        ? content[index + cleanAnchor.length]
        : "";

    // Se estiver dentro de [...], ignorar
    if (prevChar === "[" && (nextChar === "]" || nextChar === "(")) {
      searchIndex = index + 1;
      continue;
    }

    // Se estiver logo após "](", provavelmente é a URL (embora raro a âncora ser a URL)
    if (prevChar === "(" && content.slice(index - 2, index) === "](") {
      searchIndex = index + 1;
      continue;
    }

    // VERIFICAÇÃO DE URL/PATH: Não linkar partes de uma URL (ex: "seo" em ".../o-que-e-seo-...")
    const surroundingText = content.slice(
      Math.max(0, index - 10),
      Math.min(content.length, index + cleanAnchor.length + 10)
    );
    // Se o texto ao redor não tem espaços e tem barras/pontos/hífens, é suspeito
    if (
      !/\s/.test(surroundingText) &&
      (/[\/\.]/.test(surroundingText) || surroundingText.includes("-"))
    ) {
      searchIndex = index + 1;
      continue;
    }

    // Encontrou um candidato válido (não está dentro de link markdown óbvio)
    break;
  }

  // Expandir para trás
  let start = index;
  while (start > 0) {
    const char = content[start - 1];
    if (/[.?!]/.test(char) || char === "\n") {
      break;
    }
    // Proteção contra imagens markdown ou links quebrados: se encontrar "[" ou "]"
    // pode ser indício de metadados, mas vamos confiar na pontuação por enquanto.
    start--;
  }

  // Expandir para frente
  let end = index + cleanAnchor.length;
  while (end < content.length) {
    const char = content[end];
    if (/[.?!]/.test(char) || char === "\n") {
      end++; // incluir a pontuação
      break;
    }
    end++;
  }

  let sentence = content.slice(start, end).trim();

  // Limpeza final: remover artefatos de imagem markdown se a frase parecer ser apenas isso
  // Ex: "![Image 2: ...]"
  if (sentence.startsWith("![") || sentence.startsWith("[Image")) {
    return null; // Frase inválida (é uma descrição de imagem)
  }

  return sentence;
}

function isNaturalSentence(text: string): boolean {
  if (!text) return false;
  if ((text.match(/\|/g) || []).length > 1) return false;
  if ((text.match(/•/g) || []).length > 1) return false;

  // Rejeitar linhas que parecem código ou JSON
  if (/^[\{\[\(]/.test(text.trim())) return false;
  if (/function\s*\(/.test(text)) return false;
  if (/var\s+|const\s+|let\s+/.test(text)) return false;

  // Rejeitar linhas que são apenas números ou datas soltas
  if (/^[\d\/\.\-\:]+$/.test(text.trim())) return false;

  if (text.length < 20) return false;

  // Rejeitar legendas e nomes de arquivo
  if (/^\s*(fig|figure|image|imagem|foto|video|vídeo)\s*\d+/i.test(text))
    return false;
  if (/\.(jpg|png|webp|gif)$/i.test(text.trim())) return false;

  return true;
}

export async function findAnchorOpportunities(
  content: string,
  html: string | undefined,
  targets: {
    url: string;
    clusters: string[];
    theme?: string;
    intencao?: string;
  }[],
  originUrl: string,
  maxInlinks: number = 3
): Promise<AnchorOpportunity[]> {
  const limit = Math.floor(Number(maxInlinks)) || 3;
  console.log(
    `[Anchor Selector] Iniciando para ${originUrl} com ${targets.length} targets. Limit validado: ${limit} links.`
  );

  // O conteúdo já deve vir sanitizado do fluxo anterior (actions.ts ou crawler)
  // Removemos a chamada redundante ao sanitizeContent para economizar tokens e tempo.
  const contentToUse = content;

  // DEBUG DE CONTEÚDO
  console.log(
    `[Anchor Selector] Preview do conteúdo (${
      contentToUse.length
    } chars): "${contentToUse.slice(0, 100).replace(/\n/g, " ")}..."`
  );

  // Usar temperatura 0.3 para equilíbrio entre criatividade e precisão, com modelo GPT-4-turbo (gpt4.1 requested)
  const model = await getLLM(undefined, "gpt-4-turbo", 0.3);
  const structuredLLM = model.withStructuredOutput(anchorSchema);

  const targetsDescription = targets
    .map(
      (t) =>
        `- URL: ${t.url}\n  Tópicos: ${t.clusters.join(", ")}\n  Tema: ${
          t.theme || "N/A"
        }\n  Intenção: ${t.intencao || "N/A"}`
    )
    .join("\n\n");

  // RAG: Buscar partes relevantes no Supabase
  console.log(`[Anchor Selector] Buscando contexto vetorial no Supabase...`);
  let contextToAnalyze = "";

  try {
    const relevantDocs = new Set<string>();

    // 1. Sempre incluir o início do texto (intro) para contexto geral
    const introParams = new RecursiveCharacterTextSplitter({
      chunkSize: 800,
      chunkOverlap: 0,
    });
    const introDocs = await introParams.createDocuments([contentToUse]); // Usa contentToUse
    if (introDocs.length > 0) relevantDocs.add(introDocs[0].pageContent);

    // 2. Buscar chunks relevantes para cada target
    const store = getVectorStore();

    // Limitar a 3 targets para não estourar tokens se houver muitos
    const mainTargets = targets.slice(0, 3);

    for (const t of mainTargets) {
      // Buscar pelo cluster principal ou tema
      const query = t.clusters[0] || t.theme || t.url;
      console.log(`[RAG] Buscando contexto para: "${query}"`);

      // Filtra por URL de origem para não pegar texto de outras páginas
      // Nota: SupabaseVectorStore usa metadata filter
      // IMPORTANTE: Normalizar URL igual ao que foi salvo em actions.ts
      const normalizedOrigin = normalizeUrlForMetadata(originUrl);
      const results = await store.similaritySearch(query, 2, {
        url: normalizedOrigin,
      });

      results.forEach((doc: Document) => {
        if (doc.pageContent.length > 50) {
          // Ignorar pedaços muito pequenos
          relevantDocs.add(doc.pageContent);
        }
      });
    }

    if (relevantDocs.size === 0) {
      console.log(
        "[RAG] Nenhum contexto específico encontrado, usando texto completo (truncado)."
      );
      contextToAnalyze = contentToUse.slice(0, 15000); // Fallback seguro com contentToUse
    } else {
      contextToAnalyze = Array.from(relevantDocs).join("\n\n---\n\n");
      console.log(
        `[RAG] Contexto otimizado gerado: ${relevantDocs.size} blocos.`
      );
    }
  } catch (e) {
    console.warn(`[Anchor Selector] Falha no RAG Vetorial:`, e);
    // Fallback: usar o texto original truncado
    contextToAnalyze = contentToUse.slice(0, 15000);
  }

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `🎯 OBJETIVO
      Atue como um Especialista Sênior em Link Building e SEO Técnico.
      Sua missão é identificar oportunidades precisas para inserção de links internos (Internal Linking) no CONTEÚDO PRINCIPAL.

      🛡️ DIRETRIZES DE SEGURANÇA (ONDE NÃO LINKAR):
      Você deve ignorar completamente áreas que não são corpo de texto editorial.
      ❌ **NÃO SUGIRA LINKS EM**:
      1. **Elementos de Navegação**: Menus, breadcrumbs, rodapés.
      2. **Sidebars e Widgets**: Áreas laterais com "Posts Populares", "Categorias", "Assine".
      3. **Listas de Features/Produtos**: Itens curtos de venda ou bullets de especificações técnicas.
      4. **CTAs e Botões**: "Clique aqui", "Saiba mais", "Comprar".
      5. **Bios de Autor**: Descrições "Sobre o autor".
      6. **Títulos e Subtítulos**: Não insira links em H1, H2, H3 (pode prejudicar a leitura).

      ✅ ONDE SUGERIR LINKS (ZONA SEGURA):
      1. **Parágrafos Narrativos**: Onde o autor explica conceitos, conta histórias ou desenvolve argumentos.
      2. **Listas Explicativas**: Itens de lista longos que detalham um passo ou conceito.
      3. **Contexto Semântico**: Onde a âncora surge naturalmente como parte da frase.

      � CRITÉRIOS DE QUALIDADE:
      1. **Relevância Extrema**: O link deve ser útil para quem está lendo *aquela* frase específica.
      2. **Naturalidade**: A âncora deve ser parte gramatical da frase. Não force termos.
      3. **Tamanho Ideal**: 1 a 5 palavras. Evite linkar frases inteiras.

      ⚠️ REGRAS DE OURO (HARD CONSTRAINTS):
      - **TIPO PERMITIDO**: Apenas "exact" (A palavra/frase já existe no texto).
      - **SEM ALUCINAÇÕES**: O texto da âncora deve existir caractere por caractere no original.
      - **SEM DUPLICIDADE**: Não sugira linkar se já houver um link na mesma frase ou muito próximo.
      - **IDIOMA**: Analise apenas conteúdo em Português.

      FORMATO DE SAÍDA (JSON):
      Retorne um array de oportunidades conforme o schema, focando nas top {maxInlinks} mais relevantes.`,
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

  console.log(`[Anchor Selector] Invocando LLM...`);
  try {
    const result = await chain.invoke({
      content: contextToAnalyze,
      targets: targetsDescription,
      // Pedimos um pouco mais para cobrir possíveis rejeições na validação
      maxInlinks: Math.ceil(maxInlinks * 1.5).toString(),
    });

    console.log(
      `[Anchor Selector] LLM retornou ${result.opportunities.length} oportunidades brutas.`
    );

    const opportunities: AnchorOpportunity[] = [];
    const seenAnchors = new Set<string>();

    // Cheerio validation moved to DOM Validator Agent

    for (const opp of result.opportunities) {
      // Normalizar type para lowercase
      const type = opp.type.toLowerCase();

      // DEDUPLICAÇÃO LOCAL: Evitar mesma âncora para mesmo target na mesma análise
      const uniqueKey = `${opp.anchor.trim().toLowerCase()}|${opp.target_url}`;
      if (seenAnchors.has(uniqueKey)) {
        console.log(
          `[Anchor Selector] Rejeitado (Duplicata Local): ${opp.anchor}`
        );
        continue;
      }

      // FILTRO EXTRA: Rejeitar âncoras que parecem mídia ou arquivos
      if (/\.(jpg|png|webp|gif|pdf)$/i.test(opp.anchor.trim())) {
        console.log(
          `[Anchor Selector] Rejeitado (Arquivo/Imagem): ${opp.anchor}`
        );
        continue;
      }

      // Se for 'exact', aplicamos validações estritas de existência
      if (type === "exact") {
        const wordCount = opp.anchor.trim().split(/\s+/).filter(Boolean).length;
        if (wordCount > 8) continue;

        let finalTrecho = opp.trecho;

        if (!content.toLowerCase().includes(opp.anchor.toLowerCase())) {
          console.log(
            `[Anchor Selector] Rejeitado (Exact não encontrado): ${opp.anchor}`
          );
          continue;
        }

        // Validação Estrita: A frase DEVE ser encontrada no conteúdo via extração
        // Removemos qualquer fallback fuzzy para evitar alucinações.
        const realSentence = extractSentenceWithAnchor(content, opp.anchor);

        if (realSentence) {
          finalTrecho = realSentence;
        } else {
          console.log(
            `[Anchor Selector] Rejeitado (Alucinação/Não encontrado estritamente): ${opp.anchor}`
          );
          continue;
        }

        if (!isNaturalSentence(finalTrecho)) {
          console.log(
            `[Anchor Selector] Rejeitado (Frase não natural): ${finalTrecho}`
          );
          continue;
        }

        // --- NOVA VALIDAÇÃO DE CONTEXTO ---
        // Verifica se a linha original parece ser um item de lista suspeito (Widget/Sidebar)
        // Regra: Se começa com * ou - e tem menos de 10 palavras, e contém palavras "vendedoras" ou é muito curto.
        const originalLine = content.slice(
          Math.max(0, content.indexOf(opp.anchor) - 20),
          content.indexOf(opp.anchor) + opp.anchor.length + 20
        );
        const isListItem =
          /^\s*[\*\-]\s+/.test(originalLine) ||
          /^\s*[\*\-]\s+/.test(opp.trecho);

        if (isListItem) {
          const wordCount = opp.trecho.split(/\s+/).length;
          // Se for lista curta (< 15 palavras) e tiver termos suspeitos, rejeita.
          // Isso pega "Run In-depth SEO technical audits" (6 palavras)
          if (wordCount < 15) {
            console.log(
              `[Anchor Selector] Rejeitado (Suspeita de Widget/Lista Curta): ${opp.trecho}`
            );
            continue;
          }
        }
        // ----------------------------------

        // Validação de títulos movida para DOM Validator

        opp.trecho = finalTrecho;
      } else {
        // Qualquer outro tipo (rewrite/insert) que o LLM alucinar será ignorado
        console.warn(
          `[Anchor Selector] Tipo desconhecido/proibido rejeitado: ${type}`
        );
        continue;
      }

      // 1. Tentar match exato pela URL (prioridade máxima)
      // @ts-ignore - target_url foi adicionado ao schema Zod dinamicamente
      let bestTarget = targets.find((t) => t.url === opp.target_url);

      // 2. Fallback: match por tópico/cluster
      let targetTopicLower = "";
      if (!bestTarget) {
        targetTopicLower = normalizeText(opp.target_topic);
        bestTarget = targets.find((t) => {
          const clusters = t.clusters.map((c) => normalizeText(c));
          const theme = t.theme ? normalizeText(t.theme) : "";
          const url = normalizeText(t.url);

          return (
            url.includes(targetTopicLower) ||
            targetTopicLower.includes(url) ||
            clusters.some(
              (c) =>
                targetTopicLower.includes(c) || c.includes(targetTopicLower)
            ) ||
            (theme && targetTopicLower.includes(theme))
          );
        });
      }

      if (bestTarget) {
        // Validação de Self-Link com normalização
        if (
          normalizeUrlForMetadata(bestTarget.url) ===
          normalizeUrlForMetadata(originUrl)
        ) {
          console.log(
            `[Anchor Selector] Rejeitado (Self-Link detectado): ${bestTarget.url} é igual a origem.`
          );
          // Tentar encontrar outro target se possível (opcional, aqui apenas rejeitamos)
          bestTarget = undefined;
        }
      }

      if (bestTarget) {
        seenAnchors.add(uniqueKey);
        opportunities.push({
          anchor: opp.anchor,
          trecho: opp.trecho,
          origem: originUrl,
          destino: bestTarget.url,
          score: opp.score,
          reason: opp.pillar_context || `Tópico: ${opp.target_topic}`,
          type: "exact",
          original_text: opp.original_text ?? undefined,
          pillar_context: opp.pillar_context ?? undefined,
          target_topic: opp.target_topic,
        });
      } else {
        console.log(
          `[Anchor Selector] Rejeitado (Sem target match): ${opp.target_topic} (Normalizado: ${targetTopicLower})`
        );
        // Logar targets disponíveis (limitado)
        if (targets.length > 0) {
          const available = targets
            .slice(0, 3)
            .map((t) => t.clusters[0])
            .join(", ");
          console.log(`[Anchor Selector] Exemplo de targets: ${available}...`);
        }
      }
    }

    // 4. VERIFICAÇÃO ANTI-ALUCINAÇÃO (HARD CONSTRAINT)
    // O trecho PRECISA existir no conteúdo original.
    const validContentOpps = opportunities.filter((o) => {
      // Normalização simples para ignorar diferenças de quebra de linha/espaços múltiplos
      const normalizeForCheck = (s: string) => s.replace(/\s+/g, " ").trim();
      const cleanContent = normalizeForCheck(content);
      const cleanTrecho = normalizeForCheck(o.trecho);

      // Verificação 1: Existe exatamente (com case sensitive)?
      if (content.includes(o.trecho)) return true;

      // Verificação 2: Existe com normalização de espaços?
      if (cleanContent.includes(cleanTrecho)) return true;

      // Verificação 3: Existe ignorando case (fallback final)?
      if (cleanContent.toLowerCase().includes(cleanTrecho.toLowerCase())) {
        return true;
      }

      console.log(
        `[Anchor Selector] ❌ ALUCINAÇÃO DETECTADA: O trecho sugerido não existe no texto original.\n   Trecho IA: "${o.trecho}"`
      );
      return false;
    });

    if (opportunities.length !== validContentOpps.length) {
      console.log(
        `[Anchor Selector] 🛡️ Anti-Hallucination: ${
          opportunities.length - validContentOpps.length
        } oportunidades removidas por não existirem no texto.`
      );
    }

    // Filtro de Qualidade: Score >= 0.8
    const highQualityOpps = validContentOpps.filter((o) => {
      // FILTRO DE BOILERPLATE: Rejeitar frases conhecidas de rodapé/marketing
      const lowerAnchor = o.anchor.toLowerCase();
      const lowerTrecho = o.trecho.toLowerCase();

      const blockedPhrases = [
        "colocamos seu site no topo",
        "todos os direitos reservados",
        "política de privacidade",
        "termos de uso",
        "fale conosco",
        "mapa do site",
        "seo meta tags", // Exemplo específico citado
        "clique aqui",
        "saiba mais",
        "skip to content",
        "ir para o conteúdo",
        "copyright",
        "all rights reserved",
        "read more",
        "subscribe",
        "inscreva-se",
        "login",
        "entrar",
        "sign up",
        "cadastre-se",
        "follow us",
        "siga-nos",
        "share",
        "compartilhar",
        "posted by",
        "postado por",
        "leave a comment",
        "deixe um comentário",
        "previous post",
        "post anterior",
        "next post",
        "próximo post",
        "you may also like",
        "você também pode gostar",
        "related posts",
        "posts relacionados",
        "ubersuggest",
        "run in-depth",
        "technical audits",
        "case studies",
        "estudos de caso",
        "advertisement",
        "publicidade",
        "sponsored",
        "patrocinado",
      ];

      if (
        blockedPhrases.some(
          (phrase) =>
            lowerAnchor.includes(phrase) || lowerTrecho.includes(phrase)
        )
      ) {
        console.log(
          `[Anchor Selector] Rejeitado (Boilerplate Bloqueado): ${o.anchor}`
        );
        return false;
      }

      return o.score >= 0.8;
    });
    if (opportunities.length !== highQualityOpps.length) {
      console.log(
        `[Anchor Selector] Filtro de Qualidade: ${
          opportunities.length - highQualityOpps.length
        } oportunidades descartadas por score < 0.8.`
      );
    }

    // Ordenar por score (maior para menor) e limitar à quantidade solicitada
    console.log(
      `[Anchor Selector] Aplicando corte final. Max solicitado: ${limit}. Oportunidades Válidas (>=0.8): ${highQualityOpps.length}`
    );
    const finalOpportunities = highQualityOpps
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // --- MULTI-AGENT PIPELINE STEP 3: DOM Validator ---
    // Agora que temos as melhores oportunidades, validamos se elas são seguras no DOM original (HTML)
    if (html) {
      console.log(`[Anchor Selector] 🤖 Acionando Agente Validator DOM...`);
      const validatedOpps = await validateOpportunitiesInDOM(
        finalOpportunities,
        html
      );

      console.log(
        `[Anchor Selector] Finalizado com ${validatedOpps.length} oportunidades validadas (Limit: ${limit}).`
      );
      return validatedOpps;
    } else {
      console.log(
        `[Anchor Selector] Aviso: Sem HTML para validação DOM. Retornando ${finalOpportunities.length} oportunidades (pode conter links inválidos).`
      );
      return finalOpportunities;
    }
  } catch (e) {
    console.error(`[Anchor Selector] Erro crítico na cadeia LLM:`, e);
    return [];
  }
}
