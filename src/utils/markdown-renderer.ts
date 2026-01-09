/**
 * Utilitário para converter Markdown básico para HTML
 * Suporta tabelas, headers, links, negrito e blockquotes
 * Projetado para ser safe tanto no backend (Node) quanto frontend (React)
 */

/**
 * Converte string Markdown para fragmento HTML
 */
export function convertMarkdownToHtmlFragment(markdown: string): string {
  // 1. Formatação Inline Global (que não depende de quebras de linha)
  let processedMarkdown = markdown
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: #0b5fff; text-decoration: underline;">$1</a>');

  // 2. Processamento Linha a Linha
  const lines = processedMarkdown.split('\n');
  let inTable = false;
  let tableHeader: string[] = [];
  let tableRows: string[][] = [];
  const processedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    // --- Headers ---
    if (!inTable && line.startsWith('#')) {
      if (/^#### (.+)$/.test(line)) {
        processedLines.push(line.replace(/^#### (.+)$/, '<h4 style="margin-top: 1.2em; margin-bottom: 0.5em; font-weight: 600; font-size: 1.1em; color: #111;">$1</h4>'));
        continue;
      }
      if (/^### (.+)$/.test(line)) {
        processedLines.push(line.replace(/^### (.+)$/, '<h3 style="margin-top: 1.2em; margin-bottom: 0.5em; font-weight: 600; font-size: 1.25em; color: #111;">$1</h3>'));
        continue;
      }
      if (/^## (.+)$/.test(line)) {
        processedLines.push(line.replace(/^## (.+)$/, '<h2 style="margin-top: 1.2em; margin-bottom: 0.5em; font-weight: 700; font-size: 1.5em; color: #111; border-bottom: 1px solid #eee; padding-bottom: 0.3em;">$1</h2>'));
        continue;
      }
      if (/^# (.+)$/.test(line)) {
        processedLines.push(line.replace(/^# (.+)$/, '<h1 style="margin-top: 1.2em; margin-bottom: 0.5em; font-weight: 800; font-size: 1.8em; color: #111;">$1</h1>'));
        continue;
      }
    }

    // --- Blockquotes ---
    if (!inTable && line.startsWith('> ')) {
       processedLines.push(line.replace(/^> (.+)$/, '<blockquote style="border-left: 4px solid #ddd; padding-left: 16px; margin: 1em 0; color: #666; font-style: italic;">$1</blockquote>'));
       continue;
    }

    // --- Tabelas ---
    if (line.startsWith('|')) {
      // Divide a linha pelas barras, ignorando barras escapadas
      const cells = line.split(/(?<!\\)\|/).filter((c, idx, arr) => {
        return idx !== 0 && idx !== arr.length - 1; // Remove bordas
      }).map(c => c.trim().replace(/\\\|/g, '|'));

      if (!inTable) {
        // Verifica se a PRÓXIMA linha é um separador de tabela (|---|---|)
        if (i + 1 < lines.length && lines[i+1].trim().startsWith('|') && lines[i+1].includes('---')) {
          inTable = true;
          tableHeader = cells;
          i++; // Pula a linha separadora na próxima iteração
        } else {
          // Linha que começa com | mas não é tabela
          processedLines.push(line + '<br>');
        }
      } else {
        // Já estamos dentro da tabela
        tableRows.push(cells);
      }
    } else {
      // --- Linha comum ou Fim de Tabela ---
      
      // Se estava em tabela e saiu, renderiza a tabela agora
      if (inTable) {
        const headerHtml = tableHeader.map(c => 
          `<th style="border: 1px solid #e2e8f0; padding: 12px; background: #f8fafc; text-align: left; font-size: 0.875rem; font-weight: 600; color: #1e293b;">${c}</th>`
        ).join('');

        const rowsHtml = tableRows.map((row, rowIndex) => {
          const cellsHtml = row.map(c => 
            `<td style="border: 1px solid #e2e8f0; padding: 12px; font-size: 0.875rem; color: #334155; vertical-align: top;">${c}</td>`
          ).join('');
          return `<tr style="background-color: ${rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc'}">${cellsHtml}</tr>`;
        }).join('');

        processedLines.push(`<div style="overflow-x: auto; margin: 1.5em 0; border-radius: 0.5rem; border: 1px solid #e2e8f0;">
          <table style="border-collapse: collapse; width: 100%; font-family: ui-sans-serif, system-ui, sans-serif;">
            <thead><tr>${headerHtml}</tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>`);

        inTable = false;
        tableHeader = [];
        tableRows = [];
        
        if (line.length > 0) {
            processedLines.push(`<p style="margin: 0.5em 0;">${line}</p>`);
        }
      } else {
        // Linha comum fora de tabela
        if (line.length > 0) {
             processedLines.push(`<p style="margin: 0.5em 0;">${line}</p>`);
        } else {
             processedLines.push('<br>');
        }
      }
    }
  }

  // Se terminou o loop e ainda estava em tabela
  if (inTable) {
    const headerHtml = tableHeader.map(c => 
      `<th style="border: 1px solid #e2e8f0; padding: 12px; background: #f8fafc; text-align: left; font-size: 0.875rem; font-weight: 600; color: #1e293b;">${c}</th>`
    ).join('');

    const rowsHtml = tableRows.map((row, rowIndex) => {
      const cellsHtml = row.map(c => 
        `<td style="border: 1px solid #e2e8f0; padding: 12px; font-size: 0.875rem; color: #334155; vertical-align: top;">${c}</td>`
      ).join('');
      return `<tr style="background-color: ${rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc'}">${cellsHtml}</tr>`;
    }).join('');

    processedLines.push(`<div style="overflow-x: auto; margin: 1.5em 0; border-radius: 0.5rem; border: 1px solid #e2e8f0;">
      <table style="border-collapse: collapse; width: 100%; font-family: ui-sans-serif, system-ui, sans-serif;">
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>`);
  }

  return processedLines.join('\n');
}

/**
 * Envolve o fragmento HTML em um template básico de e-mail
 */
export function wrapHtmlForEmail(htmlContent: string): string {
  return `
    <html>
      <head>
        <meta charset='utf-8'>
        <style>
          body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
          a { color: #0b5fff; text-decoration: none; }
          a:hover { text-decoration: underline; }
          table { width: 100%; border-collapse: collapse; }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
    </html>
  `;
}
