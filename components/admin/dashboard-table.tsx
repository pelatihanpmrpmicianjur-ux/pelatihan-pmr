// File: components/admin/dashboard-table.tsx
'use client';

import { useState, useEffect, useTransition, Fragment } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { 
    confirmRegistrationAction, 
    rejectRegistrationAction, 
    deleteRegistrationAction,
    getRegistrationDetailsAction,
    getRegistrations, RegistrationWithTents  // Impor ini juga dari actions
} from "@/actions/registration";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, MoreHorizontal, Download, Eye, Check, X, Trash2, Loader2, FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";
import Image from "next/image";
import * as XLSX from 'xlsx';
import { RegistrationStatus } from "@prisma/client";

// Tipe data dan map status
const statusVariantMap: { [key in RegistrationStatus]: "default" | "destructive" | "secondary" | "outline" } = { DRAFT: 'outline', SUBMITTED: 'secondary', CONFIRMED: 'default', REJECTED: 'destructive' };
const statusTextMap: { [key in RegistrationStatus]: string } = { DRAFT: 'Draft', SUBMITTED: 'Menunggu Konfirmasi', CONFIRMED: 'Terkonfirmasi', REJECTED: 'Ditolak' };

type Filters = {
    category: 'all' | 'Wira' | 'Madya';
    date?: Date;
}

export function DashboardTable({ initialRegistrations }: { initialRegistrations: RegistrationWithTents[] }) {
    const router = useRouter();
    const [registrations, setRegistrations] = useState(initialRegistrations);
     const [filters, setFilters] = useState<Filters>({ category: 'all' });
    const [isPending, startTransition] = useTransition();

useEffect(() => {
        startTransition(() => {
            // ======================================================
            // === PERBAIKAN UTAMA DI SINI ===
            // ======================================================
            const categoryFilter = filters.category === 'all' ? undefined : filters.category;

            getRegistrations({ 
                category: categoryFilter, // <-- Tidak perlu `as any` lagi
                date: filters.date ? filters.date.toISOString().split('T')[0] : undefined
            }).then(setRegistrations);
        });
    }, [filters]);

    const handleExportToExcel = () => {
        const dataToExport = registrations.map(reg => ({
            "ID Pesanan": reg.customOrderId,
            "Nama Sekolah": reg.schoolName,
            "Kategori": reg.schoolCategory,
            "Tanggal Daftar": format(new Date(reg.createdAt), "dd MMMM yyyy"),
            "Total Biaya": reg.grandTotal,
            "Status": statusTextMap[reg.status],
            "Tenda Disewa": reg.tentBookings.map(b => `${b.quantity}x ${b.tentType.name}`).join(', ') || 'Tidak Sewa',
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Pendaftaran");
        XLSX.writeFile(workbook, "Data-Pendaftaran-PMR.xlsx");
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Data Pendaftar</CardTitle>
                <CardDescription>Filter, kelola, dan ekspor semua data pendaftaran yang masuk.</CardDescription>
                <div className="flex flex-wrap items-center gap-4 pt-4">
                   <Select 
                        value={filters.category} 
                        onValueChange={(value: 'all' | 'Wira' | 'Madya') => 
                            setFilters(prev => ({ ...prev, category: value }))
                        }
                    >
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter Kategori" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Kategori</SelectItem>
                            <SelectItem value="Wira">Wira</SelectItem>
                            <SelectItem value="Madya">Madya</SelectItem>
                        </SelectContent>
                    </Select>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant={"outline"} className="w-[240px] justify-start text-left font-normal">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {filters.date ? format(filters.date, "PPP") : <span>Pilih Tanggal</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={filters.date} onSelect={(date) => setFilters(prev => ({...prev, date}))} initialFocus />
                        </PopoverContent>
                    </Popover>
                    
                    <Button variant="secondary" onClick={() => setFilters({ category: 'all', date: undefined })}>Reset Filter</Button>

                    <div className="flex-grow" />
                    <Button onClick={handleExportToExcel} variant="outline">
                        <FileSpreadsheet className="mr-2 h-4 w-4" /> Ekspor ke Excel
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>ID Pesanan</TableHead>
                                <TableHead>Nama Sekolah</TableHead>
                                <TableHead>Tenda Disewa</TableHead>
                                <TableHead>Tanggal Daftar</TableHead>
                                <TableHead className="text-right">Total Biaya</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                                <TableHead className="text-center w-[50px]">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isPending ? (
                                <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                            ) : registrations.length > 0 ? (
                                registrations.map(reg => <RegistrationRow key={reg.id} registration={reg} />)
                            ) : (
                                <TableRow><TableCell colSpan={7} className="h-24 text-center">Tidak ada data yang cocok dengan filter.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}

// Komponen baris tabel terpisah untuk mengelola state-nya sendiri
function RegistrationRow({ registration }: { registration: RegistrationWithTents }) {
    const router = useRouter();
    const [isActionPending, startActionTransition] = useTransition();
    const [fileUrls, setFileUrls] = useState<{ excelUrl: string | null, paymentProofUrl: string | null, receiptUrl: string | null }>({ excelUrl: null, paymentProofUrl: null, receiptUrl: null });

    const tentInfo = registration.tentBookings.map(b => `${b.quantity}x ${b.tentType.name}`).join(', ') || 'Bawa Sendiri';

   const handleAction = async (action: 'confirm' | 'reject' | 'delete') => {
    // Lakukan operasi sinkron (prompt, confirm) di luar transisi
    if (action === 'reject') {
        const reason = prompt("Masukkan alasan penolakan:");
        if (!reason || reason.trim() === '') {
            return toast.warning("Alasan penolakan dibatalkan atau kosong.");
        }
        
        // Mulai transisi HANYA untuk panggilan asinkron
        startActionTransition(async () => {
            const result = await rejectRegistrationAction(registration.id, reason);
            if (result.success) toast.success(result.message);
            else toast.error(result.message);
            router.refresh();
        });

    } else if (action === 'delete') {
        if (!confirm(`Anda yakin ingin menghapus pendaftaran untuk ${registration.schoolName}? Tindakan ini tidak bisa dibatalkan.`)) {
            return;
        }
        
        startActionTransition(async () => {
            const result = await deleteRegistrationAction(registration.id);
            if (result.success) toast.success(result.message);
            else toast.error(result.message);
            router.refresh();
        });

    } else { // action === 'confirm'
        startActionTransition(async () => {
            const result = await confirmRegistrationAction(registration.id);
            if (result.success) toast.success(result.message);
            else toast.error(result.message);
            router.refresh();
        });
    }
};
    
    const handleFetchFileUrls = async () => {
        // Ambil URL hanya saat dropdown dibuka untuk efisiensi
        if (fileUrls.excelUrl) return; // Jangan fetch ulang jika sudah ada
        const data = await getRegistrationDetailsAction(registration.id);
        if (data) {
            setFileUrls({ excelUrl: data.excelUrl, paymentProofUrl: data.paymentProofUrl, receiptUrl: data.receiptUrl });
        }
    };

    return (
        <TableRow>
            <TableCell className="font-mono text-xs">{registration.customOrderId || '-'}</TableCell>
            <TableCell className="font-semibold">{registration.schoolName}</TableCell>
            <TableCell className="text-xs text-muted-foreground">{tentInfo}</TableCell>
            <TableCell>{format(new Date(registration.createdAt), "dd MMM yyyy")}</TableCell>
            <TableCell className="text-right">Rp {registration.grandTotal.toLocaleString('id-ID')}</TableCell>
            <TableCell className="text-center">
                <Badge variant={statusVariantMap[registration.status]}>{statusTextMap[registration.status]}</Badge>
            </TableCell>
            <TableCell className="text-center">
                <DropdownMenu onOpenChange={open => open && handleFetchFileUrls()}>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={isActionPending}>
                            {isActionPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Aksi Cepat</DropdownMenuLabel>
                        <DropdownMenuItem asChild>
                            <Link href={`/admin/registrations/${registration.id}`}>Lihat Detail Lengkap</Link>
                        </DropdownMenuItem>
                        {registration.status === 'SUBMITTED' && (
                            <Fragment>
                                <DropdownMenuItem onClick={() => handleAction('confirm')} className="text-green-600">
                                    <Check className="mr-2 h-4 w-4" /> Konfirmasi
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleAction('reject')} className="text-red-600">
                                    <X className="mr-2 h-4 w-4" /> Tolak
                                </DropdownMenuItem>
                            </Fragment>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Berkas</DropdownMenuLabel>
                        <DropdownMenuItem asChild disabled={!fileUrls.excelUrl}>
                            <a href={fileUrls.excelUrl || '#'} target="_blank" rel="noopener noreferrer">
                                <Download className="mr-2 h-4 w-4" /> Download Excel
                            </a>
                        </DropdownMenuItem>
                        <Dialog>
                            <DialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={!fileUrls.paymentProofUrl}>
                                    <Eye className="mr-2 h-4 w-4" /> Lihat Bukti Bayar
                                </DropdownMenuItem>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Bukti Pembayaran: {registration.schoolName}</DialogTitle>
                                    <DialogDescription>
                                        <Image src={fileUrls.paymentProofUrl || ''} alt="Bukti Pembayaran" width={500} height={700} className="mt-4 rounded-md" />
                                    </DialogDescription>
                                </DialogHeader>
                            </DialogContent>
                        </Dialog>
                        <DropdownMenuItem asChild disabled={!fileUrls.receiptUrl}>
                             <a href={fileUrls.receiptUrl || '#'} target="_blank" rel="noopener noreferrer">
                                <Download className="mr-2 h-4 w-4" /> Download Kwitansi
                            </a>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                         <DropdownMenuItem onClick={() => handleAction('delete')} className="text-red-600">
                            <Trash2 className="mr-2 h-4 w-4" /> Hapus Pendaftaran
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </TableCell>
        </TableRow>
    );
}