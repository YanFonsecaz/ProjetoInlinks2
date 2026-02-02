/**
 * Serviço de coleta de tendências do Google Trends via SerpAPI
 * Conversão do SERPTrendsTool (Python) para TypeScript
 */

import { fetchSerpApi } from "./serpapi-client";
import { TrendItem, TrendsPeriod } from "./types";
import { validateTrendRelevance } from "./trends-summarizer";

// Interface para resposta da SerpAPI

/**
 * Mapeia período para parâmetro de data da SerpAPI
 */
function getPeriodDateParam(periodo: TrendsPeriod): string {
  switch (periodo) {
    case "diario":
      return "now 1-d";
    case "semanal":
      return "now 7-d";
    case "mensal":
      return "now 30-d";
    default:
      return "now 30-d";
  }
}

/**
 * Faz requisição à SerpAPI
 */
// fetchSerpApi importada de serpapi-client.ts

/**
 * Coleta Trending Now (diário) com filtro por categoria
 */
async function collectTrendingNow(
  category: string,
  topN: number
): Promise<TrendItem[]> {
  const data = await fetchSerpApi({
    engine: "google_trends_trending_now",
    geo: "BR",
    hl: "pt",
  });

  const results: TrendItem[] = [];
  const trendingSearches = data.trending_searches || [];

  // Filtra por termos da categoria (Lógica mais rigorosa + IA)
  const normalizedCat = category.toLowerCase().trim();
  const catTerms = normalizedCat.split(" ").filter((w) => w.length > 2);

  // 1. Pré-filtro: Aceita qualquer coisa que tenha pelo menos UMA palavra da categoria
  const candidates = trendingSearches.filter((s: { query: string }) => {
    const query = (s.query || "").toLowerCase();
    return catTerms.some((term) => query.includes(term));
  });

  // 2. Validação Semântica via IA (Paralela)
  const validatedPromises = candidates
    .slice(0, 15)
    .map(async (item: { query: string; search_volume?: number }) => {
      const isValid = await validateTrendRelevance(item.query, category);
      return isValid ? item : null;
    });

  const validatedItems = (await Promise.all(validatedPromises)).filter(
    (i) => i !== null
  ) as any[];

  // Se a IA não retornou nada (ou falhou), tenta o filtro de string rigoroso como fallback
  const finalItems =
    validatedItems.length > 0
      ? validatedItems
      : trendingSearches.filter((s: { query: string }) => {
          const query = (s.query || "").toLowerCase();
          if (catTerms.length > 1)
            return catTerms.every((term) => query.includes(term));
          return query.includes(normalizedCat);
        });

  for (const item of finalItems.slice(0, topN)) {
    results.push({
      keyword: item.query,
      type: "top",
      score: item.search_volume?.toString(),
    });
  }

  return results;
}

/**
 * Coleta Related Queries do Google Trends
 */
async function collectRelatedQueries(
  baseQuery: string,
  periodo: TrendsPeriod,
  topN: number,
  risingN: number,
  seen: Set<string>
): Promise<TrendItem[]> {
  const results: TrendItem[] = [];

  const data = await fetchSerpApi({
    engine: "google_trends",
    data_type: "RELATED_QUERIES",
    q: baseQuery,
    hl: "pt",
    geo: "BR",
    date: getPeriodDateParam(periodo),
  });

  if (data.search_metadata?.status !== "Success") {
    return results;
  }

  const related = data.related_queries || {};

  // Coleta Top queries
  for (const item of (related.top || []).slice(0, topN)) {
    const query = item.query;
    if (!query || seen.has(query)) continue;
    seen.add(query);
    results.push({
      keyword: query,
      type: "top",
      score: item.extracted_value || item.value,
    });
  }

  // Coleta Rising queries
  for (const item of (related.rising || []).slice(0, risingN)) {
    const query = item.query;
    if (!query || seen.has(query)) continue;
    seen.add(query);
    results.push({
      keyword: query,
      type: "rising",
      score: item.extracted_value || item.value,
    });
  }

  return results;
}

/**
 * Coleta tendências do Google Trends via SerpAPI
 *
 * @param category - Categoria/setor para busca
 * @param periodo - Período de análise: diario, semanal, mensal
 * @param topN - Número máximo de tendências Top
 * @param risingN - Número máximo de tendências Rising
 * @returns Lista de tendências coletadas
 */
export async function collectTrends(
  category: string,
  periodo: TrendsPeriod = "mensal",
  topN: number = 10,
  risingN: number = 10,
  customTopics: string[] = []
): Promise<TrendItem[]> {
  const results: TrendItem[] = [];
  const seen = new Set<string>();

  try {
    // 1. Define queries base para Related Queries
    let baseQueries: string[] = [];

    if (customTopics && customTopics.length > 0) {
      // Se houver tópicos personalizados, eles têm prioridade total
      baseQueries = customTopics;
    } else {
      // Usa o próprio nome da categoria
      baseQueries = [category];

      // Adiciona variações genéricas para dar contexto
      const normalized = category.toLowerCase().trim();
      if (!normalized.includes("brasil") && !normalized.includes("mercado")) {
        baseQueries.push(`${category} brasil`);
      }
    }

    // 2. Tenta Trending Now (apenas se NÃO tiver tópicos personalizados)
    if (periodo === "diario" && (!customTopics || customTopics.length === 0)) {
      const trendingNow = await collectTrendingNow(category, topN * 2);

      if (trendingNow.length > 0) {
        results.push(...trendingNow.slice(0, topN));
      }
    }

    // 3. Coleta related queries (para cada base query)
    for (const query of baseQueries) {
      const queryResults = await collectRelatedQueries(
        query,
        periodo,
        topN,
        risingN,
        seen
      );
      results.push(...queryResults);

      // Se já temos muito resultados, paramos.
      if (results.length >= (topN + risingN) * 2) break;
    }

    // 4. Fallback: Se não retornou nada específico e NÃO são tópicos personalizados
    if (results.length === 0 && (!customTopics || customTopics.length === 0)) {
      console.log(`[Trends] Nenhum resultado específico para "${category}".`);
    }

    // Se tiver tópicos personalizados e não achou "trends" (related queries),
    // pelo menos retorna os próprios tópicos como "trends" para buscar notícias deles depois.
    if (results.length === 0 && customTopics && customTopics.length > 0) {
      for (const topic of customTopics) {
        results.push({ keyword: topic, type: "top" });
      }
    }
  } catch (error) {
    console.error("[SerpAPI Trends] Erro na coleta:", error);
    // Fallback para custom topics em caso de erro
    if (customTopics && customTopics.length > 0)
      return customTopics.map((t) => ({ keyword: t, type: "top" }));
    return [];
  }

  return results;
}
