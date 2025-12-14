"use client";

import { useState } from "react";
import {
  detectCannibalization,
  processUrlAnalysis,
  processUrlAnchors,
} from "./actions";
import {
  AnchorOpportunity,
  ContentAnalysis,
  ExtractedContent,
} from "@/types";
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
} from "lucide-react";

interface AnalysisResult {
  url: string;
  extracted: ExtractedContent;
  analysis: ContentAnalysis;
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

export default function Home() {
  // State
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
  const [activeTab, setActiveTab] = useState<"resultados" | "analise" | "logs">("resultados");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Helper functions
  const addLog = (msg: string) => setLogs((prev) => [...prev, msg]);

  const handleProcess = async () => {
    setIsProcessing(true);
    setLogs([]);
    setResults([]);
    setAnalysisResults([]);
    setCannibalizationResults([]);
    setProgress(0);
    setActiveTab("logs"); // Auto switch to logs on start

    // Validations
    if (!pillarUrl.trim()) {
      addLog("❌ Erro: URL do Conteúdo Pilar é obrigatória para análise estratégica.");
      setIsProcessing(false);
      return;
    }

    const urls = urlsInput
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    if (urls.length === 0) {
      addLog("❌ Erro: Nenhuma URL de satélite fornecida.");
      setIsProcessing(false);
      return;
    }

    const MAX_URLS = 50;
    if (urls.length > MAX_URLS) {
      addLog(`❌ Erro: Limite de ${MAX_URLS} URLs excedido (você inseriu ${urls.length}).`);
      addLog("ℹ️ Para evitar timeouts no servidor, processe em lotes menores.");
      setIsProcessing(false);
      return;
    }
    addLog(`🚀 Iniciando processamento de ${urls.length} URLs com foco no pilar...`);
    addLog(`📌 Pilar definido: ${pillarUrl}`);

    // Passo 1: Análise
    const analyzedData: AnalysisResult[] = [];
    let completed = 0;
    const batchSize = 3;

    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
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
              });
              addLog(`✅ Sucesso: ${res.extracted.title}`);
            } else {
              addLog(`❌ Falha: ${url}`);
            }
          } catch (error) {
            addLog(`❌ Erro crítico em ${url}: ${error}`);
          } finally {
            completed++;
            setProgress((completed / (urls.length * 2)) * 100);
          }
        })
      );
    }

    setAnalysisResults(analyzedData);

    // Detectar Canibalização
    if (analyzedData.length > 1) {
      addLog("⚖️ Verificando canibalização de conteúdo...");
      const cannibalization = await detectCannibalization(analyzedData);
      setCannibalizationResults(cannibalization);
      if (cannibalization.length > 0) {
        addLog(`⚠️ ${cannibalization.length} alertas de canibalização.`);
      }
    }

    addLog("🔎 Buscando oportunidades de linkagem interna...");

    // Passo 2: Encontrar Âncoras
    const targets = analyzedData.map((d) => ({
      url: d.url,
      clusters: d.analysis.clusters,
    }));

    const allAnchors: AnchorOpportunity[] = [];
    completed = 0;

    for (let i = 0; i < analyzedData.length; i += batchSize) {
      const batch = analyzedData.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (item) => {
          addLog(`🔗 Processando: ${item.extracted.title}`);
          try {
            const anchors = await processUrlAnchors(
              item.url,
              item.extracted.content,
              targets,
              maxInlinks,
              item.extracted.rawHtml
            );
            allAnchors.push(...anchors);
            addLog(`✨ ${anchors.length} inlinks encontrados em ${item.extracted.title}`);
          } catch (error) {
            addLog(`❌ Erro âncoras ${item.url}: ${error}`);
          } finally {
            completed++;
            setProgress(50 + (completed / analyzedData.length) * 50);
          }
        })
      );
    }

    const editorialWeights: Record<string, number> = {};
    if (pillarUrl) {
      editorialWeights[pillarUrl] = 1;
    }
    const ranked = rankAnchors(allAnchors, targets, editorialWeights);
    setResults(ranked);
    setIsProcessing(false);
    setActiveTab("resultados"); // Auto switch to results on finish
    addLog("🏁 Processamento finalizado com sucesso!");
  };

  const exportCSV = () => {
    if (results.length === 0) return;
    downloadCSV(generateCSV(results, pillarUrl));
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
  const avgScore = totalOpportunities > 0 
    ? (results.reduce((acc, curr) => acc + curr.score, 0) / totalOpportunities).toFixed(2) 
    : "0.00";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <LinkIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 leading-tight">Inlinks AI</h1>
                <p className="text-xs text-slate-500">Agente de Link Building Inteligente</p>
              </div>
            </div>
            
            {/* Global Progress */}
            {isProcessing && (
              <div className="flex items-center gap-3 flex-1 max-w-md mx-8">
                <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-full rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-indigo-600 w-12 text-right">{Math.round(progress)}%</span>
              </div>
            )}

            <div className="flex items-center gap-4">
              <a href="#" className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors">Documentação</a>
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                AI
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Sidebar / Config Panel */}
          <aside className="w-full lg:w-80 flex-shrink-0 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-slate-400" />
                Configuração
              </h2>
              
              <div className="space-y-4">
                
                {/* Pillar Content Input - Mandatory */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    URL do Conteúdo Pilar <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={pillarUrl}
                    onChange={(e) => setPillarUrl(e.target.value.trim())}
                    placeholder="https://exemplo.com/guia-completo"
                    className={`w-full p-2.5 rounded-lg border text-sm focus:ring-2 focus:ring-indigo-500 transition-colors ${
                      !pillarUrl && !isProcessing ? "border-indigo-300 bg-indigo-50/50" : "border-slate-300"
                    }`}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Obrigatório para priorização estratégica de links.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    URLs Satélites <span className="text-slate-400 text-xs font-normal">(Uma por linha)</span>
                  </label>
                  <textarea
                    value={urlsInput}
                    onChange={(e) => setUrlsInput(e.target.value)}
                    placeholder="https://exemplo.com/post-1&#10;https://exemplo.com/post-2"
                    className="w-full h-40 p-3 rounded-lg border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none bg-slate-50 hover:bg-white"
                  />
                </div>

                {/* Advanced Settings Toggle */}
                <div className="border-t border-slate-100 pt-2">
                  <button 
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center justify-between w-full text-sm text-slate-600 hover:text-indigo-600 py-2 transition-colors"
                  >
                    <span className="font-medium">Opções Avançadas</span>
                    {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  
                  {showAdvanced && (
                    <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Max Inlinks / Página
                        </label>
                        <select
                          value={maxInlinks}
                          onChange={(e) => setMaxInlinks(Number(e.target.value))}
                          className="w-full p-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                        >
                          {[1, 2, 3, 5, 10, 20].map((n) => (
                            <option key={n} value={n}>{n} links</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleProcess}
                  disabled={isProcessing || !pillarUrl}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-sm shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all transform active:scale-[0.98]"
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

            <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
              <h3 className="text-indigo-900 font-semibold text-sm mb-2 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Dica Estratégica
              </h3>
              <p className="text-indigo-800 text-xs leading-relaxed">
                O conteúdo pilar serve como âncora central. As URLs satélites serão analisadas para encontrar oportunidades de linkar de volta para este pilar, fortalecendo sua autoridade.
              </p>
            </div>
          </aside>

          {/* Main Content Area */}
          <div className="flex-1 space-y-6">
            
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                  <Globe className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">URLs Analisadas</p>
                  <p className="text-2xl font-bold text-slate-900">{totalProcessed}</p>
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                <div className="p-3 bg-green-100 text-green-600 rounded-lg">
                  <LinkIcon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">Oportunidades</p>
                  <p className="text-2xl font-bold text-slate-900">{totalOpportunities}</p>
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                <div className="p-3 bg-yellow-100 text-yellow-600 rounded-lg">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">Alertas</p>
                  <p className="text-2xl font-bold text-slate-900">{cannibalizationResults.length}</p>
                </div>
              </div>
            </div>

            {/* Tabs & Content */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 min-h-[500px] flex flex-col">
              {/* Tab Navigation */}
              <div className="border-b border-slate-200 px-2 flex items-center gap-1">
                <button
                  onClick={() => setActiveTab("resultados")}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === "resultados"
                      ? "border-indigo-600 text-indigo-600"
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
                      ? "border-indigo-600 text-indigo-600"
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
                      ? "border-indigo-600 text-indigo-600"
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
                            <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-md text-xs font-medium hover:bg-slate-200 transition-colors">
                              <Download className="w-4 h-4" /> CSV
                            </button>
                            <button onClick={exportJSON} className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-md text-xs font-medium hover:bg-slate-200 transition-colors">
                              <FileText className="w-4 h-4" /> JSON
                            </button>
                            <button onClick={exportMarkdown} className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-md text-xs font-medium hover:bg-slate-200 transition-colors">
                              <Layout className="w-4 h-4" /> MD
                            </button>
                          </div>
                        </div>

                        <div className="overflow-hidden rounded-lg border border-slate-200">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                              <tr>
                                <th className="p-4 w-1/4">Origem</th>
                                <th className="p-4 w-1/4">Âncora & Contexto</th>
                                <th className="p-4 w-1/4">Destino</th>
                                <th className="p-4 w-24 text-center">Score</th>
                                <th className="p-4">Motivo</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {results.map((r, i) => (
                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                  <td className="p-4 align-top">
                                    <div className="text-slate-900 font-medium truncate max-w-[200px]" title={r.origem}>{r.origem}</div>
                                  </td>
                                  <td className="p-4 align-top">
                                    <div className="text-indigo-600 font-bold">{r.anchor}</div>
                                    <div className="text-xs text-slate-500 mt-1 italic leading-relaxed">"{r.trecho}"</div>
                                  </td>
                                  <td className="p-4 align-top">
                                    <div className="text-slate-600 truncate max-w-[200px]" title={r.destino}>{r.destino}</div>
                                  </td>
                                  <td className="p-4 align-top text-center">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                      r.score > 0.8 ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                                    }`}>
                                      {r.score.toFixed(2)}
                                    </span>
                                  </td>
                                  <td className="p-4 align-top text-xs text-slate-500">
                                    {r.reason}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center py-12 text-slate-400">
                        <Search className="w-16 h-16 mb-4 opacity-20" />
                        <p className="text-lg font-medium text-slate-600">Nenhum resultado ainda</p>
                        <p className="text-sm">Inicie uma análise para ver as oportunidades de linkagem.</p>
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
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <h3 className="font-bold text-yellow-800 flex items-center gap-2 mb-3">
                              <AlertTriangle className="w-5 h-5" />
                              Conflitos de Conteúdo (Canibalização)
                            </h3>
                            <div className="grid gap-3">
                              {cannibalizationResults.map((c, i) => (
                                <div key={i} className="bg-white/50 p-3 rounded border border-yellow-100 text-sm">
                                  <div className="font-medium text-yellow-900">{c.url}</div>
                                  <div className="text-yellow-700 text-xs mt-1">
                                    Compete com: {c.cannibalization.competidores.join(", ")}
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
                            }))
                          );
                          return (
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
                              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <Layout className="w-4 h-4" />
                                Estrutura do Cluster
                              </h3>
                              <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Pilares Identificados</h4>
                                  <div className="flex flex-wrap gap-2">
                                    {map.pillars.length > 0 ? map.pillars.map(p => (
                                      <span key={p} className="px-3 py-1 bg-white border border-slate-200 rounded-full text-sm font-medium text-indigo-600 shadow-sm">
                                        {p}
                                      </span>
                                    )) : <span className="text-sm text-slate-400 italic">Nenhum pilar claro identificado</span>}
                                  </div>
                                </div>
                                <div>
                                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Distribuição de Tópicos</h4>
                                  <div className="space-y-3">
                                    {Object.entries(map.satellites).map(([pillar, urls]) => (
                                      <div key={pillar}>
                                        <span className="text-xs font-semibold text-slate-700">{pillar}</span>
                                        <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1">
                                          <div className="bg-indigo-400 h-1.5 rounded-full" style={{ width: `${Math.min(100, urls.length * 20)}%` }}></div>
                                        </div>
                                        <div className="text-[10px] text-slate-400 mt-0.5 text-right">{urls.length} páginas</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Cards de Páginas */}
                        <div className="grid md:grid-cols-2 gap-4">
                          {analysisResults.map((item, i) => (
                            <div key={i} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white">
                              <h3 className="font-medium text-indigo-700 mb-1 line-clamp-1" title={item.extracted.title}>
                                {item.extracted.title}
                              </h3>
                              <div className="text-xs text-slate-400 mb-3 truncate font-mono bg-slate-50 p-1 rounded">
                                {item.url}
                              </div>
                              
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-slate-500">Intenção</span>
                                  <span className="font-medium text-slate-700">{item.analysis.intencao}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-slate-500">Funil</span>
                                  <span className="font-medium text-slate-700">{item.analysis.funil}</span>
                                </div>
                              </div>

                              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5">
                                {item.analysis.clusters.slice(0, 4).map((c, idx) => (
                                  <span key={idx} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded-full">
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
                        <p className="text-lg font-medium text-slate-600">Sem dados de análise</p>
                        <p className="text-sm">Os detalhes do conteúdo aparecerão aqui após o processamento.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* --- TAB: LOGS --- */}
                {activeTab === "logs" && (
                  <div className="h-full flex flex-col">
                    <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-green-400 h-96 overflow-y-auto shadow-inner custom-scrollbar">
                      {logs.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-slate-700">
                          <span className="animate-pulse">_ Aguardando comando...</span>
                        </div>
                      ) : (
                        logs.map((log, i) => (
                          <div key={i} className="mb-1.5 border-b border-slate-800/50 pb-1 last:border-0 last:pb-0 break-all">
                            <span className="text-slate-500 mr-2">[{new Date().toLocaleTimeString()}]</span>
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
    </div>
  );
}
