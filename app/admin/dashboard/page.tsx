// File: app/admin/dashboard/page.tsx
'use server'; // Ini adalah file Server Component yang juga bisa mengekspor Server Actions

import { Suspense, useState, useEffect } from 'react';
import { getRegistrations, getDashboardStats, RegistrationWithTents, Stats } from '@/actions/registration';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DashboardStats } from '@/components/admin/dashboard-stats';
import { DashboardTable } from '@/components/admin/dashboard-table';
import { LoginHistory } from '@/components/admin/login-history';
import { Loader2 } from 'lucide-react';
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

    const [initialData, setInitialData] = useState<{
        registrations: RegistrationWithTents[];
        stats: Stats;
    } | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const refetchDashboardData = async () => {
        // Ambil data statistik dan registrasi secara bersamaan
        const [statsData, registrationsData] = await Promise.all([
            getDashboardStats(),
            getRegistrations({})
        ]);
        setInitialData({ stats: statsData, registrations: registrationsData });
    };

    // `useEffect` untuk memuat data pertama kali
    useEffect(() => {
        setIsLoading(true);
        refetchDashboardData().finally(() => setIsLoading(false));
    }, []);

    if (isLoading || !initialData) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

   return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight">Dashboard Pendaftaran</h2>
            
            <Suspense fallback={<div>Loading stats...</div>}>
               <DashboardStats 
                initialStats={initialData.stats} 
                refetchStats={refetchDashboardData} 
            />
            </Suspense>
            
            <div className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-2">
                    <Suspense fallback={<div>Loading table...</div>}>
                       <DashboardTable 
                initialRegistrations={initialData.registrations} 
                onActionSuccess={refetchDashboardData} 
            />
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

