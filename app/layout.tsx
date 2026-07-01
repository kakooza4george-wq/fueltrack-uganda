import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { StationProvider } from "@/hooks/useStation";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FuelTrack Uganda",
  description: "Multi-station fuel management system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <StationProvider>
          {children}
        </StationProvider>
      </body>
    </html>
  );
}