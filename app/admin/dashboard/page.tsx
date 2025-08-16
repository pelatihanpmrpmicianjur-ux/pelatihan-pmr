// File: app/admin/dashboard/page.tsx
'use client'; // <-- JADIKAN CLIENT COMPONENT

import { Suspense, useState, useEffect } from 'react';
import { DashboardStats } from '@/components/admin/dashboard-stats';
import { DashboardTable } from '@/components/admin/dashboard-table';
import { getRegistrations, getDashboardStats, RegistrationWithTents, Stats } from '@/actions/registration';
import { Loader2 } from 'lucide-react';

export default function DashboardPage() {
    const [initialData, setInitialData] = useState<{
        registrations: RegistrationWithTents[];
        stats: Stats;
    } | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Fungsi untuk memuat ulang SEMUA data dashboard
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
            
            {/* Teruskan stats dan fungsi refetch ke komponen anak */}
            <DashboardStats 
                initialStats={initialData.stats} 
                refetchStats={refetchDashboardData} 
            />
            
            {/* Teruskan registrasi dan fungsi refetch ke komponen anak */}
            <DashboardTable 
                initialRegistrations={initialData.registrations} 
                onActionSuccess={refetchDashboardData} 
            />
        </div>
    );
}