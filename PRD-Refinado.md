# PRD Refinado – Sistema de Agentes Automáticos para Análise de Conteúdo Pilar e Inlinks Estratégicos

## 🎯 Visão Geral
Este documento descreve um sistema automatizado baseado em IA (LangChain + TypeScript) capaz de:

- Analisar conteúdos pilar e conteúdos satélites.
- Identificar temas principais, intenções e clusters semânticos.
- Gerar oportunidades estratégicas de inlinks com anchors contextualizados.
- Exportar isso em formatos CSV/JSON/Markdown para uso em SEO.

O PRD foi refinado para ser totalmente **developer‑friendly**, com diagramas, formatos claros de entrada/saída e requisitos técnicos sem ambiguidades.

---

# 1. Arquitetura Geral do Sistema

```mermaid
flowchart TD
    A[Crawler / Input URLs] --> B[Content Extractor]
    B --> C[Content Analyzer (LLM + Heurísticas)]
    C --> D[Topic & Cluster Builder]
    D --> E[Anchor Opportunity Selector]
    E --> F[Ranking Engine]
    F --> G[Exporter (CSV / JSON / MD)]
```

---

# 2. Fluxo Completo

## 2.1. Entrada
- Lista de URLs (CSV, JSON ou input manual)
- Conteúdo bruto (HTML) ou texto clean
- Configurações:
  - tamanho de âncora
  - limites de links
  - ID de projeto
  - modelo LLM

---

# 3. Módulos do Sistema

---

## 3.1 Content Extractor
Remove HTML → gera texto limpo.

**Saída**

```json
{
  "url": "https://exemplo.com/pagina",
  "title": "Guia Completo de Cartão Pré-Pago",
  "content": "Texto limpo..."
}
```

---

## 3.2 Content Analyzer (LLM + heurísticas)

Responsável por:
- identificar **intenção**
- extrair **tópicos principais**
- detectar **clusters semânticos**
- encontrar **entidades importantes**
- detectar **canibalização** comparando com outras páginas

**Saída Padronizada**

```json
{
  "intencao": "Informacional",
  "funil": "Topo",
  "clusters": ["cartão pré-pago", "benefícios", "uso internacional"],
  "entidades": ["taxas", "bandeira", "saldo"],
  "canibalizacao": {
    "score": 0.58,
    "competidores": [
      "https://exemplo.com/cartao-pre-pago",
      "https://exemplo.com/guia-cartoes"
    ]
  }
}
```

---

## 3.3 Topic & Cluster Builder
Unifica clusters e decide **conteúdos pilar vs satélite**.

---

## 3.4 Anchor Opportunity Selector

Regras aplicadas:

- Não usar título como âncora.
- Não usar variações exatas da própria URL.
- Não duplicar âncoras existentes no texto.
- Priorizar trechos com alta similaridade semântica.
- Anchor deve ter **entre 2 e 6 palavras**.
- Não usar termos genéricos:  
  “clique aqui”, “veja mais”, “neste artigo”, etc.
- Anchor sempre no **corpo principal**, não sidebar/rodapé.

**Formato da Saída**

```json
{
  "anchor": "vantagens do cartão pré-pago",
  "trecho": "O cartão pré-pago possui diversas vantagens...",
  "origem": "https://site.com/guia-pre-pago",
  "destino": "https://site.com/comparativo-cartoes",
  "score": 0.87
}
```

---

## 3.5 Ranking Engine

Fatores usados:
- Similaridade semântica (peso 50%)
- Similaridade por Jaccard (peso 20%)
- PageRank interno ou peso editorial (20%)
- Qualidade do snippet (10%)

**Score final** = soma ponderada.

---

## 3.6 Exporter

Gera:
- **CSV** para planilhas
- **JSON** para APIs
- **Markdown** para documentação

---

# 4. Critérios de Aceitação

## ✔ Para Análise
- Intenção, clusters e entidades devem aparecer sempre.
- Canibalização deve incluir score e URLs comparadas.

## ✔ Para Anchors
- Todas as âncoras devem ter 2–6 palavras.
- Nenhuma âncora pode duplicar links já existentes.
- Pontuação mínima de relevância ≥ 0.65.

## ✔ Para Ranking
- Score deve ser numérico e consistente.
- Ordem deve ser decrescente por relevância.

## ✔ Para Export
- CSV abre no Excel/Sheets sem erro.
- JSON deve ser válido.
- Markdown deve conter tabela final.

---

# 5. Estrutura Developer‑Friendly

## 📁 Estrutura de Pastas (Next.js + LangChain)

```
/src
  /agents
    analyzer.ts
    anchor_selector.ts
    ranker.ts
  /chains
    extract_chain.ts
    analyze_chain.ts
  /core
    llm.ts
    similarity.ts
    preprocess.ts
  /utils
    clean_text.ts
    exporter.ts
  /types
    content.ts
    analysis.ts
    anchor.ts
  /app/api/process/route.ts
```

---

# 6. Exemplo de Pipeline (Pseudocódigo)

```ts
const html = await fetch(url);
const text = cleanText(html);

const analysis = await analyzeContent(text);
const anchors = await findAnchors(text, analysis);
const ranked = rankAnchors(anchors);

exportToCSV(ranked);
```

---

# 7. Versão Resumida (Para Executivos)

O sistema usa IA para analisar conteúdos, identificar tópicos principais e gerar links internos estratégicos. A automação melhora:

- SEO  
- Autoridade temática  
- Navegação do usuário  
- Engajamento  

E reduz o tempo do analista em 80%.

---

# 📦 Download do Arquivo
O arquivo `PRD-Refinado.md` foi gerado automaticamente.

