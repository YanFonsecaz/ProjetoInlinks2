Após analisar o `PRD-Refinado.md` e comparar com a estrutura atual (`src/`), identifiquei que a funcionalidade de **Detecção de Canibalização** descrita no item **3.2 Content Analyzer** não está totalmente integrada no fluxo final da UI, embora as interfaces de tipo já existam.

### O que está faltando:
1.  **Exibir Canibalização na UI**: O frontend recebe os dados de análise, mas atualmente só mostra "Intenção", "Funil" e "Clusters". O PRD pede explicitamente: *"Canibalização deve incluir score e URLs comparadas."* (Item 4 - Critérios de Aceitação).
2.  **Lógica de Comparação**: A função `processUrlAnalysis` extrai a análise individual, mas não cruza os dados para detectar se duas páginas competem pelo mesmo cluster *antes* de gerar os inlinks.

### Plano de Correção:
1.  **Backend (`src/app/actions.ts`)**:
    *   Criar uma nova action `detectCannibalization(analyzedData)` que recebe todas as análises e compara os clusters entre si.
    *   Se duas páginas tiverem clusters > 80% similares ou mesma intenção + tópicos iguais, marcar como canibalização.

2.  **Frontend (`src/app/page.tsx`)**:
    *   Adicionar uma nova aba ou seção "Alerta de Canibalização".
    *   Exibir cards vermelhos/amarelos quando houver sobreposição de conteúdo.

Vou focar em **implementar a exibição da canibalização na UI**, pois é o ponto mais visível que falta para atender aos critérios de aceitação.
