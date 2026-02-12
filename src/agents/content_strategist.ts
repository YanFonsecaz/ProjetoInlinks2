import { getLLM } from "@/core/llm";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { JsonOutputFunctionsParser } from "langchain/output_parsers";
import { z } from "zod";

// Schema de saída estruturada para garantir que o LLM retorne o formato exato
const strategySchema = z.object({
  analysis: z.object({
    summary: z.string().describe("Resumo executivo do conteúdo original"),
    key_points: z.array(z.string()).describe("3-5 pontos chave extraídos"),
    audience_fit: z
      .string()
      .describe("Como este conteúdo se conecta com o público alvo da persona"),
  }),
  linkedin_video_script: z.object({
    title: z.string().describe("Título chamativo para o vídeo"),
    hook: z.string().describe("Gancho inicial de 3-5 segundos"),
    body: z
      .string()
      .describe("Roteiro detalhado com instruções de cena [entre colchetes]"),
    cta: z.string().describe("Chamada para ação clara"),
    estimated_duration: z.string().describe("Duração estimada (ex: 2 min)"),
  }),
  instagram_reels_script: z.object({
    hook_visual: z
      .string()
      .describe(
        "Descrição visual dos primeiros 3 segundos para prender atenção",
      ),
    hook_audio: z.string().describe("Áudio/Fala inicial de impacto"),
    scenes: z.array(
      z.object({
        visual: z.string().describe("O que aparece na tela"),
        audio: z.string().describe("O que é falado ou tocado"),
        duration: z.string().describe("Duração da cena (ex: 3s)"),
      }),
    ),
    caption: z.string().describe("Legenda curta para o post"),
    hashtags: z
      .array(z.string())
      .describe("Lista de 5-10 hashtags estratégicas"),
  }),
  linkedin_post: z.object({
    headline: z.string().describe("Primeira frase para parar o scroll"),
    body: z
      .string()
      .describe(
        "Corpo do texto formatado com quebras de linha e emojis estratégicos",
      ),
    image_suggestion: z
      .string()
      .describe("Sugestão de imagem ou carrossel para acompanhar"),
    hashtags: z.array(z.string()),
  }),
});

const SYSTEM_PROMPT = `
Você é um Estrategista de Conteúdo Sênior da NP Digital, especialista em transformar links e artigos em ecossistemas de conteúdo viral.

SUA MISSÃO:
Analisar o conteúdo extraído da URL fornecida e criar uma estratégia de distribuição transmídia adaptada à Persona da Marca.

PERSONA DA MARCA:
- Tom de Voz: {tone}
- Público Alvo: {target}
- Objetivos: {objectives}

REGRAS DE OURO POR FORMATO:

1. VÍDEO LONGO (LinkedIn/YouTube):
- Foco em Autoridade e Profundidade.
- Estrutura: Gancho (Problema) -> Desenvolvimento (Solução/Insight) -> Prova/Exemplo -> CTA.
- Inclua instruções de cena claras entre colchetes, ex: [Cena: Close no apresentador, gráfico sobe na tela].

2. REELS (Instagram/TikTok):
- Foco em Retenção e Dinamismo.
- OBRIGATÓRIO: O script deve conter no mínimo 5 cenas detalhadas.
- OBRIGATÓRIO: Incluir instruções visuais ricas para cada cena (ex: "B-roll de pessoa assinando papel", "Close no rosto surpreso").
- OBRIGATÓRIO: No campo 'audio' de cada cena, escreva EXATAMENTE o que deve ser falado (narração) palavra por palavra. Não use resumos como "fala sobre X".
- O gancho visual e auditivo deve ocorrer no primeiro segundo.
- Use tendências visuais e cortes rápidos.

3. POST LINKEDIN:
- Foco em Copywriting (AIDA).
- Use parágrafos curtos (1-2 frases) para escaneabilidade.
- O título/headline deve ser provocativo ou educativo.

DIRETRIZES GERAIS:
- Se o conteúdo original for em outro idioma, traduza e adapte culturalmente para PT-BR.
- Mantenha a essência da mensagem original, mas adapte a linguagem para o tom da persona.
- NÃO alucine fatos que não estão no texto original, mas você pode adicionar contexto de mercado se relevante.

CONTEÚDO ORIGINAL EXTRAÍDO:
"{content}"
`;

export async function generateContentStrategy(
  content: string,
  persona: { tone: string; target: string; objectives: string[] },
) {
  try {
    const llm = await getLLM();

    // Configura o modelo para usar function calling forçado para JSON estruturado
    const structuredLLM = llm.withStructuredOutput(strategySchema);

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", SYSTEM_PROMPT],
      [
        "human",
        "Gere a estratégia de conteúdo completa baseada na análise acima.",
      ],
    ]);

    const chain = prompt.pipe(structuredLLM);

    const objectivesStr = Array.isArray(persona.objectives)
      ? persona.objectives.join(", ")
      : String(persona.objectives || "");

    const result = await chain.invoke({
      content,
      tone: persona.tone,
      target: persona.target,
      objectives: objectivesStr,
    });

    return { success: true, data: result };
  } catch (error: any) {
    console.error("Erro no ContentStrategistAgent:", error);
    return { success: false, error: error.message };
  }
}
