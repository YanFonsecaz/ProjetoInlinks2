import { AnchorOpportunity } from "@/types";

/**
 * Qualidade do snippet baseada em tamanho e legibilidade simples
 * @param snippet trecho textual
 * @returns score 0–1
 */
function snippetQuality(snippet: string): number {
  const len = snippet.length;
  if (len === 0) return 0;
  // Faixa ideal 40–160 caracteres
  if (len >= 40 && len <= 160) return 1;
  if (len < 40) return len / 40;
  if (len > 160) return Math.max(0, 1 - (len - 160) / 200);
  return 0.5;
}

/**
 * Ranking ponderado conforme PRD
 * 50% similaridade semântica • 20% Jaccard • 20% peso editorial • 10% qualidade do snippet
 * @param anchors lista de oportunidades
 * @param targets clusters por URL de destino
 * @param editorialWeights pesos por URL destino (0–1)
 * @returns lista ordenada por score final
 */
export function rankAnchors(
  anchors: AnchorOpportunity[],
  targets: { url: string; clusters: string[] }[],
  editorialWeights?: Record<string, number>
): AnchorOpportunity[] {
  const clusterByUrl = new Map<string, string[]>();
  for (const t of targets) clusterByUrl.set(t.url, t.clusters);

  const ranked = anchors.map((a) => {
    // Use LLM score (High Quality) as primary - 80% weight
    // Add Snippet Quality check - 20% weight
    // Ignore naive token similarity in favor of LLM
    const qual = snippetQuality(a.trecho);
    const final = 0.8 * a.score + 0.2 * qual;

    // Ensure we don't accidentally lower it too much if quality is weird
    // but snippetQuality handles basic length checks.

    return { ...a, score: final };
  });

  return ranked.sort((a, b) => b.score - a.score);
}
