import * as cheerio from "cheerio";
import { AnchorOpportunity } from "@/types";
import { normalizeText } from "@/utils/text-matcher";

/**
 * Agente de Validação DOM (Quality Control)
 * Verifica se as oportunidades sugeridas são tecnicamente seguras de implementar.
 * Garante que não vamos quebrar o HTML criando links dentro de links ou em locais proibidos.
 */
export async function validateOpportunitiesInDOM(
  opportunities: AnchorOpportunity[],
  html: string
): Promise<AnchorOpportunity[]> {
  // Se não tem HTML ou oportunidades, não há o que validar
  if (!html || opportunities.length === 0) return opportunities;

  console.log(
    `[DOM Validator] 🛡️ Iniciando validação estrutural de ${opportunities.length} oportunidades...`
  );

  const $ = cheerio.load(html);
  const validOpportunities: AnchorOpportunity[] = [];

  // 1. Mapear Títulos (H1-H6) para evitar linkar cabeçalhos
  const headingTexts: string[] = [];
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    headingTexts.push($(el).text());
  });

  for (const opp of opportunities) {
    const anchor = opp.anchor.trim();
    const anchorLower = normalizeText(anchor);

    // --- REGRA 1: Não linkar Títulos ---
    const isHeading = headingTexts.some((h) => {
      const hLower = normalizeText(h);
      // Rejeita se o título contiver a âncora ou vice-versa (proteção agressiva para headings)
      return hLower.includes(anchorLower) || anchorLower.includes(hLower);
    });

    if (isHeading) {
      console.log(`[DOM Validator] ❌ Rejeitado (É título): "${anchor}"`);
      continue;
    }

    // --- REGRA 2: Não linkar o que já é link ou interativo ---
    // Estratégia: Encontrar o elemento que contém o TRECHO (frase completa) e verificar se há conflitos nele.
    let isSafe = true;
    let foundContext = false;

    // Seletores de bloco onde o texto geralmente reside
    const potentialContainers = $(
      "p, li, div, blockquote, td, article, section, h1, h2, h3, h4, h5, h6, span"
    );

    potentialContainers.each((_, el) => {
      const elementText = $(el).text();
      // Verificamos se este elemento contém o trecho completo (contexto)
      // Usamos replace para normalizar espaços e quebras de linha
      const normalizedElementText = elementText.replace(/\s+/g, " ").trim();
      const normalizedTrecho = opp.trecho.replace(/\s+/g, " ").trim();

      if (normalizedElementText.includes(normalizedTrecho)) {
        foundContext = true;

        // 1. Verifica se o próprio elemento ou ancestrais são proibidos
        if ($(el).is("a, button") || $(el).parents("a, button").length > 0) {
          isSafe = false;
          console.log(
            `[DOM Validator] ❌ Rejeitado (Contexto dentro de link/botão): "${anchor}"`
          );
          return false; // Break loop
        }

        // 2. Verifica se DENTRO deste contexto a âncora já está linkada
        // Ex: <p>Texto com <a href="...">Anchor</a>.</p>
        const unsafeChildren = $(el)
          .find("a, button")
          .filter((_, child) => {
            return $(child).text().includes(anchor);
          });

        if (unsafeChildren.length > 0) {
          isSafe = false;
          console.log(
            `[DOM Validator] ❌ Rejeitado (Já existe link/botão interno): "${anchor}"`
          );
          return false; // Break loop
        }

        // Se encontramos o contexto exato e ele é seguro, ótimo.
        // Mas continuamos procurando? Se houver duplicatas do trecho, queremos validar todas?
        // Por segurança, se achamos UM contexto válido e seguro, assumimos OK, a menos que haja ambiguidade.
        // Mas se acharmos UM contexto inseguro, rejeitamos tudo.
      }
    });

    // Se não achou pelo trecho completo, tenta busca mais solta pela âncora, mas com cuidado
    if (!foundContext) {
      // Fallback: Se a âncora estiver dentro de qualquer A ou Button no documento todo, rejeita (Safety First)
      // Isso evita linkar "Contato" se já existe um botão "Contato" em algum lugar, mesmo que o texto analisado fosse outro.
      // Para "exact", isso pode ser agressivo, mas evita erros de navegação.
      const globalUnsafe = $("a, button").filter((_, el) =>
        $(el).text().includes(anchor)
      );
      if (globalUnsafe.length > 0) {
        console.log(
          `[DOM Validator] ⚠️ Aviso: Contexto exato não encontrado, e âncora existe em links na página. Rejeitando por precaução: "${anchor}"`
        );
        isSafe = false;
      } else {
        console.log(
          `[DOM Validator] ⚠️ Aviso: Contexto exato não encontrado no DOM. Assumindo seguro (não há links colidentes): "${anchor}"`
        );
      }
    }

    if (!isSafe) continue;

    validOpportunities.push(opp);
  }

  console.log(
    `[DOM Validator] ✅ Finalizado. ${validOpportunities.length} oportunidades aprovadas.`
  );
  return validOpportunities;
}
