"use server";

import { extractContent } from "@/agents/crawler";
import { analyzeContent } from "@/chains/analyze_chain";
import { sanitizeContent } from "@/agents/content_sanitizer";
import { findAnchorOpportunities } from "@/agents/anchor_selector";
import { getVectorStore } from "@/core/vector-store";
import { normalizeUrlForMetadata } from "@/utils/url-normalizer";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "@langchain/core/documents";
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
    return {
      extracted: {
        url: url || "",
        title: "Erro de Configuração",
        content: "",
        rawHtml: "",
      },
      analysis: {
        intencao: "Erro",
        funil: "N/A",
        clusters: [],
        entidades: [],
        theme: "Erro",
      },
    };
  }

  // Validar formato da URL
  try {
    const urlObj = new URL(url);
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      throw new Error("Protocolo inválido");
    }
  } catch {
    return null;
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

  // 1.1 Sanitização Inteligente (LLM)
  // Remove menus, rodapés e sidebars para melhorar a qualidade da análise e dos vetores
  try {
    const sanitized = await sanitizeContent(extracted.content);
    if (sanitized && sanitized.length > 0) {
      // Atualiza o conteúdo extraído com a versão limpa
      extracted.content = sanitized;
    }
  } catch (err) {
    console.error(
      "⚠️ [Sanitizer] Falha na sanitização, mantendo texto original:",
      err
    );
  }

  // 1.5. Salvar no Banco Vetorial (RAG Anti-Alucinação)
  try {
    // Normalizar URL para garantir consistência no banco e na busca
    const normalizedUrl = normalizeUrlForMetadata(extracted.url);
    extracted.url = normalizedUrl; // Atualiza para o restante do fluxo

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 2000,
      chunkOverlap: 200,
    });
    const docs = await splitter.createDocuments(
      [extracted.content],
      [{ url: normalizedUrl, title: extracted.title }]
    );

    // Adiciona ao Supabase (fire and forget para não travar a UI, ou await rápido)
    // Vamos usar await para garantir que está lá antes da análise de anchors
    await getVectorStore().addDocuments(docs);
    console.log(`✅ [Vector Store] ${docs.length} chunks salvos para ${url}`);
  } catch (err) {
    console.error("⚠️ [Vector Store] Falha ao salvar embeddings:", err);
    // Não abortamos o processo, apenas logamos o erro
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

      const denominator = Math.max(currentClusters.size, otherClusters.size);
      const similarity = denominator > 0 ? matchCount / denominator : 0;

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
  targets: {
    url: string;
    clusters: string[];
    theme?: string;
    intencao?: string;
  }[],
  maxInlinks: number = 3,
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
