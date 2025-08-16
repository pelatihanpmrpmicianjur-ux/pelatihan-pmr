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
} from "@/actions/admin";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, MoreHorizontal, Download, Eye, Check, X, Trash2, Loader2, FileSpreadsheet, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import * as XLSX from 'xlsx';
import { RegistrationStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { generateDailyReportAction } from '@/actions/admin';
// Tipe data dan map status
const statusVariantMap: { [key in RegistrationStatus]: "default" | "destructive" | "secondary" | "outline" } = { DRAFT: 'outline', SUBMITTED: 'secondary', CONFIRMED: 'default', REJECTED: 'destructive' };
const statusTextMap: { [key in RegistrationStatus]: string } = { DRAFT: 'Draft', SUBMITTED: 'Menunggu Konfirmasi', CONFIRMED: 'Terkonfirmasi', REJECTED: 'Ditolak' };

type Filters = {
    category: 'all' | 'Wira' | 'Madya';
    date?: Date;
}

function downloadPdf(base64: string, filename: string) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export function DashboardTable({ initialRegistrations, onActionSuccess }: { 
    initialRegistrations: RegistrationWithTents[]; 
    onActionSuccess: () => void; 
}) {
    const [registrations, setRegistrations] = useState(initialRegistrations);
    useEffect(() => { setRegistrations(initialRegistrations) }, [initialRegistrations]);
     const [filters, setFilters] = useState<Filters>({ category: 'all' });
    const [isPending, startTransition] = useTransition();
    const [reportDate, setReportDate] = useState<Date | undefined>(new Date());
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

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

    const handleRefresh = () => {
        startTransition(() => {
            toast.info("Memuat ulang data pendaftar...");
            const categoryFilter = filters.category === 'all' ? undefined : filters.category;
            const dateFilter = filters.date ? filters.date.toISOString().split('T')[0] : undefined;
            getRegistrations({ category: categoryFilter, date: dateFilter }).then((data) => {
                setRegistrations(data);
                toast.success("Data berhasil diperbarui.");
            });
        });
    };

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

    const handleGenerateReport = async () => {
        if (!reportDate) {
            return toast.error("Silakan pilih tanggal laporan.");
        }
        setIsGeneratingReport(true);
        const toastId = toast.loading("Membuat laporan harian...");

        try {
            const dateString = reportDate.toISOString().split('T')[0];
            const result = await generateDailyReportAction(dateString);
            
            if (!result.success || !result.pdfBase64) {
                throw new Error(result.message);
            }
            
            downloadPdf(result.pdfBase64, `Laporan-Keuangan-${format(reportDate, 'yyyy-MM-dd')}.pdf`);
            toast.success("Laporan berhasil diunduh.", { id: toastId });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Gagal membuat laporan.";
            toast.error(message, { id: toastId });
        } finally {
            setIsGeneratingReport(false);
        }
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

                    <div className="flex items-center gap-2">
                        <Button onClick={handleExportToExcel} variant="outline" size="sm" disabled={isPending || registrations.length === 0}>
                            <FileSpreadsheet className="mr-2 h-4 w-4" /> Export
                        </Button>
                        <Button onClick={handleRefresh} variant="outline" size="icon" disabled={isPending}>
                            <RefreshCw className={cn("h-4 w-4", isPending && "animate-spin")} />
                        </Button>
                         <Button onClick={handleGenerateReport} disabled={isGeneratingReport}>
                        {isGeneratingReport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        Download Laporan
                    </Button>
                    </div>
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
                                registrations.map(reg => <RegistrationRow 
                                key={reg.id} 
                                registration={reg} 
                                // --- Teruskan prop ke setiap baris ---
                                onActionSuccess={onActionSuccess} 
                            />)
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
function RegistrationRow({ 
    registration, 
    onActionSuccess // <-- Menerima prop baru
}: { 
    registration: RegistrationWithTents; 
    onActionSuccess: () => void; // <-- Tipe prop baru
}) {
    const router = useRouter(); // router.refresh() sudah tidak diperlukan
    const [isActionPending, startActionTransition] = useTransition();
    const [fileUrls, setFileUrls] = useState<{ excelUrl: string | null, paymentProofUrl: string | null, receiptUrl: string | null }>({ excelUrl: null, paymentProofUrl: null, receiptUrl: null });

    const tentInfo = registration.tentBookings.map(b => `${b.quantity}x ${b.tentType.name}`).join(', ') || 'Bawa Sendiri';

  const handleAction = async (action: 'confirm' | 'reject' | 'delete') => {
        // Lakukan operasi UI sinkron (prompt, confirm) di luar transisi
        let reason: string | null = null;
        if (action === 'reject') {
            reason = prompt("Masukkan alasan penolakan:");
            if (!reason || reason.trim() === '') {
                return toast.warning("Alasan penolakan dibatalkan atau kosong.");
            }
        } else if (action === 'delete') {
            if (!confirm(`Anda yakin ingin menghapus pendaftaran untuk ${registration.schoolName}? Tindakan ini tidak bisa dibatalkan.`)) {
                return;
            }
        }

        // Mulai transisi untuk pembaruan state yang disebabkan oleh aksi server
        startActionTransition(async () => {
            let result: { success: boolean; message: string; };

            // Panggil Server Action yang sesuai
            if (action === 'confirm') {
                result = await confirmRegistrationAction(registration.id);
            } else if (action === 'reject') {
                // `reason` di sini dijamin ada karena sudah divalidasi di atas
                result = await rejectRegistrationAction(registration.id, reason!);
            } else { // action === 'delete'
                result = await deleteRegistrationAction(registration.id);
            }

            // Tangani hasil dari Server Action
            if (result.success) {
                toast.success(result.message);
                // Panggil callback untuk memicu re-fetch data di komponen induk
                onActionSuccess(); 
            } else {
                toast.error(result.message);
            }
        });
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
                                       {fileUrls.paymentProofUrl ? (
                                            <img 
                                                src={fileUrls.paymentProofUrl} 
                                                alt="Bukti Pembayaran" 
                                                // Berikan style agar tidak terlalu besar
                                                className="mt-4 rounded-md max-w-full h-auto"
                                            />
                                        ) : (
                                            <p className="mt-4">Memuat URL gambar...</p>
                                        )}
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