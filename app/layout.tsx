import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { Suspense } from "react";
import AuthNav from "@/components/AuthNav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "D-Game | Survival PvP",
  description: "A dark social PvP survival game.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="container flex h-16 max-w-screen-2xl items-center justify-between px-4 sm:px-6 lg:px-8 mx-auto">
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center space-x-2 font-bold tracking-widest text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                [ D-GAME ]
              </Link>
              <div className="hidden sm:flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75 motion-reduce:hidden"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-danger"></span>
                </span>
                <span className="text-xs font-mono text-muted-foreground tracking-widest">SYSTEM ONLINE</span>
              </div>
            </div>
            
            <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
              <Link href="/game" className="text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                Arena
              </Link>
              <Link href="/profile" className="text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                Operative
              </Link>
            </nav>
            
            <div className="flex items-center gap-4">
              <Suspense fallback={<div className="h-9 w-24 bg-card rounded animate-pulse"></div>}>
                <AuthNav />
              </Suspense>
            </div>
          </div>
        </header>
        <main className="flex-1 flex flex-col">
          {children}
        </main>
        <footer className="border-t border-border py-8 mt-auto">
          <div className="container mx-auto px-4 text-center">
            <p className="text-xs text-muted-foreground tracking-widest font-mono">
              [ D-GAME ] // AN ORIGINAL GAME IN DEVELOPMENT
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
