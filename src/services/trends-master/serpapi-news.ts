/**
 * Serviço de busca de notícias via SerpAPI (Google News)
 * Conversão do SERPNewsTool (Python) para TypeScript
 */

import { fetchSerpApi } from "./serpapi-client";
import { NewsResult, NewsArticle, TrendsPeriod } from "./types";
import { extractContent } from "@/agents/crawler";
import { summarizeArticle } from "./trends-summarizer";

// Interface para resposta da SerpAPI News
interface SerpApiNewsResponse {
  news_results?: Array<{
    title?: string;
    link?: string;
    source?: string | { name?: string };
    date?: string;
    snippet?: string;
  }>;
}

/**
 * Mapeia período para parâmetro "when" da SerpAPI News
 */
function getPeriodWhenParam(periodo: TrendsPeriod): string {
  switch (periodo) {
    case "diario":
      return "1d";
    case "semanal":
      return "7d";
    case "mensal":
      return "1m";
    default:
      return "1m";
  }
}

/**
 * Aguarda um tempo antes de continuar (para rate limiting)
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Faz requisição à SerpAPI com retry e backoff
 */
async function fetchSerpApiWithRetry(
  params: Record<string, string>,
  maxRetries: number = 3
): Promise<SerpApiNewsResponse> {
  const apiKey = process.env.SERPAPI_API_KEY || process.env.SERP_API_KEY;
  if (!apiKey) {
    throw new Error("SERPAPI_API_KEY não configurada no ambiente.");
  }

  const searchParams = new URLSearchParams({ ...params, api_key: apiKey });
  const url = `https://serpapi.com/search?${searchParams.toString()}`;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `SerpAPI error: ${response.status} ${response.statusText}`
        );
      }

      return response.json();
    } catch (error) {
      if (attempt < maxRetries - 1) {
        // Backoff exponencial: 1.5s, 3s, 4.5s...
        await sleep(1500 * (attempt + 1));
        continue;
      }
      throw error;
    }
  }

  return {};
}

/**
 * Busca notícias para uma palavra-chave específica
 */
async function fetchNewsForKeyword(
  keyword: string,
  maxArticles: number,
  periodo: TrendsPeriod
): Promise<NewsArticle[]> {
  const data = await fetchSerpApiWithRetry({
    engine: "google_news",
    q: keyword,
    num: String(maxArticles),
    sort_by: "date",
    gl: "br",
    hl: "pt-BR",
    when: getPeriodWhenParam(periodo),
  });

  // Mapeia para nosso formato
  const articles: NewsArticle[] = [];

  // Processa artigos em paralelo para ser mais rápido
  const processPromises = (data.news_results || [])
    .slice(0, maxArticles)
    .map(async (item: any) => {
      let finalSnippet = item.snippet || "";

      // Se tiver link, tenta extrair conteúdo e gerar resumo via IA
      if (item.link) {
        try {
          // Timeout curto para não travar o processo (5s)
          const extraction = (await Promise.race([
            extractContent(item.link),
            new Promise<null>((resolve) =>
              setTimeout(() => resolve(null), 8000)
            ),
          ])) as any;

          if (
            extraction &&
            extraction.content &&
            extraction.content.length > 200
          ) {
            const aiSummary = await summarizeArticle(extraction.content);
            if (aiSummary) {
              finalSnippet = aiSummary;
            }
          }
        } catch (err) {
          console.warn(
            `[News] Falha ao resumir ${item.link}, usando snippet padrão.`
          );
        }
      }

      return {
        title: item.title,
        link: item.link,
        source:
          typeof item.source === "string"
            ? item.source
            : item.source?.name || "Google News",
        date: item.date || new Date().toISOString(),
        snippet: finalSnippet,
        thumbnail: item.thumbnail,
      };
    });

  const processedArticles = await Promise.all(processPromises);
  articles.push(...processedArticles);

  return articles;
}

/**
 * Busca notícias do Google News para uma lista de palavras-chave
 *
 * @param keywords - Lista de palavras-chave para buscar
 * @param maxArticles - Número máximo de artigos por palavra-chave
 * @param periodo - Período de busca: diario (1d), semanal (7d), mensal (1m)
 * @returns Lista de resultados por palavra-chave
 */
export async function fetchNews(
  keywords: string[],
  maxArticles: number = 3,
  periodo: TrendsPeriod = "mensal"
): Promise<NewsResult[]> {
  const results: NewsResult[] = [];

  for (const keyword of keywords) {
    try {
      const articles = await fetchNewsForKeyword(keyword, maxArticles, periodo);
      results.push({ keyword, articles });
    } catch (error) {
      console.error(
        `[SerpAPI News] Erro ao buscar notícias para "${keyword}":`,
        error
      );
      // Continua com próxima keyword mesmo se falhar
      results.push({ keyword, articles: [] });
    }
  }

  return results;
}

/**
 * Busca notícias para um termo específico (usado para seções especiais como "Usados")
 *
 * @param term - Termo de busca
 * @param maxArticles - Número máximo de artigos
 * @param periodo - Período de busca
 * @returns Resultado de notícias para o termo
 */
export async function fetchNewsForTerm(
  term: string,
  maxArticles: number = 5,
  periodo: TrendsPeriod = "mensal"
): Promise<NewsResult> {
  try {
    const articles = await fetchNewsForKeyword(term, maxArticles, periodo);
    return { keyword: term, articles };
  } catch (error) {
    console.error(
      `[SerpAPI News] Erro ao buscar notícias para "${term}":`,
      error
    );
    return { keyword: term, articles: [] };
  }
}
