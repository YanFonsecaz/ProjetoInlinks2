import * as cheerio from "cheerio";

/**
 * Limpa HTML e retorna texto estruturado, removendo agressivamente conteúdo não-principal.
 * @param html conteúdo HTML bruto
 * @returns texto limpo com quebras preservadas
 */
export async function cleanText(html: string): Promise<string> {
  const $ = cheerio.load(html);

  // 1. Remoção de tags estruturais não-conteúdo (Global)
  $(
    "script, style, noscript, iframe, svg, meta, link, header, footer, nav, form, button, object, embed, figure, figcaption"
  ).remove();

  // 2. Seletores de "Lixo" (Sidebars, Menus, Popups, Related, Ads)
  const junkSelectors = [
    // Estrutura Geral e Layout
    ".sidebar",
    "#sidebar",
    "aside",
    ".aside",
    ".menu",
    ".navigation",
    ".nav",
    ".site-nav",
    ".main-nav",
    ".footer",
    ".site-footer",
    ".page-footer",
    "#footer",
    ".header",
    ".site-header",
    ".page-header",
    "#header",
    ".top-bar",
    ".top-nav",

    // Conteúdo Relacionado/Extra
    ".related-posts",
    ".related",
    ".yarpp-related",
    ".jp-relatedposts",
    ".comments",
    "#comments",
    ".comment-list",
    ".respond",
    "#respond",
    ".share-buttons",
    ".social-share",
    ".share",
    ".social-icons",
    ".author-bio",
    ".about-author",
    ".author-box",
    
    // Galerias e Legendas
    ".gallery",
    ".gallery-item",
    ".wp-caption",
    ".wp-caption-text",
    "figcaption",

    // Widgets, Ads e CTAs
    ".widget",
    ".widget-area",
    ".sidebar-widget",
    ".newsletter-signup",
    ".subscribe",
    ".cta",
    ".call-to-action",
    ".popup",
    ".modal",
    ".cookie-notice",
    ".banner",
    ".ad",
    ".advertisement",
    ".adsense",

    // Metadados e Navegação de Post
    ".pagination",
    ".post-navigation",
    ".breadcrumbs",
    ".tags",
    ".post-tags",
    ".categories",
    ".cat-links",
    ".entry-meta",
    ".post-meta",
    ".toc",
    "#toc",
    ".table-of-contents", // Opcional: remover TOC se atrapalhar
  ];

  $(junkSelectors.join(", ")).remove();

  // 3. Seleção do Conteúdo Principal Inteligente
  // Prioriza elementos semânticos e escolhe o que tem mais texto (evita pegar cards de related posts como article)
  let mainCandidates = $(
    "article, main, .post-content, .entry-content, #content, .blog-post"
  );
  let main = $("body"); // Fallback

  if (mainCandidates.length > 0) {
    // Se houver múltiplos candidatos, pega o que tem maior comprimento de texto
    let bestCandidate = mainCandidates.first();
    let maxLen = 0;

    mainCandidates.each((_, el) => {
      const len = $(el).text().length;
      // Heurística: conteúdo principal geralmente é longo.
      // Ignora candidatos muito curtos (< 200 chars) que podem ser cards
      if (len > maxLen && len > 200) {
        maxLen = len;
        bestCandidate = $(el);
      }
    });

    if (maxLen > 0) {
      main = bestCandidate;
    }
  }

  // 4. Limpeza Fina dentro do Conteúdo Principal
  main.find("*").each((_, el) => {
    const $el = $(el);

    // Remove elementos ocultos
    if ($el.css("display") === "none" || $el.attr("aria-hidden") === "true") {
      $el.remove();
      return;
    }

    const text = $el.text().trim().toLowerCase();
    const isShort = text.length < 50;

    // Remove parágrafos/divs de navegação interna ("Veja também", "Leia mais")
    if (isShort) {
      if (
        text.startsWith("leia também") ||
        text.startsWith("veja também") ||
        text.startsWith("confira") ||
        text.startsWith("saiba mais") ||
        text.includes("posts relacionados") ||
        text.startsWith("tags:") ||
        text.startsWith("categorias:") ||
        text.startsWith("compartilhe")
      ) {
        $el.remove();
        return;
      }
    }

    // Remove listas que são apenas links (provavelmente menus internos ou tags)
    // Usando $el.is() para evitar erro de propriedade 'tagName'
    if ($el.is("ul") || $el.is("ol")) {
      const listItems = $el.find("li");
      const totalItems = listItems.length;
      if (totalItems > 0) {
        const itemsWithLinks = listItems.has("a").length;
        // Se mais de 80% dos itens são links e o texto é curto, remove (menu/lista de links)
        if (itemsWithLinks / totalItems > 0.8 && $el.text().length < 500) {
          $el.remove();
          return;
        }
      }
    }
  });

  // 5. Estruturação do texto para leitura
  // Substitui quebras visuais por quebras de linha reais
  $("br").replaceWith("\n");
  $("p, div, li, h1, h2, h3, h4, h5, h6, blockquote, pre").each((_, el) => {
    $(el).append("\n");
  });

  const text = main.text();

  return text
    .replace(/\s+/g, " ") // normaliza espaços múltiplos para um único
    .replace(/\n\s*\n/g, "\n\n") // garante parágrafos claros
    .trim();
}

export async function extractTitle(html: string): Promise<string> {
  const $ = cheerio.load(html);
  return (
    $("h1").first().text().trim() || $("title").text().trim() || "Sem título"
  );
}
