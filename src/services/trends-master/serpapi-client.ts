import { withRetry } from "@/utils/resilience";

// Cache simples em memória (TTL de 1 hora)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hora

/**
 * Cliente compartilhado para SerpAPI com Retry, Backoff Exponencial e Cache
 */
export async function fetchSerpApi(
  params: Record<string, string>,
): Promise<any> {
  const apiKey = process.env.SERPAPI_API_KEY || process.env.SERP_API_KEY;
  if (!apiKey) {
    throw new Error("SERPAPI_API_KEY não configurada no ambiente.");
  }

  const searchParams = new URLSearchParams({ ...params, api_key: apiKey });
  const cacheKey = searchParams.toString();
  const now = Date.now();

  // Verificar Cache
  const cached = cache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    console.log(`[SerpAPI Cache] Hit para: ${params.q || params.engine}`);
    return cached.data;
  }

  const url = `https://serpapi.com/search?${searchParams.toString()}`;
  console.log(
    `[SerpAPI] Calling: ${url.replace(/api_key=[^&]+/, "api_key=HIDDEN")}`,
  );

  const data = await withRetry(
    async () => {
      const response = await fetch(url);

      if (!response.ok) {
        const error: any = new Error(
          `SerpAPI error: ${response.status} ${response.statusText}`,
        );
        error.status = response.status;
        throw error;
      }

      return response.json();
    },
    {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 8000,
    },
  );

  // Salvar no Cache
  cache.set(cacheKey, { data, timestamp: now });

  // Limpeza periódica do cache (se crescer muito)
  if (cache.size > 200) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }

  return data;
}
