// File: app/admin/dashboard/page.tsx
// Perhatikan: Tidak ada 'use client'; di sini, ini adalah Server Component

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { RegistrationStatus } from "@prisma/client";

// Definisikan tipe data yang kita ambil, meskipun tidak digunakan
// oleh state, ini baik untuk kejelasan.
type RegistrationListItem = {
    id: string;
    createdAt: Date; // Prisma mengembalikan objek Date
    status: RegistrationStatus;
    schoolName: string;
    coachName: string | null;
    grandTotal: number;
    customOrderId: string | null;
}

// Objek untuk memetakan status ke varian visual dari Badge
const statusVariantMap: { [key in RegistrationStatus]: "default" | "destructive" | "secondary" | "outline" } = {
    DRAFT: 'outline',
    SUBMITTED: 'secondary',
    CONFIRMED: 'default',
    REJECTED: 'destructive',
};

const statusTextMap: { [key in RegistrationStatus]: string } = {
    DRAFT: 'Draft / Belum Selesai',
    SUBMITTED: 'Menunggu Konfirmasi',
    CONFIRMED: 'Terkonfirmasi',
    REJECTED: 'Ditolak',
};


// Komponen halaman sekarang adalah fungsi ASYNC
export default async function DashboardPage() {
    
    // Langsung panggil Prisma untuk mengambil data di server saat request.
    // Error handling untuk query ini akan ditangkap oleh error boundary Next.js.
    const registrations: RegistrationListItem[] = await prisma.registration.findMany({
        orderBy: {
            createdAt: 'desc',
        },
        select: {
            id: true,
            createdAt: true,
            status: true,
            schoolName: true,
            coachName: true,
            grandTotal: true,
            customOrderId: true,
        }
    });

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight">Dashboard Pendaftaran Masuk</h2>
            <div className="bg-white rounded-lg shadow-md border border-gray-200">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-xs text-gray-700 uppercase">
                            <tr>
                                <th scope="col" className="px-6 py-3">ID Pesanan</th>
                                <th scope="col" className="px-6 py-3">Nama Sekolah</th>
                                <th scope="col" className="px-6 py-3">Tanggal Daftar</th>
                                <th scope="col" className="px-6 py-3 text-right">Total Biaya</th>
                                <th scope="col" className="px-6 py-3 text-center">Status</th>
                                <th scope="col" className="px-6 py-3 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {registrations.length === 0 ? (
                                <tr className="bg-white border-b">
                                    <td colSpan={6} className="text-center p-8 text-gray-500">
                                        Belum ada pendaftaran yang masuk.
                                    </td>
                                </tr>
                            ) : (
                                registrations.map(reg => (
                                    <tr key={reg.id} className="bg-white border-b hover:bg-gray-50">
                                        <td className="px-6 py-4 font-mono text-xs text-gray-600">
                                            {reg.customOrderId || '-'}
                                        </td>
                                        <td scope="row" className="px-6 py-4 font-semibold text-gray-900 whitespace-nowrap">
                                            {reg.schoolName}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {new Date(reg.createdAt).toLocaleDateString('id-ID', {
                                                day: 'numeric', month: 'long', year: 'numeric'
                                            })}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-800 text-right">
                                            Rp {reg.grandTotal.toLocaleString('id-ID')}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <Badge variant={statusVariantMap[reg.status]}>
                                                {statusTextMap[reg.status]}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <Link href={`/admin/registrations/${reg.id}`} className="font-medium text-red-600 hover:underline">
                                                Lihat Detail
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}