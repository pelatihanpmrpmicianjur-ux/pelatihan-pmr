// File: app/admin/participants/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase/client';
import { Skeleton } from "@/components/ui/skeleton";
// Tipe data spesifik untuk halaman ini
type ParticipantData = { id: string; photoPath: string | null; fullName: string; schoolName: string; birthInfo: string; phone: string | null; };

function getPublicUrlFromPath(path: string | null): string {
    if (!path) return '/default-avatar.png'; // Fallback
    
    const { data } = supabase
        .storage
        .from('registrations')
        .getPublicUrl(path);
    console.log(`Path: ${path}, Generated URL: ${data.publicUrl}`);
    return data.publicUrl;
}

export default function AllParticipantsPage() {
    const [participants, setParticipants] = useState<ParticipantData[]>([]);
    const [isLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                const res = await fetch('/api/admin/participants');
                if (!res.ok) throw new Error('Gagal memuat data peserta');
                const data = await res.json();
                setParticipants(data);
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

    // Fungsi untuk ekspor ke CSV
    const handleExportCSV = (data: ParticipantData[], filename: string) => {
        if (data.length === 0) {
            toast.warning("Tidak ada data untuk diekspor.");
            return;
        }
          const headers: (keyof ParticipantData)[] = [
        'id', 
        'fullName', 
        'schoolName', 
        'birthInfo', 
        'phone'
    ];
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(header => JSON.stringify(row[header])).join(','))
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

    const TableSkeleton = () => (
        Array.from({ length: 5 }).map((_, index) => (
            <TableRow key={`skeleton-${index}`}>
                <TableCell><Skeleton className="h-10 w-10 rounded-full" /></TableCell>
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
                 <h1 className="text-3xl font-bold">Data Peserta ({!isLoading && participants.length})</h1>
                <Button onClick={() =>handleExportCSV}>
                    <Download className="mr-2 h-4 w-4" /> Ekspor ke CSV
                </Button>
            </div>
            
            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Foto</TableHead>
                            <TableHead>Nama Lengkap</TableHead>
                            <TableHead>Asal Sekolah</TableHead>
                            <TableHead>Info Kelahiran</TableHead>
                            <TableHead>No. HP</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                         {isLoading ? <TableSkeleton /> : (
                            participants.length > 0 ? (
                                participants.map(p => (
                                    <TableRow key={p.id}>
                                    <TableCell>
                                         <Image 
                        src={getPublicUrlFromPath(p.photoPath)} 
                        alt={p.fullName} 
                        width={40} 
                        height={40} 
                        className="rounded-full object-cover aspect-square" 
                    />
                                    </TableCell>
                                    <TableCell className="font-medium">{p.fullName}</TableCell>
                                    <TableCell>{p.schoolName}</TableCell>
                                    <TableCell>{p.birthInfo}</TableCell>
                                    <TableCell>{p.phone || '-'}</TableCell>
                                </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={5} className="text-center h-24">Tidak ada data peserta.</TableCell></TableRow>
                            )
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}