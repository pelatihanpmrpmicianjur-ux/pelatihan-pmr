// File: app/admin/dashboard/page.tsx
'use client';

import { useState, useEffect } from "react";
import { type RegistrationStatus } from "@prisma/client";
import Link from "next/link";
import { Badge } from "@/components/ui/badge"; // npx shadcn-ui@latest add badge

type RegistrationListItem = {
    id: string;
    createdAt: string;
    status: RegistrationStatus;
    schoolName: string;
    coachName: string;
    grandTotal: number;
    customOrderId: string | null;
}

const statusVariant: { [key in RegistrationStatus]: "default" | "destructive" | "secondary" | "outline" } = {
    DRAFT: 'outline',
    SUBMITTED: 'secondary',
    CONFIRMED: 'default',
    REJECTED: 'destructive',
};

export default function DashboardPage() {
    const [registrations, setRegistrations] = useState<RegistrationListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                const response = await fetch('/api/admin/registrations');
                const data = await response.json();
                setRegistrations(data);
            } catch (error) {
                console.error(error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);

    if (isLoading) return <p>Loading data pendaftaran...</p>;

    return (
        <div>
            <h2 className="text-2xl font-bold mb-4">Daftar Pendaftaran Masuk</h2>
            <div className="bg-white rounded-lg shadow">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="p-4">ID Pesanan</th>
                            <th className="p-4">Nama Sekolah</th>
                            <th className="p-4">Tanggal Daftar</th>
                            <th className="p-4">Total Biaya</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {registrations.map(reg => (
                            <tr key={reg.id} className="border-b">
                                <td className="p-4 font-mono text-xs">{reg.customOrderId || '-'}</td>
                                <td className="p-4 font-semibold">{reg.schoolName}</td>
                                <td className="p-4">{new Date(reg.createdAt).toLocaleDateString('id-ID')}</td>
                                <td className="p-4">Rp {reg.grandTotal.toLocaleString('id-ID')}</td>
                                <td className="p-4">
                                    <Badge variant={statusVariant[reg.status]}>{reg.status}</Badge>
                                </td>
                                <td className="p-4">
                                    <Link href={`/admin/registrations/${reg.id}`} className="text-blue-600 hover:underline">
                                        Lihat Detail
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}