import { ChatPromptTemplate } from "@langchain/core/prompts";
import { getLLM } from "@/core/llm";
import { z } from "zod";

const sanitizerSchema = z.object({
  main_content: z
    .string()
    .describe(
      "O conteúdo principal do artigo, limpo de menus, widgets, sidebars e rodapés. Mantenha a formatação Markdown original do texto narrativo."
    ),
  is_article: z
    .boolean()
    .describe(
      "True se o texto parece ser um artigo/conteúdo editorial válido. False se for apenas uma página de erro, login ou sem conteúdo."
    ),
  removed_sections: z
    .array(z.string())
    .describe(
      "Lista resumida do tipo de seções removidas (ex: 'Sidebar', 'Footer', 'Menu de Navegação')"
    ),
});

/**
 * Agente Especialista: Content Sanitizer
 * Objetivo: Receber um texto "sujo" (raw markdown) e extrair APENAS o conteúdo editorial principal.
 * Remove ruídos como sidebars, widgets, menus, CTAs de marketing e rodapés.
 */
export async function sanitizeContent(rawContent: string): Promise<string> {
  console.log(`[Content Sanitizer] Iniciando limpeza inteligente via LLM...`);

  // Se o texto for muito curto, não gastamos LLM
  if (rawContent.length < 300) {
    console.log(`[Content Sanitizer] Texto muito curto, retornando original.`);
    return rawContent;
  }

  // Usamos um modelo mais rápido/barato para essa tarefa estrutural (gpt-4o-mini)
  // Temperatura 0 é crucial para tarefas de extração/limpeza
  const model = await getLLM(undefined, "gpt-4o-mini", 0);
  const structuredLLM = model.withStructuredOutput(sanitizerSchema);

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `Você é um Especialista Sênior em Extração de Conteúdo Web e Processamento de Linguagem Natural.

      🎯 OBJETIVO PRINCIPAL:
      Sua tarefa é limpar um texto em Markdown extraído de uma página web, separando o "Conteúdo Principal" (Main Content) do "Ruído" (Boilerplate).
      Você deve retornar APENAS o texto jornalístico/editorial, mantendo sua estrutura original.

      🛑 O QUE DEVE SER REMOVIDO (RUÍDO):
      1. **Elementos de Navegação**: Menus principais, breadcrumbs, "Voltar ao topo", "Ir para conteúdo".
      2. **Sidebars e Widgets**: Listas de "Posts Populares", "Categorias", "Arquivos", banners laterais, widgets de redes sociais.
      3. **Chamadas de Ação (CTAs) Intrusivas**: Botões de "Assine agora", "Baixe o Ebook", "Inscreva-se na newsletter", pop-ups em texto.
      4. **Seções de Rodapé**: Copyright, links institucionais (Sobre, Contato), bios genéricas de autor no fim da página.
      5. **Metadados e Poluição Visual**: Datas repetitivas, listas de tags excessivas, "Publicado em", "Tempo de leitura".
      6. **Engajamento**: Seções de comentários, "Deixe uma resposta", "O que você achou?".
      7. **Blocos de "Leia Também"**: Links internos inseridos no meio do texto que quebram a leitura (ex: "Veja também: [Titulo]").

      💎 O QUE DEVE SER MANTIDO (CONTEÚDO VALIOSO):
      1. **Cabeçalhos**: O Título Principal (H1) e todos os subtítulos (H2-H6) que estruturam o artigo.
      2. **Corpo do Texto**: Todos os parágrafos narrativos, explicativos e opinativos.
      3. **Listas de Conteúdo**: Listas (bullets/numéricas) que fazem parte da explicação (passo-a-passo, características, exemplos).
      4. **Citações e Destaques**: Blockquotes relevantes e caixas de destaque informativas.
      5. **Mídia Relevante**: Descrições de imagens ou legendas que agregam valor ao contexto (se houver texto).

      🧠 CRITÉRIO DE DESEMPATE (O TESTE DE OURO):
      Ao analisar um bloco, pergunte-se: "Se eu imprimir este artigo para ler no papel, este bloco faz parte da história ou é apenas uma ferramenta do site?"
      - Se for ferramenta/menu -> LIXO.
      - Se for história/explicação -> OURO.

      ⚠️ INSTRUÇÃO DE FORMATAÇÃO:
      - Mantenha a formatação Markdown original (negrito, itálico, headers) para o conteúdo preservado.
      - Não adicione textos explicativos ("Aqui está o texto limpo"). Retorne apenas o conteúdo.`,
    ],
    [
      "human",
      `Analise e limpe o seguinte conteúdo bruto:
      
      ---
      {text}
      ---`,
    ],
  ]);

  const chain = prompt.pipe(structuredLLM);

  try {
    // Limitamos o input para não estourar tokens, focando no início/meio onde a sujeira de sidebar costuma atrapalhar mais
    // Mas para limpeza ideal, o ideal é passar blocos. Aqui assumimos que cabe no contexto (128k tokens do gpt-4-turbo é sobra).
    // Por segurança e custo, vamos enviar os primeiros 15k caracteres que geralmente contém todo o artigo.
    const inputSlice = rawContent.slice(0, 20000);

    const result = await chain.invoke({
      text: inputSlice,
    });

    if (!result.is_article) {
      console.warn(
        `[Content Sanitizer] LLM indicou que isso não parece um artigo válido.`
      );
      return rawContent; // Fallback: retorna original se não for artigo
    }

    console.log(`[Content Sanitizer] Limpeza concluída.`);
    console.log(
      `[Content Sanitizer] Seções removidas: ${result.removed_sections.join(
        ", "
      )}`
    );

    // Se o texto original era muito maior que o slice, avisamos (mas para blogs, 20k chars cobre 99%)
    if (rawContent.length > 20000) {
      console.warn(
        `[Content Sanitizer] Atenção: Texto original era maior que 20k chars. O final pode ter sido cortado na limpeza.`
      );
    }

    return result.main_content;
  } catch (error) {
    console.error(`[Content Sanitizer] Erro na limpeza via LLM:`, error);
    return rawContent; // Fallback seguro: retorna o texto original (sujo) se a IA falhar
  }
}
