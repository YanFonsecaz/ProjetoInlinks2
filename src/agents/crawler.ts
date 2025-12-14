import { cleanText, extractTitle } from "@/utils/clean_text";
import { ExtractedContent } from "@/types";

/**
 * Busca HTML de uma URL e extrai título e texto limpo
 * @param url endereço da página
 * @returns conteúdo extraído com título e texto
 */
export async function extractContent(url: string): Promise<ExtractedContent> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const readerUrl = `https://r.jina.ai/http://${url.replace(
        /^https?:\/\//,
        ""
      )}`;
      const readerResp = await fetch(readerUrl, { redirect: "follow" });
      if (readerResp.ok) {
        const readerText = await readerResp.text();
        const fallbackTitle = readerText.split("\n")[0] || "Sem título";
        return {
          url,
          title: fallbackTitle,
          content: readerText,
        };
      }
      throw new Error(
        `Falha ao acessar ${url}: ${response.status} ${response.statusText}`
      );
    }

    const html = await response.text();
    const title = await extractTitle(html);
    const content = await cleanText(html);
    if (content && content.trim().length > 0) {
      return {
        url,
        title,
        content,
        rawHtml: html,
      };
    }

    const readerUrl = `https://r.jina.ai/http://${url.replace(
      /^https?:\/\//,
      ""
    )}`;
    const readerResp = await fetch(readerUrl, { redirect: "follow" });
    if (readerResp.ok) {
      const readerText = await readerResp.text();
      const fallbackTitle = title || readerText.split("\n")[0] || "Sem título";
      return {
        url,
        title: fallbackTitle,
        content: readerText,
        rawHtml: html,
      };
    }

    return {
      url,
      title,
      content,
      rawHtml: html,
    };
  } catch (error) {
    console.error(`Erro ao extrair ${url}:`, error);
    try {
      const readerUrl = `https://r.jina.ai/http://${url.replace(
        /^https?:\/\//,
        ""
      )}`;
      const resp = await fetch(readerUrl, { redirect: "follow" });
      if (resp.ok) {
        const text = await resp.text();
        return {
          url,
          title: "Sem título",
          content: text,
        };
      }
    } catch {}
    return { url, title: "Erro na extração", content: "" };
  }
}
