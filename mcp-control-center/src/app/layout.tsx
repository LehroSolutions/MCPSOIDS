import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ErrorBoundary } from "../components/ErrorBoundary";

export const metadata: Metadata = {
  title: "MCPSOIDS | Active Robustness",
  description: "Advanced monitoring dashboard for MCPSOIDS",
};

export const viewport: Viewport = {
  themeColor: "#020617",
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className="antialiased bg-slate-950 text-slate-100 selection:bg-emerald-500/30"
      >
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
