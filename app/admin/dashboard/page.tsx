// File: app/admin/dashboard/page.tsx
// Ini adalah Server Component, TIDAK ADA 'use client'

import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DashboardClient } from '@/components/admin/dashboard-client'; // Impor komponen klien baru
import { getRegistrations, getDashboardStats, getLoginHistory } from '@/actions/admin';

// Komponen Halaman Utama (Server)
export default async function DashboardPage() {
    // 1. Pemeriksaan Sesi & Keamanan
    const session = await getServerSession(authOptions);
    if (!session) {
        redirect('/login'); 
    }

    // 2. Pengambilan Data Awal
    const [initialRegistrations, initialStats, initialLoginHistory] = await Promise.all([
        getRegistrations({}),
        getDashboardStats(),
        getLoginHistory()
    ]);

    // Komponen Skeleton untuk Suspense
    const DashboardSkeleton = () => (
        <div className="space-y-6 animate-pulse">
            <div className="h-9 w-72 bg-gray-200 rounded-md"></div>
            <div className="grid gap-4 md:grid-cols-2">
                <div className="h-28 bg-gray-200 rounded-lg"></div>
                <div className="h-28 bg-gray-200 rounded-lg"></div>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-2 h-96 bg-gray-200 rounded-lg"></div>
                <div className="md:col-span-1 h-96 bg-gray-200 rounded-lg"></div>
            </div>
        </div>
    );

    return (
        <Suspense fallback={<DashboardSkeleton />}>
            {/* 3. Render Komponen Klien dengan Data Awal */}
            <DashboardClient 
                initialRegistrations={initialRegistrations}
                initialStats={initialStats}
                initialLoginHistory={initialLoginHistory}
            />
        </Suspense>
    );
}