import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  // Cada tela põe o próprio nome na aba (e na janela do app de desktop).
  title: { default: "black berry", template: "%s · black berry" },
  description: "Gestão e aprovação de conteúdo para agências de social media.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="min-h-screen bg-bg text-fg-soft antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
