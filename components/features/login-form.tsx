// File: components/features/login-form.tsx
'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import Image from 'next/image';

export default function LoginForm() {
  const router = useRouter(); // Meskipun tidak terpakai di sini, biarkan jika perlu di masa depan
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/admin/dashboard';
  const error = searchParams.get('error');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const errorMessages: { [key: string]: string } = {
      CredentialsSignin: "Username atau password salah. Silakan coba lagi.",
    };

    if (error && errorMessages[error]) {
      toast.error(errorMessages[error]);
      // Hapus parameter error dari URL. `router.replace` lebih aman di sini.
      const newUrl = window.location.pathname; // Hanya dapatkan path, tanpa query params
      router.replace(newUrl, { scroll: false });
    }
  }, [error, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    await signIn('credentials', {
      username: username.trim(),
      password: password,
      callbackUrl: callbackUrl,
    });
    // Tidak perlu setIsLoading(false) karena halaman akan di-redirect
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <Card className="w-full max-w-sm bg-white/80 backdrop-blur-lg border-gray-200/50 shadow-2xl shadow-slate-300/20">
        <CardHeader className="text-center">
          <motion.div
            whileHover={{ scale: 1.1, rotate: -5 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <Image src="/logo-pmi.png" alt="Logo PMI" width={72} height={72} className="mx-auto" />
          </motion.div>
          <CardTitle className="text-2xl font-bold pt-4">Admin Dashboard</CardTitle>
          <CardDescription>Silakan masuk untuk melanjutkan</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="Masukkan username"
                autoComplete="username"
                disabled={isLoading}
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Masukkan password"
                autoComplete="current-password"
                disabled={isLoading}
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <Button 
                type="submit" 
                className="w-full bg-red-600 hover:bg-red-700 font-semibold text-base py-6 transition-all duration-300" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="animate-accordion-up" />
                ) : (
                  <motion.span
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Masuk
                  </motion.span>
                )}
              </Button>
            </motion.div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}