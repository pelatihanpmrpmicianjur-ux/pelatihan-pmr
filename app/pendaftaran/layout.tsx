// File: app/pendaftaran/layout.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { School, UploadCloud, Tent, ListChecks, CreditCard } from 'lucide-react';
import { AnimatedTooltip } from '@/components/ui/animated-tooltip'; // Pastikan ini diimpor

const steps = [
  { id: 1, name: 'Data Sekolah', designation: 'Langkah 1', path: '/pendaftaran/1-data-sekolah', icon: School, image: '' },
  { id: 2, name: 'Upload Data', designation: 'Langkah 2', path: '/pendaftaran/2-upload-excel', icon: UploadCloud, image: '' },
  { id: 3, name: 'Pilih Tenda', designation: 'Langkah 3', path: '/pendaftaran/3-pilih-tenda', icon: Tent, image: '' },
  { id: 4, name: 'Ringkasan', designation: 'Langkah 4', path: '/pendaftaran/4-ringkasan', icon: ListChecks, image: '' },
  { id: 5, name: 'Pembayaran', designation: 'Langkah 5', path: '/pendaftaran/5-pembayaran', icon: CreditCard, image: '' },
];

export default function PendaftaranLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [highestStep, setHighestStep] = useState(1);
  const currentStep = steps.find(step => pathname.startsWith(step.path))?.id || 0;

  useEffect(() => {
    if (currentStep > highestStep) {
      setHighestStep(currentStep);
    }
  }, [currentStep, highestStep]);

const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 lg:p-6 border-b border-white/10">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/logo-pmi.png" alt="Logo PMI" width={100} height={100} className="bg-white p-1 rounded-sm" />
        </Link>
      </div>
      
      {/* --- PERUBAHAN UTAMA: GUNAKAN ANIMATED TOOLTIP DI SINI --- */}
      <nav className="flex-grow p-6">
        <div className="flex flex-col items-start space-y-4">
            <AnimatedTooltip 
                items={steps.map(step => {
                    const isCurrent = currentStep === step.id;
                    const isCompleted = currentStep > step.id;
                    const isClickable = step.id <= highestStep;

                    return {
                        id: step.id,
                        name: step.name,
                        designation: step.designation,
                        icon: step.icon,
                        isCurrent,
                        isCompleted,
                        isClickable,
                        onClick: () => { if (isClickable && step.id !== currentStep) router.push(step.path) },
                    };
                })}
            />
        </div>
      </nav>
      {/* -------------------------------------------------------- */}

      <div className="p-4 lg:p-6 mt-auto">
        <p className="text-xs text-red-300/50 mb-2">Progress Pendaftaran</p>
        <div className="w-full bg-red-900/50 rounded-full h-2">
            <motion.div
              className="bg-white h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
              transition={{ ease: "circOut", duration: 0.8 }}
            />
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen w-full bg-gray-50 flex flex-col md:flex-row">
      <aside className="hidden md:block fixed top-0 left-0 h-screen w-[100px] lg:w-[100px] bg-red-700 shadow-2xl">
        <SidebarContent />
      </aside>
      
      <div className="flex-1 flex flex-col w-full md:ml-[100px] lg:ml-[100px]">
        <header className="md:hidden sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b p-4 flex justify-between items-center">
            <Link href="/" className="flex items-center gap-2">
                <Image src="/logo-pmi.png" alt="Logo PMI" width={70} height={70} />
            </Link>
            <div className="text-right">
                <p className="font-bold text-sm">Langkah {currentStep} / {steps.length}</p>
                <p className="text-xs text-muted-foreground">{steps[currentStep-1]?.name}</p>
            </div>
        </header>

        <main className="flex-grow w-full py-8 px-4 md:px-6 lg:px-8">
          <AnimatePresence mode="wait">
            <motion.div 
              key={pathname}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
        
        <footer className="w-full text-center p-4 text-xs text-gray-400 mt-auto">
          © {new Date().getFullYear()} PMI Kabupaten Cianjur.
        </footer>
      </div>
    </div>
  );
}