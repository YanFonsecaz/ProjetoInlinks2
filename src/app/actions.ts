"use server";

import { extractContent } from "@/agents/crawler";
import { analyzeContent } from "@/chains/analyze_chain";
import { findAnchorOpportunities } from "@/agents/anchor_selector";
import {
  ProcessResult,
  ContentAnalysis,
  ExtractedContent,
  AnchorOpportunity,
} from "@/types";

// Passo 1: Extrair e Analisar
export async function processUrlAnalysis(
  url: string
): Promise<{ extracted: ExtractedContent; analysis: ContentAnalysis } | null> {
  if (!url) return null;

  // Validar se API Key existe
  if (!process.env.OPENAI_API_KEY) {
    console.error("ERRO CRÍTICO: OPENAI_API_KEY não configurada no ambiente.");
    // Não retornar erro para o front com detalhes, apenas logar no server
  }

  // 1. Extração
  const extracted = await extractContent(url);
  if (!extracted.content) {
    return {
      extracted,
      analysis: {
        intencao: "Erro",
        funil: "N/A",
        clusters: [],
        entidades: [],
      },
    };
  }

  // 2. Análise
  try {
    const analysis = await analyzeContent(extracted.content, extracted.title);
    return { extracted, analysis };
  } catch (e) {
    console.error("Erro na análise:", e);
    return {
      extracted,
      analysis: {
        intencao: "Erro ao analisar",
        funil: "N/A",
        clusters: [],
        entidades: [],
      },
    };
  }
}

export async function detectCannibalization(
  data: { url: string; analysis: ContentAnalysis }[]
): Promise<
  { url: string; cannibalization: { score: number; competidores: string[] } }[]
> {
  const results = [];

  for (let i = 0; i < data.length; i++) {
    const current = data[i];
    const competitors: string[] = [];
    let maxScore = 0;

    for (let j = 0; j < data.length; j++) {
      if (i === j) continue;
      const other = data[j];

      // Lógica de similaridade simples (interseção de clusters)
      const currentClusters = new Set(
        current.analysis.clusters.map((c) => c.toLowerCase())
      );
      const otherClusters = new Set(
        other.analysis.clusters.map((c) => c.toLowerCase())
      );

      let matchCount = 0;
      currentClusters.forEach((c) => {
        if (otherClusters.has(c)) matchCount++;
      });

      const similarity =
        matchCount / Math.max(currentClusters.size, otherClusters.size);

      // Se a similaridade for alta (> 0.5) ou intenção for a mesma com alguma similaridade
      if (
        similarity > 0.5 ||
        (current.analysis.intencao === other.analysis.intencao &&
          similarity > 0.3)
      ) {
        competitors.push(other.url);
        if (similarity > maxScore) maxScore = similarity;
      }
    }

    if (competitors.length > 0) {
      results.push({
        url: current.url,
        cannibalization: {
          score: maxScore,
          competidores: competitors,
        },
      });
    }
  }

  return results;
}

// Passo 2: Encontrar Âncoras (para uma URL, dado os targets)
export async function processUrlAnchors(
  currentUrl: string,
  content: string,
  targets: { url: string; clusters: string[]; theme?: string; intencao?: string }[],
  maxInlinks: number = 5,
  html?: string
): Promise<AnchorOpportunity[]> {
  try {
    return await findAnchorOpportunities(
      content,
      html,
      targets,
      currentUrl,
      maxInlinks
    );
  } catch (e) {
    console.error("Erro ao buscar âncoras:", e);
    return [];
  }
}
