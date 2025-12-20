"use client";

import { AnchorOpportunity } from "@/types";

export function generateCSV(
  data: AnchorOpportunity[],
  pillarUrl: string
): string {
  if (!data || data.length === 0) return "";

  // Helper para sanitizar campos para CSV (aspas duplas escapadas)
  const sanitize = (str: string | number | undefined) => {
    if (str === undefined || str === null) return "";
    const stringValue = String(str);
    // Escapa aspas duplas duplicando-as e envolve o campo em aspas
    return `"${stringValue.replace(/"/g, '""')}"`;
  };

  // Extrai domínio para o título
  let domain = "";
  try {
    domain = new URL(pillarUrl).hostname;
  } catch (e) {
    domain = pillarUrl;
  }

  const today = new Date().toLocaleDateString("pt-BR");

  // Cabeçalho Hierárquico conforme modelo solicitado
  // Adicionando colunas extras solicitadas: Tipo, Score, Frase na Satellite, Frase na Pillar
  const lines = [
    // Linha 1: Título Geral
    `"","","Auditoria de Linkagem Interna: ${domain} ","","","","","","","","",""`,
    // Linhas 2-3: Vazias
    `"","","","","","","","","","","",""`,
    `"","","","","","","","","","","",""`,
    // Linha 4: Cabeçalho do Pilar
    `"#1","URL da Página Pilar","","","Produto/Serviço","","","","","Data de Implementação","",""`,
    // Linha 5: Dados do Pilar
    `${sanitize(pillarUrl)},"","","","","","","","","${today}","",""`,
    // Linha 6: Vazia
    `"","","","","","","","","","","",""`,
    // Linha 7: Cabeçalho das Oportunidades
    `"","URL Onde Inserir (Origem)","","Texto Âncora","URL Destino (Alvo)","Score","Instrução/Parágrafo","Contexto na Origem","Otimização Implementada","Justificativa"`,
  ];

  // Linhas de dados (Oportunidades)
  data.forEach((row, index) => {
    // Instrução + Parágrafo
    const instruction = `Inserir a marcação do hiperlink na âncora sinalizada em negrito:\n\n${row.trecho}`;

    const line = [
      index + 1, // A: ID
      sanitize(row.origem), // B: URL Origem
      "", // C
      sanitize(row.anchor), // D: Âncora
      sanitize(row.destino), // E: URL Destino (Nova coluna explícita)
      sanitize(row.score?.toFixed(2) || "0.00"), // F: Score
      sanitize(instruction), // G: Instrução
      sanitize(row.trecho), // H: Contexto na Origem
      "TRUE", // I: Status
      sanitize(row.reason || row.pillar_context || "N/A"), // J: Justificativa
    ].join(",");

    lines.push(line);
  });

  // Adiciona BOM para UTF-8 e junta as linhas
  return "\uFEFF" + lines.join("\n");
}

export function downloadCSV(
  content: string,
  filename: string = "inlinks_opportunities.csv"
) {
  if (typeof window === "undefined") return;

  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

/**
 * Gera JSON string para oportunidades de inlinks
 * @param data lista de oportunidades
 * @returns string JSON formatada
 */
export function generateJSON(data: AnchorOpportunity[]): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Gera Markdown com tabela de oportunidades
 * @param data lista de oportunidades
 * @returns string Markdown
 */
export function generateMarkdown(data: AnchorOpportunity[]): string {
  const header = `| Origem | Âncora | Tipo | Destino | Score | Motivo |\n|---|---|---|---|---|---|`;
  const rows = data.map((r) => {
    const score = r.score?.toFixed(2) || "0.00";
    const reason = r.reason ?? "";
    const type = r.type ?? "exact";
    return `| ${r.origem} | ${r.anchor} | ${type} | ${r.destino} | ${score} | ${reason} |`;
  });
  return [header, ...rows].join("\n");
}

/**
 * Faz download de conteúdo texto (JSON/MD)
 * @param content conteúdo em texto
 * @param filename nome do arquivo
 */
export function downloadText(content: string, filename: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: "text/plain;charset=utf-8;" });
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
