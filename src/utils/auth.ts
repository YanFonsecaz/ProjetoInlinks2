import { supabase } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * Verifica o token JWT enviado no header Authorization e retorna o usuário
 * @param req Request do Next.js
 * @returns User ID se válido, null caso contrário
 */
export async function verifyAuth(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.split(" ")[1];
  
  // Bypass para desenvolvimento/teste
  if (token === "mock-token") {
    return "00000000-0000-0000-0000-000000000000";
  }
  
  // No Supabase, o token JWT pode ser verificado diretamente chamando getUser
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    console.error("Erro na verificação de auth:", error?.message);
    return null;
  }

  return data.user.id;
}
