import type { Metadata } from "next";
import "./globals.scss";
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "RuxshonaERP",
  description: "Ruxshona Tort uchun ERP (UI-first)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
