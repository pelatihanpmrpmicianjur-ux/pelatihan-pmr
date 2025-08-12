import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner" // Untuk shadcn toast
import SmoothScrolling from "@/components/layout/ScmoothScroll";
import { Inter, Lora } from 'next/font/google';

export const metadata: Metadata = {
  title: "Pendaftaran PMR Cianjur 2025",
  description: "Website resmi pendaftaran Pelatihan dan Pelantikan PMR Se-Kabupaten Cianjur 2025.",
};

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const lora = Lora({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-lora' });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${lora.variable}`}>
      <body>
        
        <SmoothScrolling>
          {children}
        </SmoothScrolling>
        <Toaster />
      </body>

    </html>
  );
}