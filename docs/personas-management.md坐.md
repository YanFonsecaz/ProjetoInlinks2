# Gerenciamento de Personas da Marca

Esta funcionalidade permite aos usuários configurar e gerenciar as identidades visuais e tons de voz de diferentes marcas para serem utilizadas pelo Agente de Social Media IA.

## Funcionalidades

- **CRUD Completo**: Criação, visualização, edição e exclusão de personas.
- **Integração com IA**: Opção de "Análise Automática" onde a IA extrai a persona a partir de um texto de referência.
- **Design System**: Interface totalmente integrada ao padrão NP Digital (Laranja/Slate).
- **Navbar Global**: Acesso rápido a partir de qualquer lugar do sistema.

## Documentação Técnica

### API (`/api/persona`)

- `GET`: Lista todas as personas do usuário autenticado.
- `POST`: Cria uma nova persona.
- `PATCH`: Atualiza uma persona existente (requer `id`).
- `DELETE`: Remove uma persona (requer `id` via query param).

### Componentes Principais

- `Navbar`: Gerencia a navegação global e alterna estilos entre o modo claro (NP) e modo escuro (Social Agent).
- `PersonaForm`: Formulário dinâmico com validação Zod e suporte a análise de IA em background.
- `PersonasPage`: Dashboard principal com busca e grid responsivo.

## Manutenção e Testes

Para rodar os testes da funcionalidade:

```bash
npx jest src/app/api/persona/route.test.ts
```

Os dados são persistidos na tabela `brand_personas` do Supabase, com segurança RLS baseada no `user_id`.
