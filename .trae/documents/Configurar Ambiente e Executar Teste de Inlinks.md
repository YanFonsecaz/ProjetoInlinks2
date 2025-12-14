Para atender à solicitação de configurar a API Key e o modelo, e em seguida realizar o teste, seguirei os seguintes passos:

1.  **Configurar Variáveis de Ambiente**:
    *   Renomear o arquivo `.env.example` para `.env.local` (padrão do Next.js para variáveis locais).
    *   Garantir que a chave `OPENAI_API_KEY` fornecida pelo usuário e o modelo `OPENAI_MODEL` estejam corretamente definidos neste arquivo.

2.  **Ajustar Código para Ler o Modelo**:
    *   Verificar se o código atual (`src/core/llm.ts`) está lendo a variável `OPENAI_MODEL` do ambiente. Se não estiver, farei o ajuste para que o modelo seja dinâmico conforme a configuração.

3.  **Reiniciar o Servidor**:
    *   Como variáveis de ambiente mudaram, é necessário reiniciar o servidor de desenvolvimento para que elas sejam carregadas.

4.  **Executar o Teste Automatizado**:
    *   Usar o Puppeteer (via MCP tool) para abrir o navegador, preencher o formulário com a URL pilar e as URLs de inlinks fornecidas, e iniciar o processo.
    *   Capturar um screenshot do resultado para confirmação.

Este plano garante que a aplicação esteja configurada corretamente com as credenciais fornecidas e valida o funcionamento ponta a ponta.
