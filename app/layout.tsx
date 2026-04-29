import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sync – Private Developer Workspace",
  description: "Collaborate, build, and stay updated with your team.",
};

const themeScript = `
try {
  var t = localStorage.getItem('sync-theme')
  if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark')
  }
} catch(e) {}
`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${geist.className} antialiased h-full`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
