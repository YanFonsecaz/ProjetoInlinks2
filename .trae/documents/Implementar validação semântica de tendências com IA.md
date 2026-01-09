Sim, é possível e **altamente recomendado** usar a IA para essa validação. A filtragem por palavras-chave (que implementei anteriormente) resolve o problema óbvio do "lava e seca", mas pode acabar excluindo tendências legítimas que não usam as palavras exatas (ex: "Machine Learning" seria ignorado se buscarmos apenas "Inteligência Artificial").

Vou implementar uma validação semântica usando o modelo `gpt-4o-mini`, que é rápido e barato.

**Plano de Implementação:**

1.  **Criar Validador de Tendências (`src/services/trends-master/trends-summarizer.ts`)**:
    *   Criar a função `validateTrendRelevance(trend: string, category: string): Promise<boolean>`.
    *   Ela perguntará à IA: "O termo de pesquisa '${trend}' é semanticamente relevante para o setor/categoria '${category}'? Responda apenas SIM ou NAO."

2.  **Integrar na Coleta (`src/services/trends-master/serpapi-trends.ts`)**:
    *   Atualizar `collectTrendingNow` para:
        *   Fazer uma pré-filtragem leve (apenas para descartar lixo óbvio).
        *   Para os candidatos restantes, chamar `validateTrendRelevance` em paralelo.
        *   Manter apenas os aprovados pela IA.

Isso garante que "Lava e Seca" seja rejeitado (contexto irrelevante) enquanto "ChatGPT" ou "Redes Neurais" sejam aprovados para a categoria "Inteligência Artificial", mesmo sem conterem as palavras exatas.
