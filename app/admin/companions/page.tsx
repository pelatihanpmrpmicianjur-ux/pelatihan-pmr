// File: app/admin/participants/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

// Tipe data spesifik untuk halaman ini
type CompanionsData = { id: string; fullName: string; schoolName: string; birthInfo: string; phone: string | null; };

export default function AllParticipantsPage() {
    const [companions, setCompanions] = useState<CompanionsData[]>([]);
    const [isLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                const res = await fetch('/api/admin/companions');
                if (!res.ok) throw new Error('Gagal memuat data pendamping');
                const data = await res.json();
                setCompanions(data);
            }catch (error: unknown) {
    if (error instanceof Error) {
        toast.error(error.message);
    } else {
        toast.error("Terjadi kesalahan yang tidak diketahui");
    }
}
        }
        fetchData();
    }, []);

    // Fungsi untuk ekspor ke CSV
    const handleExportCSV = (data: CompanionsData[], filename: string) => {
        if (data.length === 0) {
            toast.warning("Tidak ada data untuk diekspor.");
            return;
        }
         const headers: (keyof CompanionsData)[] = [
        'id', 
        'fullName', 
        'schoolName', 
        'birthInfo', 
        'phone'
    ];
        
       const csvContent = [
        headers.join(','), // Baris header
        ...data.map(row => {
            // Sekarang, TypeScript tahu `header` adalah kunci yang valid dari `row`
            return headers.map(header => {
                const value = row[header];
                // JSON.stringify untuk menangani koma dan tanda kutip di dalam data
                return JSON.stringify(value);
            }).join(',');
        })
    ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `${filename}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    if (isLoading) return <p>Memuat data...</p>;

return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Data Pendamping ({companions.length})</h1>
                <Button onClick={() =>handleExportCSV}>
                    <Download className="mr-2 h-4 w-4" /> Ekspor ke CSV
                </Button>
            </div>
            
            <div className="border rounded-md">
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
                        {isLoading ? (
                            <TableRow><TableCell colSpan={5} className="text-center">Memuat data...</TableCell></TableRow>
                        ) : (
                            companions.map(c => (
                                <TableRow key={c.id}>
                                    <TableCell className="font-medium">{c.fullName}</TableCell>
                                    <TableCell>{c.schoolName}</TableCell>
                                    <TableCell>{c.birthInfo}</TableCell>
                                    <TableCell>{c.phone || '-'}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}