// File: app/admin/tents/page.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, School, Tent, Users } from 'lucide-react';

// Tipe data yang diharapkan dari API /api/admin/tents
type TentBookingData = {
    schoolName: string;
    capacity: number;
    price: number;
    quantity: number;
    totalCapacity: number;
};

export default function AllTentsPage() {
    const [tentBookings, setTentBookings] = useState<TentBookingData[]>([]);
    const [isLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                const res = await fetch('/api/admin/tents');
                if (!res.ok) throw new Error('Gagal memuat data sewa tenda');
                const data = await res.json();
                setTentBookings(data);
            } catch (error: unknown) {
    if (error instanceof Error) {
        toast.error(error.message);
    } else {
        toast.error("Terjadi kesalahan yang tidak diketahui");
    }
            }
        }
        fetchData();
    }, []);

    // Gunakan useMemo untuk menghitung total secara efisien.
    // Kalkulasi ini hanya akan berjalan ulang jika `tentBookings` berubah.
    const summary = useMemo(() => {
        const totalSchools = new Set(tentBookings.map(t => t.schoolName)).size;
        const totalTents = tentBookings.reduce((sum, t) => sum + t.quantity, 0);
        const totalCapacityProvided = tentBookings.reduce((sum, t) => sum + t.totalCapacity, 0);
        
        // Ringkasan per tipe tenda
        const tentsByType = tentBookings.reduce((acc, booking) => {
            const capacityStr = `Kapasitas ${booking.capacity}`;
            if (!acc[capacityStr]) {
                acc[capacityStr] = 0;
            }
            acc[capacityStr] += booking.quantity;
            return acc;
        }, {} as Record<string, number>);

        return { totalSchools, totalTents, totalCapacityProvided, tentsByType };
    }, [tentBookings]);
    
    // Fungsi generik untuk ekspor ke CSV
    const handleExportCSV = () => {
        if (tentBookings.length === 0) {
            toast.warning("Tidak ada data untuk diekspor.");
            return;
        }
        const headers = ["Nama Sekolah", "Kapasitas Tenda", "Jumlah Unit", "Harga per Unit", "Total Kapasitas"];
        const csvContent = [
            headers.join(','),
            ...tentBookings.map(row => 
                [
                    JSON.stringify(row.schoolName),
                    row.capacity,
                    row.quantity,
                    row.price,
                    row.totalCapacity
                ].join(',')
            )
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `rekapitulasi-tenda.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <h1 className="text-3xl font-bold">Data Tenda</h1>
                <Button onClick={handleExportCSV}>
                    <Download className="mr-2 h-4 w-4" /> Ekspor ke CSV
                </Button>
            </div>
            
            {/* Kartu Ringkasan */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Sekolah Menyewa</CardTitle>
                        <School className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{isLoading ? '...' : summary.totalSchools}</div>
                        <p className="text-xs text-muted-foreground">Total sekolah yang menyewa tenda</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Tenda Disewa</CardTitle>
                        <Tent className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{isLoading ? '...' : summary.totalTents}</div>
                        <p className="text-xs text-muted-foreground">Jumlah semua unit tenda yang disewa</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Kapasitas Disediakan</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{isLoading ? '...' : summary.totalCapacityProvided.toLocaleString('id-ID')}</div>
                        <p className="text-xs text-muted-foreground">Total kapasitas dari semua tenda</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Rincian per Tipe</CardTitle>
                        <Tent className="h-4 w-4 text-black" />
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <p className="text-xs">...</p> : 
                            Object.entries(summary.tentsByType).map(([type, count]) => (
                                <div key={type} className="text-sm flex justify-between">
                                    <span>{type}</span>
                                    <span className="font-semibold">{count} unit</span>
                                </div>
                            ))
                        }
                    </CardContent>
                </Card>
            </div>
            
            {/* Tabel Rincian */}
            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nama Sekolah</TableHead>
                            <TableHead className="text-center">Kapasitas Tenda</TableHead>
                            <TableHead className="text-center">Jumlah Unit</TableHead>
                            <TableHead className="text-right">Total Kapasitas</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={4} className="h-24 text-center">Memuat data...</TableCell></TableRow>
                        ) : tentBookings.length > 0 ? (
                            tentBookings.map((booking, index) => (
                                <TableRow key={`${booking.schoolName}-${booking.capacity}-${index}`}>
                                    <TableCell className="font-medium">{booking.schoolName}</TableCell>
                                    <TableCell className="text-center">{booking.capacity} orang</TableCell>
                                    <TableCell className="text-center">{booking.quantity} unit</TableCell>
                                    <TableCell className="text-right font-semibold">{booking.totalCapacity} orang</TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow><TableCell colSpan={4} className="h-24 text-center">Belum ada sekolah yang menyewa tenda.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}