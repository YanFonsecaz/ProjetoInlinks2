"use server";

import { getLLM } from "@/core/llm";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { extractContent } from "@/agents/crawler";
import { generateContentStrategy } from "@/agents/content_strategist";

import { ChatPromptTemplate } from "@langchain/core/prompts";

const SYSTEM_PROMPT = `
Você é o Agente Social Media da NP Digital, um especialista em estratégia de conteúdo transmídia.
Sua missão é ajudar o usuário a transformar conteúdos (artigos, ideias) em posts virais para Instagram e LinkedIn.

PERSONA ATIVA DA MARCA:
- Tom de Voz: {tone}
- Público Alvo: {target}
- Objetivos: {objectives}

DIRETRIZES DE INTERAÇÃO:
1. Mantenha o tom da persona definida acima em suas respostas.
2. Seja proativo: sugira formatos, ganchos e melhorias sem o usuário pedir.
3. Formatação: Use Markdown rico (negrito, listas, tabelas) para facilitar a leitura.
4. Se o usuário fornecer um link ou texto, comece analisando os pontos-chave antes de sugerir posts.
5. Se o usuário pedir um formato específico (ex: "crie um carrossel"), entregue a estrutura completa slide a slide.

REGRAS PARA ITERAÇÃO E FEEDBACK:
- Se o usuário disser que não gostou ou pedir melhorias, NÃO se justifique. Apenas reescreva o conteúdo aplicando as críticas imediatamente.
- Se o usuário pedir para "tentar de novo" ou "melhorar", apresente uma versão TOTALMENTE NOVA, com abordagem criativa diferente da anterior.
- Pergunte ao final se a nova versão está mais alinhada com a expectativa.

Responda sempre em Português do Brasil.
`;

export async function chatWithSocialAgent(
  messages: { role: string; content: string }[],
  persona: { tone: string; target: string; objectives: string[] },
  contextContent?: string,
) {
  try {
    const llm = await getLLM();

    // Converter histórico simples para formato LangChain
    // Se houver conteúdo de base (artigo extraído), injetamos como contexto inicial invisível

    // Tratamento defensivo para evitar erro no .join()
    const objectivesStr = Array.isArray(persona.objectives)
      ? persona.objectives.join(", ")
      : String(persona.objectives || "");

    let systemMessage = SYSTEM_PROMPT.replace("{tone}", persona.tone)
      .replace("{target}", persona.target)
      .replace("{objectives}", objectivesStr);

    if (contextContent) {
      systemMessage += `\n\nCONTEÚDO BASE PARA TRABALHO:\n"${contextContent}"\n\nUse este conteúdo como referência principal.`;
    }

    const promptMessages = [
      ["system", systemMessage],
      ...messages.map((m) => [
        m.role === "user" ? "human" : "assistant",
        m.content,
      ]),
    ];

    const prompt = ChatPromptTemplate.fromMessages(promptMessages as any);
    const chain = prompt.pipe(llm).pipe(new StringOutputParser());

    const result = await chain.invoke({});

    return { success: true, output: result };
  } catch (error: any) {
    console.error("Erro no chatWithSocialAgent:", error);
    return { success: false, error: error.message };
  }
}

export async function processUrlStrategy(
  url: string,
  persona: { tone: string; target: string; objectives: string[] },
) {
  try {
    // 1. Extrair conteúdo
    const extracted = await extractContent(url);
    if (!extracted.content) throw new Error("Falha ao extrair conteúdo da URL");

    // 2. Gerar Estratégia Estruturada
    const strategy = await generateContentStrategy(extracted.content, persona);

    return {
      success: true,
      content: extracted.content,
      strategy: strategy.success ? strategy.data : null,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getUrlContent(url: string) {
  try {
    const extracted = await extractContent(url);
    return { success: true, content: extracted.content };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
