O erro 500 recorrente indica que algo está quebrando no lado do servidor (Next.js Server Actions ou SSR) antes mesmo de renderizar a página corretamente ou durante as chamadas de API.

Já corrigi o `exporter.ts`, mas o problema persiste. Vou investigar sistematicamente os outros pontos de falha comuns em Server Components/Actions:

1.  **Verificar `src/app/page.tsx`**: Confirmar se há imports de módulos que usam APIs de Node.js (como `fs`, `path` ou bibliotecas exclusivas de server) sendo importados diretamente num Client Component (`"use client"`). Isso causa erros de compilação/runtime silenciosos que viram 500.
2.  **Verificar `src/agents/crawler.ts` e `src/utils/clean_text.ts`**: O crawler usa `fetch` e `cheerio`. Se essas funções forem chamadas incorretamente no cliente ou se houver mistura de contextos, pode falhar.
3.  **Verificar `src/core/llm.ts`**: O uso de variáveis de ambiente (`process.env`) no cliente às vezes é problemático se não tiver o prefixo `NEXT_PUBLIC_`, embora aqui devêssemos estar usando apenas no servidor.

**Plano de Ação:**
1.  **Auditoria de Imports**: Verificar se `page.tsx` (Client) está importando algo que deveria ser exclusivo do servidor.
    *   *Suspeita*: `processUrlAnalysis` e `processUrlAnchors` são Server Actions. Elas devem ser importadas de um arquivo marcado com `"use server"`. O arquivo `src/app/actions.ts` tem essa marcação? Vou conferir.
2.  **Isolamento de Server Actions**: Garantir que `src/app/actions.ts` tenha `'use server'` no topo.
3.  **Logs de Erro**: O erro 500 no navegador é genérico. Preciso olhar o terminal onde o `npm run dev` está rodando (via `check_command_status`) para ver o stack trace real do erro no servidor.

Vou começar verificando os logs do servidor para ter certeza da causa raiz e depois revisar os arquivos chave.
