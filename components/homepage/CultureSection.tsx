"use client";
import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const principles = [
    { title: "Tri Bakti PMR", desc: "" },
    { title: "Meningkatkan Keterampilan Hidup Sehat", desc: "Anggota PMR diajarkan untuk menjaga kebersihan diri dan lingkungan, memahami berbagai penyakit serta cara pencegahan dan penanganannya, serta mempraktikkan gaya hidup sehat. " },
    { title: "Berbakti pada Masyarakat", desc: "PMR mendorong anggotanya untuk aktif dalam kegiatan sosial dan kemanusiaan, seperti membantu di panti jompo, menjadi donor darah, atau mengadakan bakti sosial. " },
    { title: "Mempererat Persahabatan Nasional dan Internasional", desc: "PMR menumbuhkan semangat persaudaraan dan kerjasama antar anggota PMR dari berbagai daerah dan negara. Hal ini dapat diwujudkan melalui kegiatan latihan bersama, pertukaran informasi, atau kunjungan ke daerah lain. " },
]

export function CultureSection() {
    const componentRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (!componentRef.current) return;

        const ctx = gsap.context(() => {
            const cards = gsap.utils.toArray<HTMLElement>('.principle-card');
            
            cards.forEach((card, index) => {
                if (cards[index + 1]) {
                    gsap.from(cards[index + 1], {
                        yPercent: 100,
                        ease: 'none',
                        scrollTrigger: {
                            trigger: card,
                            start: 'top top',
                            end: 'bottom top',
                            scrub: true,
                            invalidateOnRefresh: true,
                        },
                    });
                }
            });

        }, componentRef);
        
        return () => ctx.revert();
    }, []);

    return (
        // Komponen pembungkus
        <section ref={componentRef} className="gsap-section bg-white" data-theme="light">
            {principles.map((p, i) => (
                <div
                    key={i}
                    // Beri tinggi minimum 100vh agar ada ruang untuk di-scroll dan di-pin
                    className="principle-card relative w-full min-h-screen flex flex-col items-center justify-center text-center p-8"
                    style={{ zIndex: i, backgroundColor: i % 2 === 0 ? 'white' : '#FDFCFB' }}
                >
                    <h3 className="text-4xl md:text-6xl font-serif text-red-700">{p.title}</h3>
                    <p className="mt-4 text-xl md:text-1xl text-indigo-950 max-w-4xl">{p.desc}</p>
                </div>
            ))}
            
            {/* --- ELEMEN SPACER (SOLUSI) --- */}
            {/* Tambahkan div kosong setelah loop map. */}
            {/* Div ini akan memberikan ruang scroll tambahan setelah kartu terakhir. */}
            <div className="h-screen w-full"></div>
            
        </section>
    );
}