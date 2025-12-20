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
  // Otimização de Custo: Usa gpt-4o-mini por padrão se nenhum for especificado
  // Esse modelo é 10x+ mais barato e suficiente para classificação/extração
  const llm = await getLLM(undefined, modelName || "gpt-4o-mini");

  // Usar withStructuredOutput para garantir o JSON
  const structuredLLM = llm.withStructuredOutput(analysisSchema);

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `Você é um Especialista Sênior em Estratégia de SEO e Análise Semântica.
      
      🎯 OBJETIVO:
      Analise profundamente o conteúdo fornecido para extrair metadados estratégicos que guiarão a linkagem interna.
      
      📋 DEFINIÇÕES PARA EXTRAÇÃO:

      1. **CLUSTERS (Tópicos Principais)**:
         - Identifique de 3 a 5 grandes temas ou categorias semânticas que este conteúdo cobre.
         - Exemplo: Para um artigo sobre "Tênis de Corrida", clusters seriam ["Calçados Esportivos", "Corrida de Rua", "Reviews de Produtos"].
         - NÃO use palavras-chave de cauda longa aqui, use categorias amplas.

      2. **INTENÇÃO DE BUSCA (User Intent)**:
         - Classifique estritamente em uma das categorias:
           * **Informacional**: O usuário quer aprender algo ou tirar uma dúvida.
           * **Transacional**: O usuário quer comprar ou realizar uma ação imediata.
           * **Comercial**: O usuário está comparando opções antes de comprar (Reviews, Melhores X).
           * **Navegacional**: O usuário quer encontrar uma página específica.

      3. **FUNIL DE VENDAS**:
         - Classifique o estágio da jornada do cliente:
           * **Topo (ToFu)**: Consciência/Aprendizado. Problemas amplos, definições básicas.
           * **Meio (MoFu)**: Consideração. Comparativos, aprofundamento técnico, solução de problemas específicos.
           * **Fundo (BoFu)**: Decisão. Ofertas, cases de sucesso, foco no produto/serviço.

      4. **ENTIDADES**:
         - Liste nomes próprios relevantes: Pessoas, Empresas, Ferramentas, Tecnologias, Locais.
         - Ignore termos genéricos.

      5. **TEMA**:
         - Uma frase concisa que resume "Sobre o que é esta página?".

      Saída deve ser estritamente o JSON solicitado.`,
    ],
    ["user", "Título: {title}\n\nConteúdo:\n{content}"],
  ]);

  const chain = prompt.pipe(structuredLLM);

  return await chain.invoke({
    title,
    content: content.substring(0, 15000), // Limitar caracteres para não estourar contexto
  });
}
