"use client";

import { useState, useEffect } from "react";
import { 
  Plus, 
  Search, 
  Users, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  ExternalLink,
  Loader2,
  AlertCircle,
  X,
  Check
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import PersonaForm from "@/components/PersonaForm";

export default function PersonasPage() {
  const [personas, setPersonas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const fetchPersonas = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("brand_personas")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setPersonas(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPersonas();
  }, []);

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("brand_personas")
      .delete()
      .eq("id", id);

    if (!error) {
      setPersonas(prev => prev.filter(p => p.id !== id));
      setIsDeleting(null);
    }
  };

  const filteredPersonas = personas.filter(p => 
    p.nome_da_marca.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.tipo_de_tom.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gerenciamento de Personas</h1>
          <p className="text-sm text-slate-500">Configure a identidade e o tom de voz das suas marcas para a IA.</p>
        </div>
        <button 
          onClick={() => {
            setEditingPersona(null);
            setIsFormOpen(true);
          }}
          className="flex items-center justify-center gap-2 bg-[#ff5f29] hover:bg-[#e64e1c] text-white px-6 py-2.5 rounded-xl font-semibold transition-all shadow-lg shadow-orange-500/20"
        >
          <Plus className="w-5 h-5" />
          Nova Persona
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por marca ou tom de voz..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5f29]/20 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-10 h-10 animate-spin mb-4" />
          <p>Carregando suas personas...</p>
        </div>
      ) : filteredPersonas.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPersonas.map((persona) => (
            <div 
              key={persona.id} 
              className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-xl hover:border-orange-100 transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-orange-50 rounded-xl text-[#ff5f29]">
                  <Users className="w-6 h-6" />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => {
                      setEditingPersona(persona);
                      setIsFormOpen(true);
                    }}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setIsDeleting(persona.id)}
                    className="p-2 hover:bg-red-50 rounded-lg text-slate-500 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <h3 className="text-lg font-bold text-slate-900 mb-1">{persona.nome_da_marca}</h3>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded">
                  {persona.tipo_de_tom}
                </span>
                {persona.status_processamento === 'processing' && (
                  <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 bg-blue-50 text-blue-500 rounded flex items-center gap-1">
                    <Loader2 className="w-2 h-2 animate-spin" />
                    Analisando
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div className="text-xs text-slate-500">
                  <p className="font-semibold text-slate-700 mb-1">Público Alvo:</p>
                  <p className="line-clamp-2">
                    {typeof persona.publico_alvo === 'string' 
                      ? persona.publico_alvo 
                      : persona.publico_alvo.segmento || JSON.stringify(persona.publico_alvo)}
                  </p>
                </div>
                <div className="text-xs text-slate-500">
                  <p className="font-semibold text-slate-700 mb-1">Objetivos:</p>
                  <div className="flex flex-wrap gap-1">
                    {persona.objetivos_comunicacao.map((obj: string) => (
                      <span key={obj} className="px-1.5 py-0.5 bg-slate-50 border border-slate-100 rounded text-[10px]">
                        {obj}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl py-20 flex flex-col items-center text-center px-4">
          <div className="p-4 bg-white rounded-2xl shadow-sm mb-4">
            <Users className="w-12 h-12 text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Nenhuma persona encontrada</h3>
          <p className="text-sm text-slate-500 max-w-xs mb-6">
            Você ainda não configurou nenhuma persona. Crie sua primeira para começar a personalizar seus conteúdos.
          </p>
          <button 
            onClick={() => setIsFormOpen(true)}
            className="text-[#ff5f29] font-bold text-sm hover:underline"
          >
            Criar minha primeira persona
          </button>
        </div>
      )}

      {/* Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-slate-900">
                {editingPersona ? 'Editar Persona' : 'Nova Persona'}
              </h2>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <div className="p-8">
              <PersonaForm 
                initialData={editingPersona} 
                onSuccess={() => {
                  setIsFormOpen(false);
                  fetchPersonas();
                }} 
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleting && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="p-3 bg-red-50 text-red-500 rounded-full mb-4">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Excluir Persona?</h3>
              <p className="text-sm text-slate-500 mb-6">
                Tem certeza que deseja excluir esta persona? Esta ação não pode ser desfeita.
              </p>
              <div className="flex w-full gap-3">
                <button 
                  onClick={() => setIsDeleting(null)}
                  className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => handleDelete(isDeleting)}
                  className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-colors"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
