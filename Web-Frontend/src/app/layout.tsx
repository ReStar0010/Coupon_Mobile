import type { Metadata } from "next";
import { Inter, Jost } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";

import AuthProvider from "./components/providers/SessionProvider";
import ThemeProvider from "./components/providers/ThemeProvider";
import ToastProvider from "./components/providers/ToastProvider";

const inter = Inter({ subsets: ["latin"] });
const jost = Jost({ subsets: ["latin"], variable: "--font-jost" });

export const metadata: Metadata = {
  title: "CouPro",
  description: "CouPro 是一個專注於折扣與優惠共享的數位平台，旨在讓使用者輕鬆發掘、交換、分享商家的各類折扣，同時幫助商家增加曝光與轉化率。我們的核心目標是透過網路效應與社群互動，讓折扣不只是省錢的工具，更是一種潮流與消費方式。CouPro 不僅提供即時可用的折扣，未來還計劃整合支付系統，將折扣轉化為可運用的點數，建立跨商家優惠生態。",
};

export default function RootLayout({ children, }: Readonly<{ children: React.ReactNode; }>) {

  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className={`${jost.variable} font-jost`}>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <div className="min-h-full">{children}</div>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );

}
