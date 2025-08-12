// File: app/admin/companions/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// Tipe data yang 100% cocok dengan API
type CompanionData = { 
    id: string; 
    fullName: string; 
    schoolName: string; 
    birthInfo: string; 
    phone: string | null;
    gender: string;
    bloodType: string | null;
    address: string;
};

export default function AllCompanionsPage() { // <-- Nama komponen diperbaiki
    const [companions, setCompanions] = useState<CompanionData[]>([]);
    const [isLoading, setIsLoading] = useState(true); // <-- Pastikan ini benar

    useEffect(() => {
        async function fetchData() {
            try {
                const res = await fetch('/api/admin/companions');
                if (!res.ok) throw new Error('Gagal memuat data pendamping');
                const data = await res.json();
                setCompanions(data);
            } catch (error: unknown) {
                if (error instanceof Error) {
                    toast.error(error.message);
                } else {
                    toast.error("Terjadi kesalahan yang tidak diketahui saat mengambil data.");
                }
            } finally {
                // --- PERBAIKAN: Set isLoading menjadi false ---
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);

    const handleExportCSV = () => { // Hapus argumen yang tidak perlu
        if (companions.length === 0) {
            toast.warning("Tidak ada data untuk diekspor.");
            return;
        }
        
        const headers = ["ID", "Nama Lengkap", "Asal Sekolah", "Info Kelahiran", "No. HP", "Gender", "Gol. Darah", "Alamat"];
        const keys: (keyof CompanionData)[] = ['id', 'fullName', 'schoolName', 'birthInfo', 'phone', 'gender', 'bloodType', 'address'];
        
        const csvContent = [
            headers.join(','),
            ...companions.map(row => 
                keys.map(key => JSON.stringify(row[key] ?? '')).join(',')
            )
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `data-pendamping.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const TableSkeleton = () => (
        Array.from({ length: 5 }).map((_, index) => (
            <TableRow key={`skeleton-${index}`}>
                <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            </TableRow>
        ))
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Semua Pendamping ({!isLoading ? companions.length : '...'})</h1>
                {/* --- PERBAIKAN: Panggil fungsi dengan benar --- */}
                <Button onClick={handleExportCSV}>
                    <Download className="mr-2 h-4 w-4" /> Ekspor ke CSV
                </Button>
            </div>
            
            <div className="border rounded-md bg-white shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nama Lengkap</TableHead>
                            <TableHead>Asal Sekolah</TableHead>
                            <TableHead>Info Kelahiran</TableHead>
                            <TableHead>No. HP</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? <TableSkeleton /> : (
                            companions.length > 0 ? (
                                companions.map(c => (
                                    <TableRow key={c.id}>
                                        <TableCell className="font-medium">{c.fullName}</TableCell>
                                        <TableCell>{c.schoolName}</TableCell>
                                        <TableCell>{c.birthInfo}</TableCell>
                                        <TableCell>{c.phone || '-'}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                        Tidak ada data pendamping yang ditemukan.
                                    </TableCell>
                                </TableRow>
                            )
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}