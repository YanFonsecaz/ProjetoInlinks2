import { ContentAnalysis } from "@/types";

/**
 * Constrói mapa de clusters e decide páginas pilar vs satélite
 * @param data lista com URL e análise (clusters/intenção)
 * @returns mapeamento de pilares e satélites
 */
export function buildClusterMap(
  data: { url: string; analysis: ContentAnalysis }[]
): {
  pillars: string[];
  satellites: Record<string, string[]>;
  clusterIndex: Record<string, string[]>;
} {
  const clusterCountByUrl = new Map<string, number>();
  const uniqueClusters = new Set<string>();

  for (const item of data) {
    const count = item.analysis.clusters.length;
    clusterCountByUrl.set(item.url, count);
    item.analysis.clusters.forEach((c) => uniqueClusters.add(c.toLowerCase()));
  }

  // Seleciona até 2 pilares: maiores coberturas de clusters
  const sorted = [...clusterCountByUrl.entries()].sort((a, b) => b[1] - a[1]);
  const pillars = sorted.slice(0, Math.min(2, sorted.length)).map((x) => x[0]);

  const satellites: Record<string, string[]> = {};
  for (const p of pillars) satellites[p] = [];

  // Atribui demais páginas ao pilar com maior interseção de clusters
  for (const item of data) {
    if (pillars.includes(item.url)) continue;
    let bestPillar = pillars[0];
    let bestScore = -1;
    for (const p of pillars) {
      const pillarClusters = data.find((d) => d.url === p)?.analysis.clusters || [];
      const s = intersectionSize(
        pillarClusters.map((c) => c.toLowerCase()),
        item.analysis.clusters.map((c) => c.toLowerCase())
      );
      if (s > bestScore) {
        bestScore = s;
        bestPillar = p;
      }
    }
    satellites[bestPillar].push(item.url);
  }

  const clusterIndex: Record<string, string[]> = {};
  for (const c of uniqueClusters) {
    clusterIndex[c] = data
      .filter((d) => d.analysis.clusters.map((x) => x.toLowerCase()).includes(c))
      .map((d) => d.url);
  }

  return { pillars, satellites, clusterIndex };
}

function intersectionSize(a: string[], b: string[]): number {
  const setB = new Set(b);
  let n = 0;
  for (const x of a) if (setB.has(x)) n++;
  return n;
}
