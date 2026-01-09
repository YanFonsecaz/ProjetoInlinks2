/**
 * Tipos TypeScript para o módulo Trends Master
 * Conversão do CrewAi-Trends-v2 (Python) para a stack Next.js/TypeScript
 */

/**
 * Configuração do módulo Trends Master
 */
export interface TrendsConfig {
  /** Setor/categoria para monitoramento (ex: "Autos", "Tecnologia") */
  sector: string;
  /** Períodos de análise habilitados */
  periods: TrendsPeriod[];
  /** Número máximo de tendências Top a coletar */
  topN: number;
  /** Número máximo de tendências Rising a coletar */
  risingN: number;
  /** Número máximo de artigos por palavra-chave */
  maxArticles: number;
  /** Lista de destinatários de email */
  emailRecipients: string[];
  /** Se o envio de email está habilitado */
  emailEnabled: boolean;
  /** Modo de envio de email */
  emailMode?: 'smtp' | 'api';
  /** Provedor de API de email (quando emailMode='api') */
  emailApiProvider?: 'sendgrid' | 'mailgun';
  /** Tópicos personalizados para monitoramento extra */
  customTopics?: string[];
}

/**
 * Períodos disponíveis para análise de tendências
 */
export type TrendsPeriod = 'diario' | 'semanal' | 'mensal';

/**
 * Item de tendência coletado do Google Trends
 */
export interface TrendItem {
  /** Palavra-chave da tendência */
  keyword: string;
  /** Tipo da tendência: top (estabelecida) ou rising (em ascensão) */
  type: 'top' | 'rising';
  /** Score ou volume de busca (quando disponível) */
  score?: number | string;
}

/**
 * Artigo de notícia coletado do Google News
 */
export interface NewsArticle {
  /** Título da notícia */
  title: string;
  /** Link para a notícia */
  link: string;
  /** Nome da fonte/portal */
  source: string;
  /** Data de publicação */
  date: string;
  /** Resumo/Snippet da notícia */
  snippet?: string;
}

/**
 * Resultado de busca de notícias para uma palavra-chave
 */
export interface NewsResult {
  /** Palavra-chave pesquisada */
  keyword: string;
  /** Lista de artigos encontrados */
  articles: NewsArticle[];
}

/**
 * Dados de um período específico no relatório
 */
export interface PeriodData {
  /** Label do período (ex: "Diário", "Semanal") */
  label: string;
  /** Identificador do período */
  periodo: TrendsPeriod;
  /** Tendências coletadas */
  trends: TrendItem[];
  /** Notícias encontradas */
  news: NewsResult[];
}

/**
 * Relatório completo de tendências
 */
export interface TrendsReport {
  /** Setor analisado */
  sector: string;
  /** Data/hora de geração */
  generatedAt: Date;
  /** Dados por período */
  periods: PeriodData[];
  /** Resumo gerado pelo LLM */
  summary: string;
  /** Relatório em formato Markdown */
  markdown: string;
}

/**
 * Status de execução da pipeline
 */
export interface PipelineStatus {
  /** Status atual */
  status: 'idle' | 'running' | 'completed' | 'error';
  /** Etapa atual */
  step?: 'trends' | 'news' | 'summary' | 'report' | 'email';
  /** Progresso (0-100) */
  progress: number;
  /** Mensagem de log */
  message?: string;
  /** Erro, se houver */
  error?: string;
}

/**
 * Configuração de email SMTP
 */
export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
}

/**
 * Configuração de email via API
 */
export interface EmailApiConfig {
  provider: 'sendgrid' | 'mailgun';
  apiKey: string;
  from: string;
  domain?: string; // Apenas para Mailgun
}
