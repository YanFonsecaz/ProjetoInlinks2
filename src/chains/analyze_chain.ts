import { z } from "zod";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { getLLM } from "@/core/llm";

const analysisSchema = z.object({
  theme: z.string().describe("O tema principal da página em uma frase curta"),
  intencao: z
    .string()
    .describe(
      "A intenção de busca do usuário (ex: Informacional, Transacional, Navegacional)"
    ),
  funil: z
    .string()
    .describe("O estágio do funil de vendas (ex: Topo, Meio, Fundo)"),
  clusters: z
    .array(z.string())
    .describe("Lista de clusters semânticos ou tópicos principais abordados"),
  entidades: z
    .array(z.string())
    .describe(
      "Lista de entidades importantes mencionadas (pessoas, empresas, tecnologias, conceitos)"
    ),
});

/**
 * Analisa conteúdo e retorna estrutura padronizada (intenção, funil, clusters, entidades)
 * @param content texto limpo da página
 * @param title título da página
 * @param modelName modelo opcional
 * @returns JSON estruturado conforme `analysisSchema`
 */
export async function analyzeContent(
  content: string,
  title: string,
  modelName?: string
) {
  const llm = await getLLM(undefined, modelName);

  // Usar withStructuredOutput para garantir o JSON
  const structuredLLM = llm.withStructuredOutput(analysisSchema);

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      "Você é um especialista em SEO e análise de conteúdo. Analise o texto fornecido e extraia as informações solicitadas em JSON, incluindo o tema principal.",
    ],
    ["user", "Título: {title}\n\nConteúdo:\n{content}"],
  ]);

  const chain = prompt.pipe(structuredLLM);

  return await chain.invoke({
    title,
    content: content.substring(0, 15000), // Limitar caracteres para não estourar contexto
  });
}
