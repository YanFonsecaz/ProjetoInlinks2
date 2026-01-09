/**
 * Cliente compartilhado para SerpAPI
 */

export async function fetchSerpApi(
  params: Record<string, string>
): Promise<any> {
  const apiKey = process.env.SERPAPI_API_KEY || process.env.SERP_API_KEY;
  if (!apiKey) {
    throw new Error("SERPAPI_API_KEY não configurada no ambiente.");
  }

  const searchParams = new URLSearchParams({ ...params, api_key: apiKey });
  const response = await fetch(
    `https://serpapi.com/search?${searchParams.toString()}`
  );

  if (!response.ok) {
    throw new Error(`SerpAPI error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
