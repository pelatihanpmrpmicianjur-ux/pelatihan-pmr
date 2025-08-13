// File: app/login/page.tsx
'use client';

import { useState, useEffect } from 'react'; // Tambahkan useEffect
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/admin/dashboard';
  
  // Ambil parameter 'error' dari URL
  const error = searchParams.get('error');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // ======================================================
  // === LOGIKA BARU UNTUK MENAMPILKAN TOAST ERROR ===
  // ======================================================
  useEffect(() => {
    // Pesan error akan dipetakan di sini
    const errorMessages: { [key: string]: string } = {
      CredentialsSignin: "Username atau password salah. Silakan coba lagi.",
      // Tambahkan kode error lain dari next-auth jika perlu
    };

    if (error && errorMessages[error]) {
      // Tampilkan toast jika ada error yang kita kenali
      toast.error(errorMessages[error]);

      // Hapus parameter error dari URL agar tidak muncul lagi saat refresh
      // menggunakan window.history.replaceState
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [error]); // Jalankan effect ini setiap kali parameter 'error' berubah
  // ======================================================


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Fungsi signIn tidak perlu diubah. Ia akan secara otomatis
    // meng-handle redirect dan penambahan parameter error.
    await signIn('credentials', {
        username,
        password,
        callbackUrl: callbackUrl, // Redirect ke dashboard setelah sukses
    });

    // Kita tidak perlu lagi setIsLoading(false) di sini karena
    // halaman akan di-redirect atau di-refresh oleh signIn
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Admin Login</CardTitle>
        </CardHeader>
        <CardContent>
            <form onSubmit={handleLogin} className="space-y-6">
            <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="Masukkan username"
                  autoComplete="username"
                />
            </div>
            <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Masukkan password"
                  autoComplete="current-password"
                />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Memproses...' : 'Login'}
            </Button>
            </form>
        </CardContent>
      </Card>
    </div>
  );
}