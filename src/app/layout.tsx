import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DM_Sans } from "next/font/google";
import { Toaster } from "react-hot-toast";
import dynamic from "next/dynamic";

const DevAutoLogin = dynamic(() => import("@/components/DevAutoLogin"), {
  ssr: false,
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: "TCG Shipping Suite",
  description: "Label generation and batch management for TCGplayer sellers",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className={dmSans.variable}>
      <body>
        {process.env.NEXT_PUBLIC_USE_EMULATORS === "true" && <DevAutoLogin />}
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
              fontSize: "13px",
              background: "var(--sidebar)",
              color: "#ffffff",
              border: "1px solid rgba(255,255,255,0.1)",
            },
            success: { iconTheme: { primary: "var(--active-color)", secondary: "#ffffff" } },
            error:   { iconTheme: { primary: "var(--destructive)",  secondary: "#ffffff" } },
          }}
        />
      </body>
    </html>
  );
}
