// File: app/admin/layout.tsx
'use client'; // <-- Kita butuh 'use client' di komponen ini untuk menggunakan hooks

import AuthProvider from "@/components/providers/session-provider";
import { AdminHeader } from "@/components/shared/admin-header";
import { useSearchParams } from "next/navigation"; // Impor
import { useEffect } from "react"; // Impor
import { toast } from "sonner"; // Impor

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const searchParams = useSearchParams();

    useEffect(() => {
        const loginSuccess = searchParams.get('login_success');
        if (loginSuccess === 'true') {
            toast.success('Login berhasil!');
            // Opsi: Hapus parameter dari URL tanpa reload halaman
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
        }
    }, [searchParams]);

    return (
        <AuthProvider>
            <div className="min-h-screen bg-gray-50">
                <AdminHeader />
                <main className="p-4 md:p-8">
                    {children}
                </main>
            </div>
        </AuthProvider>
    )
}