import type { Metadata } from "next";
import "./globals.css";
import { StationProvider } from "@/hooks/useStation";

export const metadata: Metadata = {
  title: "FuelTrack Uganda",
  description: "Fuel Station Management System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StationProvider>{children}</StationProvider>
      </body>
    </html>
  );
}