import { z } from "zod";

/**
 * Schema de validação para a configuração de Persona da Marca
 */
export const PersonaSchema = z.object({
  tipo_de_tom: z.enum([
    "corporativo",
    "divertido",
    "técnico",
    "inspiracional",
    "analise_automatica",
  ]),
  texto_referencia: z.string().optional(),
  nome_da_marca: z.string().min(2, "Nome da marca deve ter pelo menos 2 caracteres"),
  publico_alvo: z.object({
    faixa_etaria: z.string().optional(),
    interesses: z.array(z.string()).optional(),
    localizacao: z.string().optional(),
    segmento: z.string(),
  }),
  objetivos_de_comunicação: z.array(z.string()).min(1, "Selecione pelo menos um objetivo"),
});

export type PersonaInput = z.infer<typeof PersonaSchema>;

export interface PersonaResponse {
  id: string;
  status_processamento: "completed" | "processing" | "failed";
  tempo_estimado_analise?: number; // em segundos
}
