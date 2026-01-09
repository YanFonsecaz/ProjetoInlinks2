A função `markdownToHtml` está quebrando a formatação da tabela porque converte as quebras de linha (`\n`) em tags HTML (`<br>`) **antes** de processar a estrutura da tabela. Isso faz com que o parser de tabela não consiga identificar as linhas corretamente.

Para corrigir isso, vou reestruturar a função `markdownToHtml` em `src/services/trends-master/email-sender.ts` com a seguinte lógica:

1.  **Formatação Inline Primeiro**: Aplicar Negrito e Links globalmente, pois não dependem da estrutura de linhas.
2.  **Processamento Linha a Linha**: Dividir o texto em linhas (`split('\n')`) e iterar sobre elas.
3.  **Detecção de Blocos**:
    *   **Tabelas**: Identificar linhas que começam com `|` e processá-las em conjunto para gerar a estrutura HTML `<table>`.
    *   **Cabeçalhos**: Identificar linhas com `#` e converter para `<h1>` a `<h4>`.
    *   **Citações**: Identificar linhas com `>` e converter para `<blockquote>`.
    *   **Texto Comum**: Manter as linhas restantes, adicionando quebras de linha (`<br>`) apenas onde necessário.
4.  **Montagem Final**: Juntar tudo em um HTML limpo e estruturado.

Essa abordagem garante que a tabela seja renderizada corretamente no e-mail, mantendo a compatibilidade com os outros elementos de formatação.

**Arquivo afetado:**
- `src/services/trends-master/email-sender.ts`
