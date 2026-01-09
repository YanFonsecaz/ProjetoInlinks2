Para corrigir a coluna "Resumo" que está vindo vazia e atender à solicitação de gerar resumos via IA baseados no conteúdo do link, farei as seguintes alterações:

1.  **Criar Função de Resumo de Artigo (`src/services/trends-master/trends-summarizer.ts`)**:
    *   Implementar `summarizeArticle(content: string)`: Uma função que recebe o texto bruto de uma notícia e usa o modelo `gpt-4o-mini` (mais rápido e econômico) para gerar um resumo conciso de 1 a 2 frases.

2.  **Integrar Scraping e Resumo na Busca de Notícias (`src/services/trends-master/serpapi-news.ts`)**:
    *   Atualizar a função `fetchNewsForKeyword` para que, após receber os links do Google News:
        *   Para cada artigo, execute o `extractContent` (já existente no crawler) para baixar o texto da URL.
        *   Envie o texto para a nova função `summarizeArticle`.
        *   Substitua o campo `snippet` pelo resumo gerado pela IA.
    *   **Fallback**: Se o scraping ou a IA falharem, manter o snippet original do Google ou exibir "Resumo indisponível".
    *   **Performance**: Executar essas chamadas em paralelo para minimizar o tempo de espera do relatório.

Dessa forma, a coluna "Resumo" será preenchida com informações reais processadas pela IA, em vez de depender de snippets muitas vezes vazios da API de busca.
