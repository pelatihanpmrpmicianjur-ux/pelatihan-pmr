// File: app/admin/registrations/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import Image from 'next/image';
import { type RegistrationStatus, type Participant, type Companion, type TentType } from '@prisma/client';
import { Download, Eye, XCircle, CheckCircle2, Receipt } from 'lucide-react';
import { Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog" 
import { supabase } from "@/lib/supabase/client";
import { 
    getRegistrationDetailsAction,
    confirmRegistrationAction, 
    rejectRegistrationAction, 
    deleteRegistrationAction 
} from '@/actions/admin';
// Definisikan tipe data yang lebih spesifik untuk data yang kita fetch
type TentInfo = {
    quantity: number;
    tentType: TentType;
};

type RegistrationDetail = Awaited<ReturnType<typeof getRegistrationDetailsAction>>;

const statusVariant: { [key in RegistrationStatus]: "default" | "destructive" | "secondary" | "outline" } = {
    DRAFT: 'outline',
    SUBMITTED: 'secondary',
    CONFIRMED: 'default',
    REJECTED: 'destructive',
};

const statusText: { [key in RegistrationStatus]: string } = {
    DRAFT: 'Draft / Proses',
    SUBMITTED: 'Menunggu Konfirmasi',
    CONFIRMED: 'Terkonfirmasi',
    REJECTED: 'Ditolak',
};

const DetailRow = ({ label, value }: { label: string, value: string | number | null }) => (
    <div className="flex justify-between text-sm py-1.5">
        <p className="text-muted-foreground">{label}</p>
        <p className="font-medium text-right">{value || '-'}</p>
    </div>
);

function getPublicUrlFromPath(path: string | null): string {
    if (!path) return '/default-avatar.png';
    
    // Gunakan Supabase client untuk membuat URL publik
    const { data } = supabase
        .storage
        .from('registrations')
        .getPublicUrl(path);
        
    return data.publicUrl;
}

export default function RegistrationDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const [registration, setRegistration] = useState<RegistrationDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isActionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        if (!id) return;
async function fetchData() {
      try {
        // Panggil Server Action secara langsung
        const data = await getRegistrationDetailsAction(id);
        if (!data) {
            throw new Error('Gagal memuat data atau pendaftaran tidak ditemukan.');
        }
        setRegistration(data);
      } catch (e: unknown) {
        if (e instanceof Error) {
            toast.error(e.message);
        }
      } finally {
        setIsLoading(false);
      }
    }
    // ---------------------------------------------
    
    fetchData();
  }, [id]);


     const handleConfirm = async () => {
        setActionLoading(true);
        const toastId = toast.loading("Memulai proses konfirmasi...");

        // Panggil Server Action secara langsung
        const result = await confirmRegistrationAction(id);
        
        if (result.success) {
            toast.success(result.message, { id: toastId });
            router.push('/admin/dashboard');
            router.refresh(); // Penting untuk refresh data
        } else {
            toast.error(result.message, { id: toastId });
        }
        
        setActionLoading(false);
    };
  
    const handleReject = async () => {
        const reason = prompt("PENTING: Masukkan alasan penolakan. Alasan ini akan dapat dilihat oleh pengguna.");
        if (!reason || reason.trim() === '') {
            toast.warning("Alasan penolakan harus diisi.");
            return;
        }
        setActionLoading(true);
        const toastId = toast.loading("Menolak pendaftaran...");

        // Panggil Server Action 'reject'
        const result = await rejectRegistrationAction(id, reason);
        
        if (result.success) {
            toast.success(result.message, { id: toastId });
            router.push('/admin/dashboard');
        } else {
            toast.error(result.message, { id: toastId });
        }
        setActionLoading(false);
    };

     const handleDelete = async () => {
        setActionLoading(true);
        const toastId = toast.loading("Menghapus pendaftaran...");
        
        // Panggil Server Action 'delete'
        const result = await deleteRegistrationAction(id);
        
        if (result.success) {
            toast.success(result.message, { id: toastId });
            router.push('/admin/dashboard');
        } else {
            toast.error(result.message, { id: toastId });
        }
        setActionLoading(false);
    };

    if (isLoading) return <div className="p-8 text-center">Memuat detail pendaftaran...</div>;
    if (!registration) return <div className="p-8 text-center text-red-500">Data pendaftaran tidak ditemukan.</div>;
  
    const tents = registration.status === 'CONFIRMED' ? registration.tentBookings : registration.tentReservations;
    const tentStatus = registration.status === 'CONFIRMED' ? 'Permanen' : 'Reservasi';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap justify-between items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold">{registration.schoolName}</h1>
                    <p className="text-muted-foreground font-mono text-xs">{registration.customOrderId || `ID: ${registration.id}`}</p>
                </div>
                <Badge variant={statusVariant[registration.status]} className="text-base px-4 py-2">
                    {statusText[registration.status]}
                </Badge>
            </div>
             <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="icon">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Anda Yakin?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Tindakan ini tidak bisa dibatalkan. Ini akan menghapus data pendaftaran,
                                semua data peserta, pendamping, dan semua file terkait secara permanen.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                                Ya, Hapus
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            
            {registration.status === 'REJECTED' && (
                <Card className="bg-destructive/10 border-destructive">
                    <CardHeader><CardTitle>Alasan Penolakan</CardTitle></CardHeader>
                    <CardContent><p className="italic">{registration.rejectionReason}</p></CardContent>
                </Card>
            )}

            {/* Panel Aksi */}
            {registration.status === 'SUBMITTED' && (
                <Card className="bg-yellow-50 border-yellow-200">
                    <CardHeader><CardTitle>Tindakan Diperlukan</CardTitle></CardHeader>
                    <CardContent className="flex gap-4">
                        <Button onClick={handleConfirm} disabled={isActionLoading}>
                            <CheckCircle2 className="mr-2 h-4 w-4" /> Konfirmasi Pendaftaran
                        </Button>
                        <Button variant="destructive" onClick={handleReject} disabled={isActionLoading}>
                            <XCircle className="mr-2 h-4 w-4" /> Tolak Pendaftaran
                        </Button>
                    </CardContent>
                </Card>
            )}
      
            {/* Layout Utama */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Kolom Kiri */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader><CardTitle>Informasi Pendaftar</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                            <DetailRow label="Nama Pembina" value={registration.coachName} />
                            <DetailRow label="No. WhatsApp" value={registration.coachPhone} />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Daftar Peserta ({registration.participants.length})</CardTitle></CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {registration.participants.map((p: Participant) => (
                                    <Dialog key={p.id}>
                                        <DialogTrigger asChild>
                                            <div className="text-center cursor-pointer group">
                                                <div className="relative w-full aspect-square overflow-hidden rounded-lg border">
                                                    <Image src={getPublicUrlFromPath(p.photoPath)}  alt={p.fullName} fill className="object-cover transition-transform group-hover:scale-105" />
                                                </div>
                                                <p className="text-xs font-medium mt-2 truncate">{p.fullName}</p>
                                            </div>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader><DialogTitle>{p.fullName}</DialogTitle></DialogHeader>
                                            <div className="relative w-full aspect-square mx-auto max-w-sm">
                                                <Image src={getPublicUrlFromPath(p.photoPath)}  alt={p.fullName} fill className="object-contain" />
                                            </div>
                                            <Separator />
                                            <DetailRow label="Info Kelahiran" value={p.birthInfo} />
                                            <DetailRow label="Alamat" value={p.address} />
                                            <DetailRow label="No. HP" value={p.phone} />
                                        </DialogContent>
                                    </Dialog>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {registration.companions.length > 0 && (
                        <Card>
                            <CardHeader><CardTitle>Daftar Pendamping ({registration.companions.length})</CardTitle></CardHeader>
                            <CardContent>
                                <ul className="list-disc list-inside">
                                    {registration.companions.map((c: Companion) => <li key={c.id}>{c.fullName}</li>)}
                                </ul>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Kolom Kanan */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader><CardTitle>Rincian Biaya</CardTitle></CardHeader>
                        <CardContent>
                            <DetailRow label="Biaya Peserta" value={`Rp ${registration.totalCostPeserta.toLocaleString('id-ID')}`} />
                            <DetailRow label="Biaya Pendamping" value={`Rp ${registration.totalCostPendamping.toLocaleString('id-ID')}`} />
                            <DetailRow label="Biaya Tenda" value={`Rp ${registration.totalCostTenda.toLocaleString('id-ID')}`} />
                            <Separator className="my-2" />
                            <div className="flex justify-between font-bold text-lg pt-2">
                                <span>Grand Total</span>
                                <span>Rp {registration.grandTotal.toLocaleString('id-ID')}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Sewa Tenda ({tentStatus})</CardTitle></CardHeader>
                        <CardContent>
                            {tents.length > 0 ? tents.map((t: TentInfo) => (
                                <DetailRow key={t.tentType.id} label={`Tenda Kap. ${t.tentType.capacity}`} value={`${t.quantity} unit`} />
                            )) : <p className="text-sm text-muted-foreground">Tidak menyewa tenda.</p>}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Berkas Terlampir</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                            {registration.excelUrl ? (
                                <a href={registration.excelUrl} target="_blank" rel="noopener noreferrer" className="w-full">
                                    <Button variant="outline" className="w-full justify-between">Lihat File Excel <Download className="h-4 w-4" /></Button>
                                </a>
                            ) : <p className="text-sm text-muted-foreground">File Excel tidak ditemukan.</p>}
                            
                            {registration.paymentProofUrl ? (
                                <a href={registration.paymentProofUrl} target="_blank" rel="noopener noreferrer" className="w-full">
                                    <Button variant="outline" className="w-full justify-between">Lihat Bukti Bayar <Eye className="h-4 w-4" /></Button>
                                </a>
                            ) : <p className="text-sm text-muted-foreground">Bukti bayar tidak ditemukan.</p>}

                             {registration.receiptPath ? (
                                <a href={registration.receiptPath} target="_blank" rel="noopener noreferrer" className="w-full">
                                    <Button variant="outline" className="w-full justify-between">Lihat File Kwitansi <Receipt className="h-4 w-4" /></Button>
                                </a>
                            ) : <p className="text-sm text-muted-foreground">File Kwitansi tidak ditemukan.</p>}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}