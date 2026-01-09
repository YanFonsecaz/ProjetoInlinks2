"use server";

/**
 * Server Actions para o módulo Trends Master
 * Orquestra a pipeline de coleta de tendências, notícias e geração de relatório
 */

import {
  TrendsConfig,
  TrendsReport,
  PeriodData,
  TrendsPeriod,
  PipelineStatus,
  NewsResult,
} from "@/services/trends-master/types";
import { collectTrends } from "@/services/trends-master/serpapi-trends";
import {
  fetchNews,
  fetchNewsForTerm,
} from "@/services/trends-master/serpapi-news";
import { summarizeTrends } from "@/services/trends-master/trends-summarizer";
import { createReport } from "@/services/trends-master/report-generator";
import { sendEmail } from "@/services/trends-master/email-sender";
import { supabase } from "@/lib/supabase";

// Labels para períodos
const PERIOD_LABELS: Record<TrendsPeriod, string> = {
  diario: "Diário",
  semanal: "Semanal",
  mensal: "Mensal",
};

/**
 * Executa a pipeline completa de coleta de tendências
 */
export async function runTrendsPipeline(
  config: TrendsConfig
): Promise<{ success: boolean; report?: TrendsReport; error?: string }> {
  try {
    const periodsData: PeriodData[] = [];
    const allNews: NewsResult[] = [];

    // Processa cada período configurado
    for (const periodo of config.periods) {
      console.log(`[Trends Pipeline] Processando período: ${periodo}`);

      // 1. Coleta tendências
      // 1. Coleta tendências
      const trends = await collectTrends(
        config.sector,
        periodo,
        config.topN,
        config.risingN,
        config.customTopics // Passa tópicos personalizados
      );
      console.log(
        `[Trends Pipeline] ${trends.length} tendências coletadas para ${periodo}`
      );

      // 2. Extrai keywords das tendências
      // Adiciona também os próprios tópicos personalizados como keywords garantidas
      const keywords = trends
        .map((t) => t.keyword)
        .filter((k): k is string => !!k);

      if (config.customTopics) {
        for (const topic of config.customTopics) {
          if (!keywords.includes(topic)) {
            keywords.unshift(topic); // Adiciona no início
          }
        }
      }

      // 3. Busca notícias para cada keyword
      const news = await fetchNews(keywords, config.maxArticles, periodo);
      console.log(
        `[Trends Pipeline] Notícias coletadas para ${news.length} keywords`
      );

      allNews.push(...news);

      periodsData.push({
        label: PERIOD_LABELS[periodo],
        periodo,
        trends,
        news: news,
      });
    }

    // 4.1 Busca notícias de Tópicos Personalizados (se houver)
    if (config.customTopics && config.customTopics.length > 0) {
      console.log(
        `[Trends Pipeline] Buscando notícias para ${config.customTopics.length} tópicos personalizados...`
      );

      const customNews = await fetchNews(
        config.customTopics,
        config.maxArticles,
        "mensal"
      ); // Usa período mensal como base ou o mais abrangente

      if (customNews.length > 0) {
        console.log(
          `[Trends Pipeline] Encontradas notícias para tópicos personalizados`
        );
        allNews.push(...customNews);

        // Adiciona um "período" extra no relatório apenas para exibir os tópicos personalizados, ou injeta no primeiro período
        // Vamos injetar como um PeriodData especial
        periodsData.push({
          label: "Tópicos Personalizados",
          periodo: "mensal", // Dummy
          trends: config.customTopics.map((t) => ({
            keyword: t,
            type: "rising",
          })),
          news: customNews,
        });
      }
    }

    // 5. Gera resumo com LLM
    console.log("[Trends Pipeline] Gerando resumo com LLM...");
    const summary = await summarizeTrends(config.sector, allNews);

    // 6. Cria relatório
    // Se houver tópicos personalizados, o título do relatório deve refleti-los
    const reportTitle =
      config.customTopics && config.customTopics.length > 0
        ? config.customTopics.join(", ")
        : config.sector;

    const report = createReport(reportTitle, periodsData, summary);
    console.log("[Trends Pipeline] Relatório gerado com sucesso");

    // 7. Envia email (se habilitado)
    if (config.emailEnabled && config.emailRecipients.length > 0) {
      console.log("[Trends Pipeline] Enviando email...");
      const emailSent = await sendEmail(
        report,
        config.emailRecipients,
        config.emailMode || "smtp",
        config.emailApiProvider
      );
      if (emailSent) {
        console.log("[Trends Pipeline] ✅ Email enviado com sucesso");
      } else {
        console.warn("[Trends Pipeline] ⚠️ Falha ao enviar email");
      }
    }

    return { success: true, report };
  } catch (error) {
    console.error("[Trends Pipeline] Erro:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

/**
 * Salva configuração do Trends Master no Supabase
 */
export async function saveTrendsConfig(config: TrendsConfig): Promise<boolean> {
  try {
    const { error } = await supabase.from("trends_config").upsert(
      {
        id: "default",
        sector: config.sector,
        periods: config.periods,
        top_n: config.topN,
        rising_n: config.risingN,
        max_articles: config.maxArticles,
        email_recipients: config.emailRecipients,
        email_enabled: config.emailEnabled,
        email_mode: config.emailMode,
        email_api_provider: config.emailApiProvider,
        custom_topics: config.customTopics,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (error) {
      console.error("[Trends Config] Erro ao salvar:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[Trends Config] Erro ao salvar:", error);
    return false;
  }
}

/**
 * Carrega configuração do Trends Master do Supabase
 */
export async function loadTrendsConfig(): Promise<TrendsConfig | null> {
  try {
    const { data, error } = await supabase
      .from("trends_config")
      .select("*")
      .eq("id", "default")
      .single();

    if (error || !data) {
      // Retorna configuração padrão se não existir
      return {
        sector: "Autos",
        periods: ["diario", "semanal", "mensal"],
        topN: 10,
        risingN: 10,
        maxArticles: 3,
        emailRecipients: [],
        emailEnabled: false,
      };
    }

    return {
      sector: data.sector,
      periods: data.periods as TrendsPeriod[],
      topN: data.top_n,
      risingN: data.rising_n,
      maxArticles: data.max_articles,
      emailRecipients: data.email_recipients || [],
      emailEnabled: data.email_enabled || false,
      emailMode: data.email_mode,
      emailApiProvider: data.email_api_provider,
      customTopics: data.custom_topics || [],
    };
  } catch (error) {
    console.error("[Trends Config] Erro ao carregar:", error);
    return null;
  }
}

/**
 * Testa a conexão com a SerpAPI
 */
export async function testSerpApiConnection(): Promise<{
  success: boolean;
  error?: string;
}> {
  const apiKey = process.env.SERPAPI_API_KEY || process.env.SERP_API_KEY;

  if (!apiKey) {
    return { success: false, error: "SERPAPI_API_KEY não configurada" };
  }

  try {
    // Faz uma busca simples para testar
    const response = await fetch(
      `https://serpapi.com/search?engine=google&q=test&api_key=${apiKey}&num=1`
    );

    if (!response.ok) {
      return { success: false, error: `Erro na API: ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro de conexão",
    };
  }
}
