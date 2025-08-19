import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type React from "react";
import "./globals.css";

import { AppSidebar } from "@/components/app-sidebar";
import { PolicyProvider } from "@/components/policy-context";
import { SidebarProvider } from "@/components/ui/sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Open Coverage - Health Insurance Comparator",
  description: "Compare health insurance policies and SBC documents easily",
  generator: "v0.dev",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <PolicyProvider>
          <SidebarProvider>
            <AppSidebar />
            {children}
          </SidebarProvider>
        </PolicyProvider>
      </body>
    </html>
  );
}
