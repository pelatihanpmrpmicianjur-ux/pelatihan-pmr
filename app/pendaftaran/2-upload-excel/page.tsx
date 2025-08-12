// File: app/pendaftaran/2-upload-excel/page.tsx
'use client';

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Image from "next/image";
import { CheckCircle, XCircle, Loader2, ChevronDown, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase/client";
import { FileUpload } from "@/components/ui/file-upload"; // Nama komponen dari Aceternity UI
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { requestUploadUrlAction, processExcelAction } from "@/actions/registration";

// Tipe data lengkap yang diharapkan dari API/Action
type ParticipantPreview = { rowNumber: number | null; fullName: string; birthInfo: string; address: string; religion: string; bloodType: string | null; entryYear: number; phone: string | null; gender: string; photoPath: string | null; };
type CompanionPreview = { rowNumber: number | null; fullName: string; birthInfo: string; address: string; religion: string; bloodType: string | null; entryYear: number; phone: string | null; gender: string; };
type Summary = {
    pesertaCount: number;
    pendampingCount: number;
    totalBiaya: number;
    previewPeserta: ParticipantPreview[];
    previewPendamping: CompanionPreview[];
};
type DataTableRow = ParticipantPreview | CompanionPreview;

function getPublicUrlFromPath(path: string | null): string {
    if (!path) return '/default-avatar.png';
    const { data } = supabase.storage.from('registrations').getPublicUrl(path);
    return data.publicUrl;
}

function isParticipant(item: DataTableRow): item is ParticipantPreview {
    return 'photoPath' in item;
}

export default function UploadExcelPage() {
    const router = useRouter();
    const [registrationId, setRegistrationId] = useState<string | null>(null);
    const [fileToUpload, setFileToUpload] = useState<File | null>(null);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [uploadState, setUploadState] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isLoadingInitialData, setIsLoadingInitialData] = useState(true);

    const APP_URL = process.env.NEXTAUTH_URL;
    const excelTemplate = `${APP_URL}/Template_Data_Peserta(ganti dengan nama sekolah).xlsx`;
    
    useEffect(() => {
        const id = localStorage.getItem('registrationId');
        if (!id) {
            toast.error("Sesi tidak ditemukan. Harap mulai dari Langkah 1.");
            router.push('/pendaftaran/1-data-sekolah');
            return;
        }
        setRegistrationId(id);

        const cachedSummaryKey = `summary_${id}`;
        const cachedSummaryData = localStorage.getItem(cachedSummaryKey);

        if (cachedSummaryData) {
            try {
                const parsedSummary: Summary = JSON.parse(cachedSummaryData);
                setSummary(parsedSummary);
                setUploadState('success');
            } catch (_error: unknown) {
                console.error("Gagal mem-parse data summary dari cache, data akan dihapus:", _error);
                localStorage.removeItem(cachedSummaryKey);
            }
        }
        setIsLoadingInitialData(false);
    }, [router]);

    const handleFileChange = (files: File[]) => {
        const selectedFile = files[0];
        if (!selectedFile) {
            setFileToUpload(null);
            return;
        };

        const MAX_SIZE_MB = 10;
        if (selectedFile.size > MAX_SIZE_MB * 1024 * 1024) {
            toast.error(`Ukuran file melebihi ${MAX_SIZE_MB}MB.`);
            setFileToUpload(null);
            return;
        }
        if (!['.xlsx', '.xls'].some(ext => selectedFile.name.toLowerCase().endsWith(ext))) {
            toast.error("Tipe file tidak valid. Harap unggah file .xlsx atau .xls.");
            setFileToUpload(null);
            return;
        }
        
        setFileToUpload(selectedFile);
    };

    const handleProcess = async () => {
        if (!fileToUpload || !registrationId) {
            toast.warning("Silakan pilih file Excel terlebih dahulu.");
            return;
        }

        const processResult = await processExcelAction(registrationId, urlResult.path);
        if (!processResult.success) {
            throw new Error(processResult.message || "Gagal memproses file di server.");
        }

        // --- SIMPAN SUMMARY KE CACHE ---
        if (processResult.summary && registrationId) {
            const cachedSummaryKey = `summary_${registrationId}`;
            localStorage.setItem(cachedSummaryKey, JSON.stringify(processResult.summary));
        }

        setSummary(processResult.summary);
        setUploadState('success');
        setErrorMessage(null);
        const toastId = toast.loading("Memulai proses...");

        try {
            toast.loading("Menyiapkan koneksi aman...", { id: toastId });
            const urlResult = await requestUploadUrlAction(registrationId, fileToUpload.name, fileToUpload.type);
            if (!urlResult.success || !urlResult.signedUrl || !urlResult.path) {
                throw new Error(urlResult.message || "Gagal mendapatkan URL upload dari server.");
            }

            toast.loading("Mengunggah file ke cloud storage...", { id: toastId });
            const uploadResponse = await fetch(urlResult.signedUrl, { method: 'PUT', body: fileToUpload });
            if (!uploadResponse.ok) throw new Error("Gagal mengunggah file ke storage.");

            toast.loading("Mengekstrak data dan foto dari file Excel...", { id: toastId });
            const processResult = await processExcelAction(registrationId, urlResult.path);
            if (!processResult.success) {
                throw new Error(processResult.message || "Gagal memproses file di server.");
            }

            if (processResult.summary) {
                const cachedSummaryKey = `summary_${registrationId}`;
                localStorage.setItem(cachedSummaryKey, JSON.stringify(processResult.summary));
            }
            
            setSummary(processResult.summary);
            setUploadState('success');
            toast.success("File berhasil diproses! Silakan verifikasi data di bawah.", { id: toastId, duration: 5000 });

        } catch (error: unknown) {
            setUploadState('error');
            const message = error instanceof Error ? error.message : "Terjadi kesalahan yang tidak diketahui.";
            setErrorMessage(message);
            toast.error(message, { id: toastId, duration: 8000 });
        }
    };
    
    const handleContinue = () => {
        router.push('/pendaftaran/3-pilih-tenda');
    };
    
    const resetState = () => {
        if (registrationId) {
            localStorage.removeItem(`summary_${registrationId}`);
        }
        setFileToUpload(null);
        setUploadState('idle');
        setSummary(null);
        setErrorMessage(null);
    };

    if (isLoadingInitialData) {
        return (
            <div className="flex justify-center items-center h-[calc(100vh-200px)]">
                <Loader2 className="h-10 w-10 animate-spin text-red-600" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="text-center">
                <h1 className="text-3xl font-bold mb-2">Langkah 2: Upload Data Peserta</h1>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                    Seret atau pilih file Excel sesuai template yang telah disediakan.
                    <a href={excelTemplate} className="text-red-600 hover:underline font-semibold ml-1" download>Unduh template.</a>
                </p> 
            </div>
            
            <AnimatePresence mode="wait">
                {uploadState === 'idle' && (
                    <motion.div key="idle" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                        <Card className="max-w-3xl mx-auto p-4 bg-white dark:bg-neutral-900">
                            <FileUpload onChange={handleFileChange} />
                            {fileToUpload && (
                                <div className="flex justify-center mt-6">
                                    <Button onClick={handleProcess} className="bg-red-600 hover:bg-red-700 font-semibold px-8 py-6 text-base">
                                        Proses File Ini
                                    </Button>
                                </div>
                            )}
                        </Card>
                    </motion.div>
                )}

                {uploadState === 'processing' && (
                    <motion.div key="progress" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                        <Card className="max-w-md mx-auto text-center p-8">
                            <Loader2 className="h-12 w-12 mx-auto animate-spin text-red-600" />
                            <h2 className="text-xl font-semibold mt-4">Sedang Memproses File Anda</h2>
                            <p className="text-muted-foreground mt-2">Ini mungkin memakan waktu beberapa saat, terutama jika ada banyak foto. Harap jangan tutup halaman ini.</p>
                        </Card>
                    </motion.div>
                )}
                
                {uploadState === 'success' && summary && (
                    <motion.div key="result-success" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                        <SuccessComponent summary={summary} onReset={resetState} onContinue={handleContinue} />
                    </motion.div>
                )}
                 
                {uploadState === 'error' && (
                    <motion.div key="result-error" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                        <ErrorComponent message={errorMessage} onReset={resetState} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

const SuccessComponent = ({ summary, onReset, onContinue }: { summary: Summary, onReset: () => void, onContinue: () => void }) => {
   return (
     <div className="space-y-8">
        <Card>
            <CardHeader>
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                    <CardTitle className="flex items-center gap-2"><CheckCircle className="text-green-500" />File Berhasil Diproses</CardTitle>
                    <Button variant="outline" onClick={onReset}>Upload File Baru</Button>
                </div>
                <CardDescription className="pt-2">Silakan periksa data di bawah ini untuk memastikan semuanya sudah benar sebelum melanjutkan.</CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="peserta" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="peserta">Peserta ({summary.pesertaCount})</TabsTrigger>
                        <TabsTrigger value="pendamping">Pendamping ({summary.pendampingCount})</TabsTrigger>
                    </TabsList>
                    <TabsContent value="peserta">
                        <DataTable data={summary.previewPeserta} type="peserta" />
                    </TabsContent>
                    <TabsContent value="pendamping">
                        <DataTable data={summary.previewPendamping} type="pendamping" />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
        <div className="flex justify-center">
            <Button size="lg" className="bg-red-600 hover:bg-red-700" onClick={onContinue}>
                Data Sudah Benar, Lanjutkan ke Pilih Tenda
            </Button>
        </div>
    </div>
    );
};

const ErrorComponent = ({ message, onReset }: { message: string | null, onReset: () => void }) => (
    <Card className="max-w-2xl mx-auto border-red-500 bg-red-50 text-center">
        <CardHeader><CardTitle className="text-red-700 flex items-center justify-center gap-2"><XCircle />Terjadi Kesalahan</CardTitle></CardHeader>
        <CardContent>
            <p className="text-red-800 font-medium mb-4">{message || "Terjadi kesalahan yang tidak diketahui. Periksa kembali file Excel Anda atau coba lagi nanti."}</p>
            <Button variant="destructive" onClick={onReset}>Coba Lagi</Button>
        </CardContent>
    </Card>
);

const DataTable = ({ data, type }: { data: DataTableRow[], type: 'peserta' | 'pendamping' }) => {
    if (!data || data.length === 0) {
        return (
            <div className="text-center p-12 border rounded-lg mt-4 bg-gray-50">
                <p className="text-muted-foreground">Tidak ada data {type} yang ditemukan di file Excel.</p>
            </div>
        );
    }
    
  return (
        <div className="mt-4">
            <div className="hidden md:block border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px] text-center">No.</TableHead>
                            {type === 'peserta' && <TableHead className="w-[60px]">Foto</TableHead>}
                            <TableHead>Nama Lengkap</TableHead>
                            <TableHead>Info Kelahiran</TableHead>
                            <TableHead>No. HP</TableHead>
                            <TableHead className="text-center w-[100px]">Detail</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.map((item) => <DataTableRowComponent key={item.rowNumber} item={item} type={type} />)}
                    </TableBody>
                </Table>
            </div>
            <div className="md:hidden space-y-4">
                {data.map((item) => <DataCardComponent key={item.rowNumber} item={item} type={type} />)}
            </div>
        </div>
    );
};

const DataTableRowComponent = ({ item, type }: { item: DataTableRow, type: 'peserta' | 'pendamping' }) => (
    <TableRow>
        <TableCell className="text-center font-medium">{item.rowNumber}</TableCell>
        {type === 'peserta' && (
            <TableCell>
                {/* `isParticipant` memastikan `item` memiliki `photoPath` */}
                {isParticipant(item) && (
                    <Image src={getPublicUrlFromPath(item.photoPath)} alt={item.fullName} width={40} height={40} className="rounded-full object-cover aspect-square" />
                )}
            </TableCell>
        )}
        <TableCell className="font-semibold">{item.fullName}</TableCell>
        <TableCell className="text-sm">{item.birthInfo}</TableCell>
        {/* Menggunakan `item.phone` yang ada di kedua tipe preview */}
        <TableCell className="text-sm">{item.phone || '-'}</TableCell>
        <TableCell className="text-center">
            <Dialog>
                <DialogTrigger asChild>
                    <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader><DialogTitle>{item.fullName}</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        {type === 'peserta' && isParticipant(item) && (
                            <div className="relative mx-auto w-32 h-32 mb-4">
                                <Image src={getPublicUrlFromPath(item.photoPath)} alt={item.fullName} fill className="rounded-full object-cover" />
                            </div>
                        )}
                        <DetailRow label="Alamat" value={item.address} />
                        <DetailRow label="Gender" value={item.gender} />
                        <DetailRow label="Gol. Darah" value={item.bloodType} />
                        <DetailRow label="Agama" value={item.religion} />
                        <DetailRow label="Tahun Masuk" value={item.entryYear} />
                    </div>
                </DialogContent>
            </Dialog>
        </TableCell>
    </TableRow>
);

const DataCardComponent = ({ item, type }: { item: DataTableRow, type: 'peserta' | 'pendamping' }) => (
    <Card className="overflow-hidden">
        <CardContent className="p-4">
            <div className="flex gap-4 items-center">
                {type === 'peserta' && isParticipant(item) && (
                    <Image src={getPublicUrlFromPath(item.photoPath)} alt={item.fullName} width={60} height={60} className="rounded-lg object-cover aspect-square" />
                )}
                <div className="flex-1">
                    <p className="font-bold text-base">{item.rowNumber}. {item.fullName}</p>
                    <p className="text-sm text-muted-foreground">{item.birthInfo}</p>
                </div>
            </div>
            <Collapsible className="mt-4">
                <CollapsibleContent className="space-y-2 text-sm CollapsibleContent">
                    <DetailRow label="Alamat" value={item.address} />
                    <DetailRow label="No. HP" value={item.phone || '-'} />
                    <DetailRow label="Gender" value={item.gender} />
                    <DetailRow label="Gol. Darah" value={item.bloodType} />
                    <DetailRow label="Agama" value={item.religion} />
                    <DetailRow label="Tahun Masuk" value={item.entryYear} />
                </CollapsibleContent>
                <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full mt-2 text-red-600 hover:text-red-700 data-[state=open]:bg-red-50">
                        Lihat Detail
                        <ChevronDown className="h-4 w-4 ml-2 transition-transform duration-200 CollapsibleChevron" />
                    </Button>
                </CollapsibleTrigger>
            </Collapsible>
        </CardContent>
    </Card>
);

const DetailRow = ({ label, value }: { label: string; value: string | number | null }) => {
    if (value === null || value === undefined) return null;
    return (
        <div className="flex justify-between border-t pt-2">
            <p className="text-muted-foreground">{label}:</p>
            <p className="font-medium text-right break-all">{String(value)}</p>
        </div>
    );
};