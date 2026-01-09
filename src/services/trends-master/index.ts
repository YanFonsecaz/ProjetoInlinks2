/**
 * Módulo Trends Master - Exporta todos os serviços
 */

export * from './types';
export { collectTrends } from './serpapi-trends';
export { fetchNews, fetchNewsForTerm } from './serpapi-news';
export { summarizeTrends } from './trends-summarizer';
export { generateReport, createReport } from './report-generator';
export { sendEmail } from './email-sender';
