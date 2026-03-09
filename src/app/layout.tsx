import "./globals.css";
import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { Toaster } from "react-hot-toast";

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
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={dmSans.variable}>
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
              fontSize: "13px",
              background: "#001242",
              color: "#ffffff",
              border: "1px solid rgba(255,255,255,0.1)",
            },
            success: { iconTheme: { primary: "#0094C6", secondary: "#ffffff" } },
            error:   { iconTheme: { primary: "#dc2626",  secondary: "#ffffff" } },
          }}
        />
      </body>
    </html>
  );
}
