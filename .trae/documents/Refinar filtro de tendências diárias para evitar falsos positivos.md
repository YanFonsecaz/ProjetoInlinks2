O problema de "lava e seca" aparecendo em um relatório de "inteligência artificial" ocorre porque a função `collectTrendingNow` está fazendo uma filtragem muito permissiva. Ela quebra a categoria em palavras soltas e aceita qualquer tendência que contenha *qualquer* uma dessas palavras.

No caso de "inteligencia artificial":
1.  A categoria é quebrada em `['inteligencia', 'artificial']`.
2.  A notícia sobre "lava e seca" provavelmente contém a palavra "inteligência" (ex: "usa **inteligência** artificial para dosar água"), o que faz o filtro aprová-la.
3.  Como "lava e seca" é uma tendência popular (rising/top), ela acaba entrando na lista.

**Plano de Correção:**

Vou tornar o filtro da função `collectTrendingNow` em `src/services/trends-master/serpapi-trends.ts` mais rigoroso:

1.  **Correspondência Exata (ou quase)**: Em vez de aceitar qualquer palavra solta, vou exigir que a tendência contenha a **categoria completa** (ex: "inteligencia artificial") OU que, se quebrada em palavras, a correspondência seja mais forte (ex: todas as palavras presentes, ou palavras principais).
2.  **Remover Termos Genéricos**: Palavras como "inteligência", "mercado", "brasil" isoladas são muito comuns e geram falsos positivos. Vou ajustar a lógica para evitar matches em palavras únicas a menos que sejam muito específicas.

Essa alteração garantirá que apenas tendências *realmente* sobre o tema escolhido sejam incluídas no relatório diário.
