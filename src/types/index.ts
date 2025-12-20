export interface ExtractedContent {
  url: string;
  title: string;
  content: string;
  rawHtml?: string;
}

export interface Competitor {
  url: string;
}

export interface Cannibalization {
  score: number;
  competidores: string[];
}

export interface ContentAnalysis {
  theme?: string; // Tema Principal
  intencao: string;
  funil: string;
  clusters: string[];
  entidades: string[];
  canibalizacao?: Cannibalization;
}

export interface AnchorOpportunity {
  anchor: string;
  trecho: string;
  origem: string;
  destino: string;
  score: number;
  reason?: string;
  type?: 'exact'; // Apenas exact permitido
  original_text?: string;
  pillar_context?: string; // Justificativa do destino
  target_topic?: string;
}

export interface ProcessResult {
  extracted: ExtractedContent;
  analysis: ContentAnalysis;
  anchors: AnchorOpportunity[];
}

export interface ProcessRequest {
  urls: string[];
  targetUrl?: string; // Para verificar canibalização contra uma URL específica ou entre si
  config?: {
    minWords?: number;
    maxWords?: number;
    openAiKey?: string;
    modelName?: string;
  };
}
