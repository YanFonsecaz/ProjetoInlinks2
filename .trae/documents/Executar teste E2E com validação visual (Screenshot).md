Vou realizar o teste E2E (End-to-End) para validar se a correção funcionou e se o relatório está sendo gerado corretamente com a nova lógica de IA.

**Plano de Teste:**

1.  **Preparar Ambiente**:
    *   Vou adicionar a categoria "Inteligência Artificial" às opções do frontend (`src/app/trends-master/page.tsx`) e defini-la como padrão, para garantir que o teste use exatamente o termo que estava dando problema.
    *   Iniciarei o servidor de desenvolvimento local (`npm run dev`).

2.  **Executar Teste Automatizado (via Playwright)**:
    *   Navegar até a página do Trends Master (`http://localhost:3000/trends-master`).
    *   Clicar no botão "Executar Pipeline" para iniciar a geração do relatório.
    *   Aguardar o processamento (que agora inclui validação de tendências e resumo de notícias via IA).
    *   Capturar um screenshot do resultado final.

3.  **Validação**:
    *   O screenshot servirá como prova visual de que:
        *   A coluna "Resumo" está preenchida.
        *   Termos irrelevantes (como "Lava e Seca") foram filtrados.

**Observação**: Como o servidor precisa subir e a pipeline envolve chamadas de IA, o processo pode levar cerca de 1 minuto.
