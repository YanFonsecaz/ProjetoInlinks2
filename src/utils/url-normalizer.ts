/**
 * Normaliza uma URL para uso consistente em chaves de banco de dados e metadados.
 * Remove protocol, www, query params e trailing slashes para comparação robusta.
 * Mas retorna uma versão limpa completa (https://...) para armazenamento.
 */
export function normalizeUrlForMetadata(url: string): string {
  try {
    // Adiciona protocolo se faltar para o parser funcionar
    const urlToParse = url.startsWith("http") ? url : `https://${url}`;
    const urlObj = new URL(urlToParse);

    // Remove www
    let hostname = urlObj.hostname.replace(/^www\./, "").toLowerCase();

    // Remove trailing slash e hash
    let pathname = urlObj.pathname.replace(/\/$/, "");
    if (pathname === "") pathname = "/";

    // Ignora search params e hash para canonicalização de conteúdo
    return `https://${hostname}${pathname}`;
  } catch (e) {
    // Fallback: limpeza básica de string
    return url.trim().toLowerCase().replace(/\/$/, "").split("#")[0];
  }
}

/**
 * Normaliza apenas para comparação (sem protocolo)
 */
export function normalizeUrlForComparison(url: string): string {
  try {
    const urlToParse = url.startsWith("http") ? url : `https://${url}`;
    const urlObj = new URL(urlToParse);
    const hostname = urlObj.hostname.replace(/^www\./, "").toLowerCase();
    const pathname = urlObj.pathname.replace(/\/$/, "");
    return `${hostname}${pathname}`;
  } catch (e) {
    return url
      .trim()
      .toLowerCase()
      .replace(/^(https?:\/\/)?(www\.)?/, "")
      .replace(/\/$/, "");
  }
}
