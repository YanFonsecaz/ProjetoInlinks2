import { NextRequest, NextResponse } from "next/server";
import { PersonaSchema, PersonaResponse } from "@/types/persona";
import { verifyAuth } from "@/utils/auth";
import { checkRateLimit } from "@/utils/rate-limit";
import { analyzeToneAndPersona, estimateAnalysisTime } from "@/services/ai-persona-service";
import { supabase } from "@/lib/supabase";

/**
 * @swagger
 * /api/persona:
 *   post:
 *     summary: Configura a persona da marca para o agente de IA
 *     description: Permite definir o tom de voz, público-alvo e objetivos da marca.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PersonaInput'
 *     responses:
 *       201:
 *         description: Persona criada com sucesso
 *       401:
 *         description: Não autorizado
 *       429:
 *         description: Rate limit excedido
 *       400:
 *         description: Erro de validação
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Autenticação JWT
    const userId = await verifyAuth(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Rate Limiting (100 req/hora)
    const isAllowed = await checkRateLimit(userId, "persona");
    if (!isAllowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again in an hour." },
        { status: 429 }
      );
    }

    // 3. Validação do Body
    const body = await req.json();
    const validation = PersonaSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.format() },
        { status: 400 }
      );
    }

    const personaData = validation.data;
    let status: "completed" | "processing" = "completed";
    let estimatedTime = 0;

    // 4. Análise Automática de Tom (se solicitado)
    if (personaData.tipo_de_tom === "analise_automatica") {
      if (!personaData.texto_referencia) {
        return NextResponse.json(
          { error: "texto_referencia is required for analise_automatica" },
          { status: 400 }
        );
      }
      status = "processing";
      estimatedTime = estimateAnalysisTime(personaData.texto_referencia);
      
      // Iniciamos a análise em background (em uma app real usaríamos uma Queue)
      // Aqui, faremos de forma assíncrona mas salvando o estado inicial
      analyzeToneAndPersona(personaData.texto_referencia).then(async (result) => {
         await supabase
           .from("brand_personas")
           .update({ 
             status_processamento: "completed",
             texto_referencia: `${personaData.texto_referencia}\n\nAnalise IA: ${result}`
           })
           .eq("user_id", userId)
           .eq("nome_da_marca", personaData.nome_da_marca);
      }).catch(err => console.error("Erro na análise IA:", err));
    }

    // 5. Persistência no Banco de Dados
    const { data, error } = await supabase
      .from("brand_personas")
      .insert({
        user_id: userId,
        nome_da_marca: personaData.nome_da_marca,
        tipo_de_tom: personaData.tipo_de_tom,
        texto_referencia: personaData.texto_referencia,
        publico_alvo: personaData.publico_alvo,
        objetivos_comunicacao: personaData.objetivos_de_comunicação,
        status_processamento: status,
        tempo_estimado_analise: estimatedTime
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(`Erro ao salvar no banco: ${error.message}`);
    }

    const response: PersonaResponse = {
      id: data.id,
      status_processamento: status,
      tempo_estimado_analise: estimatedTime > 0 ? estimatedTime : undefined
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error: any) {
    console.error("Erro na rota /api/persona:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}

/**
 * @swagger
 * /api/persona:
 *   get:
 *     summary: Lista todas as personas do usuário
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de personas
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await verifyAuth(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("brand_personas")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/persona:
 *   patch:
 *     summary: Atualiza uma persona existente
 *     security:
 *       - bearerAuth: []
 */
export async function PATCH(req: NextRequest) {
  try {
    const userId = await verifyAuth(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("brand_personas")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/persona:
 *   delete:
 *     summary: Exclui uma persona
 *     security:
 *       - bearerAuth: []
 */
export async function DELETE(req: NextRequest) {
  try {
    const userId = await verifyAuth(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("brand_personas")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
