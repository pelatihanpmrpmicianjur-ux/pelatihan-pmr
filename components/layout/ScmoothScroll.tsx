"use client";
import Lenis from '@studio-freight/lenis';
import { useEffect, ReactNode } from 'react';

function SmoothScrolling({ children }: { children: ReactNode }) {
  useEffect(() => {
    const lenis = new Lenis();

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);
    
    return () => {
      lenis.destroy(); // Cleanup on component unmount
    }
  }, []);

  return <>{children}</>;
}

export default SmoothScrolling;