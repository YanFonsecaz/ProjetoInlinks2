/**
 * Cria e retorna uma instância do ChatOpenAI de forma dinâmica e segura
 * @param apiKey chave opcional (usa `process.env.OPENAI_API_KEY` por padrão)
 * @param modelName modelo opcional (usa `process.env.OPENAI_MODEL` ou `gpt-4o`)
 * @returns instância pronta de chat model
 */
export const getLLM = async (apiKey?: string, modelName?: string) => {
  const { ChatOpenAI } = await import("@langchain/openai");
  const finalApiKey = process.env.OPENAI_API_KEY || apiKey;
  const finalModelName = modelName || process.env.OPENAI_MODEL || "gpt-4o";

  if (!finalApiKey) {
    throw new Error("OpenAI API Key não configurada no servidor.");
  }

  return new ChatOpenAI({
    openAIApiKey: finalApiKey,
    modelName: finalModelName,
    temperature: 0,
  });
};
