import React, { useState } from "react";
import {
  X,
  TrendingUp,
  Link as LinkIcon,
  HelpCircle,
  Activity,
  Search,
  Settings,
  Mail,
  BarChart3,
  FileText,
} from "lucide-react";

interface DocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = "trends" | "links";

export default function DocumentationModal({
  isOpen,
  onClose,
}: DocumentationModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("trends");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <HelpCircle className="w-5 h-5 text-[#ff5f29]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Documentação das Automações
              </h2>
              <p className="text-xs text-slate-500">
                Guia detalhado de funcionalidades e parâmetros
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab("trends")}
            className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors relative ${
              activeTab === "trends"
                ? "text-[#ff5f29] bg-white"
                : "text-slate-500 bg-slate-50 hover:bg-slate-100 hover:text-slate-700"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Trends Master
            {activeTab === "trends" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ff5f29]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("links")}
            className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors relative ${
              activeTab === "links"
                ? "text-[#ff5f29] bg-white"
                : "text-slate-500 bg-slate-50 hover:bg-slate-100 hover:text-slate-700"
            }`}
          >
            <LinkIcon className="w-4 h-4" />
            Inlinks AI Agent
            {activeTab === "links" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ff5f29]" />
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-white custom-scrollbar">
          {activeTab === "trends" && <TrendsDocumentation />}
          {activeTab === "links" && <LinksDocumentation />}
        </div>
      </div>
    </div>
  );
}

function TrendsDocumentation() {
  return (
    <div className="space-y-8">
      <div className="prose prose-slate max-w-none">
        <p className="text-slate-600 text-sm leading-relaxed">
          O <strong>Trends Master</strong> é uma automação projetada para
          identificar tendências emergentes no Google, analisar o contexto com
          IA e gerar relatórios prontos para pautas de conteúdo.
        </p>
      </div>

      {/* Fluxo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            icon: Search,
            title: "1. Coleta",
            desc: "Busca tendências no Google Trends e filtra por relevância.",
          },
          {
            icon: FileText,
            title: "2. Notícias",
            desc: "Extrai artigos principais relacionados a cada tendência.",
          },
          {
            icon: Activity,
            title: "3. Análise IA",
            desc: "GPT-4 resume e valida se a tendência faz sentido para o nicho.",
          },
          {
            icon: Mail,
            title: "4. Entrega",
            desc: "Gera relatório Markdown e envia por e-mail automaticamente.",
          },
        ].map((item, i) => (
          <div
            key={i}
            className="bg-slate-50 p-4 rounded-xl border border-slate-100"
          >
            <div className="w-8 h-8 bg-white rounded-lg shadow-sm flex items-center justify-center text-[#ff5f29] mb-3">
              <item.icon className="w-4 h-4" />
            </div>
            <h4 className="font-semibold text-slate-900 text-sm mb-1">
              {item.title}
            </h4>
            <p className="text-xs text-slate-500">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Parâmetros */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Settings className="w-5 h-5 text-slate-400" />
          Parâmetros de Configuração
        </h3>

        <div className="grid gap-6">
          <ParamCard
            title="Setor / Categoria"
            required
            description="Define o nicho macro de busca no Google Trends (ex: Tecnologia, Saúde, Finanças). O sistema usa isso para filtrar resultados irrelevantes."
          />

          <ParamCard
            title="Tópicos Personalizados"
            description="Palavras-chave específicas que você deseja monitorar. O sistema dará prioridade a tendências que contenham estes termos ou sejam semanticamente relacionadas."
            example="Ex: 'Inteligência Artificial', 'Machine Learning' para um setor de Tecnologia."
          />

          <ParamCard
            title="Períodos de Análise"
            required
            description="Define a janela de tempo para busca das tendências:"
          >
            <ul className="mt-2 space-y-1 text-xs text-slate-600 list-disc pl-4">
              <li>
                <strong>Diário:</strong> Últimas 24 horas. Ideal para notícias
                quentes (Hard News).
              </li>
              <li>
                <strong>Semanal:</strong> Últimos 7 dias. Bom para artigos de
                análise e tutoriais.
              </li>
              <li>
                <strong>Mensal:</strong> Últimos 30 dias. Ideal para identificar
                comportamentos consolidados e conteúdo evergreen.
              </li>
            </ul>
          </ParamCard>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ParamCard
              title="Top N (Populares)"
              description="Quantidade de termos com maior volume absoluto de busca. São tendências consolidadas e seguras."
              example="Valor recomendado: 10"
            />
            <ParamCard
              title="Rising N (Em Ascensão)"
              description="Quantidade de termos com crescimento repentino (+5000% ou 'Breakout'). São oportunidades virais de alto potencial."
              example="Valor recomendado: 10"
            />
          </div>

          <ParamCard
            title="Artigos por Keyword"
            description="Número de notícias que o robô deve ler para cada tendência encontrada. Quanto maior, mais rico o resumo, porém mais lento o processamento."
            example="Padrão: 3 artigos"
          />

          <ParamCard
            title="Enviar por Email"
            description="Se ativado, o relatório final renderizado será enviado para a lista de destinatários configurada."
          />
        </div>
      </div>
    </div>
  );
}

function LinksDocumentation() {
  return (
    <div className="space-y-8">
      <div className="prose prose-slate max-w-none">
        <p className="text-slate-600 text-sm leading-relaxed">
          O <strong>Inlinks AI Agent</strong> automatiza a estratégia de{" "}
          <em>Link Building Interno</em>. Ele analisa seu conteúdo pilar e
          encontra oportunidades semânticas em outras páginas do seu site para
          linkar de volta para o pilar, aumentando sua autoridade de tópico (Topic Authority).
        </p>
      </div>

      <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
        <h4 className="font-semibold text-orange-800 text-sm mb-2">
          Por que usar?
        </h4>
        <p className="text-xs text-orange-700">
          Links internos ajudam o Google a entender a hierarquia do seu site e
          distribuem o "Link Juice" (autoridade) para as páginas que você mais
          quer rankear.
        </p>
      </div>

      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Settings className="w-5 h-5 text-slate-400" />
          Parâmetros de Configuração
        </h3>

        <div className="grid gap-6">
          <ParamCard
            title="URL do Conteúdo Pilar"
            required
            description="A URL da página principal que você deseja fortalecer. O agente buscará menções a tópicos relacionados a esta página em todo o seu site."
          />

          <ParamCard
            title="Sitemap.xml"
            description="O mapa do seu site (ex: https://site.com/sitemap.xml). É essencial para que o robô descubra todas as URLs disponíveis para análise."
          />

          <ParamCard
            title="Estratégia de Linkagem"
            description="Define a regra de negócio para criação dos links:"
          >
             <ul className="mt-2 space-y-2 text-xs text-slate-600">
              <li className="flex items-start gap-2">
                <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-mono text-[10px] font-bold mt-0.5">HÍBRIDO</span>
                <span>
                  <strong>Bidirecional:</strong> Cria links das páginas satélites para o pilar (fortalece o pilar) E do pilar para satélites relevantes (distribui autoridade). É a estratégia mais equilibrada.
                </span>
              </li>
            </ul>
          </ParamCard>

          <ParamCard
            title="Max Inlinks por Página"
            description="Limite de segurança para evitar excesso de otimização (Over-optimization). Define o máximo de links que o agente pode sugerir para uma única página."
            example="Padrão: 5 links"
          />
        </div>
      </div>
    </div>
  );
}

function ParamCard({
  title,
  description,
  required,
  example,
  children,
}: {
  title: string;
  description: string;
  required?: boolean;
  example?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 hover:border-slate-200 transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <h4 className="font-semibold text-slate-900 text-sm">{title}</h4>
        {required && (
          <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded">
            OBRIGATÓRIO
          </span>
        )}
      </div>
      <p className="text-xs text-slate-600 leading-relaxed">{description}</p>
      {children}
      {example && (
        <div className="mt-3 pt-3 border-t border-slate-200/50">
          <p className="text-[10px] font-mono text-slate-500">{example}</p>
        </div>
      )}
    </div>
  );
}
