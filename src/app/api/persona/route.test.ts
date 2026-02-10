import { POST, GET, PATCH, DELETE } from "./route";
import { NextRequest } from "next/server";
import { verifyAuth } from "@/utils/auth";
import { checkRateLimit } from "@/utils/rate-limit";
import { supabase } from "@/lib/supabase";

// Mock das dependências
jest.mock("@/utils/auth");
jest.mock("@/utils/rate-limit");
jest.mock("@/lib/supabase", () => {
  const mockSupabase = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn(),
  };
  return { supabase: mockSupabase };
});
jest.mock("@/services/ai-persona-service", () => ({
  analyzeToneAndPersona: jest.fn().mockResolvedValue("divertido"),
  estimateAnalysisTime: jest.fn().mockReturnValue(10),
}));

describe("POST /api/persona", () => {
  const validBody = {
    tipo_de_tom: "corporativo",
    nome_da_marca: "Minha Marca",
    publico_alvo: {
      segmento: "Tecnologia",
    },
    objetivos_de_comunicação: ["engajamento"],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deve retornar 401 se não estiver autenticado", async () => {
    (verifyAuth as jest.Mock).mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/persona", {
      method: "POST",
      body: JSON.stringify(validBody),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("deve retornar 429 se exceder o rate limit", async () => {
    (verifyAuth as jest.Mock).mockResolvedValue("user-123");
    (checkRateLimit as jest.Mock).mockResolvedValue(false);

    const req = new NextRequest("http://localhost/api/persona", {
      method: "POST",
      body: JSON.stringify(validBody),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it("deve retornar 400 se o corpo for inválido", async () => {
    (verifyAuth as jest.Mock).mockResolvedValue("user-123");
    (checkRateLimit as jest.Mock).mockResolvedValue(true);

    const req = new NextRequest("http://localhost/api/persona", {
      method: "POST",
      body: JSON.stringify({ tipo_de_tom: "invalido" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("deve criar uma persona com sucesso", async () => {
    (verifyAuth as jest.Mock).mockResolvedValue("user-123");
    (checkRateLimit as jest.Mock).mockResolvedValue(true);
    (supabase.from as jest.Mock).mockReturnValue({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest
        .fn()
        .mockResolvedValue({ data: { id: "persona-123" }, error: null }),
    });

    const req = new NextRequest("http://localhost/api/persona", {
      method: "POST",
      body: JSON.stringify(validBody),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.id).toBe("persona-123");
    expect(json.status_processamento).toBe("completed");
  });

  it("deve iniciar processamento se for analise_automatica", async () => {
    (verifyAuth as jest.Mock).mockResolvedValue("user-123");
    (checkRateLimit as jest.Mock).mockResolvedValue(true);
    (supabase.from as jest.Mock).mockReturnValue({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest
        .fn()
        .mockResolvedValue({ data: { id: "persona-456" }, error: null }),
    });

    const bodyWithAI = {
      ...validBody,
      tipo_de_tom: "analise_automatica",
      texto_referencia: "Um texto longo aqui...",
    };

    const req = new NextRequest("http://localhost/api/persona", {
      method: "POST",
      body: JSON.stringify(bodyWithAI),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.status_processamento).toBe("processing");
    expect(json.tempo_estimado_analise).toBeDefined();
  });

  it("deve retornar 400 se analise_automatica for pedida sem texto_referencia", async () => {
    (verifyAuth as jest.Mock).mockResolvedValue("user-123");
    (checkRateLimit as jest.Mock).mockResolvedValue(true);

    const bodyWithoutRef = {
      ...validBody,
      tipo_de_tom: "analise_automatica",
    };

    const req = new NextRequest("http://localhost/api/persona", {
      method: "POST",
      body: JSON.stringify(bodyWithoutRef),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("deve retornar 500 se houver erro no banco de dados", async () => {
    (verifyAuth as jest.Mock).mockResolvedValue("user-123");
    (checkRateLimit as jest.Mock).mockResolvedValue(true);
    (supabase.from as jest.Mock).mockReturnValue({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest
        .fn()
        .mockResolvedValue({ data: null, error: { message: "DB Error" } }),
    });

    const req = new NextRequest("http://localhost/api/persona", {
      method: "POST",
      body: JSON.stringify(validBody),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});

describe("GET /api/persona", () => {
  it("deve retornar 200 e a lista de personas", async () => {
    (verifyAuth as jest.Mock).mockResolvedValue("user-123");
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [{ id: "1" }], error: null }),
    });

    const req = new NextRequest("http://localhost/api/persona");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toHaveLength(1);
  });
});

describe("PATCH /api/persona", () => {
  it("deve atualizar uma persona com sucesso", async () => {
    (verifyAuth as jest.Mock).mockResolvedValue("user-123");
    (supabase.from as jest.Mock).mockReturnValue({
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest
        .fn()
        .mockResolvedValue({ data: { id: "1", nome: "Novo" }, error: null }),
    });

    const req = new NextRequest("http://localhost/api/persona", {
      method: "PATCH",
      body: JSON.stringify({ id: "1", nome_da_marca: "Novo" }),
    });

    const res = await PATCH(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.nome).toBe("Novo");
  });
});

describe("DELETE /api/persona", () => {
  it("deve excluir uma persona com sucesso", async () => {
    (verifyAuth as jest.Mock).mockResolvedValue("user-123");

    // Mock manual para garantir sucesso
    (supabase.from as jest.Mock).mockReturnValue({
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    });

    const req = new NextRequest("http://localhost/api/persona?id=1", {
      method: "DELETE",
    });

    const res = await DELETE(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });
});
