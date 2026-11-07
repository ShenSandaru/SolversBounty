import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { LoadingState } from "@/components/loading-state";
import { PageContainer } from "@/components/page-container";
import { AppShell } from "@/components/layout/app-shell";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "SolversBounty",
    template: "%s · SolversBounty",
  },
  description: "Solve problems. Earn rewards. Unlock human insights.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Providers>
          <Suspense
            fallback={
              <PageContainer>
                <LoadingState label="Loading this page." />
              </PageContainer>
            }
          >
            <AppShell>{children}</AppShell>
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
