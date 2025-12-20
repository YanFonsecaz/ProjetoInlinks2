import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const url = (supabase as any).supabaseUrl;
    // Tenta uma operação inócua, ex: pegar data do servidor se houver RPC,
    // ou apenas retornar status de sucesso da inicialização.

    return NextResponse.json({
      status: "success",
      message: "Supabase Client Configured",
      connected_to: url,
      has_key: !!(supabase as any).supabaseKey,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "error",
        message: error.message,
      },
      { status: 500 }
    );
  }
}
