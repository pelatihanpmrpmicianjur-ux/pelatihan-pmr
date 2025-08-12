// File: app/admin/layout.tsx
'use client';
import AuthProvider from "@/components/providers/session-provider";
import { AdminHeader } from "@/components/shared/admin-header";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { toast } from "sonner";

// Buat komponen kecil yang bertanggung jawab atas logika ini
function ShowLoginToast() {
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get('login_success') === 'true') {
      toast.success('Login berhasil!');
    }
  }, [searchParams]);
  return null;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            {/* Bungkus komponen dinamis dalam Suspense */}
            <Suspense>
                <ShowLoginToast />
            </Suspense>

            <div className="min-h-screen bg-gray-50">
                <AdminHeader />
                <main className="p-4 md:p-8">
                    {children}
                </main>
            </div>
        </AuthProvider>
    )
}