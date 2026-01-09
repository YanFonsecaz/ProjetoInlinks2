Após uma análise detalhada do arquivo `src/services/trends-master/serpapi-trends.ts`, identifiquei que o sistema possui uma lógica hardcoded específica para o setor "Autos", que força o comportamento da automação mesmo quando o usuário pode querer algo mais genérico ou dinâmico.

**Pontos identificados que impactam a automação de maneira forçada:**

1.  **Filtros de Tokens Automotivos (`AUTOS_TOKENS`)**:
    *   Existe uma lista fixa de palavras (`carro`, `suv`, `ipva`, etc.) usada para filtrar os resultados do "Trending Now". Se uma tendência diária não contiver uma dessas palavras, ela é descartada, o que pode ser restritivo demais.

2.  **Sementes de Fallback (`SEED_TRENDS`)**:
    *   Uma lista estática de tendências (`carros elétricos`, `SUV híbrido`, `IPVA`) é retornada automaticamente se a API falhar ou não encontrar resultados, mascarando o fato de que não houve dados reais.

3.  **Detecção e Queries Forçadas para Autos**:
    *   O sistema verifica se a categoria é "Autos" ou similar e, se for, **ignora** o termo original e força uma busca por uma lista pré-definida: `['carros', 'automóveis', 'veículos', 'suv', 'lançamento carros', 'preço carros', 'motos', 'híbridos', 'elétricos']`. Isso impede que você busque por nichos específicos dentro de autos (ex: "caminhões" ou "náutica") sem ser inundado por carros.

**Plano de Correção:**

Para tornar a automação agnóstica e respeitar a configuração do usuário:

1.  **Remover `AUTOS_TOKENS` e `SEED_TRENDS`**: Eliminar as listas estáticas que viciam os resultados.
2.  **Generalizar a Lógica de Coleta (`collectTrends`)**:
    *   Remover o bloco `if (isAutos) { ... }` que força as queries fixas.
    *   Fazer com que o sistema use **sempre** a categoria informada pelo usuário (ou os tópicos personalizados) como base para a busca de `Related Queries`.
    *   Se a categoria for "Autos", ele buscará tendências relacionadas a "Autos". Se for "Caminhões", buscará sobre "Caminhões", sem desvios forçados.
3.  **Ajustar Filtros do Trending Now**:
    *   Em vez de filtrar por uma lista fixa de tokens, filtrar apenas se o termo do trending contém a palavra-chave da categoria (comportamento genérico que já existe para outros setores).

Essa limpeza garantirá que o "Trends Master" funcione para qualquer setor que você configurar, sem "puxar a sardinha" para carros automaticamente.
