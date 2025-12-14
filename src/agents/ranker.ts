import { AnchorOpportunity } from "@/types";

/**
 * Calcula similaridade semântica simples entre âncora e clusters do destino
 * @param anchor texto da âncora
 * @param clusters lista de tópicos/termos do destino
 * @returns score 0–1
 */
function semanticSimilarity(anchor: string, clusters: string[]): number {
  const a = anchor.toLowerCase();
  const terms = clusters.join(" ").toLowerCase();
  const aTokens = a.split(/[^a-zA-ZÀ-ÿ0-9]+/).filter(Boolean);
  const tTokens = terms.split(/[^a-zA-ZÀ-ÿ0-9]+/).filter(Boolean);
  if (aTokens.length === 0 || tTokens.length === 0) return 0;
  const setT = new Set(tTokens);
  let match = 0;
  for (const tok of aTokens) if (setT.has(tok)) match++;
  return Math.min(1, match / aTokens.length);
}

/**
 * Jaccard entre tokens do trecho e tokens de clusters
 * @param snippet trecho textual
 * @param clusters clusters do destino
 * @returns score 0–1
 */
function jaccard(snippet: string, clusters: string[]): number {
  const sTokens = snippet
    .toLowerCase()
    .split(/[^a-zA-ZÀ-ÿ0-9]+/)
    .filter(Boolean);
  const cTokens = clusters
    .join(" ")
    .toLowerCase()
    .split(/[^a-zA-ZÀ-ÿ0-9]+/)
    .filter(Boolean);
  const setS = new Set(sTokens);
  const setC = new Set(cTokens);
  const inter = [...setS].filter((x) => setC.has(x)).length;
  const union = new Set([...setS, ...setC]).size;
  if (union === 0) return 0;
  return inter / union;
}

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
    const clusters = clusterByUrl.get(a.destino) || [];
    const sem = semanticSimilarity(a.anchor, clusters);
    const jac = jaccard(a.trecho, clusters);
    const ed = Math.max(0, Math.min(1, editorialWeights?.[a.destino] ?? 0.5));
    const qual = snippetQuality(a.trecho);
    const final = 0.5 * sem + 0.2 * jac + 0.2 * ed + 0.1 * qual;
    return { ...a, score: final };
  });

  return ranked.sort((a, b) => b.score - a.score);
}
