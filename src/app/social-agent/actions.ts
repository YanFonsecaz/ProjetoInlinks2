"use server";

import { getLLM } from "@/core/llm";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { extractContent } from "@/agents/crawler";

const SOCIAL_MEDIA_PROMPT = `
Atue como um Social Media Sênior especializado em Content Marketing e Estratégia Transmídia. Sua missão principal é transformar artigos de blog (BlogPosts) em um ecossistema completo de conteúdo multimídia otimizado para Instagram e LinkedIn.

CONTEÚDO BASE:
"{content}"

PERSONA DA MARCA:
- Tom de Voz: {tone}
- Público Alvo: {target}
- Objetivos: {objectives}

ETAPA ATUAL: {step}

{step_instructions}

RESPOSTA (em Português):
`;

const STEP_INSTRUCTIONS = {
  analysis: `
  ETAPA 1: Análise Estratégica
  - Realize uma leitura profunda do conteúdo recebido.
  - Identifique e liste:
    - Os 3-5 pontos-chave (Core Messages).
    - O tom de voz detectado ou solicitado.
    - O público-alvo primário.
    - O objetivo central da mensagem (educar, vender, inspirar, entreter).
  - Apresente esta análise em texto corrido explicativo.
  `,
  scripts: `
  ETAPA 2: Scripts de Vídeo (Reels & LinkedIn)
  - Crie scripts roteirizados focados em retenção:
    - Instagram Reels/Stories (15-60s): Foco em dinamismo, cortes rápidos e visual.
    - Vídeo LinkedIn (1-3 min): Foco em profundidade, autoridade e valor profissional.
  - Estrutura obrigatória dos scripts: Gancho de Atenção (Hook) -> Desenvolvimento -> Call-to-Action (CTA) clara.
  `,
  formats: `
  ETAPA 3: Adaptação para Formatos Estáticos e Interativos
  - Desenvolva o conteúdo para:
    - Carrosséis: Estruture a narrativa slide a slide (Título, Desenvolvimento, Conclusão).
    - Posts Estáticos: Imagem única com legenda forte ou infográfico resumido.
    - Stories Interativos: Sequência narrativa com sugestões de enquetes, caixas de perguntas e stickers para engajamento.
  `,
  captions: `
  ETAPA 4: Legendas e Otimização de Plataforma
  - Redija as legendas completas para cada postagem sugerida acima.
  - Inclua:
    - Headlines (primeira frase) atrativas.
    - Quebras de linha para escaneabilidade.
    - Emojis estratégicos (sem excesso).
    - Blocos de Hashtags selecionados (mix de alcance amplo e nichado).
  - Diferencie a linguagem: Mais descontraída/visual para Instagram vs. Mais profissional/discursiva para LinkedIn.
  `,
  visual: `
  ETAPA 5: Diretrizes Visuais
  - Forneça diretrizes descritivas para a equipe de design (ou para o usuário criar as artes).
  - Sugira: Estilo de imagem (foto real, ilustração, minimalista), paleta de cores sugerida e tipografia.
  - Nota: Não gere imagens, apenas descreva o conceito visual.
  `,
  calendar: `
  ETAPA 6: Métricas e Calendário
  - Estabeleça quais KPIs devem ser monitorados para cada peça.
  - Desenvolva um calendário de postagem estratégico sugerindo a ordem de publicação para maximizar o ciclo de vida do conteúdo.
  `
};

export async function processSocialStep(
  step: keyof typeof STEP_INSTRUCTIONS,
  content: string,
  persona: { tone: string; target: string; objectives: string[] }
) {
  try {
    const llm = await getLLM();
    const prompt = PromptTemplate.fromTemplate(SOCIAL_MEDIA_PROMPT);
    const chain = prompt.pipe(llm).pipe(new StringOutputParser());

    const result = await chain.invoke({
      content,
      tone: persona.tone,
      target: persona.target,
      objectives: persona.objectives.join(", "),
      step: step.toUpperCase(),
      step_instructions: STEP_INSTRUCTIONS[step]
    });

    return { success: true, output: result };
  } catch (error: any) {
    console.error(`Erro no processSocialStep (${step}):`, error);
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
