import type { Metadata, Viewport } from "next";
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

/*
 * `viewport-fit=cover` deixa as telas usarem a área inteira do iPhone (atrás
 * do entalhe e da barra de gestos) — quem encosta nelas (o campo do Inbox,
 * a folha de ações) desconta `env(safe-area-inset-*)`. A cor do tema pinta a
 * barra do navegador do celular com o preto do app.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
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
