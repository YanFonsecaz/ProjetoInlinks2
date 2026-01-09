/**
 * Chain LangChain para resumo de tendências e notícias
 * Conversão do _summarize_with_llm (Python) para TypeScript
 */

import { getLLM } from "@/core/llm";
import { NewsResult } from "./types";

/**
 * Gera um resumo em português usando LangChain/OpenAI
 *
 * @param sector - Setor analisado (ex: "Autos")
 * @param trendsAndNews - Lista de resultados de notícias por keyword
 * @returns Resumo gerado pelo LLM
 */
export async function summarizeTrends(
  sector: string,
  trendsAndNews: NewsResult[]
): Promise<string> {
  try {
    const llm = await getLLM(undefined, undefined, 0.2);

    // Monta lista de fontes em bullet points
    const bullets: string[] = [];
    for (const item of trendsAndNews) {
      if (!item.keyword) continue;
      bullets.push(`- Palavra-chave: ${item.keyword}`);
      for (const article of item.articles.slice(0, 3)) {
        bullets.push(
          `  - ${article.title} (${article.source}) — ${article.link}`
        );
      }
    }

    const systemPrompt =
      "Você é um assistente que escreve em português do Brasil.";

    const userPrompt = `Você é um analista de inteligência de mercado em português. 
Com base nas palavras-chave e notícias coletadas para o setor '${sector}', 
elabore um resumo breve (5–10 linhas) destacando tendências relevantes, riscos e oportunidades. 
Use um tom claro e objetivo. Em seguida, liste as fontes em bullet points.

Fontes coletadas:
${bullets.join("\n")}`;

    const response = await llm.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    // Extrai conteúdo da resposta
    const content =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);

    return content || "Resumo não disponível.";
  } catch (error) {
    console.error("[Trends Summarizer] Erro ao gerar resumo:", error);
    return "Resumo não disponível: erro ao processar com LLM.";
  }
}

/**
 * Gera um resumo curto para um artigo específico
 * @param content Conteúdo extraído do artigo
 */
export async function summarizeArticle(content: string): Promise<string> {
  try {
    // Usa modelo mini para ser mais rápido e barato em volume
    const llm = await getLLM(undefined, "gpt-4o-mini", 0.1);

    // Trunca conteúdo muito longo para economizar tokens
    const truncated = content.slice(0, 4000);

    const response = await llm.invoke([
      {
        role: "system",
        content:
          "Você é um assistente que resume notícias em português do Brasil.",
      },
      {
        role: "user",
        content: `Resuma o texto abaixo em 1 ou 2 frases curtas e objetivas, focando apenas no fato principal da notícia.\n\nTexto:\n${truncated}`,
      },
    ]);

    const summary =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);

    return summary.trim();
  } catch (error) {
    console.warn("[Summarizer] Falha ao resumir artigo:", error);
    return "";
  }
}

/**
 * Valida se um termo de tendência é semanticamente relevante para a categoria
 * @param trend Termo da tendência (ex: "Lava e Seca")
 * @param category Categoria alvo (ex: "Inteligência Artificial")
 */
export async function validateTrendRelevance(
  trend: string,
  category: string
): Promise<boolean> {
  try {
    const llm = await getLLM(undefined, "gpt-4o-mini", 0.0);

    const response = await llm.invoke([
      {
        role: "system",
        content: "Você é um classificador de tópicos rigoroso.",
      },
      {
        role: "user",
        content: `O termo de pesquisa "${trend}" é semanticamente relevante e diretamente relacionado ao setor/categoria "${category}"?
      
Responda APENAS com "SIM" ou "NAO".
Exemplos:
- Trend: "ChatGPT", Categoria: "Inteligência Artificial" -> SIM
- Trend: "Lava e Seca", Categoria: "Inteligência Artificial" -> NAO
- Trend: "iPhone 15", Categoria: "Carros" -> NAO`,
      },
    ]);

    const content =
      typeof response.content === "string"
        ? response.content.trim().toUpperCase()
        : "";

    return content.includes("SIM");
  } catch (error) {
    console.warn(`[Summarizer] Erro ao validar tendência "${trend}":`, error);
    // Em caso de erro, assumimos falso para evitar lixo, ou true se preferir permissivo.
    // Melhor false para garantir qualidade.
    return false;
  }
}
