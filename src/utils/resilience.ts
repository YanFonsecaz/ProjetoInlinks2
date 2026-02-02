/**
 * Utilitário de resiliência para chamadas de API externas.
 * Implementa Retry com Backoff Exponencial.
 */

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  factor?: number;
  retryOn?: (error: any) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  factor: 2,
  retryOn: (error: any) => {
    // Retry em erros de rede, 429 (Rate Limit) e 5xx (Server Error)
    if (!error) return false;
    
    // Se for um erro de resposta HTTP
    if (error.status) {
      return error.status === 429 || (error.status >= 500 && error.status <= 599);
    }
    
    // Se for erro de rede/timeout
    const errorMessage = error.message?.toLowerCase() || "";
    return (
      errorMessage.includes("timeout") ||
      errorMessage.includes("fetch") ||
      errorMessage.includes("network") ||
      errorMessage.includes("econnreset")
    );
  },
};

/**
 * Executa uma função com lógica de retry e backoff exponencial.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;
  let delay = opts.initialDelay;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === opts.maxRetries || !opts.retryOn(error)) {
        throw error;
      }

      console.warn(
        `⚠️ [Retry] Tentativa ${attempt + 1}/${opts.maxRetries} falhou. Aguardando ${delay}ms...`,
        error instanceof Error ? error.message : error
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * opts.factor, opts.maxDelay);
    }
  }

  throw lastError;
}

/**
 * Delay simples (Sleep)
 */
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
