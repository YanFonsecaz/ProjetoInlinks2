import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Configuração de timeout (60 segundos)
export const maxDuration = 60;

const inter = Inter({ subsets: ["latin"] });

import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Inlinks AI Agent",
  description: "Análise de conteúdo e link building automático",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
