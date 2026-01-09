O problema é que o frontend está exibindo o Markdown puro dentro de uma tag `<pre>`, o que preserva a formatação de texto simples (incluindo as barras `|` da tabela) em vez de renderizar o HTML formatado.

Para corrigir isso e reaproveitar a lógica de correção de tabela que já criamos para o e-mail (sem duplicar código ou causar erros de dependência no frontend), farei o seguinte:

1.  **Extrair a Lógica de Conversão**: Vou mover a função de conversão de Markdown para HTML (que atualmente está dentro de `email-sender.ts`) para um novo arquivo utilitário compartilhado: `src/utils/markdown-renderer.ts`.
    *   Isso é necessário porque `email-sender.ts` usa bibliotecas de servidor (`nodemailer`) e quebraria a página se fosse importado diretamente no frontend.
    *   Vou separar a lógica em duas partes: uma que gera o fragmento HTML (para o site) e outra que gera o template completo de e-mail (para o envio).

2.  **Atualizar o Serviço de E-mail**: Modificar `src/services/trends-master/email-sender.ts` para importar e usar essa nova função utilitária.

3.  **Atualizar o Frontend**: Modificar `src/app/trends-master/page.tsx` para:
    *   Importar a nova função de renderização.
    *   Substituir a tag `<pre>` por uma `<div>` que renderiza o HTML processado (`dangerouslySetInnerHTML`), garantindo que a tabela apareça bonita e formatada na tela "Relatório".

Dessa forma, tanto o e-mail quanto o site usarão a mesma lógica robusta de tabelas que acabamos de corrigir.
