"use client";
import AnimationProvider from "@/components/layout/AnimationProvider";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <AnimationProvider>
        <Header />
        <main>{children}</main>
        <Footer />
    </AnimationProvider>
  );
}