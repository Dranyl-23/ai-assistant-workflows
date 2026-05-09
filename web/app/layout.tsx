import type { Metadata } from "next";
import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Assistant Workflow",
  description: "Your intelligent AI productivity assistant with voice, search, and workflow automation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="bg-mesh" />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
