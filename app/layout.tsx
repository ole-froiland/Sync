import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { LanguageProvider } from "@/context/LanguageContext";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sync – Co-op made easy",
  description: "The collaborative workspace for co-op teams.",
};

const themeScript = `
try {
  var t = localStorage.getItem('sync-theme')
  if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark')
  }
} catch(e) {}
`

const languageScript = `
try {
  var l = localStorage.getItem('sync-language')
  document.documentElement.lang = l === 'no' ? 'no' : 'en'
} catch(e) {}
`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: languageScript }} />
      </head>
      <body className={`${geist.className} antialiased h-full`}>
        <ThemeProvider>
          <LanguageProvider>{children}</LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
