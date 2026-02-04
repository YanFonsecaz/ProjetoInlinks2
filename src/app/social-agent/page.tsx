"use client";

import { useState, useEffect } from "react";
import { 
  processSocialStep, 
  getUrlContent 
} from "./actions";
import { supabase } from "@/lib/supabase";
import { 
  Loader2, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  Send, 
  FileText, 
  Video, 
  Layout as LayoutIcon, 
  Type, 
  Palette, 
  Calendar as CalendarIcon,
  Search,
  ArrowRight,
  RefreshCcw,
  Sparkles,
  Plus,
  Settings2,
  X
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import PersonaForm from "@/components/PersonaForm";

const STEPS = [
  { id: "analysis", label: "Análise", icon: Search },
  { id: "scripts", label: "Scripts", icon: Video },
  { id: "formats", label: "Formatos", icon: LayoutIcon },
  { id: "captions", label: "Legendas", icon: Type },
  { id: "visual", label: "Visual", icon: Palette },
  { id: "calendar", label: "Calendário", icon: CalendarIcon },
];

export default function SocialAgentPage() {
  // State
  const [currentStepIndex, setCurrentStepIndex] = useState(-1); // -1 is initial setup
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState("");
  const [rawText, setRawText] = useState("");
  const [content, setContent] = useState("");
  const [persona, setPersona] = useState({
    tone: "corporativo",
    target: "Profissionais de marketing e empresários",
    objectives: ["Autoridade", "Engajamento"],
  });
  const [outputs, setOutputs] = useState<Record<string, string>>({});
  const [savedPersonas, setSavedPersonas] = useState<any[]>([]);
  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);

  // Fetch personas on mount
  const fetchPersonas = async (selectLatest = false) => {
    const { data, error } = await supabase
      .from("brand_personas")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (!error && data) {
      setSavedPersonas(data);
      // Se solicitado ou se for a primeira carga sem persona selecionada
      if ((data.length > 0 && !persona.tone) || selectLatest) {
        const p = data[0];
        setPersona({
          tone: p.tipo_de_tom,
          target: typeof p.publico_alvo === 'string' ? p.publico_alvo : JSON.stringify(p.publico_alvo),
          objectives: p.objetivos_comunicacao
        });
      }
    }
  };

  useEffect(() => {
    fetchPersonas();
  }, []);

  // Handlers
  const handleStart = async () => {
    setLoading(true);
    let finalContent = rawText;
    
    if (url.trim()) {
      const res = await getUrlContent(url);
      if (res.success && res.content) {
        finalContent = res.content;
      } else {
        alert("Erro ao extrair conteúdo da URL. Usando texto manual se disponível.");
      }
    }

    if (!finalContent.trim()) {
      alert("Por favor, forneça uma URL ou texto base.");
      setLoading(false);
      return;
    }

    setContent(finalContent);
    setCurrentStepIndex(0);
    await runStep(0, finalContent);
    setLoading(false);
  };

  const runStep = async (index: number, contentOverride?: string) => {
    const stepId = STEPS[index].id as any;
    setLoading(true);
    
    // Coletar contexto das etapas anteriores
    let previousContext = "";
    if (index > 0) {
      previousContext = STEPS.slice(0, index)
        .map(s => `--- SAÍDA DA ETAPA ${s.label.toUpperCase()} ---\n${outputs[s.id] || "Não disponível"}`)
        .join("\n\n");
    }

    const res = await processSocialStep(stepId, contentOverride || content, persona, previousContext);
    
    if (res.success && res.output) {
      setOutputs(prev => ({ ...prev, [stepId]: res.output || "" }));
    } else {
      alert(`Erro na etapa ${stepId}: ${res.error || "Erro desconhecido"}`);
    }
    setLoading(false);
  };

  const handleNext = async () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStepIndex(nextIndex);
      if (!outputs[STEPS[nextIndex].id]) {
        await runStep(nextIndex);
      }
    }
  };

  const handleBack = () => {
    if (currentStepIndex > -1) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  // Renderers
  const renderInitialForm = () => (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center p-3 bg-orange-50 rounded-2xl mb-4">
          <Sparkles className="w-8 h-8 text-[#ff5f29]" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Agente Social Media</h1>
        <p className="text-slate-500">Transforme seus artigos em conteúdo viral para Instagram e LinkedIn.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-8 space-y-6 shadow-sm">
        <div className="space-y-4">
          <label className="text-sm font-medium text-slate-700">Conteúdo Base</label>
          <input 
            type="url" 
            placeholder="URL do Artigo (opcional)" 
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ff5f29]/20 transition-all text-slate-900"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400">ou insira o texto</span></div>
          </div>
          <textarea 
            placeholder="Cole o texto do artigo aqui..." 
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 min-h-[150px] focus:outline-none focus:ring-2 focus:ring-[#ff5f29]/20 transition-all resize-none text-slate-900"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">Persona Salva</label>
              <button 
                onClick={() => setIsPersonaModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-[#ff5f29] border border-orange-100 rounded-lg text-[10px] font-bold hover:bg-orange-100 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Nova Persona
              </button>
            </div>
            <select 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ff5f29]/20 text-slate-900"
              onChange={(e) => {
                const p = savedPersonas.find(p => p.id === e.target.value);
                if (p) {
                  setPersona({
                    tone: p.tipo_de_tom,
                    target: typeof p.publico_alvo === 'string' ? p.publico_alvo : JSON.stringify(p.publico_alvo),
                    objectives: p.objetivos_comunicacao
                  });
                }
              }}
            >
              <option value="">Selecione uma persona...</option>
              {savedPersonas.map(p => (
                <option key={p.id} value={p.id}>{p.nome_da_marca}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Tom de Voz (Manual)</label>
            <select 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ff5f29]/20 text-slate-900"
              value={persona.tone}
              onChange={(e) => setPersona({...persona, tone: e.target.value})}
            >
              <option value="corporativo">Corporativo</option>
              <option value="divertido">Divertido</option>
              <option value="técnico">Técnico</option>
              <option value="inspiracional">Inspiracional</option>
            </select>
          </div>
        </div>

        <button 
          onClick={handleStart}
          disabled={loading}
          className="w-full bg-[#ff5f29] hover:bg-[#e64e1c] disabled:opacity-50 text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-2 transition-all group shadow-lg shadow-orange-500/20"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
            <>
              Iniciar Transformação
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </div>
    </div>
  );

  const renderStepContent = () => {
    const currentStep = STEPS[currentStepIndex];
    const output = outputs[currentStep.id];

    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
        <div className="flex items-center justify-between bg-white border border-slate-200 p-6 rounded-3xl shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-50 rounded-2xl text-[#ff5f29]">
              <currentStep.icon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{currentStep.label}</h2>
              <p className="text-sm text-slate-500">Etapa {currentStepIndex + 1} de {STEPS.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleBack}
              className="p-3 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button 
              onClick={() => runStep(currentStepIndex)}
              disabled={loading}
              className="p-3 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 disabled:opacity-50"
            >
              <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button 
              onClick={handleNext}
              disabled={currentStepIndex === STEPS.length - 1 || loading || !output}
              className="bg-[#ff5f29] hover:bg-[#e64e1c] disabled:opacity-30 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-md"
            >
              Aprovar e Avançar
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-8 min-h-[500px] relative shadow-sm">
            {loading && !output ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-12 h-12 text-[#ff5f29] animate-spin" />
                <p className="text-slate-400 animate-pulse">A IA está processando sua {currentStep.label.toLowerCase()}...</p>
              </div>
            ) : (
              <div className="prose prose-slate max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{output || ""}</ReactMarkdown>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
              <h3 className="font-bold mb-4 flex items-center gap-2 text-slate-900">
                <Sparkles className="w-4 h-4 text-[#ff5f29]" />
                Progresso do Projeto
              </h3>
              <div className="space-y-3">
                {STEPS.map((step, idx) => (
                  <div 
                    key={step.id} 
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                      idx === currentStepIndex ? 'bg-orange-50 text-[#ff5f29] border border-orange-100' : 
                      idx < currentStepIndex ? 'text-green-600 bg-green-50/50' : 'text-slate-400'
                    }`}
                  >
                    {idx < currentStepIndex ? <CheckCircle2 className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}
                    <span className="text-sm font-medium">{step.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-[#ff5f29] to-[#e64e1c] rounded-3xl p-6 text-white shadow-lg shadow-orange-500/20">
              <h3 className="font-bold mb-2">Dica do Especialista</h3>
              <p className="text-sm text-orange-50 leading-relaxed">
                {currentStep.id === 'analysis' && "Uma boa análise estratégica é a base para todos os outros formatos. Verifique se os pontos-chave capturam a essência do seu artigo."}
                {currentStep.id === 'scripts' && "No Reels, os primeiros 3 segundos são cruciais. Use o gancho para parar o scroll!"}
                {currentStep.id === 'formats' && "Carrosséis tendem a ter mais salvamentos, o que sinaliza valor para o algoritmo do Instagram."}
                {currentStep.id === 'captions' && "Use a primeira linha da legenda como um segundo título para reforçar a curiosidade."}
                {currentStep.id === 'visual' && "A consistência visual cria reconhecimento de marca. Tente manter a mesma paleta em todos os posts."}
                {currentStep.id === 'calendar' && "Publique nos horários de maior pico do seu público para maximizar o alcance inicial."}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8 selection:bg-orange-100 selection:text-slate-900">
      <div className="relative z-10 container mx-auto">
        {currentStepIndex === -1 ? renderInitialForm() : renderStepContent()}
      </div>

      {/* Persona Creation Modal */}
      {isPersonaModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-slate-900">Nova Persona</h2>
              <button 
                onClick={() => setIsPersonaModalOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <div className="p-8">
              <PersonaForm 
                onSuccess={() => {
                  setIsPersonaModalOpen(false);
                  fetchPersonas(true); // Recarrega e seleciona a nova persona
                }} 
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
