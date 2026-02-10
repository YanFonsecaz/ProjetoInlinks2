import { supabase } from "@/lib/supabase";

const LIMIT = 100;
const WINDOW_MS = 60 * 60 * 1000; // 1 hora em milissegundos

/**
 * Verifica e atualiza o rate limit de um usuário para um endpoint específico
 * @param userId ID do usuário
 * @param endpoint Nome do endpoint (ex: 'persona')
 * @returns boolean indicando se a requisição é permitida
 */
export async function checkRateLimit(
  userId: string,
  endpoint: string,
): Promise<boolean> {
  const now = new Date();

  // Busca o registro atual do usuário
  const { data, error } = await supabase
    .from("rate_limits")
    .select("request_count, last_request")
    .eq("user_id", userId)
    .eq("endpoint", endpoint)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 é 'no rows returned'
    console.error("Erro no rate limit:", error.message);
    return true; // Falha segura: permite a requisição em caso de erro no DB
  }

  if (!data) {
    // Primeiro acesso
    await supabase.from("rate_limits").insert({
      user_id: userId,
      endpoint: endpoint,
      request_count: 1,
      last_request: now.toISOString(),
    });
    return true;
  }

  const lastRequest = new Date(data.last_request);
  const diff = now.getTime() - lastRequest.getTime();

  if (diff > WINDOW_MS) {
    // Janela expirou, reseta o contador
    await supabase
      .from("rate_limits")
      .update({
        request_count: 1,
        last_request: now.toISOString(),
      })
      .eq("user_id", userId)
      .eq("endpoint", endpoint);
    return true;
  }

  if (data.request_count >= LIMIT) {
    return false;
  }

  // Incrementa o contador
  await supabase
    .from("rate_limits")
    .update({
      request_count: data.request_count + 1,
    })
    .eq("user_id", userId)
    .eq("endpoint", endpoint);

  return true;
}
