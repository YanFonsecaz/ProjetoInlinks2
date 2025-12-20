import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { OpenAIEmbeddings } from "@langchain/openai";
import { supabase } from "@/lib/supabase";

// Configuração dos Embeddings
// text-embedding-3-small é excelente (custo/benefício).
// Mantemos dimensions default (1536) para compatibilidade máxima.
const embeddings = new OpenAIEmbeddings({
  modelName: "text-embedding-3-small",
  openAIApiKey: process.env.OPENAI_API_KEY,
  dimensions: 1536, // Explicitar dimensão para garantir consistência
});

/**
 * Retorna uma instância do Vector Store conectado ao Supabase
 */
export function getVectorStore() {
  return new SupabaseVectorStore(embeddings, {
    client: supabase,
    tableName: "documents",
    queryName: "match_documents",
  });
}

/**
 * Busca documentos similares no banco com filtro de qualidade e metadados
 * @param query O texto para buscar
 * @param k Número máximo de resultados
 * @param filter Filtro de metadados do Supabase (ex: { url: '...' })
 * @param threshold Score mínimo de similaridade (0.0 a 1.0). Default 0.7 para evitar ruído.
 */
export async function searchSimilarDocuments(
  query: string,
  k = 4,
  filter?: Record<string, any>,
  threshold = 0.75 // Aumentei um pouco a régua para garantir relevância
) {
  const store = getVectorStore();

  try {
    // Busca com score para podermos filtrar o "lixo"
    const resultsWithScore = await store.similaritySearchWithScore(
      query,
      k,
      filter
    );

    // Filtra resultados abaixo do threshold
    const highQualityResults = resultsWithScore
      .filter(([_, score]) => score >= threshold)
      .map(([doc, _]) => doc);

    if (highQualityResults.length < resultsWithScore.length) {
      console.log(
        `[Vector Store] Filtrados ${
          resultsWithScore.length - highQualityResults.length
        } resultados com score < ${threshold}`
      );
    }

    return highQualityResults;
  } catch (error) {
    console.error(`[Vector Store] Erro ao buscar documentos:`, error);
    return []; // Retorna vazio em vez de quebrar a aplicação
  }
}
