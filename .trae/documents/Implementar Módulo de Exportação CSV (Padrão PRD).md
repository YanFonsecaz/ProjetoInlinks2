Vou refatorar a funcionalidade de exportação para seguir estritamente a arquitetura e os requisitos definidos no PRD.

### O Plano

1.  **Criar o módulo `src/utils/exporter.ts`**:
    *   Conforme definido na seção "5. Estrutura Developer‑Friendly" do PRD.
    *   Este módulo será responsável por formatar os dados.

2.  **Implementar a geração de CSV Padrão**:
    *   Garantir compatibilidade com Excel adicionando o **BOM (Byte Order Mark)** `\uFEFF` (muito importante para caracteres acentuados em português).
    *   Usar delimitador `;` (ponto e vírgula) que é o padrão para Excel no Brasil/Europa, ou garantir que o `,` funcione com aspas corretas.
    *   Mapear as colunas exatamente como sugerido nos exemplos de JSON do PRD.

3.  **Atualizar o Frontend (`src/app/page.tsx`)**:
    *   Substituir a lógica *hardcoded* pela chamada da nova função utilitária.

### Arquivos Afetados
*   `src/utils/exporter.ts` (Novo)
*   `src/app/page.tsx` (Modificação)
