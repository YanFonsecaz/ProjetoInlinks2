import * as cheerio from "cheerio";

/**
 * Limpa HTML e retorna texto estruturado, removendo agressivamente conteúdo não-principal.
 * @param html conteúdo HTML bruto
 * @returns texto limpo com quebras preservadas
 */
export async function cleanText(html: string): Promise<string> {
  const $ = cheerio.load(html);

  // 1. Remoção de tags estruturais não-conteúdo e Mídia (Global)
  // Removemos h1 pois geralmente é o título da página (já capturado) e não queremos links nele.
  $(
    "script, style, noscript, iframe, svg, meta, link, header, footer, nav, form, button, object, embed, figure, figcaption, video, audio, canvas, map, area, img, picture, source, track, h1"
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
    ".logo",
    ".branding",

    // Conteúdo Relacionado/Extra (MUITO COMUM)
    ".related-posts",
    ".related",
    ".yarpp-related",
    ".jp-relatedposts",
    ".crp_related",
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
    ".author-info",
    ".post-author",

    // Galerias, Legendas e Mídia
    ".gallery",
    ".gallery-item",
    ".wp-caption",
    ".wp-caption-text",
    "figcaption",
    ".caption",
    ".image-caption",
    ".video-caption",
    ".media-caption",
    ".wp-block-image",
    ".wp-block-video",
    ".wp-block-embed",

    // Títulos redundantes (no corpo)
    ".entry-title",
    ".page-title",
    ".post-title",

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
    ".ads",
    ".ad-container",

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
    ".date",
    ".time",
    ".published",
    ".updated",
    ".toc",
    "#toc",
    ".table-of-contents",
    ".ez-toc-container", // Easy Table of Contents plugin
  ];

  $(junkSelectors.join(", ")).remove();

  // 3. Seleção do Conteúdo Principal Inteligente
  // Prioriza elementos semânticos e escolhe o que tem mais texto
  let mainCandidates = $(
    "article, main, .post-content, .entry-content, #content, .blog-post, .post-body, .article-body, [itemprop='articleBody']"
  );

  let main = $("body"); // Fallback

  if (mainCandidates.length > 0) {
    // Se houver múltiplos candidatos, pega o que tem maior comprimento de texto
    let bestCandidate = mainCandidates.first();
    let maxLen = 0;

    mainCandidates.each((_, el) => {
      // Clone para não destruir o original ao medir texto
      const clone = $(el).clone();
      // Remove tags aninhadas que podem inflar o tamanho (como related posts dentro de article)
      clone.find(junkSelectors.join(", ")).remove();
      const len = clone.text().length;

      // Heurística: conteúdo principal geralmente é longo.
      // Ignora candidatos muito curtos (< 200 chars) que podem ser cards ou teasers
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
    if (
      $el.css("display") === "none" ||
      $el.attr("aria-hidden") === "true" ||
      $el.hasClass("hidden")
    ) {
      $el.remove();
      return;
    }

    const text = $el.text().trim().toLowerCase();
    const isShort = text.length < 100;

    // Remove parágrafos/divs de navegação interna ("Veja também", "Leia mais")
    // Verifica palavras-chave comuns de interrupção de fluxo
    // Aumentando a agressividade para pegar blocos maiores de "Veja também"
    if (isShort || text.length < 300) {
      const lowerText = text.toLowerCase();
      if (
        lowerText.startsWith("leia também") ||
        lowerText.startsWith("veja também") ||
        lowerText.startsWith("confira") ||
        lowerText.startsWith("continue e confira") ||
        lowerText.startsWith("saiba mais") ||
        lowerText.includes("posts relacionados") ||
        lowerText.startsWith("tags:") ||
        lowerText.startsWith("categorias:") ||
        lowerText.startsWith("compartilhe") ||
        lowerText.startsWith("escrito por") ||
        lowerText.startsWith("publicado em") ||
        lowerText === "publicidade" ||
        lowerText === "anúncio" ||
        // Padrões de "Veja mais" que podem aparecer como títulos ou chamadas
        /^veja (mais|também|também|agora):?/i.test(lowerText) ||
        /^leia (mais|também|também|agora):?/i.test(lowerText) ||
        /^confira (também|também|agora):?/i.test(lowerText)
      ) {
        $el.remove();
        return;
      }
    }

    // 4.1 Detecção de Seções de "Leia Também" baseada em conteúdo anterior
    // Se encontrarmos um título (h2, h3, h4, strong) que diz "Leia Também",
    // e este elemento atual parece ser um link ou lista de links, removemos.
    // (Esta lógica é difícil de implementar iterando um por um, mas podemos tentar heurísticas simples)

    // Remove links isolados que parecem ser navegação ou tags
    // Ex: <p><a href="...">Link</a></p> ou <div><a href="...">Link</a></div>
    if (($el.is("p") || $el.is("div")) && text.length < 100) {
      const children = $el.children();
      if (children.length === 1 && children.is("a")) {
        // É apenas um link. Verifica se é link de conteúdo ou navegação
        // Se o texto do link for "clique aqui", "saiba mais", etc, remove
        const linkText = children.text().toLowerCase();
        if (
          linkText.includes("leia mais") ||
          linkText.includes("saiba mais") ||
          linkText.includes("clique aqui")
        ) {
          $el.remove();
          return;
        }
      }
    }

    // Remove listas que são apenas links (provavelmente menus internos ou tags)
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
    .replace(/[ \t]+/g, " ") // normaliza apenas espaços horizontais
    .replace(/\n\s*\n/g, "\n\n") // garante parágrafos claros
    .trim();
}

export async function extractTitle(html: string): Promise<string> {
  const $ = cheerio.load(html);
  return (
    $("h1").first().text().trim() || $("title").text().trim() || "Sem título"
  );
}

export function cleanMarkdown(text: string): string {
  // 1. Remove Imagens Markdown: ![alt](url)
  let clean = text.replace(/!\[.*?\]\(.*?\)/g, "");

  // 2. Remove Links Markdown que são apenas navegação/menus: [Link](url)
  // Remove linhas inteiras que são APENAS um link ou lista de links
  clean = clean.replace(/^\s*[\*\-]?\s*\[.*?\]\(.*?\)\s*$/gm, "");

  // 3. Remove Links Markdown "Button" ou "CTA" comuns e "Leia Também"
  clean = clean.replace(
    /\[(Click here|Clique aqui|Saiba mais|Read more|Download|Button|Leia [Tt]amb[ée]m|Veja [Mm]ais|Confira)\]\(.*?\)/gi,
    ""
  );

  // Remove linhas que começam com "Leia também", "Veja mais", etc (muito comum em blogs)
  clean = clean.replace(
    /^\s*(Leia|Veja|Confira)\s+(tamb[ée]m|mais|agora|o post).*?$/gim,
    ""
  );

  // 4. Remove blocos de código (frequentemente contêm JS minificado ou CSS)
  clean = clean.replace(/```[\s\S]*?```/g, "");

  // 5. Remove linhas que são apenas URLs soltas
  clean = clean.replace(/^\s*https?:\/\/\S+\s*$/gm, "");

  // 6. Remove linhas que começam com símbolos estranhos ou parecem JS vazado
  // Ex: "function()..." ou "{var x...}" ou "66TcZTo)..."
  clean = clean.replace(/^\s*[a-zA-Z0-9_$]+\(.*\).*/gm, "");
  clean = clean.replace(/^\s*\{.*\}\s*$/gm, "");

  // 7. Remove linhas de Copyright/Footer/Nav comuns
  const boilerplateRegex =
    /^(Copyright|All rights reserved|Todos os direitos reservados|Powered by|Menu|Home|About|Contact|Privacy Policy|Terms of Use|Sitemap|Fale Conosco|Política de Privacidade|Termos de Uso|Mapa do Site|Início|Sobre|Contato|Search|Buscar|Login|Sign Up|Entrar|Cadastrar)/i;
  clean = clean
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (trimmed.length < 3) return false; // Remove linhas muito curtas (ruído)
      if (boilerplateRegex.test(trimmed)) return false;

      // Remove linhas que são apenas pontuação ou números
      if (/^[\W\d]+$/.test(trimmed)) return false;

      return true;
    })
    .join("\n");

  // 8. Remove metadados comuns do Jina e Cabeçalhos de Markdown
  clean = clean.replace(
    /(Title|URL|Source|Description|Author|Date):\s+.*$/gim,
    ""
  );
  clean = clean.replace(/^#\s+.*$/gm, ""); // H1

  // 9. Compressão de espaços verticais
  clean = clean.replace(/\n{3,}/g, "\n\n");

  return clean.trim();
}
