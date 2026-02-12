"use client";

import { useState, useEffect, useRef } from "react";
import {
  chatWithSocialAgent,
  getUrlContent,
  processUrlStrategy,
} from "./actions";
import { supabase } from "@/lib/supabase";
import {
  Loader2,
  Send,
  Sparkles,
  Plus,
  Settings2,
  X,
  MessageSquare,
  Copy,
  Trash2,
  Bot,
  User,
  ArrowDown,
  Video,
  Linkedin,
  Instagram,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import PersonaForm from "@/components/PersonaForm";

export default function SocialAgentPage() {
  // Chat State
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [extractedContent, setExtractedContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Persona State
  const [persona, setPersona] = useState({
    tone: "corporativo",
    target: "Profissionais de marketing e empresários",
    objectives: ["Autoridade", "Engajamento"],
  });
  const [savedPersonas, setSavedPersonas] = useState<any[]>([]);
  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);

  // Auto-scroll
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Fetch personas on mount
  const fetchPersonas = async (selectLatest = false) => {
    try {
      const res = await fetch("/api/persona", {
        headers: {
          Authorization: "Bearer mock-token",
        },
      });
      const data = await res.json();

      if (res.ok && Array.isArray(data)) {
        setSavedPersonas(data);
        if ((data.length > 0 && !persona.tone) || selectLatest) {
          const p = data[0];
          setPersona({
            tone: p.tipo_de_tom,
            target:
              typeof p.publico_alvo === "string"
                ? p.publico_alvo
                : JSON.stringify(p.publico_alvo),
            objectives: Array.isArray(p.objetivos_comunicacao)
              ? p.objetivos_comunicacao
              : [],
          });
        }
      }
    } catch (error) {
      console.error("Erro ao buscar personas:", error);
    }
  };

  useEffect(() => {
    fetchPersonas();
  }, []);

  // Handlers
  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput("");

    // Add User Message
    const newMessages = [
      ...messages,
      { role: "user" as const, content: userMsg },
    ];
    setMessages(newMessages);
    setLoading(true);

    // Check if input contains URL
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const foundUrls = userMsg.match(urlRegex);
    let contextToSend = extractedContent;

    if (foundUrls && foundUrls.length > 0) {
      const urlToProcess = foundUrls[0];
      const loadingMsg = {
        role: "assistant" as const,
        content: `🔍 Analisando link: ${urlToProcess}...`,
      };

      // Atualiza estado visualmente antes da chamada async
      const intermediateMessages = [...newMessages, loadingMsg];
      setMessages(intermediateMessages);

      try {
        // Usar o novo agente de estratégia se for uma URL
        const res = await processUrlStrategy(urlToProcess, persona);

        if (res.success && res.content && res.strategy) {
          setExtractedContent(res.content);
          contextToSend = res.content;

          // Montar mensagem visual com a estratégia gerada
          const strategy = res.strategy;
          const strategyMarkdown = `
✅ **Estratégia de Conteúdo Gerada com Sucesso!**

Aqui estão 3 formatos otimizados para esta URL:

### 1. 🎬 Vídeo Longo (LinkedIn/YouTube)
**Título:** ${strategy.linkedin_video_script.title}
**Gancho:** ${strategy.linkedin_video_script.hook}
**CTA:** ${strategy.linkedin_video_script.cta}

---

### 2. 📱 Reels (Instagram/TikTok)
**Gancho Visual:** ${strategy.instagram_reels_script.hook_visual}
**Áudio:** ${strategy.instagram_reels_script.hook_audio}
**Legenda:** ${strategy.instagram_reels_script.caption}

---

### 3. 💼 Post LinkedIn
**Headline:** ${strategy.linkedin_post.headline}
**Corpo:** 
${strategy.linkedin_post.body}

---
*Deseja refinar algum desses formatos?*
`;

          const successMsg = {
            role: "assistant" as const,
            content: strategyMarkdown,
          };

          setMessages([...newMessages, successMsg]);
          setLoading(false);
          return;
        } else if (res.success && res.content) {
          // Fallback se a estratégia falhar mas extração funcionar
          setExtractedContent(res.content);
          contextToSend = res.content;

          const successMsg = {
            role: "assistant" as const,
            content: `✅ Conteúdo extraído! \n\nAgora posso criar posts baseados em: *${urlToProcess}*`,
          };

          const agentRes = await chatWithSocialAgent(
            newMessages,
            persona,
            res.content,
          );

          if (agentRes.success && agentRes.output) {
            setMessages([
              ...newMessages,
              successMsg,
              { role: "assistant", content: agentRes.output },
            ]);
          }
          setLoading(false);
          return;
        } else {
          // Falha na extração
          const errorMsg = {
            role: "assistant" as const,
            content: `⚠️ Não consegui ler o conteúdo do link (${res.error || "Erro desconhecido"}). Vou tentar responder apenas com meu conhecimento base.`,
          };
          setMessages([...newMessages, errorMsg]);
        }
      } catch (err) {
        console.error("Erro fatal ao processar URL:", err);
      }
    }

    // Call Agent (Fluxo normal sem URL ou falha de URL)
    const res = await chatWithSocialAgent(newMessages, persona, contextToSend);

    if (res.success && res.output) {
      setMessages([...newMessages, { role: "assistant", content: res.output }]);
    } else {
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: `❌ Erro: ${res.error || "Desculpe, tive um erro ao processar sua mensagem."}`,
        },
      ]);
    }
    setLoading(false);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add toast here
  };

  const handleClear = () => {
    if (confirm("Limpar todo o histórico?")) {
      setMessages([]);
      setExtractedContent("");
    }
  };

  return (
    <main className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
      {/* Sidebar - Persona & Settings */}
      <aside className="w-80 bg-white border-r border-slate-200 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-orange-50 rounded-xl">
              <Sparkles className="w-6 h-6 text-[#ff5f29]" />
            </div>
            <h1 className="font-bold text-lg">Social Agent</h1>
          </div>

          <button
            onClick={() => setIsPersonaModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 bg-[#ff5f29] hover:bg-[#e64e1c] text-white py-3 rounded-xl font-medium transition-all shadow-lg shadow-orange-500/20"
          >
            <Plus className="w-5 h-5" />
            Nova Persona
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Persona Ativa
            </label>
            <select
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#ff5f29]/20 outline-none"
              onChange={(e) => {
                const p = savedPersonas.find((p) => p.id === e.target.value);
                if (p) {
                  setPersona({
                    tone: p.tipo_de_tom,
                    target:
                      typeof p.publico_alvo === "string"
                        ? p.publico_alvo
                        : JSON.stringify(p.publico_alvo),
                    objectives: Array.isArray(p.objetivos_comunicacao)
                      ? p.objetivos_comunicacao
                      : [],
                  });
                }
              }}
            >
              <option value="">Selecione...</option>
              {savedPersonas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome_da_marca}
                </option>
              ))}
            </select>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Settings2 className="w-3 h-3" />
                <span>Configuração Atual:</span>
              </div>
              <p className="text-sm font-medium">{persona.tone}</p>
              <p className="text-xs text-slate-400 line-clamp-2">
                {persona.target}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100">
          <button
            onClick={handleClear}
            className="flex items-center gap-2 text-slate-400 hover:text-red-500 text-sm p-2 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Limpar Conversa
          </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <section className="flex-1 flex flex-col relative">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-60">
              <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mb-4">
                <Bot className="w-10 h-10 text-[#ff5f29]" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">
                Como posso ajudar hoje?
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full">
                {[
                  "Criar posts para Instagram sobre Marketing",
                  "Transformar um link em Thread do LinkedIn",
                  "Ideias de Reels para minha persona",
                  "Calendário editorial para a semana",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="p-4 bg-white border border-slate-200 rounded-xl hover:border-[#ff5f29]/50 hover:bg-orange-50/30 transition-all text-sm text-left shadow-sm"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-4 max-w-4xl mx-auto ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-[#ff5f29] flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                )}

                <div
                  className={`relative group max-w-[85%] rounded-2xl p-6 shadow-sm ${
                    msg.role === "user"
                      ? "bg-slate-900 text-white rounded-tr-none"
                      : "bg-white border border-slate-100 text-slate-800 rounded-tl-none"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <button
                      onClick={() => handleCopy(msg.content)}
                      className="absolute top-2 right-2 p-1.5 bg-slate-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-200"
                      title="Copiar"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                  )}

                  <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-slate-800 prose-pre:text-slate-50">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>

                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 mt-1">
                    <User className="w-5 h-5 text-slate-500" />
                  </div>
                )}
              </div>
            ))
          )}

          {loading && (
            <div className="flex gap-4 max-w-4xl mx-auto">
              <div className="w-8 h-8 rounded-full bg-[#ff5f29] flex items-center justify-center flex-shrink-0">
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              </div>
              <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-none p-4 shadow-sm flex items-center gap-2">
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100" />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 md:p-6 bg-white border-t border-slate-100">
          <div className="max-w-4xl mx-auto relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Digite sua mensagem ou cole um link..."
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-4 pr-14 py-4 min-h-[60px] max-h-[200px] focus:outline-none focus:ring-2 focus:ring-[#ff5f29]/20 focus:border-[#ff5f29] resize-none shadow-sm transition-all"
            />
            <button
              onClick={handleSendMessage}
              disabled={!input.trim() || loading}
              className="absolute right-3 bottom-3 p-2 bg-[#ff5f29] hover:bg-[#e64e1c] disabled:opacity-50 disabled:hover:bg-[#ff5f29] text-white rounded-xl transition-all shadow-md"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-center text-xs text-slate-400 mt-3">
            O Agente pode cometer erros. Verifique as informações importantes.
          </p>
        </div>
      </section>

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
