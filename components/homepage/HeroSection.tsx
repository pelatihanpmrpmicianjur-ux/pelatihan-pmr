"use client";
import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';

export function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLHeadingElement>(null);
  const taglineRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // Teks memudar dan mengecil saat scroll
      gsap.to(textRef.current, {
        opacity: 0,
        scale: 0.8,
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top top',
          end: 'bottom center',
          scrub: true,
        }
      });
      // Tagline muncul
      gsap.from(taglineRef.current, {
        opacity: 0,
        y: 50,
        duration: 1,
        delay: 0.5
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} className="gsap-section h-screen w-full bg-white flex flex-col items-center justify-center text-center" data-theme="light">
      <h1 ref={textRef} className="text-6xl md:text-9xl font-extrabold tracking-tighter text-black">
        Saatnya <span className="text-red-700">Beraksi</span>.
      </h1>
      <p ref={taglineRef} className="mt-4 text-lg text-gray-600 max-w-2xl">
        Sebuah gerakan bukan dimulai dari ribuan orang, tapi dari satu langkah pertamamu.
      </p>
    </section>
  );
}