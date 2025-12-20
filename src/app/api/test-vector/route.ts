import { NextResponse } from "next/server";
import { getVectorStore } from "@/core/vector-store";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log("🔍 Testando Vector Store via API...");
    
    const store = getVectorStore();

    // 1. Adicionar doc de teste
    const docId = `test-${Date.now()}`;
    await store.addDocuments([
      {
        pageContent: "Este é um teste de verificação do Supabase Vector Store.",
        metadata: { type: "test", id: docId }
      }
    ]);

    // 2. Buscar
    const results = await store.similaritySearch("teste verificação", 1);

    return NextResponse.json({
      success: true,
      message: "Vector Store conectado e funcionando!",
      insertedId: docId,
      searchResult: results.map(r => r.pageContent)
    });

  } catch (error: any) {
    console.error("❌ Erro na API de teste vetorial:", error);
    return NextResponse.json({
      success: false,
      error: error.message,
      hint: "Verifique se rodou o SQL de setup no Supabase (extensions, table, function)."
    }, { status: 500 });
  }
}
