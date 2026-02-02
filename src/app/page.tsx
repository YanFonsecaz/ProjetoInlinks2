"use client";

import { useState } from "react";
import {
  detectCannibalization,
  processUrlAnalysis,
  processUrlAnchors,
  batchAddVectors,
} from "./actions";
import { AnchorOpportunity, ContentAnalysis, ExtractedContent } from "@/types";
import { normalizeUrlForComparison } from "@/utils/url-normalizer";
import { Document } from "@langchain/core/documents";
import {
  Loader2,
  Download,
  Play,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Activity,
  Settings,
  BarChart3,
  Terminal,
  Link as LinkIcon,
  ChevronDown,
  ChevronUp,
  Search,
  Layout,
  Globe,
  ArrowRight,
  Hash,
  TrendingUp,
} from "lucide-react";

interface AnalysisResult {
  url: string;
  extracted: ExtractedContent;
  analysis: ContentAnalysis;
  chunks: Document[];
}

interface CannibalizationResult {
  url: string;
  cannibalization: {
    score: number;
    competidores: string[];
  };
}

import {
  generateCSV,
  downloadCSV,
  generateJSON,
  generateMarkdown,
  downloadText,
} from "@/utils/exporter";
import { rankAnchors } from "@/agents/ranker";
import { buildClusterMap } from "@/agents/cluster_builder";
import DocumentationModal from "@/components/DocumentationModal";

export default function Home() {
  // State
  const [showDocs, setShowDocs] = useState(false);
  const [urlsInput, setUrlsInput] = useState("");
  const [pillarUrl, setPillarUrl] = useState("");
  const [maxInlinks, setMaxInlinks] = useState(3);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<AnchorOpportunity[]>([]);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [cannibalizationResults, setCannibalizationResults] = useState<
    CannibalizationResult[]
  >([]);
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<"resultados" | "analise" | "logs">(
    "resultados",
  );
  const [strategyMode, setStrategyMode] = useState<
    "inlinks" | "outlinks" | "hybrid"
  >("inlinks");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [totalUrlsSent, setTotalUrlsSent] = useState(0);
  const [failedUrls, setFailedUrls] = useState<string[]>([]);

  // Helper functions
  const addLog = (msg: string) => setLogs((prev) => [...prev, msg]);

  const handleProcess = async () => {
    setIsProcessing(true);
    setLogs([]);
    setResults([]);
    setAnalysisResults([]);
    setCannibalizationResults([]);
    setFailedUrls([]);
    setProgress(0);
    setActiveTab("logs"); // Auto switch to logs on start

    // Validations
    if (!pillarUrl.trim()) {
      addLog(
        "❌ Erro: URL do Conteúdo Pilar é obrigatória para análise estratégica.",
      );
      setIsProcessing(false);
      return;
    }

    const rawUrls = urlsInput
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    // Remove duplicates and exclude Pillar URL from satellites list
    const urls = [...new Set(rawUrls)].filter((u) => u !== pillarUrl.trim());

    if (urls.length === 0) {
      addLog(
        "❌ Erro: Nenhuma URL de satélite válida fornecida (ou apenas a própria URL pilar).",
      );
      setIsProcessing(false);
      return;
    }

    const MAX_URLS = 100;
    if (urls.length > MAX_URLS) {
      addLog(
        `❌ Erro: Limite de ${MAX_URLS} URLs excedido (você inseriu ${urls.length}).`,
      );
      addLog("ℹ️ Para evitar timeouts no servidor, processe em lotes menores.");
      setIsProcessing(false);
      return;
    }

    // Incluir Pilar na análise para processamento bidirecional
    const allUrlsToAnalyze = [pillarUrl.trim(), ...urls];
    setTotalUrlsSent(allUrlsToAnalyze.length);

    addLog(
      `🚀 Iniciando processamento de ${allUrlsToAnalyze.length} URLs (1 Pilar + ${urls.length} Satélites)...`,
    );
    addLog(`📌 Pilar definido: ${pillarUrl}`);

    // Passo 1: Análise
    const analyzedData: AnalysisResult[] = [];
    const allChunks: Document[] = [];
    const failedList: string[] = [];
    let completed = 0;
    const batchSize = 5;

    for (let i = 0; i < allUrlsToAnalyze.length; i += batchSize) {
      const batch = allUrlsToAnalyze.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (url) => {
          addLog(`🔍 Analisando: ${url}`);
          try {
            const res = await processUrlAnalysis(url);
            if (res) {
              analyzedData.push({
                url,
                extracted: res.extracted,
                analysis: res.analysis,
                chunks: res.chunks,
              });
              allChunks.push(...res.chunks);
              addLog(`✅ Sucesso: ${res.extracted.title}`);
            } else {
              addLog(`❌ Falha: ${url}`);
              failedList.push(url);
            }
          } catch (error) {
            addLog(`❌ Erro crítico em ${url}: ${error}`);
            failedList.push(url);
          } finally {
            completed++;
            setProgress((completed / (allUrlsToAnalyze.length * 2)) * 100);
          }
        })
      );
    }

    setAnalysisResults(analyzedData);
    setFailedUrls(failedList);

    // Passo 1.5: Inserção em Lote no Banco Vetorial
    if (allChunks.length > 0) {
      addLog(`💾 Salvando ${allChunks.length} vetores no banco de dados...`);
      const dbSuccess = await batchAddVectors(allChunks);
      if (dbSuccess) {
        addLog("✅ Banco vetorial atualizado.");
      } else {
        addLog("⚠️ Erro ao salvar vetores. A análise de âncoras pode ser menos precisa.");
      }
    }
    if (analyzedData.length === 0) {
      addLog(
        "❌ Nenhuma URL pôde ser processada com sucesso. Verifique se as URLs retornam status 200 e não bloqueiam o crawler.",
      );
    }

    // Detectar Canibalização
    if (analyzedData.length > 1) {
      addLog("⚖️ Verificando canibalização de conteúdo...");
      const cannibalization = await detectCannibalization(analyzedData);
      setCannibalizationResults(cannibalization);
      if (cannibalization.length > 0) {
        addLog(`⚠️ ${cannibalization.length} alertas de canibalização.`);
      }
    }

    addLog("🔎 Buscando oportunidades de linkagem interna (Bidirecional)...");

    // Preparar Targets
    // Satélites targets (para o Pilar linkar)
    // GARANTIA: Pilar nunca entra aqui
    const satelliteTargets = analyzedData
      .filter((d) => d.url !== pillarUrl.trim())
      .map((d) => ({
        url: d.url,
        clusters: d.analysis.clusters,
        theme: d.analysis.theme, // Usar tema para match mais rico
        intencao: d.analysis.intencao,
      }));

    // Pilar target (para os Satélites linkarem)
    const pillarData = analyzedData.find(
      (d) =>
        normalizeUrlForComparison(d.url) ===
        normalizeUrlForComparison(pillarUrl),
    );
    const pillarTarget = pillarData
      ? [
          {
            url: pillarData.url,
            clusters: pillarData.analysis.clusters,
            theme: pillarData.analysis.theme,
            intencao: pillarData.analysis.intencao,
          },
        ]
      : [];

    if (satelliteTargets.length === 0) {
      addLog(
        "⚠️ Aviso: Nenhum dado de satélite analisado com sucesso. Linkagem ativa (Pilar -> Satélites) não será possível.",
      );
    }
    if (pillarTarget.length === 0) {
      addLog(
        "⚠️ Aviso: Dados do Pilar não encontrados. Linkagem passiva (Satélites -> Pilar) não será possível.",
      );
    }

    const allAnchors: AnchorOpportunity[] = [];
    completed = 0;

    // Processar em lotes
    for (let i = 0; i < analyzedData.length; i += batchSize) {
      const batch = analyzedData.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (item) => {
          const isPillar =
            normalizeUrlForComparison(item.url) ===
            normalizeUrlForComparison(pillarUrl);

          // Lógica de Direção baseada no Modo Selecionado
          let currentTargets: any[] = [];

          if (isPillar) {
            // Se for Pilar, busca links PARA os satélites (Active Link Building)
            // SÓ executa se modo for OUTLINKS ou HYBRID
            if (strategyMode === "inlinks") return;
            currentTargets = satelliteTargets;
          } else {
            // Se for Satélite, busca links PARA o pilar (Passive Link Building)
            // SÓ executa se modo for INLINKS ou HYBRID
            if (strategyMode === "outlinks") return;
            currentTargets = pillarTarget;
          }

          if (currentTargets.length === 0) return;

          addLog(
            `🔗 Processando ${
              isPillar ? "[PILAR -> SATÉLITES]" : "[SATÉLITE -> PILAR]"
            }: ${item.extracted.title}`,
          );

          try {
            const anchors = await processUrlAnchors(
              item.url,
              item.extracted.content,
              currentTargets,
              maxInlinks,
              item.extracted.rawHtml,
            );
            allAnchors.push(...anchors);
            addLog(
              `✨ ${anchors.length} oportunidades em ${item.extracted.title}`,
            );
          } catch (error) {
            addLog(`❌ Erro âncoras ${item.url}: ${error}`);
          } finally {
            completed++;
            setProgress(50 + (completed / analyzedData.length) * 50);
          }
        }),
      );
    }

    const editorialWeights: Record<string, number> = {};
    if (pillarUrl) {
      editorialWeights[pillarUrl.trim()] = 1; // Prioridade editorial para o pilar
    }
    const ranked = rankAnchors(
      allAnchors,
      satelliteTargets.concat(pillarTarget),
      editorialWeights,
    );
    setResults(ranked);
    setIsProcessing(false);
    setActiveTab("resultados"); // Auto switch to results on finish
    addLog("🏁 Processamento finalizado com sucesso!");
    setHasRun(true);
  };

  const exportCSV = () => {
    if (results.length === 0) return;
    downloadCSV(generateCSV(results, pillarUrl), "inlinks_opportunities.csv");
  };

  const exportJSON = () => {
    if (results.length === 0) return;
    downloadText(generateJSON(results), "inlinks_opportunities.json");
  };

  const exportMarkdown = () => {
    if (results.length === 0) return;
    downloadText(generateMarkdown(results), "inlinks_opportunities.md");
  };

  // Stats
  const totalProcessed = analysisResults.length;
  const totalOpportunities = results.length;
  const avgScore =
    totalOpportunities > 0
      ? (
          results.reduce((acc, curr) => acc + curr.score, 0) /
          totalOpportunities
        ).toFixed(2)
      : "0.00";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-orange-100 selection:text-slate-900">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">
              {/* Logo NP Digital */}
              <div className="flex flex-col justify-center">
                <svg
                  width="180"
                  height="50"
                  viewBox="0 0 200 60"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-10 w-auto"
                >
                  {/* Quadrado Laranja */}
                  <rect
                    x="2"
                    y="2"
                    width="56"
                    height="56"
                    stroke="#ff5f29"
                    strokeWidth="4"
                    fill="none"
                  />
                  {/* Texto NP */}
                  <text
                    x="30"
                    y="42"
                    fontFamily="Arial, sans-serif"
                    fontWeight="bold"
                    fontSize="28"
                    fill="#ff5f29"
                    textAnchor="middle"
                  >
                    NP
                  </text>
                  {/* Texto digital */}
                  <text
                    x="68"
                    y="42"
                    fontFamily="Arial, sans-serif"
                    fontWeight="bold"
                    fontSize="32"
                    fill="#000000"
                  >
                    digital
                  </text>
                </svg>
                <p className="text-[10px] text-slate-500 mt-1 ml-1">
                  Agente de Link Building Inteligente
                </p>
              </div>
            </div>

            {/* Global Progress */}
            {isProcessing && (
              <div className="flex items-center gap-3 flex-1 max-w-md mx-8">
                <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-[#ff5f29] h-full rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-[#ff5f29] w-12 text-right">
                  {Math.round(progress)}%
                </span>
              </div>
            )}

            <div className="flex items-center gap-4">
              <a
                href="/trends-master"
                className="flex items-center gap-1.5 text-sm font-medium text-[#ff5f29] hover:text-[#e64e1c] transition-colors bg-[#fff5f2] px-3 py-1.5 rounded-lg"
              >
                <TrendingUp className="w-4 h-4" />
                Google Trends
              </a>
              <button
                onClick={() => setShowDocs(true)}
                className="text-sm font-medium text-slate-500 hover:text-[#ff5f29] transition-colors"
              >
                Documentação
              </button>
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-[#ff5f29] font-bold text-xs">
                AI
              </div>
            </div>
          </div>
        </div>
      </nav>

      <DocumentationModal
        isOpen={showDocs}
        onClose={() => setShowDocs(false)}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar / Config Panel */}

          <aside className="w-full lg:w-80 shrink-0 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-slate-400" />
                Configuração
              </h2>

              <div className="space-y-4">
                {/* Pillar Content Input - Mandatory */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    URL do Conteúdo Pilar{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={pillarUrl}
                    onChange={(e) => setPillarUrl(e.target.value.trim())}
                    placeholder="https://exemplo.com/guia-completo"
                    className={`w-full p-2.5 rounded-lg border text-sm focus:ring-2 focus:ring-[#ff5f29] transition-colors ${
                      !pillarUrl && !isProcessing
                        ? "border-orange-200 bg-[#fff5f2]/50"
                        : "border-slate-300"
                    }`}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Obrigatório. Será usado como origem E destino.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    URLs Satélites{" "}
                    <span className="text-slate-400 text-xs font-normal">
                      (Uma por linha)
                    </span>
                  </label>
                  <textarea
                    value={urlsInput}
                    onChange={(e) => setUrlsInput(e.target.value)}
                    placeholder="https://exemplo.com/post-1&#10;https://exemplo.com/post-2"
                    className="w-full h-40 p-3 rounded-lg border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-[#ff5f29] focus:border-[#ff5f29] transition-all resize-none bg-slate-50 hover:bg-white"
                  />
                </div>

                {/* Estratégia de Linkagem (Visível) */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-2">
                    Direção da Linkagem
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => setStrategyMode("inlinks")}
                      className={`p-3 rounded-lg border text-sm font-medium transition-all text-left flex items-center gap-3 ${
                        strategyMode === "inlinks"
                          ? "bg-[#fff5f2] border-[#ff5f29] text-[#ff5f29] ring-1 ring-[#ff5f29]"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <div className="p-1.5 bg-white rounded border border-slate-100 shrink-0">
                        <ArrowRight className="w-4 h-4 rotate-180" />
                      </div>
                      <div>
                        <div className="font-semibold">Inlinks (Padrão)</div>
                        <div className="text-[10px] opacity-70 font-normal">
                          Satélites → Pilar
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => setStrategyMode("outlinks")}
                      className={`p-3 rounded-lg border text-sm font-medium transition-all text-left flex items-center gap-3 ${
                        strategyMode === "outlinks"
                          ? "bg-[#fff5f2] border-[#ff5f29] text-[#ff5f29] ring-1 ring-[#ff5f29]"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <div className="p-1.5 bg-white rounded border border-slate-100 shrink-0">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold">Outlinks (Cluster)</div>
                        <div className="text-[10px] opacity-70 font-normal">
                          Pilar → Satélites
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => setStrategyMode("hybrid")}
                      className={`p-3 rounded-lg border text-sm font-medium transition-all text-left flex items-center gap-3 ${
                        strategyMode === "hybrid"
                          ? "bg-[#fff5f2] border-[#ff5f29] text-[#ff5f29] ring-1 ring-[#ff5f29]"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <div className="p-1.5 bg-white rounded border border-slate-100 shrink-0">
                        <Activity className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold">Híbrido</div>
                        <div className="text-[10px] opacity-70 font-normal">
                          Bidirecional
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Advanced Settings Toggle */}
                <div className="border-t border-slate-100 pt-2">
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center justify-between w-full text-sm text-slate-600 hover:text-[#ff5f29] py-2 transition-colors"
                  >
                    <span className="font-medium">Configurações Avançadas</span>
                    {showAdvanced ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>

                  {showAdvanced && (
                    <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Max Inlinks por Página
                        </label>
                        <select
                          value={maxInlinks}
                          onChange={(e) =>
                            setMaxInlinks(Number(e.target.value))
                          }
                          className="w-full p-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-[#ff5f29]"
                        >
                          {[1, 2, 3, 5, 10, 20].map((n) => (
                            <option key={n} value={n}>
                              {n} links
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleProcess}
                  disabled={isProcessing || !pillarUrl}
                  className="w-full py-3 bg-[#ff5f29] hover:bg-[#e64e1c] text-white rounded-lg font-medium shadow-sm shadow-orange-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all transform active:scale-[0.98]"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="animate-spin w-4 h-4" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Iniciar Análise
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="bg-[#fff5f2] rounded-xl p-4 border border-orange-100">
              <h3 className="text-slate-900 font-semibold text-sm mb-2 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Modo:{" "}
                {strategyMode === "inlinks"
                  ? "Inlinks (Padrão)"
                  : strategyMode === "outlinks"
                    ? "Outlinks (Cluster)"
                    : "Híbrido (Bidirecional)"}
              </h3>
              <p className="text-slate-700 text-xs leading-relaxed">
                {strategyMode === "inlinks" &&
                  "Analisa URLs Satélites buscando oportunidades para linkar PARA a URL Pilar (Fortalece o Pilar)."}
                {strategyMode === "outlinks" &&
                  "Analisa a URL Pilar buscando oportunidades para linkar PARA as URLs Satélites (Distribui Autoridade)."}
                {strategyMode === "hybrid" &&
                  "Analisa bidirecionalmente: sugere links dos Satélites para o Pilar e do Pilar para os Satélites."}
              </p>
            </div>
          </aside>

          {/* Main Content Area */}
          <div className="flex-1 space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                <div className="p-3 bg-slate-100 text-slate-600 rounded-lg">
                  <Globe className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">
                    URLs Processadas
                  </p>
                  <p className="text-2xl font-bold text-slate-900">
                    {totalProcessed}{" "}
                    <span className="text-sm text-slate-400 font-normal">
                      / {totalUrlsSent}
                    </span>
                  </p>
                  {failedUrls.length > 0 && (
                    <p className="text-xs text-red-500 mt-1">
                      {failedUrls.length} falhas
                    </p>
                  )}
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                <div className="p-3 bg-[#fff5f2] text-[#ff5f29] rounded-lg">
                  <LinkIcon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">
                    Oportunidades
                  </p>
                  <p className="text-2xl font-bold text-slate-900">
                    {totalOpportunities}
                  </p>
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                <div className="p-3 bg-orange-50 text-orange-600 rounded-lg">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">Alertas</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {cannibalizationResults.length}
                  </p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                <div className="p-3 bg-slate-100 text-slate-600 rounded-lg">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">
                    Score médio
                  </p>
                  <p className="text-2xl font-bold text-slate-900">
                    {avgScore}
                  </p>
                </div>
              </div>
            </div>

            {/* Tabs & Content */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 min-h-[32rem] flex flex-col">
              {/* Tab Navigation */}
              <div className="border-b border-slate-200 px-2 flex items-center gap-1">
                <button
                  onClick={() => setActiveTab("resultados")}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === "resultados"
                      ? "border-[#ff5f29] text-[#ff5f29]"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Resultados
                </button>
                <button
                  onClick={() => setActiveTab("analise")}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === "analise"
                      ? "border-[#ff5f29] text-[#ff5f29]"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Análise
                </button>
                <button
                  onClick={() => setActiveTab("logs")}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === "logs"
                      ? "border-[#ff5f29] text-[#ff5f29]"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <Terminal className="w-4 h-4" />
                  Logs
                </button>
              </div>

              {/* Tab Content Area */}
              <div className="p-6 flex-1">
                {/* --- TAB: RESULTADOS --- */}
                {activeTab === "resultados" && (
                  <div className="space-y-6">
                    {results.length > 0 ? (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <h3 className="text-lg font-semibold text-slate-900">
                            Oportunidades Encontradas
                          </h3>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={exportCSV}
                              className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-md text-xs font-medium hover:bg-slate-200 transition-colors"
                            >
                              <Download className="w-4 h-4" /> CSV
                            </button>
                            <button
                              onClick={exportJSON}
                              className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-md text-xs font-medium hover:bg-slate-200 transition-colors"
                            >
                              <FileText className="w-4 h-4" /> JSON
                            </button>
                            <button
                              onClick={exportMarkdown}
                              className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-md text-xs font-medium hover:bg-slate-200 transition-colors"
                            >
                              <Layout className="w-4 h-4" /> MD
                            </button>
                          </div>
                        </div>

                        <div className="overflow-hidden rounded-lg border border-slate-200">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                              <tr>
                                <th className="p-4 w-1/4">Origem / Destino</th>
                                <th className="p-4 w-1/3">Ação Recomendada</th>
                                <th className="p-4 w-24 text-center">Score</th>
                                <th className="p-4">Contexto/Motivo</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {results.map((r, i) => {
                                const isOutlink = r.origem === pillarUrl.trim();
                                return (
                                  <tr
                                    key={`${i}-${r.origem}-${r.anchor}`}
                                    className="hover:bg-slate-50 transition-colors"
                                  >
                                    <td className="p-4 align-top">
                                      <div className="flex flex-col gap-3">
                                        <div className="flex items-start gap-2 group">
                                          <div className="mt-1 p-1 bg-slate-100 rounded text-slate-400 group-hover:text-[#ff5f29] transition-colors">
                                            {isOutlink ? (
                                              <ArrowRight className="w-3 h-3" />
                                            ) : (
                                              <ArrowRight className="w-3 h-3 rotate-180" />
                                            )}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                Origem
                                              </span>
                                              <span
                                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                                  isOutlink
                                                    ? "bg-[#fff5f2] text-[#ff5f29]"
                                                    : "bg-slate-100 text-slate-600"
                                                }`}
                                              >
                                                {isOutlink
                                                  ? "PILAR"
                                                  : "SATÉLITE"}
                                              </span>
                                            </div>
                                            <a
                                              href={r.origem}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-sm text-slate-600 hover:text-[#ff5f29] font-medium break-all line-clamp-2 transition-colors"
                                              title={r.origem}
                                            >
                                              {r.origem}
                                            </a>
                                          </div>
                                        </div>

                                        <div className="flex items-start gap-2 group">
                                          <div className="mt-1 p-1 bg-slate-100 rounded text-slate-400 group-hover:text-[#ff5f29] transition-colors">
                                            <LinkIcon className="w-3 h-3" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                Destino
                                              </span>
                                              <span
                                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                                  !isOutlink
                                                    ? "bg-[#fff5f2] text-[#ff5f29]"
                                                    : "bg-slate-100 text-slate-600"
                                                }`}
                                              >
                                                {!isOutlink
                                                  ? "PILAR"
                                                  : "SATÉLITE"}
                                              </span>
                                            </div>
                                            <a
                                              href={r.destino}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-sm text-slate-600 hover:text-[#ff5f29] font-medium break-all line-clamp-2 transition-colors"
                                            >
                                              {r.destino}
                                            </a>
                                          </div>
                                        </div>
                                      </div>
                                    </td>

                                    <td className="p-4 align-top">
                                      <div className="flex items-center gap-2 mb-2">
                                        {r.type === "exact" && (
                                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#fff5f2] text-[#ff5f29] border border-[#ff5f29]">
                                            EXACT
                                          </span>
                                        )}

                                        <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                          <Hash className="w-3 h-3" />
                                          {r.target_topic || "Tópico Geral"}
                                        </span>
                                      </div>

                                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-slate-700 leading-relaxed relative">
                                        <span className="font-semibold text-[#ff5f29] bg-[#fff5f2] px-1 rounded">
                                          {r.anchor}
                                        </span>
                                        <span className="text-xs text-slate-500 block mt-2 italic">
                                          "...{r.trecho}..."
                                        </span>
                                      </div>
                                    </td>

                                    <td className="p-4 align-top text-center">
                                      <span
                                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                          r.score > 0.8
                                            ? "bg-[#fff5f2] text-[#ff5f29]"
                                            : "bg-slate-100 text-slate-600"
                                        }`}
                                      >
                                        {r.score.toFixed(2)}
                                      </span>
                                    </td>

                                    <td className="p-4 align-top text-xs text-slate-500">
                                      {r.pillar_context ? (
                                        <div className="bg-orange-50 p-2 rounded border border-orange-100 text-orange-800">
                                          <strong>Contexto do Pilar:</strong>{" "}
                                          {r.pillar_context}
                                        </div>
                                      ) : (
                                        r.reason
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center py-12 text-slate-400">
                        <Search className="w-16 h-16 mb-4 opacity-20" />
                        <p className="text-lg font-medium text-slate-600">
                          {!hasRun
                            ? "Nenhum resultado ainda"
                            : analysisResults.length === 0
                              ? "Nenhuma URL pôde ser processada"
                              : "Nenhuma oportunidade encontrada"}
                        </p>
                        <p className="text-sm">
                          {!hasRun
                            ? "Inicie uma análise para ver as oportunidades de linkagem."
                            : analysisResults.length === 0
                              ? "Verifique se as URLs retornam status 200, não exigem login e não bloqueiam o crawler. Veja a aba Logs para detalhes."
                              : "As páginas foram analisadas, mas não encontramos oportunidades de linkagem interna com os critérios atuais."}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* --- TAB: ANÁLISE --- */}
                {activeTab === "analise" && (
                  <div className="space-y-8">
                    {analysisResults.length > 0 ? (
                      <>
                        {/* Alertas */}
                        {cannibalizationResults.length > 0 && (
                          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                            <h3 className="font-bold text-orange-800 flex items-center gap-2 mb-3">
                              <AlertTriangle className="w-5 h-5" />
                              Conflitos de Conteúdo (Canibalização)
                            </h3>
                            <div className="grid gap-3">
                              {cannibalizationResults.map((c, i) => (
                                <div
                                  key={i}
                                  className="bg-white/50 p-3 rounded border border-orange-100 text-sm"
                                >
                                  <div className="font-medium text-orange-900">
                                    {c.url}
                                  </div>
                                  <div className="text-orange-700 text-xs mt-1">
                                    Compete com:{" "}
                                    {c.cannibalization.competidores.join(", ")}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Cluster Map */}
                        {(() => {
                          const map = buildClusterMap(
                            analysisResults.map((d) => ({
                              url: d.url,
                              analysis: d.analysis,
                            })),
                          );
                          return (
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
                              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <Layout className="w-4 h-4" />
                                Estrutura do Cluster
                              </h3>
                              <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                                    Pilares Identificados
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {map.pillars.length > 0 ? (
                                      map.pillars.map((p) => (
                                        <span
                                          key={p}
                                          className="px-3 py-1 bg-white border border-slate-200 rounded-full text-sm font-medium text-[#ff5f29] shadow-sm"
                                        >
                                          {p}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-sm text-slate-400 italic">
                                        Nenhum pilar claro identificado
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                                    Distribuição de Tópicos
                                  </h4>
                                  <div className="space-y-3">
                                    {Object.entries(map.satellites).map(
                                      ([pillar, urls]) => (
                                        <div key={pillar}>
                                          <span className="text-xs font-semibold text-slate-700">
                                            {pillar}
                                          </span>
                                          <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1">
                                            <div
                                              className="bg-[#ff5f29] h-1.5 rounded-full"
                                              style={{
                                                width: `${Math.min(
                                                  100,
                                                  urls.length * 20,
                                                )}%`,
                                              }}
                                            ></div>
                                          </div>
                                          <div className="text-[10px] text-slate-400 mt-0.5 text-right">
                                            {urls.length} páginas
                                          </div>
                                        </div>
                                      ),
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Cards de Páginas */}
                        <div className="grid md:grid-cols-2 gap-4">
                          {analysisResults.map((item, i) => (
                            <div
                              key={i}
                              className={`border rounded-lg p-4 hover:shadow-md transition-shadow bg-white ${
                                item.url === pillarUrl
                                  ? "border-[#ff5f29] ring-1 ring-[#ff5f29]"
                                  : "border-slate-200"
                              }`}
                            >
                              <h3
                                className="font-medium text-[#ff5f29] mb-1 line-clamp-1"
                                title={item.extracted.title}
                              >
                                {item.extracted.title}
                                {item.url === pillarUrl && (
                                  <span className="ml-2 text-[10px] bg-[#ff5f29] text-white px-1.5 py-0.5 rounded uppercase tracking-wider">
                                    Pilar
                                  </span>
                                )}
                              </h3>
                              <div className="text-xs text-slate-400 mb-3 truncate font-mono bg-slate-50 p-1 rounded">
                                {item.url}
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-slate-500">
                                    Intenção
                                  </span>
                                  <span className="font-medium text-slate-700">
                                    {item.analysis.intencao}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-slate-500">Funil</span>
                                  <span className="font-medium text-slate-700">
                                    {item.analysis.funil}
                                  </span>
                                </div>
                                {item.analysis.theme && (
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-500">
                                      Tema Principal
                                    </span>
                                    <span className="font-medium text-slate-700">
                                      {item.analysis.theme}
                                    </span>
                                  </div>
                                )}
                              </div>

                              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5">
                                {item.analysis.clusters
                                  .slice(0, 4)
                                  .map((c, idx) => (
                                    <span
                                      key={idx}
                                      className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded-full"
                                    >
                                      {c}
                                    </span>
                                  ))}
                                {item.analysis.clusters.length > 4 && (
                                  <span className="px-2 py-0.5 bg-slate-50 text-slate-400 text-[10px] rounded-full">
                                    +{item.analysis.clusters.length - 4}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center py-12 text-slate-400">
                        <BarChart3 className="w-16 h-16 mb-4 opacity-20" />
                        <p className="text-lg font-medium text-slate-600">
                          Sem dados de análise
                        </p>
                        <p className="text-sm">
                          Os detalhes do conteúdo aparecerão aqui após o
                          processamento.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* --- TAB: LOGS --- */}
                {activeTab === "logs" && (
                  <div className="h-full flex flex-col">
                    <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-[#ff5f29] h-96 overflow-y-auto shadow-inner custom-scrollbar">
                      {logs.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-slate-700">
                          <span className="animate-pulse">
                            _ Aguardando comando...
                          </span>
                        </div>
                      ) : (
                        logs.map((log, i) => (
                          <div
                            key={i}
                            className="mb-1.5 border-b border-slate-800/50 pb-1 last:border-0 last:pb-0 break-all"
                          >
                            <span className="text-slate-500 mr-2">
                              [{new Date().toLocaleTimeString()}]
                            </span>
                            {log}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-sm text-slate-500 border-t border-slate-200 mt-8">
        <p>Desenvolvido por Yan Fonseca</p>
      </footer>
    </div>
  );
}
