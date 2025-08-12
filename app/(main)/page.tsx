import { HeroSection } from "@/components/homepage/HeroSection";
import { ServiceMarquee } from "@/components/homepage/ServiceMarquee";
import { CultureSection } from "@/components/homepage/CultureSection";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <ServiceMarquee />
      <CultureSection />
      {/* Footer akan otomatis dirender oleh layout */}
    </>
  );
}