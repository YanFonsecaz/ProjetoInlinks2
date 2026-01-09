Vou adicionar a coluna "Resumo" de volta à tabela de relatório no arquivo `src/services/trends-master/report-generator.ts`.

Conforme sua solicitação e a imagem de referência, a coluna será incluída para exibir o conteúdo gerado pela IA (snippet).

**Alterações planejadas:**
1.  No arquivo `src/services/trends-master/report-generator.ts`:
    *   Atualizar a função `formatPeriodTable` para incluir o cabeçalho `| Resumo |` na tabela.
    *   Adicionar o campo `snippet` (ou um fallback caso esteja vazio) nas linhas de dados da tabela.
    *   Farei o mesmo ajuste na função `formatTermTable` para manter a consistência.

Dessa forma, o relatório gerado passará a incluir a coluna de resumo.
