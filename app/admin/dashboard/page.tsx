// File: app/admin/dashboard/page.tsx
'use server'; // Ini adalah file Server Component yang juga bisa mengekspor Server Actions

import { Suspense } from 'react';
import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DashboardStats } from '@/components/admin/dashboard-stats';
import { DashboardTable } from '@/components/admin/dashboard-table';
import { Registration, TentBooking, TentType } from '@prisma/client'; // Impor tipe-tipe yang dibutuhkan
import { Card, CardHeader, CardTitle } from '@/components/ui/card';

// ====================================================================
// === BAGIAN SERVER ACTIONS ===
// (Kode ini sudah benar)
// ====================================================================

// Tipe data yang diperkaya untuk tabel kita
// Menggabungkan tipe dasar dengan relasinya
export type RegistrationWithTents = Registration & {
    tentBookings: (TentBooking & {
        tentType: TentType;
    })[];
};

// Server action baru untuk mengambil data dengan filter
export async function getRegistrations(filters: { category?: 'Wira' | 'Madya'; date?: string }) {
    // Tipe `any` digunakan di sini untuk fleksibilitas pembuatan query
    // Ini adalah kasus penggunaan yang bisa diterima untuk `whereClause` dinamis
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {
        status: { not: 'DRAFT' }
    };

    if (filters.category) {
        whereClause.schoolCategory = filters.category;
    }

    if (filters.date) {
        const startDate = new Date(filters.date);
        const endDate = new Date(startDate);
endDate.setUTCDate(startDate.getUTCDate() + 1); // Gunakan UTC untuk konsistensi
        whereClause.createdAt = {
            gte: startDate,
            lt: endDate,
        };
    }

    return prisma.registration.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        include: {
            tentBookings: {
                include: {
                    tentType: true,
                },
            },
        },
    });
}

// Server action untuk statistik
export async function getDashboardStats() {
    const [totalRegistrations, totalRevenueResult] = await Promise.all([
        prisma.registration.count({
            where: { status: { not: 'DRAFT' } }
        }),
        prisma.registration.aggregate({
            _sum: { grandTotal: true },
            where: { status: 'CONFIRMED' }
        })
    ]);
    
    return {
        totalRegistrations,
        totalRevenue: totalRevenueResult._sum.grandTotal || 0
    };
}


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
            
            {/* 
              Suspense digunakan untuk streaming UI. Jika salah satu komponen data
              lambat dimuat, yang lain bisa ditampilkan terlebih dahulu.
            */}
            <Suspense fallback={<StatsSkeleton />}>
                {/* 
                  Komponen Klien ini menerima data awal sebagai props.
                  Ia tidak akan melakukan fetch data lagi saat pertama kali dimuat.
                */}
                <DashboardStats initialStats={initialStats} />
            </Suspense>
            
            <Suspense fallback={<TableSkeleton />}>
                {/* 
                  Komponen Klien ini juga menerima data awal sebagai props.
                  Semua logika filter dan aksi akan terjadi di dalamnya.
                */}
                <DashboardTable initialRegistrations={initialRegistrations} />
            </Suspense>

            {/* TODO: Tabel Login History bisa ditambahkan di sini */}
        </div>
    );
}

// Komponen skeleton bisa ditempatkan di sini atau di filenya sendiri
const StatsSkeleton = () => (
    <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader><CardTitle>Loading...</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardTitle>Loading...</CardTitle></CardHeader></Card>
    </div>
);

const TableSkeleton = () => (
    <Card><CardHeader><CardTitle>Loading data tabel...</CardTitle></CardHeader></Card>
);