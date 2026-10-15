import type { Metadata } from "next";
import "./globals.css";
import { SCRIPT_TEMA } from "@/components/theme-script";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Central Seller Hub",
  description: "Gerencie seus marketplaces em um único lugar",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <head>
        {/*
          Aplica o tema salvo antes da tela ser desenhada, para a página não
          piscar branca ao carregar no modo noturno.
        */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
