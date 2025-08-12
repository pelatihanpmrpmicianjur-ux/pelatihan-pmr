// Header.tsx
"use client";
import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function Header() {
  useEffect(() => {
    const ctx = gsap.context(() => { // Gunakan gsap.context untuk cleanup yang aman
        gsap.utils.toArray<HTMLElement>('.gsap-section').forEach((section) => {
          ScrollTrigger.create({ // Sekarang ScrollTrigger sudah terdefinisi
            trigger: section,
            start: 'top 50%',
            end: 'bottom 50%',
            onToggle: self => {
              const theme = section.getAttribute('data-theme');
              if (self.isActive) {
                gsap.to('.header-logo', { color: theme === 'dark' ? 'white' : 'black', duration: 0.5 });
                gsap.to('.header-admin', { color: theme === 'dark' ? 'white' : '#ffffff',
                   backgroundColor: theme === 'dark' ? 'white' : '#ffffff',
                   duration: 0.5 });
                gsap.to('.header-cta', {
                  backgroundColor: theme === 'dark' ? 'white' : '#DC2626',
                  color: theme === 'dark' ? '#DC2626' : 'white',
                  duration: 0.5
                });
              }
            }
          });
        });
    });
    return () => ctx.revert(); // Cleanup saat komponen unmount
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/90">
      <div className="container mx-auto flex h-24 items-center justify-between px-8 ">
        <Link href="/" className="flex items-center gap-3">
            <Image src="/logo-pmi.png" alt="Logo PMI" width={100} height={40} />
        </Link>
        <Link href="/pendaftaran/1-data-sekolah">
            <div className="header-cta rounded-md bg-red-700 px-6 py-3 text-sm font-semibold text-rd-700 transition-colors duration-200 shadow-md hover:shadow-black/60">
                DAFTAR
            </div>
        </Link>
      </div>
    </header>
  );
}