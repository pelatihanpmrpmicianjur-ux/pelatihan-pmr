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
import { cn } from '@/lib/utils'; // Impor cn untuk Skeleton

// Tipe data spesifik yang SESUAI dengan apa yang dikembalikan oleh API
type ParticipantData = { 
    id: string; 
    photoPath: string | null; 
    fullName: string; 
    schoolName: string; 
    birthInfo: string; 
    phone: string | null;
    // Tambahkan properti lain yang mungkin dikirim oleh API
    gender: string;
    bloodType: string | null;
    address: string;
};

function getPublicUrlFromPath(path: string | null): string {
    if (!path) return '/default-avatar.png';
    const { data } = supabase
        .storage
        .from('registrations')
        .getPublicUrl(path);
    return data.publicUrl;
}

export default function AllParticipantsPage() {
    const [participants, setParticipants] = useState<ParticipantData[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                const res = await fetch('/api/admin/participants');
                if (!res.ok) throw new Error('Gagal memuat data peserta');
                const data = await res.json();
                
                console.log("Data peserta diterima dari API:", data); // Log ini sangat membantu
                
                setParticipants(data);
            } catch (error: unknown) { // Perbaikan: Gunakan 'unknown' bukan 'any'
                console.error("Error saat fetching data:", error);
                if (error instanceof Error) {
                    toast.error(error.message);
                } else {
                    toast.error("Terjadi kesalahan tidak dikenal saat mengambil data.");
                }
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);

    const handleExportCSV = () => { // Hapus argumen jika kita bisa akses 'participants' langsung
        if (participants.length === 0) {
            toast.warning("Tidak ada data untuk diekspor.");
            return;
        }
        
        // Pilih header yang ingin diekspor
        const headers = ["ID", "Nama Lengkap", "Asal Sekolah", "Info Kelahiran", "No. HP", "Gender", "Gol. Darah", "Alamat"];
        const keys: (keyof ParticipantData)[] = ['id', 'fullName', 'schoolName', 'birthInfo', 'phone', 'gender', 'bloodType', 'address'];

        const csvContent = [
            headers.join(','),
            ...participants.map(row => 
                keys.map(key => 
                    // JSON.stringify akan menangani koma di dalam string
                    JSON.stringify(row[key] === null ? '' : row[key]) 
                ).join(',')
            )
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', 'data-peserta.csv');
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
                 <h1 className="text-3xl font-bold">Semua Peserta ({!isLoading ? participants.length : '...'})</h1>
                {/* --- PERBAIKAN: Panggil fungsi dengan benar --- */}
                <Button onClick={handleExportCSV}> 
                    <Download className="mr-2 h-4 w-4" /> Ekspor ke CSV
                </Button>
            </div>
            
            <div className="border rounded-md bg-white shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[60px]">Foto</TableHead>
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
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                        Tidak ada data peserta yang sudah dikonfirmasi.
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