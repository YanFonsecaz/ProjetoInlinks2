/**
 * Gerador de relatório Markdown para tendências
 * Conversão do _format_table_md (Python) para TypeScript
 */

import {
  TrendItem,
  NewsResult,
  PeriodData,
  TrendsReport,
  TrendsPeriod,
} from "./types";

/**
 * Dias da semana em português
 */
const WEEKDAYS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

/**
 * Labels dos períodos em português
 */
const PERIOD_LABELS: Record<TrendsPeriod, string> = {
  diario: "Diário",
  semanal: "Semanal",
  mensal: "Mensal",
};

/**
 * Identifica o número da coleta com base na hora
 */
function getColetaLabel(hour: number): string {
  if (hour < 10) return "Coleta 1";
  if (hour < 13) return "Coleta 2";
  return "Coleta";
}

/**
 * Gera tabela Markdown para um período específico
 */
/**
 * Formata texto para tabela Markdown (escapa pipes)
 */
function safeMd(text: string): string {
  return (text || "—").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

/**
 * Gera tabela Markdown para um período específico
 */
function formatPeriodTable(
  sector: string,
  trends: TrendItem[],
  news: NewsResult[],
  now: Date
): string {
  const hora = now.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const diaSemana = WEEKDAYS[now.getDay()];
  const coleta = getColetaLabel(now.getHours());

  const lines: string[] = [];
  // Ajuste no título da seção para ser mais limpo
  lines.push(`#### ${sector} - Análise (${coleta} - ${hora})\n`);
  // Reordenação de colunas para match exato com o screenshot
  lines.push(
    "| Palavra-chave | Tipo | Título | Fonte | Link | Data/Hora | Dia | Resumo |"
  );
  lines.push("|---|---|---|---|---|---|---|---|");

  // Mapeia tipo por keyword
  const typeByKeyword = new Map<string, string>();
  for (const trend of trends) {
    if (trend.keyword) {
      typeByKeyword.set(trend.keyword, trend.type || "top");
    }
  }

  // Mapeia notícias por keyword
  const newsByKeyword = new Map<string, NewsResult["articles"]>();
  for (const item of news) {
    newsByKeyword.set(item.keyword, item.articles);
  }

  // Gera linhas da tabela
  for (const [keyword, type] of typeByKeyword) {
    const articles = newsByKeyword.get(keyword) || [];

    if (articles.length === 0) {
      lines.push(
        `| ${safeMd(keyword)} | ${safeMd(
          type
        )} | — | — | — | ${hora} | ${diaSemana} | — |`
      );
      continue;
    }

    for (const article of articles) {
      const title = article.title;
      const source = article.source;
      const link = article.link;
      const date = article.date || hora;
      const resumo = article.snippet || "";

      lines.push(
        `| ${safeMd(keyword)} | ${safeMd(type)} | ${safeMd(title)} | ${safeMd(
          source
        )} | ${safeMd(link)} | ${date} | ${diaSemana} | ${safeMd(resumo)} |`
      );
    }
  }

  if (typeByKeyword.size === 0) {
    lines.push("");
    lines.push("> Sem dados de tendências retornados para este período.");
  }

  return lines.join("\n");
}

/**
 * Gera relatório completo em Markdown
 *
 * @param sector - Setor analisado
 * @param periodsData - Dados por período
 * @param summary - Resumo gerado pelo LLM
 * @returns Relatório em formato Markdown
 */
export function generateReport(
  sector: string,
  periodsData: PeriodData[],
  summary: string
): string {
  const now = new Date();
  const dataFormatada = now.toLocaleDateString("pt-BR");

  const sections: string[] = [];

  // Header principal
  sections.push(`# Relatório de Tendências - ${sector}`);
  sections.push(`**Data:** ${dataFormatada}\n`);

  // Seção por categoria (Autos)
  sections.push(`## ${sector}\n`);

  for (const period of periodsData) {
    sections.push(`### ${period.label}\n`);
    sections.push(formatPeriodTable(sector, period.trends, period.news, now));
    sections.push("");
  }

  // Resumo geral
  sections.push("## Resumo Geral\n");
  sections.push(summary);
  sections.push("");

  return sections.join("\n");
}

/**
 * Cria estrutura de dados do relatório
 */
export function createReport(
  sector: string,
  periodsData: PeriodData[],
  summary: string
): TrendsReport {
  return {
    sector,
    generatedAt: new Date(),
    periods: periodsData,
    summary,
    markdown: generateReport(sector, periodsData, summary),
  };
}
