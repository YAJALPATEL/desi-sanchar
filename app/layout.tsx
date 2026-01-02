import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google"; // Switch to Google Fonts
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider"

// Initialize the font
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Desi Sanchar",
  description: "Connect with your friends in Desi style.",
};

// === LOCK ZOOM & SCALE ===
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Prevents pinch-zoom
  themeColor: '#DC143C',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        // Apply the Google Font class here
        className={`${inter.className} antialiased overscroll-none`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}