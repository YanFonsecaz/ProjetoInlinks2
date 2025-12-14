/**
 * Utilitário para busca de texto robusta (Fuzzy Matching).
 * Permite encontrar strings ignorando diferenças de whitespace,
 * pontuação básica e pequenas variações (singular/plural/typos).
 */

/**
 * Normaliza uma string removendo acentos e convertendo para minúsculas.
 */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/**
 * Calcula a distância de Levenshtein entre duas strings.
 * Útil para saber o quão "perto" duas strings estão.
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) == a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substituição
          Math.min(
            matrix[i][j - 1] + 1, // inserção
            matrix[i - 1][j] + 1 // deleção
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Verifica se 'search' existe em 'content' com tolerância a erros.
 * 1. Tenta match exato normalizado (rápido).
 * 2. Se falhar, varre o conteúdo buscando substrings com distância de Levenshtein baixa.
 */
export function fuzzyContains(content: string, search: string): boolean {
  if (!content || !search) return false;

  const contentNorm = normalizeText(content);
  const searchNorm = normalizeText(search);

  // 1. Match Simples (ignorando pontuação/espaços)
  const clean = (s: string) => s.replace(/[^\w\s]|_/g, "").replace(/\s+/g, "");
  if (clean(contentNorm).includes(clean(searchNorm))) {
    return true;
  }

  // 2. Match Aproximado (Levenshtein) para frases curtas (< 50 chars)
  // Se a frase for muito longa, Levenshtein fica lento, então pulamos.
  if (searchNorm.length > 50) return false;

  // Janela deslizante: pega trechos do tamanho aproximado da busca e compara
  const windowSize = searchNorm.length + 5; // margem de erro
  const threshold = Math.max(2, Math.floor(searchNorm.length * 0.2)); // aceita 20% de erro

  for (let i = 0; i < contentNorm.length - searchNorm.length; i += 5) { // step de 5 para performance
    const window = contentNorm.slice(i, i + windowSize);
    const dist = levenshteinDistance(searchNorm, window.slice(0, searchNorm.length));
    if (dist <= threshold) return true;
  }

  return false;
}
