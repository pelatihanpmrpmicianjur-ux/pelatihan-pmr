"use client";
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Lenis from '@studio-freight/lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export default function AnimationProvider({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    // Hanya aktifkan di homepage
    if (pathname !== '/') {
      if (lenisRef.current) {
        lenisRef.current.destroy();
        lenisRef.current = null;
      }
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });
    lenisRef.current = lenis;

    lenis.on('scroll', ScrollTrigger.update);

    const raf = (time: number) => {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };
    
    requestAnimationFrame(raf);

    // Refresh ScrollTrigger saat Lenis selesai menginisialisasi
    setTimeout(() => {
      ScrollTrigger.refresh();
    }, 500);

    return () => {
      lenis.destroy();
      lenisRef.current = null;
      // Bunuh semua ScrollTriggers untuk mencegah memory leak
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    };
  }, [pathname]);

  return <>{children}</>;
}