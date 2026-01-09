/**
 * Serviço de envio de email para relatórios de tendências
 * Conversão do _send_email_with_smtp e _send_email_via_api (Python) para TypeScript
 */

import nodemailer from "nodemailer";
import { TrendsReport } from "./types";
import {
  convertMarkdownToHtmlFragment,
  wrapHtmlForEmail,
} from "@/utils/markdown-renderer";

/**
 * Converte Markdown básico para HTML com estilos inline
 * (Mantido para compatibilidade, agora usando o utilitário compartilhado)
 */
export function markdownToHtml(markdown: string): string {
  const fragment = convertMarkdownToHtmlFragment(markdown);
  return wrapHtmlForEmail(fragment);
}

/**
 * Envia email via SMTP usando nodemailer
 */
async function sendEmailSmtp(
  report: TrendsReport,
  recipients: string[]
): Promise<boolean> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT || "587";
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const emailFrom = process.env.EMAIL_FROM;
  const subject =
    process.env.EMAIL_SUBJECT || `Relatório de Tendências - ${report.sector}`;

  if (!smtpHost || !smtpUser || !smtpPassword || !emailFrom) {
    console.warn(
      "[Email] Configuração SMTP incompleta (SMTP_HOST, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM). Email não enviado."
    );
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: parseInt(smtpPort) === 465, // true para 465, false para outros (587)
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    console.log(
      "[Email] Tentando enviar via SMTP para:",
      recipients.join(", ")
    );

    const info = await transporter.sendMail({
      from: emailFrom,
      to: recipients.join(", "),
      subject,
      text: report.markdown, // Versão texto puro
      html: markdownToHtml(report.markdown), // Versão HTML
    });

    console.log(
      "[Email] ✅ Email enviado com sucesso via SMTP! ID:",
      info.messageId
    );
    return true;
  } catch (error) {
    console.error("[Email] ❌ Erro ao enviar via SMTP:", error);
    return false;
  }
}

/**
 * Envia email via SendGrid API
 */
async function sendEmailSendGrid(
  report: TrendsReport,
  recipients: string[]
): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;
  const subject =
    process.env.EMAIL_SUBJECT || `Relatório de Tendências - ${report.sector}`;

  if (!apiKey || !emailFrom) {
    console.warn("[Email] Configuração SendGrid incompleta.");
    return false;
  }

  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: recipients.map((email) => ({ email })),
          },
        ],
        from: { email: emailFrom },
        subject,
        content: [
          { type: "text/plain", value: report.markdown },
          { type: "text/html", value: markdownToHtml(report.markdown) },
        ],
      }),
    });

    if (!response.ok && response.status !== 202) {
      console.error(
        "[Email] SendGrid error:",
        response.status,
        await response.text()
      );
      return false;
    }

    console.log("[Email] ✅ Email enviado via SendGrid");
    return true;
  } catch (error) {
    console.error("[Email] Erro ao enviar via SendGrid:", error);
    return false;
  }
}

/**
 * Envia email via Mailgun API
 */
async function sendEmailMailgun(
  report: TrendsReport,
  recipients: string[]
): Promise<boolean> {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const emailFrom = process.env.EMAIL_FROM;
  const subject =
    process.env.EMAIL_SUBJECT || `Relatório de Tendências - ${report.sector}`;

  if (!apiKey || !domain || !emailFrom) {
    console.warn("[Email] Configuração Mailgun incompleta.");
    return false;
  }

  try {
    const formData = new FormData();
    formData.append("from", emailFrom);
    formData.append("to", recipients.join(", "));
    formData.append("subject", subject);
    formData.append("text", report.markdown);
    formData.append("html", markdownToHtml(report.markdown));

    const response = await fetch(
      `https://api.mailgun.net/v3/${domain}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString(
            "base64"
          )}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      console.error(
        "[Email] Mailgun error:",
        response.status,
        await response.text()
      );
      return false;
    }

    console.log("[Email] ✅ Email enviado via Mailgun");
    return true;
  } catch (error) {
    console.error("[Email] Erro ao enviar via Mailgun:", error);
    return false;
  }
}

/**
 * Envia relatório por email
 */
export async function sendEmail(
  report: TrendsReport,
  recipients: string[],
  mode: "smtp" | "api" = "smtp",
  provider?: "sendgrid" | "mailgun"
): Promise<boolean> {
  if (recipients.length === 0) {
    console.warn("[Email] Nenhum destinatário configurado.");
    return false;
  }

  // Remove emails vazios e espaços
  const cleanRecipients = recipients
    .map((r) => r.trim())
    .filter((r) => r.length > 0 && r.includes("@"));

  if (cleanRecipients.length === 0) {
    console.warn("[Email] Nenhum email válido na lista de destinatários.");
    return false;
  }

  if (mode === "api") {
    const apiProvider =
      provider || (process.env.EMAIL_API_PROVIDER as "sendgrid" | "mailgun");

    if (apiProvider === "sendgrid") {
      return sendEmailSendGrid(report, cleanRecipients);
    } else if (apiProvider === "mailgun") {
      return sendEmailMailgun(report, cleanRecipients);
    } else {
      console.warn("[Email] Provedor de API não suportado:", apiProvider);
      return false;
    }
  }

  return sendEmailSmtp(report, cleanRecipients);
}
