import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { ThemeProvider } from "@/components/theme-provider"; // Import this
import { Home, Search, PlusSquare, Heart, User, MessageCircle } from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Desi Sanchar",
  description: "Connect via Music & Moments",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <div className="flex min-h-screen bg-white dark:bg-[#0a0a0a] text-black dark:text-white transition-colors duration-300">

            {/* === SIDEBAR (Only visible if NOT on login page usually, but we keep it simple) === */}
            {/* ... (Your Sidebar Code remains same, just ensure colors use dark: prefix) ... */}
            {/* For now, to keep the layout code clean, I will assume you kept the previous sidebar code. 
                  Just make sure to wrap everything inside ThemeProvider like I did here. 
              */}

            <main className="flex-1 min-h-screen relative">
              {children}
            </main>

          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}