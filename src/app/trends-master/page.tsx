"use client";

/**
 * Página do módulo Trends Master
 * Interface para coleta e análise de tendências do Google Trends
 */

import { useState, useEffect } from "react";
import {
  Loader2,
  Download,
  Play,
  Settings,
  Terminal,
  TrendingUp,
  Newspaper,
  Mail,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  FileText,
  ExternalLink,
  HelpCircle,
  Search,
} from "lucide-react";
import {
  runTrendsPipeline,
  loadTrendsConfig,
  saveTrendsConfig,
  testSerpApiConnection,
} from "./actions";
import {
  TrendsConfig,
  TrendsReport,
  TrendsPeriod,
} from "@/services/trends-master/types";
import { convertMarkdownToHtmlFragment } from "@/utils/markdown-renderer";

// Opções de períodos disponíveis
const PERIOD_OPTIONS: { value: TrendsPeriod; label: string }[] = [
  { value: "diario", label: "Diário" },
  { value: "semanal", label: "Semanal" },
  { value: "mensal", label: "Mensal" },
];

// Setores/categorias disponíveis (Baseado no Google Trends)
const SECTOR_OPTIONS = [
  "Animais e Pets",
  "Artes e Entretenimento",
  "Automóveis e Veículos",
  "Beleza e Fitness",
  "Casa e Jardim",
  "Ciência",
  "Comidas e Bebidas",
  "Compras",
  "Computadores e Eletrônicos",
  "Comunidades Online",
  "Empregos e Educação",
  "Esportes",
  "Finanças",
  "Hobbies e Lazer",
  "Imóveis",
  "Inteligência Artificial",
  "Internet e Telecomunicações",
  "Jogos",
  "Lei e Governo",
  "Livros e Literatura",
  "Moda",
  "Negócios e Indústria",
  "Notícias",
  "Pessoas e Sociedade",
  "Referência",
  "Saúde",
  "Viagens",
];

export const maxDuration = 300; // 5 minutos (limite do plano Pro) ou 60s (limite do Hobby)

export default function TrendsMasterPage() {
  // State de configuração
  const [config, setConfig] = useState<TrendsConfig>({
    sector: "Inteligência Artificial", // Valor padrão válido
    periods: ["diario", "semanal", "mensal"],
    topN: 10,
    risingN: 10,
    maxArticles: 3,
    emailRecipients: [],
    emailEnabled: false,
    emailMode: "smtp",
  });

  // State para tópicos personalizados
  const [customTopics, setCustomTopics] = useState<string>("");

  // State de UI
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [report, setReport] = useState<TrendsReport | null>(null);
  const [activeTab, setActiveTab] = useState<"config" | "report" | "logs">(
    "config",
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [serpApiStatus, setSerpApiStatus] = useState<"idle" | "ok" | "error">(
    "idle",
  );
  const [progress, setProgress] = useState(0);

  // Carrega configuração salva
  useEffect(() => {
    loadTrendsConfig().then((saved) => {
      if (saved) {
        // Mapeia setor legado "Autos" para o novo "Automóveis e Veículos"
        // para garantir que o Select exiba corretamente
        if (saved.sector === "Autos") {
          saved.sector = "Automóveis e Veículos";
        }

        // Removendo carregamento automático de email e tópicos personalizados
        // conforme solicitado pelo usuário, para que o usuário insira manualmente
        const { emailRecipients, customTopics, ...rest } = saved;

        setConfig((prev) => ({
          ...prev,
          ...rest,
          emailRecipients: [], // Força vazio
        }));

        // Garante que tópicos personalizados iniciem vazios
        setCustomTopics("");
      }
    });
  }, []);

  // Testa conexão SerpAPI
  useEffect(() => {
    testSerpApiConnection().then((result) => {
      setSerpApiStatus(result.success ? "ok" : "error");
    });
  }, []);

  // Helper: adiciona log
  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  // Toggle período
  const togglePeriod = (period: TrendsPeriod) => {
    setConfig((prev) => ({
      ...prev,
      periods: prev.periods.includes(period)
        ? prev.periods.filter((p) => p !== period)
        : [...prev.periods, period],
    }));
  };

  // Adiciona email
  const addEmail = () => {
    if (!newEmail.trim() || !newEmail.includes("@")) return;
    if (config.emailRecipients.includes(newEmail.trim())) return;
    setConfig((prev) => ({
      ...prev,
      emailRecipients: [...prev.emailRecipients, newEmail.trim()],
    }));
    setNewEmail("");
  };

  // Remove email
  const removeEmail = (email: string) => {
    setConfig((prev) => ({
      ...prev,
      emailRecipients: prev.emailRecipients.filter((e) => e !== email),
    }));
  };

  // Executa pipeline
  const handleRun = async () => {
    if (config.periods.length === 0) {
      addLog("❌ Selecione pelo menos um período para análise.");
      return;
    }

    setIsRunning(true);
    setLogs([]);
    setReport(null);
    setActiveTab("logs");
    setProgress(0);

    const effectiveConfig: TrendsConfig = {
      ...config,
      customTopics: customTopics
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0),
    };

    addLog("🚀 Iniciando Trends Master...");
    addLog(`📊 Setor: ${config.sector}`);
    addLog(`📅 Períodos: ${config.periods.join(", ")}`);
    if (
      effectiveConfig.customTopics &&
      effectiveConfig.customTopics.length > 0
    ) {
      addLog(
        `🔍 Tópicos personalizados (${
          effectiveConfig.customTopics.length
        }): ${effectiveConfig.customTopics.join(", ")}`,
      );
    }

    // Simula progresso (a pipeline real é síncrona no server action)
    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.min(prev + 5, 90));
    }, 1000);

    try {
      const result = await runTrendsPipeline(effectiveConfig);
      clearInterval(progressInterval);
      setProgress(100);

      // Verificação de segurança para evitar erro crítico em caso de timeout
      if (!result) {
        throw new Error(
          "O servidor não retornou uma resposta válida. Isso geralmente ocorre por Timeout (limite de 5 minutos excedido). Tente reduzir o número de tópicos ou períodos.",
        );
      }

      if (result.success && result.report) {
        addLog("✅ Pipeline concluída com sucesso!");
        addLog(`📝 Relatório gerado: ${result.report.periods.length} períodos`);
        setReport(result.report);
        setActiveTab("report");
      } else {
        addLog(`❌ Erro: ${result.error || "Erro desconhecido"}`);
      }
    } catch (error) {
      clearInterval(progressInterval);
      addLog(
        `❌ Erro crítico: ${error instanceof Error ? error.message : error}`,
      );
    } finally {
      setIsRunning(false);
    }
  };

  // Salva configuração
  const handleSaveConfig = async () => {
    const configToSave: TrendsConfig = {
      ...config,
      customTopics: customTopics
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0),
    };

    const success = await saveTrendsConfig(configToSave);
    if (success) {
      addLog("💾 Configuração salva com sucesso!");
    } else {
      addLog("❌ Erro ao salvar configuração.");
    }
  };

  // Download do relatório
  const downloadReport = () => {
    if (!report) return;
    const blob = new Blob([report.markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trends_${config.sector}_${
      new Date().toISOString().split("T")[0]
    }.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar - Configuração */}
          <aside className="w-full lg:w-80 shrink-0 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-slate-400" />
                Configuração
              </h2>

              <div className="space-y-4">
                {/* Setor */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Setor / Categoria
                  </label>
                  <select
                    value={config.sector}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, sector: e.target.value }))
                    }
                    className="w-full p-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-[#ff5f29]"
                  >
                    {SECTOR_OPTIONS.map((sector) => (
                      <option key={sector} value={sector}>
                        {sector}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tópicos Personalizados */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    <span className="flex items-center gap-1">
                      <Search className="w-3.5 h-3.5" />
                      Tópicos Personalizados
                    </span>
                  </label>
                  <textarea
                    value={customTopics}
                    onChange={(e) => setCustomTopics(e.target.value)}
                    placeholder="Ex: financiamento, consórcio, seguro auto"
                    className="w-full p-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-[#ff5f29] resize-none h-20"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Separe por vírgula os tópicos que deseja monitorar no Google
                    Trends e News
                  </p>
                </div>

                {/* Períodos */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Períodos de Análise
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PERIOD_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => togglePeriod(opt.value)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          config.periods.includes(opt.value)
                            ? "bg-[#ff5f29] text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Email Toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">
                    Enviar por Email
                  </span>
                  <button
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        emailEnabled: !prev.emailEnabled,
                      }))
                    }
                    className={`w-12 h-6 rounded-full transition-colors ${
                      config.emailEnabled ? "bg-[#ff5f29]" : "bg-slate-200"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        config.emailEnabled
                          ? "translate-x-6"
                          : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>

                {/* Email Recipients */}
                {config.emailEnabled && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Destinatários
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && addEmail()}
                        placeholder="email@exemplo.com"
                        className="flex-1 p-2 rounded-lg border border-slate-300 text-sm"
                      />
                      <button
                        onClick={addEmail}
                        className="p-2 bg-[#ff5f29] text-white rounded-lg hover:bg-[#e64e1c]"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {config.emailRecipients.map((email) => (
                        <div
                          key={email}
                          className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded text-sm"
                        >
                          <span>{email}</span>
                          <button
                            onClick={() => removeEmail(email)}
                            className="text-slate-400 hover:text-red-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Advanced Settings */}
                <div className="border-t border-slate-100 pt-2">
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center justify-between w-full text-sm text-slate-600 hover:text-[#ff5f29] py-2"
                  >
                    <span className="font-medium">Configurações Avançadas</span>
                    {showAdvanced ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>

                  {showAdvanced && (
                    <div className="space-y-4 pt-2 animate-in fade-in">
                      {/* Explicação Top N e Rising N */}
                      <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                        <div className="flex items-start gap-2">
                          <HelpCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                          <div className="text-xs text-blue-700 space-y-1">
                            <p>
                              <strong>Top N:</strong> Quantidade de termos mais
                              buscados (tendências estáveis e populares).
                            </p>
                            <p>
                              <strong>Rising N:</strong> Quantidade de termos em
                              ascensão rápida (crescimento acelerado nas
                              buscas).
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1">
                            Top N
                            <span
                              className="text-slate-400"
                              title="Termos mais buscados"
                            >
                              📈
                            </span>
                          </label>
                          <input
                            type="number"
                            value={config.topN}
                            onChange={(e) =>
                              setConfig((prev) => ({
                                ...prev,
                                topN: Number(e.target.value),
                              }))
                            }
                            className="w-full p-2 rounded-lg border border-slate-300 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1">
                            Rising N
                            <span
                              className="text-slate-400"
                              title="Termos em ascensão"
                            >
                              🚀
                            </span>
                          </label>
                          <input
                            type="number"
                            value={config.risingN}
                            onChange={(e) =>
                              setConfig((prev) => ({
                                ...prev,
                                risingN: Number(e.target.value),
                              }))
                            }
                            className="w-full p-2 rounded-lg border border-slate-300 text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Artigos por Keyword
                        </label>
                        <input
                          type="number"
                          value={config.maxArticles}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              maxArticles: Number(e.target.value),
                            }))
                          }
                          className="w-full p-2 rounded-lg border border-slate-300 text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Botões de ação */}
                <div className="space-y-2 pt-2">
                  <button
                    onClick={handleRun}
                    disabled={isRunning || serpApiStatus === "error"}
                    className="w-full py-3 bg-[#ff5f29] hover:bg-[#e64e1c] text-white rounded-lg font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
                  >
                    {isRunning ? (
                      <>
                        <Loader2 className="animate-spin w-4 h-4" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Executar Pipeline
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleSaveConfig}
                    className="w-full py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                  >
                    Salvar Configuração
                  </button>
                </div>
              </div>
            </div>

            {/* Botão Google Trends */}
            <a
              href="https://trends.google.com.br/trends/?geo=BR"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 bg-white border-2 border-[#4285f4] text-[#4285f4] rounded-xl font-medium hover:bg-[#4285f4] hover:text-white transition-all group"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
              </svg>
              Abrir Google Trends
              <ExternalLink className="w-4 h-4 opacity-70" />
            </a>

            {/* Info Card */}
            <div className="bg-[#fff5f2] rounded-xl p-4 border border-orange-100">
              <h3 className="text-slate-900 font-semibold text-sm mb-2 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Sobre o Trends Master
              </h3>
              <p className="text-slate-700 text-xs leading-relaxed">
                Coleta tendências do Google Trends, busca notícias relacionadas
                e gera um relatório completo com resumo via IA.
              </p>
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1 space-y-6">
            {/* Tabs */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 min-h-[500px] flex flex-col">
              <div className="border-b border-slate-200 px-2 flex items-center gap-1">
                <button
                  onClick={() => setActiveTab("config")}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === "config"
                      ? "border-[#ff5f29] text-[#ff5f29]"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  Visão Geral
                </button>
                <button
                  onClick={() => setActiveTab("report")}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === "report"
                      ? "border-[#ff5f29] text-[#ff5f29]"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Newspaper className="w-4 h-4" />
                  Relatório
                  {report && (
                    <span className="bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded">
                      Novo
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("logs")}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === "logs"
                      ? "border-[#ff5f29] text-[#ff5f29]"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Terminal className="w-4 h-4" />
                  Logs
                </button>
              </div>

              <div className="p-6 flex-1">
                {/* Tab: Visão Geral */}
                {activeTab === "config" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-[#fff5f2] text-[#ff5f29] rounded-lg">
                            <TrendingUp className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-sm text-slate-500">Setor</p>
                            <p className="text-lg font-bold">{config.sector}</p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                            <Newspaper className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-sm text-slate-500">Períodos</p>
                            <p className="text-lg font-bold">
                              {config.periods.length}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-green-50 text-green-600 rounded-lg">
                            <Mail className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-sm text-slate-500">
                              Destinatários
                            </p>
                            <p className="text-lg font-bold">
                              {config.emailRecipients.length}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
                      <h3 className="font-semibold text-slate-900 mb-4">
                        Como funciona
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {[
                          {
                            step: "1",
                            title: "Coleta Trends",
                            desc: "Busca tendências via SerpAPI",
                          },
                          {
                            step: "2",
                            title: "Busca Notícias",
                            desc: "Encontra notícias relacionadas",
                          },
                          {
                            step: "3",
                            title: "Resumo IA",
                            desc: "Gera análise com GPT-4",
                          },
                          {
                            step: "4",
                            title: "Relatório",
                            desc: "Exporta Markdown/Email",
                          },
                        ].map((item) => (
                          <div key={item.step} className="text-center">
                            <div className="w-8 h-8 bg-[#ff5f29] text-white rounded-full flex items-center justify-center mx-auto mb-2 font-bold text-sm">
                              {item.step}
                            </div>
                            <p className="font-medium text-slate-900 text-sm">
                              {item.title}
                            </p>
                            <p className="text-xs text-slate-500">
                              {item.desc}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab: Relatório */}
                {activeTab === "report" && (
                  <div className="space-y-4">
                    {report ? (
                      <>
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-slate-900">
                            Relatório: {report.sector}
                          </h3>
                          <button
                            onClick={downloadReport}
                            className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-md text-xs font-medium hover:bg-slate-200"
                          >
                            <Download className="w-4 h-4" />
                            Download MD
                          </button>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 overflow-auto max-h-[600px]">
                          <div
                            className="text-sm text-slate-700"
                            dangerouslySetInnerHTML={{
                              __html: convertMarkdownToHtmlFragment(
                                report.markdown,
                              ),
                            }}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <FileText className="w-12 h-12 mb-4" />
                        <p className="text-lg font-medium">
                          Nenhum relatório gerado
                        </p>
                        <p className="text-sm">
                          Execute a pipeline para gerar um relatório
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Logs */}
                {activeTab === "logs" && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">
                      Logs de Execução
                    </h3>
                    <div className="bg-slate-900 rounded-lg p-4 h-[32rem] overflow-y-auto font-mono text-sm">
                      {logs.length > 0 ? (
                        logs.map((log, i) => (
                          <div key={i} className="text-green-400 py-0.5">
                            {log}
                          </div>
                        ))
                      ) : (
                        <div className="text-slate-500">
                          Aguardando execução da pipeline...
                        </div>
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
