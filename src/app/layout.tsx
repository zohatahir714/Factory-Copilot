import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AI Business Copilot", template: "%s | AI Business Copilot" },
  description: "Conversational operating system for Pakistani SMEs — inventory, purchase, sales, cash and compliance through natural language.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
