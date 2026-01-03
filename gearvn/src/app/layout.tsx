import "./globals.css";
import type { Metadata } from "next";
import { Manrope } from "next/font/google";

import { Modals } from "@/components/modals";
import { Toaster } from "@/components/ui/sonner";

import { NuqsProvider } from "@/components/providers/nuqs-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { ResetStepGuard } from "@/components/guards/reset-step-guard";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title:
    "GEARVN - Máy tính cao cấp, Laptop thiết bị chơi game hàng đầu Việt Nam – GEARVN.COM",
  description:
    "GEARVN hệ thống bán lẻ cung cấp Hi-End PC, laptop, máy tính và thiết bị gaming gear chuyên nghiệp hàng đầu Việt Nam, hotline: 1900 5301",
  metadataBase: new URL("https://gearvn.com"),
  openGraph: {
    title: "GEARVN - Máy tính cao cấp, Laptop, Gaming Gear",
    description:
      "GEARVN cung cấp Hi-End PC, laptop, máy tính và thiết bị gaming gear hàng đầu Việt Nam",
    url: "https://gearvn.com",
    siteName: "GEARVN",
    locale: "vi_VN",
    type: "website",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

const RootLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={`${manrope.variable} antialiased`}>
        <QueryProvider>
          <NuqsProvider>
            <ResetStepGuard>
              <Modals />
              <Toaster />
              {children}
            </ResetStepGuard>
          </NuqsProvider>
        </QueryProvider>
      </body>
    </html>
  );
};

export default RootLayout;
