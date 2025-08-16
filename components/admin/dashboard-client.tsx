// File: components/admin/dashboard-client.tsx
'use client';

import { useState, useCallback } from 'react';
import { DashboardStats } from '@/components/admin/dashboard-stats';
import { DashboardTable } from '@/components/admin/dashboard-table';
import { LoginHistory } from '@/components/admin/login-history';
import { getDashboardStats, getLoginHistory, type Stats, type LoginHistoryItem, getRegistrations, type RegistrationWithTents  } from '@/actions/admin';

type DashboardClientProps = {
    initialRegistrations: RegistrationWithTents[];
    initialStats: Stats;
    initialLoginHistory: LoginHistoryItem[];
};

export function DashboardClient({ initialRegistrations, initialStats, initialLoginHistory }: DashboardClientProps) {
    // State untuk data dinamis
    const [registrations, setRegistrations] = useState(initialRegistrations);
    const [stats, setStats] = useState(initialStats);
    const [loginHistory, setLoginHistory] = useState(initialLoginHistory);
    
    // State untuk loading saat refetch, bukan saat muat awal
    const [isRefetching, setIsRefetching] = useState(false);

    const refetchDashboardData = useCallback(async () => {
        setIsRefetching(true);
        try {
            const [statsData, registrationsData, historyData] = await Promise.all([
                getDashboardStats(),
                getRegistrations({}), // Gunakan filter yang aktif jika perlu
                getLoginHistory()
            ]);
            setStats(statsData);
            setRegistrations(registrationsData);
            setLoginHistory(historyData);
        } catch (error) {
            console.error("Gagal memuat ulang data dashboard:", error);
        } finally {
            setIsRefetching(false);
        }
    }, []);
    
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold tracking-tight">Dashboard Pendaftaran</h2>
                {/* Anda bisa menambahkan tombol refresh global di sini jika mau */}
            </div>
            
            <DashboardStats initialStats={stats} />
            
            <div className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-2">
                    <DashboardTable 
                        initialRegistrations={registrations} 
                        onActionSuccess={refetchDashboardData} 
                    />
                </div>
                <div className="md:col-span-1">
                    <LoginHistory initialHistory={loginHistory} />
                </div>
            </div>
        </div>
    );
}