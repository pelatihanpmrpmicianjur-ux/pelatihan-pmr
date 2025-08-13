// File: app/login/page.tsx
'use client';

import { Suspense } from 'react'; // Impor Suspense dari React
import { motion } from 'framer-motion';
import LoginForm from '@/components/features/login-form';
import { Loader2 } from 'lucide-react';

// Buat komponen Fallback untuk ditampilkan selama Suspense
const LoginFallback = () => {
    return (
        <div className="flex flex-col items-center justify-center text-center p-8 bg-white/50 backdrop-blur-sm rounded-lg shadow-lg">
            <Loader2 className="h-8 w-8 animate-spin text-red-600" />
            <p className="mt-4 text-muted-foreground">Mempersiapkan form login...</p>
        </div>
    );
};

export default function LoginPage() {
  return (
    <div className="relative flex items-center justify-center min-h-screen w-full overflow-hidden bg-gray-100 p-4">
      {/* Background Shapes Animasi */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5, rotate: -30 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="absolute -top-20 -left-20 w-72 h-72 bg-red-500/10 rounded-full blur-3xl"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.5, rotate: 30 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
        className="absolute -bottom-20 -right-20 w-72 h-72 bg-red-500/10 rounded-full blur-3xl"
      />

      {/* ====================================================== */}
      {/* === BUNGKUS KOMPONEN KLIEN DINAMIS DENGAN SUSPENSE === */}
      {/* ====================================================== */}
      <Suspense fallback={<LoginFallback />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}