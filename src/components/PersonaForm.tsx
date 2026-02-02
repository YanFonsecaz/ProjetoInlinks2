"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PersonaSchema, PersonaInput } from "@/types/persona";
import { 
  Loader2, 
  Check, 
  AlertCircle,
  Plus,
  X,
  Sparkles
} from "lucide-react";

interface PersonaFormProps {
  initialData?: any;
  onSuccess: () => void;
}

export default function PersonaForm({ initialData, onSuccess }: PersonaFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PersonaInput>({
    resolver: zodResolver(PersonaSchema),
    defaultValues: initialData ? {
      nome_da_marca: initialData.nome_da_marca,
      tipo_de_tom: initialData.tipo_de_tom,
      texto_referencia: initialData.texto_referencia || "",
      publico_alvo: initialData.publico_alvo,
      objetivos_de_comunicação: initialData.objetivos_comunicacao,
    } : {
      tipo_de_tom: "corporativo",
      objetivos_de_comunicação: [],
      publico_alvo: {
        segmento: ""
      }
    },
  });

  const objetivos = watch("objetivos_de_comunicação") || [];
  const tipoDeTom = watch("tipo_de_tom");

  const onSubmit = async (data: PersonaInput) => {
    setLoading(true);
    setError(null);

    try {
      const url = "/api/persona";
      const method = initialData ? "PATCH" : "POST";
      const body = initialData ? { ...data, id: initialData.id } : data;

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          // Em um app real, o token JWT viria do auth state
          "Authorization": "Bearer mock-token" 
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao salvar persona");
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addObjetivo = (val: string) => {
    if (val && !objetivos.includes(val)) {
      setValue("objetivos_de_comunicação", [...objetivos, val]);
    }
  };

  const removeObjetivo = (val: string) => {
    setValue("objetivos_de_comunicação", objetivos.filter(o => o !== val));
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">Nome da Marca *</label>
          <input 
            {...register("nome_da_marca")}
            placeholder="Ex: Insider Store"
            className={`w-full p-3 bg-slate-50 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all ${
              errors.nome_da_marca ? 'border-red-300 focus:ring-red-100' : 'border-slate-200 focus:ring-orange-100'
            }`}
          />
          {errors.nome_da_marca && <p className="text-xs text-red-500">{errors.nome_da_marca.message}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">Tipo de Tom *</label>
          <select 
            {...register("tipo_de_tom")}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-100 transition-all"
          >
            <option value="corporativo">Corporativo</option>
            <option value="divertido">Divertido</option>
            <option value="técnico">Técnico</option>
            <option value="inspiracional">Inspiracional</option>
            <option value="analise_automatica">Análise Automática (IA)</option>
          </select>
        </div>
      </div>

      {tipoDeTom === "analise_automatica" && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
          <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-500" />
            Texto de Referência
          </label>
          <textarea 
            {...register("texto_referencia")}
            placeholder="Cole um texto ou artigo que represente bem o tom da marca para que a IA possa analisar."
            className="w-full h-32 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all resize-none"
          />
          <p className="text-[10px] text-slate-500">A IA processará este texto em segundo plano para extrair a persona.</p>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">Público Alvo</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500">Segmento *</label>
            <input 
              {...register("publico_alvo.segmento")}
              placeholder="Ex: Moda Tecnológica"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500">Faixa Etária</label>
            <input 
              {...register("publico_alvo.faixa_etaria")}
              placeholder="Ex: 25-45 anos"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">Objetivos de Comunicação *</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {objetivos.map(obj => (
            <span key={obj} className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-[#ff5f29] border border-orange-100 rounded-full text-xs font-medium">
              {obj}
              <button type="button" onClick={() => removeObjetivo(obj)}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input 
            id="new-objective"
            type="text" 
            placeholder="Adicionar objetivo (ex: Autoridade)"
            className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addObjetivo((e.target as HTMLInputElement).value);
                (e.target as HTMLInputElement).value = "";
              }
            }}
          />
          <button 
            type="button"
            onClick={() => {
              const input = document.getElementById('new-objective') as HTMLInputElement;
              addObjetivo(input.value);
              input.value = "";
            }}
            className="p-2.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
        {errors.objetivos_de_comunicação && <p className="text-xs text-red-500">{errors.objetivos_de_comunicação.message}</p>}
      </div>

      <div className="pt-6 flex gap-3">
        <button 
          type="submit"
          disabled={loading}
          className="flex-1 bg-[#ff5f29] hover:bg-[#e64e1c] disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-500/20"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
            <>
              <Check className="w-5 h-5" />
              {initialData ? 'Salvar Alterações' : 'Criar Persona'}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
