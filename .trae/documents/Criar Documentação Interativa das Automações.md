# Plano: Implementar Documentação de Automações

Vou criar um sistema de documentação acessível pelo botão "Documentação" na página inicial. Isso explicará detalhadamente como funcionam as duas principais automações do sistema: **Inlinks AI Agent** (Link Building) e **Trends Master** (Google Trends).

## Passos da Implementação

1.  **Criar Componente de Modal de Documentação**
    *   Criar novo arquivo: `src/components/DocumentationModal.tsx`.
    *   Desenvolver uma interface com abas para alternar entre "Link Building" e "Trends Master".
    *   Incluir explicações detalhadas para cada campo e parâmetro (ex: Top N, Rising N, Estratégia de Linkagem, etc.), conforme solicitado.

2.  **Integrar na Página Inicial (`src/app/page.tsx`)**
    *   Adicionar estado para controlar a visibilidade do modal (`showDocs`).
    *   Transformar o link "Documentação" em um botão interativo.
    *   Renderizar o `DocumentationModal` quando o botão for clicado.

## Conteúdo da Documentação

*   **Trends Master**: Explicação sobre Setor, Tópicos Personalizados, Períodos (Diário/Semanal/Mensal), diferença entre Top N (volume) e Rising N (crescimento), e automação de e-mail.
*   **Link Building**: Explicação sobre Conteúdo Pilar, Sitemap, Estratégias de Linkagem e limites de links.

Deseja confirmar a criação deste módulo de documentação?