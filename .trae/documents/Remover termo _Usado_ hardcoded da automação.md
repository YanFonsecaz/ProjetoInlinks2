Vou remover o termo "Usado" que está fixo no código, tanto na coleta de notícias quanto na geração do relatório.

**Plano de Ação:**

1.  **Remover a busca fixa no backend**:
    *   Arquivo: `src/app/trends-master/actions.ts`
    *   Ação: Remover o bloco de código que chama `fetchNewsForTerm('Usado', ...)` e o adiciona aos resultados. Isso impedirá que notícias sobre "Usado" sejam coletadas automaticamente.

2.  **Remover a seção fixa no relatório**:
    *   Arquivo: `src/services/trends-master/report-generator.ts`
    *   Ação: Remover a função `formatTermTable` (que é usada apenas para essa seção) e o loop que adiciona a seção `## Usados` no Markdown final.

Dessa forma, o relatório conterá apenas as tendências do setor configurado e os tópicos personalizados que você definir na interface, sem incluir "Usados" de forma forçada.
