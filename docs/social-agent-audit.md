# Relatório de Auditoria Técnica: Social Agent

**Data:** 25/02/2026
**Escopo:** Análise do código-fonte e arquitetura da ferramenta "Social Agent" (v1.0)

---

## 1. Sumário Executivo

A ferramenta "Social Agent" apresenta uma base sólida para a geração assistida de conteúdo, com uma interface moderna e um fluxo de trabalho lógico (Análise -> Scripts -> Formatos). No entanto, a implementação atual sofre de **"amnésia contextual"** entre as etapas, o que compromete a coerência do resultado final. Além disso, a ausência de persistência de estado no servidor torna a ferramenta frágil a recarregamentos de página.

**Avaliação Geral:**
- **UX/UI:** ⭐⭐⭐⭐☆ (Moderna, responsiva, bom feedback visual)
- **Qualidade de Prompt:** ⭐⭐⭐☆☆ (Bons prompts individuais, mas desconectados)
- **Arquitetura de Dados:** ⭐⭐☆☆☆ (Falta persistência robusta e gestão de contexto)
- **Escalabilidade:** ⭐⭐⭐☆☆ (Dependente inteiramente da latência da OpenAI, sem filas)

---

## 2. Análise Crítica Detalhada

### A. Pontos Fortes
1.  **Interface Intuitiva**: O uso de um stepper lateral e a divisão clara do processo em 6 etapas reduz a carga cognitiva do usuário.
2.  **Integração de Personas**: A capacidade de criar e selecionar personas (tom de voz, público) é um diferencial competitivo bem implementado.
3.  **Modularidade**: A separação das instruções de prompt em `STEP_INSTRUCTIONS` facilita a manutenção e ajustes finos.

### B. Pontos Fracos e Gargalos (Gaps)

#### 1. Amnésia Contextual (Crítico)
**Problema:** No arquivo `actions.ts`, a função `processSocialStep` recebe apenas o `content` original e a `persona`.
**Impacto:** Quando o usuário está na Etapa 4 (Legendas), a IA **não sabe** o que foi gerado na Etapa 2 (Scripts). Isso gera desconexão. A legenda pode falar de um tópico que o script ignorou.
**Evidência:**
```typescript
// actions.ts
const result = await chain.invoke({
  content, // Sempre o texto original
  step: step.toUpperCase(),
  // Faltam os outputs das etapas anteriores!
});
```

#### 2. Falta de Persistência de Sessão
**Problema:** Todo o estado da geração (`outputs`) vive apenas na memória do navegador (React State).
**Impacto:** Se o usuário der refresh na página, perde todo o trabalho de 15 minutos de geração.
**Risco de Negócio:** Frustração extrema do usuário e perda de confiança na ferramenta.

#### 3. Rigidez do Prompt
**Problema:** Os prompts são estáticos. Se o usuário quiser "refazer" uma etapa com um ajuste ("faça mais curto"), não há mecanismo direto para isso sem editar o prompt no código.

---

## 3. Plano de Melhorias (Roadmap)

### Fase 1: Correções Imediatas (Quick Wins)
- [x] **Contexto Progressivo**: Alterar `processSocialStep` para aceitar um parâmetro `previousContext` (resumo das etapas anteriores) para que a IA mantenha a coerência.
- [ ] **Tratamento de Erros na UI**: Adicionar toasts/notificações quando a geração falhar, em vez de apenas parar o loader.

### Fase 2: Robustez e Persistência (Médio Prazo)
- [ ] **Salvar Rascunhos**: Criar uma tabela `social_drafts` no Supabase para salvar o progresso de cada etapa automaticamente.
- [ ] **Edição Manual**: Permitir que o usuário edite o texto gerado de uma etapa antes de passar para a próxima (e a próxima etapa usar o texto editado como contexto).

### Fase 3: Funcionalidades Avançadas (Longo Prazo)
- [ ] **Geração de Imagem**: Integrar DALL-E 3 ou Midjourney na etapa "Visual" para gerar as imagens descritas.
- [ ] **Integração de Publicação**: Conectar com APIs do LinkedIn/Instagram para agendamento direto.

---

## 4. Definição de KPIs Técnicos

Para monitorar a saúde da ferramenta, sugerimos implementar os seguintes logs/métricas:

1.  **Taxa de Sucesso de Geração**: % de chamadas LLM que retornam 200 OK sem timeout.
2.  **Tempo Médio por Etapa**: Monitorar a latência para identificar gargalos (ex: se a etapa "Scripts" demora 40s, precisa otimizar o prompt).
3.  **Taxa de Retenção de Sessão**: Quantos usuários completam as 6 etapas vs. quantos abandonam no meio.

---

## 5. Próximos Passos (Ação Imediata)

Vou proceder agora com a implementação da **Correção de Contexto Progressivo** (Fase 1), pois é a mudança de menor esforço com maior impacto na qualidade do conteúdo gerado.
