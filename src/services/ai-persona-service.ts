import { getLLM } from "@/core/llm";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

/**
 * Serviço para analisar automaticamente o tom de voz e persona a partir de um texto de referência
 */
export async function analyzeToneAndPersona(textoReferencia: string): Promise<string> {
  const llm = await getLLM();
  
  const prompt = PromptTemplate.fromTemplate(`
    Você é um Especialista em Branding e Social Media Sênior. 
    Sua tarefa é analisar o texto de referência abaixo e identificar o tom de voz predominante.
    
    Esta análise será usada para alimentar um sistema que transforma BlogPosts em conteúdo para Instagram e LinkedIn.
    
    TEXTO DE REFERÊNCIA:
    "{texto}"
    
    INSTRUÇÕES:
    1. Identifique se o tom é: corporativo, divertido, técnico ou inspiracional.
    2. Explique brevemente por que você escolheu esse tom.
    3. Forneça 3 diretrizes rápidas de como manter esse tom em scripts de vídeo e legendas.
    
    RESPOSTA:
    Retorne apenas o nome do tom (um dos 4 acima) seguido de uma breve justificativa.
  `);

  const chain = prompt.pipe(llm).pipe(new StringOutputParser());
  
  const result = await chain.invoke({ texto: textoReferencia });
  return result;
}

/**
 * Estima o tempo de análise baseado no tamanho do texto
 */
export function estimateAnalysisTime(texto?: string): number {
  if (!texto) return 0;
  // Regra simples: 5 segundos base + 1 segundo a cada 1000 caracteres
  return 5 + Math.floor(texto.length / 1000);
}
