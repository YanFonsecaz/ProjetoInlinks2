import { cleanText, extractTitle, cleanMarkdown } from "@/utils/clean_text";
import { ExtractedContent } from "@/types";

/**
 * Helper para buscar conteúdo via Jina Reader quando o fetch direto falha
 */
async function fetchWithJina(
  url: string,
  defaultTitle = "Sem título"
): Promise<ExtractedContent | null> {
  try {
    // Jina Reader aceita a URL direta após o prefixo
    const readerUrl = `https://r.jina.ai/${url}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const readerResp = await fetch(readerUrl, {
      redirect: "follow",
      headers: {
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (readerResp.ok) {
      const readerText = await readerResp.text();
      const cleanedText = cleanMarkdown(readerText);
      const fallbackTitle = readerText.split("\n")[0] || defaultTitle;

      // Garantir que o título esteja no conteúdo para contexto da IA
      let finalContent = cleanedText;
      if (
        !cleanedText.trim().startsWith(fallbackTitle) &&
        !cleanedText.trim().startsWith("#")
      ) {
        finalContent = `# ${fallbackTitle}\n\n${cleanedText}`;
      }

      return {
        url,
        title: fallbackTitle,
        content: finalContent,
      };
    }
  } catch (error) {
    console.error(`Erro no Jina Reader para ${url}:`, error);
  }
  return null;
}

/**
 * Busca HTML de uma URL e extrai título e texto limpo
 * @param url endereço da página
 * @returns conteúdo extraído com título e texto
 */
export async function extractContent(url: string): Promise<ExtractedContent> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "max-age=0",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Ch-Ua":
          '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"macOS"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        Referer: "https://www.google.com/",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(
        `[Crawler] Fetch direto falhou (${response.status}). Tentando Jina Reader...`
      );
      const jinaResult = await fetchWithJina(url);
      if (jinaResult) return jinaResult;

      throw new Error(
        `Falha ao acessar ${url}: ${response.status} ${response.statusText}`
      );
    }

    const html = await response.text();
    const title = await extractTitle(html);
    const content = await cleanText(html);

    if (content && content.trim().length > 0) {
      // Garantir que o título esteja no conteúdo
      let finalContent = content;
      if (title && !content.includes(title)) {
        finalContent = `# ${title}\n\n${content}`;
      }

      return {
        url,
        title,
        content: finalContent,
        rawHtml: html,
      };
    }

    // Se o conteúdo veio vazio, tenta Jina
    const jinaResult = await fetchWithJina(url, title);
    if (jinaResult) {
      return { ...jinaResult, rawHtml: html };
    }

    return {
      url,
      title,
      content,
      rawHtml: html,
    };
  } catch (error) {
    console.error(`Erro ao extrair ${url}:`, error);
    // Tenta Jina como último recurso
    const jinaResult = await fetchWithJina(url);
    if (jinaResult) return jinaResult;

    return { url, title: "Erro na extração", content: "" };
  }
}
