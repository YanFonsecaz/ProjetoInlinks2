# Plano: Remover Preenchimento Automático

Para atender à solicitação de que "o usuário deve colocar" os emails e tópicos personalizados, farei a seguinte alteração no frontend:

1.  **Modificar `src/app/trends-master/page.tsx`**:
    *   Alterar a lógica do `useEffect` que carrega as configurações salvas (`loadTrendsConfig`).
    *   **Não carregar** a lista de `emailRecipients` (destinatários) do banco de dados.
    *   **Não carregar** os `customTopics` (tópicos personalizados) do banco de dados.
    *   Manter o carregamento das outras preferências (Setor, Períodos, Top N, etc.).

Dessa forma, sempre que a página for recarregada, os campos de E-mail e Tópicos Personalizados virão **vazios**, exigindo que o usuário os preencha manualmente conforme desejado.

## Arquivos Afetados
- `src/app/trends-master/page.tsx`

Deseja confirmar essa alteração?