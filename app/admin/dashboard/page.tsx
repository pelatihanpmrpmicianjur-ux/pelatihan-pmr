// File: app/admin/dashboard/page.tsx
'use server'; // Ini adalah file Server Component yang juga bisa mengekspor Server Actions

import { Suspense } from 'react';
import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DashboardStats } from '@/components/admin/dashboard-stats';
import { DashboardTable } from '@/components/admin/dashboard-table';
import { LoginHistory } from '@/components/admin/login-history';
import { getRegistrations, getDashboardStats } from '@/actions/registration';
// ====================================================================
// === BAGIAN SERVER ACTIONS ===
// (Kode ini sudah benar)
// ====================================================================

// Tipe data yang diperkaya untuk tabel kita
// Menggabungkan tipe dasar dengan relasinya




// ====================================================================
// === BAGIAN KOMPONEN HALAMAN (JSX) ===
// ====================================================================

export default async function DashboardPage() {
    const session = await getServerSession(authOptions);
    if (!session) {
        redirect('/login'); 
    }

    // Ambil data awal di server saat halaman pertama kali dimuat
    const initialRegistrations = await getRegistrations({});
    const initialStats = await getDashboardStats();

   return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight">Dashboard Pendaftaran</h2>
            
            <Suspense fallback={<div>Loading stats...</div>}>
                <DashboardStats initialStats={initialStats} />
            </Suspense>
            
            <div className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-2">
                    <Suspense fallback={<div>Loading table...</div>}>
                        <DashboardTable initialRegistrations={initialRegistrations} />
                    </Suspense>
                </div>
                <div className="md:col-span-1">
                     <Suspense fallback={<div>Loading history...</div>}>
                        <LoginHistory />
                    </Suspense>
                </div>
            </div>
        </div>
    );
}

