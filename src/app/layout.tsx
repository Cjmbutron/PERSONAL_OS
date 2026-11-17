import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

const DESCRIPTION = "Trabajo, hábitos, salud, finanzas y vida personal en un solo lugar.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Personal OS",
    template: "%s · Personal OS",
  },
  description: DESCRIPTION,
  applicationName: "Personal OS",
  // Es una app privada: que los buscadores no la indexen (D-120).
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    siteName: "Personal OS",
    title: "Personal OS",
    description: "Tu vida entera, en un solo lugar.",
    locale: "es_BO",
  },
  twitter: { card: "summary_large_image", title: "Personal OS", description: "Tu vida entera, en un solo lugar." },
  appleWebApp: { capable: true, title: "Personal OS", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef2f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0c1517" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Aplica el tema guardado antes de pintar, para que no parpadee. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
