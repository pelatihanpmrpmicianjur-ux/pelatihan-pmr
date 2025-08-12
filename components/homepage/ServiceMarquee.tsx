// src/components/homepage/ServiceMarquee.tsx
"use client";
import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';


const services = ["BERAKSI, BERBAKTI, BERBUDAYA"];

export function ServiceMarquee() {
  const marqueeRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const marquee = marqueeRef.current;
      if (!marquee) return;
      const marqueeText = marquee.querySelector('.marquee-text');
      if (!marqueeText) return;

      gsap.to(marqueeText, {
        xPercent: -50,
        ease: 'none',
        scrollTrigger: {
          trigger: marquee,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.5,
        }
      });
    }, marqueeRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={marqueeRef} className="gsap-section w-full py-24 bg-gradient-to-l from-red-700 to-rose-700 overflow-hidden" data-theme="dark">
      <div className="marquee-text flex whitespace-nowrap text-6xl md:text-9xl font-bold text-white">
        {/* Duplikasi untuk efek loop tak terbatas */}
        {[...services, ...services].map((service, i) => (
          <div key={i} className="flex items-center">
            <span className="mx-8">{service}</span>
            <span className="text-red-300">•</span>
          </div>
        ))}
      </div>
    </section>
  );
}