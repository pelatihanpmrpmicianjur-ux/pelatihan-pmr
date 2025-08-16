// File: app/pendaftaran/5-pembayaran/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { submitRegistrationAction, getReceiptUrlAction, getSummaryAction } from '@/actions/registration';
import { Loader2, CheckCircle, Download, Landmark, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Label } from '@/components/ui/label';

export default function PembayaranPage() {
    const router = useRouter();
    const [registrationId, setRegistrationId] = useState<string | null>(null);
    const [grandTotal, setGrandTotal] = useState<number | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [orderId, setOrderId] = useState('');
    const [finalRegistrationId, setFinalRegistrationId] = useState('');

    const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
    const [isCheckingReceipt, setIsCheckingReceipt] = useState(true);

    useEffect(() => {
        const id = localStorage.getItem('registrationId');
        if (!id) {
            toast.error("Sesi tidak ditemukan. Harap mulai dari Langkah 1.");
            router.push('/pendaftaran/1-data-sekolah');
            return;
        }
        setRegistrationId(id);

        // ====================================================================
        // === OPTIMASI UTAMA: BACA DARI LOCALSTORAGE DULU ===
        // ====================================================================
        const cachedTotal = localStorage.getItem(`payment_total_${id}`);

        if (cachedTotal) {
            // Jika ada di cache, gunakan itu. Parsing ke angka.
            console.log("Mengambil grandTotal dari cache localStorage.");
            setGrandTotal(parseInt(cachedTotal, 10));
        } else {
            // Jika TIDAK ada (misalnya, pengguna refresh), baru panggil API sebagai fallback
            console.warn("grandTotal tidak ditemukan di cache, mengambil dari server...");
            async function fetchTotal(regId: string) {
                try {
                    const result = await getSummaryAction(regId);
                    if (result.success && result.data) {
                        setGrandTotal(result.data.costSummary.grandTotal);
                    } else {
                        throw new Error(result.message || "Gagal memuat total biaya.");
                    }
                } catch (error: unknown) {
                    const message = error instanceof Error ? error.message : "Terjadi kesalahan";
                    toast.error(message);
                    // Arahkan kembali ke ringkasan jika fetch gagal
                    router.push('/pendaftaran/4-ringkasan'); 
                }
            }
            fetchTotal(id);
        }
        // ====================================================================

    }, [router]);

    useEffect(() => {
        if (!isSuccess || !finalRegistrationId) return;

        let attempts = 0;
        const maxAttempts = 12; // Cek selama 60 detik (12 * 5 detik)
        const interval = setInterval(async () => {
            attempts++;
            try {
                const result = await getReceiptUrlAction(finalRegistrationId);
                if (result.status === 'ready' && result.downloadUrl) {
                    setReceiptUrl(result.downloadUrl);
                    setIsCheckingReceipt(false);
                    clearInterval(interval);
                } else if (result.status !== 'processing' || attempts >= maxAttempts) {
                    console.error("Gagal mendapatkan kwitansi atau waktu tunggu habis:", result.message);
                    setIsCheckingReceipt(false);
                    clearInterval(interval);
                }
            } catch (error) {
                console.error("Polling error:", error);
                setIsCheckingReceipt(false);
                clearInterval(interval);
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [isSuccess, finalRegistrationId]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            const MAX_SIZE_MB = 5;
            if (selectedFile.size > MAX_SIZE_MB * 1024 * 1024) {
                toast.error(`Ukuran file bukti pembayaran tidak boleh melebihi ${MAX_SIZE_MB}MB.`);
                e.target.value = '';
                setFile(null);
                return;
            }
            setFile(selectedFile);
        }
    };
    
    const handleSubmit = async () => {
        if (!file || !registrationId) {
            toast.error("Harap pilih file bukti pembayaran atau sesi tidak valid.");
            return;
        }
        setIsLoading(true);
        const toastId = toast.loading("Mengirim pendaftaran...");

        try {
            const formData = new FormData();
            formData.append('paymentProof', file);

            const data = await submitRegistrationAction(registrationId, formData);
            
            if (!data.success) {
                throw new Error(data.message);
            }
            
            setOrderId(data.orderId || '');
            setFinalRegistrationId(registrationId);
            setIsSuccess(true);
            toast.success("Pendaftaran Anda telah berhasil dikirim!", { id: toastId });
            
            // Pembersihan semua item localStorage terkait sesi pendaftaran ini
            localStorage.removeItem('registrationId');
            localStorage.removeItem(`summary_${registrationId}`);
            localStorage.removeItem(`tent_order_${registrationId}`);
            localStorage.removeItem(`payment_total_${registrationId}`);

        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Terjadi kesalahan yang tidak terduga.";
            toast.error(message, { id: toastId });
        } finally {
            setIsLoading(false);
        }
    };
    
    if (isSuccess) {
        return (
            <div className="flex justify-center items-center py-16">
                <Card className="w-full max-w-lg text-center">
                    <CardContent className="p-8">
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
                            <CheckCircle className="h-20 w-20 text-green-500 mx-auto" />
                        </motion.div>
                        <h1 className="text-3xl font-bold text-green-600 mt-4">Pendaftaran Berhasil!</h1>
                        <p className="text-muted-foreground mt-2">Terima kasih! Data Anda sedang menunggu verifikasi oleh panitia.</p>
                        <div className="mt-6 p-4 bg-slate-100 rounded-lg">
                            <p className="text-sm">Nomor Pendaftaran Anda:</p>
                            <p className="font-mono font-bold text-lg break-all">{orderId}</p>
                        </div>
                        <div className="mt-6">
                            {isCheckingReceipt && (
                                <Button disabled variant="outline" className="w-full">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Menyiapkan Kwitansi...
                                </Button>
                            )}
                            {receiptUrl && !isCheckingReceipt && (
    // --- PERBAIKAN DI SINI ---
    <a href={receiptUrl} download={`kwitansi-${orderId.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`}>
        <Button className="w-full bg-blue-600 hover:bg-blue-700">
            <Download className="mr-2 h-4 w-4" />
            Unduh Kwitansi
        </Button>
    </a>
)}
                            {!receiptUrl && !isCheckingReceipt && (
                                <p className="text-sm text-red-500">Gagal memuat kwitansi. Silakan hubungi panitia.</p>
                            )}
                        </div>
                        <Button className="mt-4" variant="secondary" onClick={() => router.push('/')}>
                            Kembali ke Halaman Utama
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }
    
    return (
        <Card className="max-w-3xl mx-auto">
            <CardHeader>
                <CardTitle className="text-2xl font-bold">Langkah 5: Pembayaran</CardTitle>
                <CardDescription>Langkah terakhir. Lakukan pembayaran dan unggah buktinya di sini untuk menyelesaikan pendaftaran.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                <div className="p-6 border rounded-lg bg-blue-50/50 border-blue-200 space-y-4">
                    <div>
                        <p className="text-sm font-semibold text-blue-800">Total yang harus dibayar:</p>
                        {grandTotal === null ? (
                            <Skeleton className="h-10 w-48 mt-1" />
                        ) : (
                            <p className="text-4xl font-bold text-blue-700">Rp {grandTotal.toLocaleString('id-ID')},-</p>
                        )}
                    </div>
                    <Separator />
                    <div>
                        <p className="text-sm font-semibold text-blue-800">Silakan transfer ke rekening berikut:</p>
                        <div className="mt-2 space-y-2">
                            <div className="flex items-center gap-3"><Landmark className="h-5 w-5 text-blue-600" /><p><span className="font-bold">Bank XYZ:</span> 1234-5678-9012</p></div>
                            <div className="flex items-center gap-3"><UserCircle className="h-5 w-5 text-blue-600" /><p>a.n. <span className="font-bold">PMI Kabupaten Cianjur</span></p></div>
                        </div>
                    </div>
                </div>
                
                <div className="space-y-2">
                    <Label htmlFor="payment-proof" className="font-semibold text-base">Upload Bukti Pembayaran</Label>
                    <p className="text-sm text-muted-foreground">Format: JPG, PNG, PDF. Maksimal 5MB.</p>
                    <Input id="payment-proof" type="file" onChange={handleFileChange} accept="image/*,.pdf" className="pt-2 h-auto file:text-red-600 file:font-semibold"/>
                </div>
            </CardContent>
            <CardFooter className="flex justify-end bg-slate-50/50 py-4 px-6 rounded-b-lg">
                <Button size="lg" onClick={handleSubmit} disabled={isLoading || !file || grandTotal === null} className="bg-red-600 hover:bg-red-700">
                    {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mengirim...</> : "Kirim Pendaftaran & Selesai"}
                </Button>
            </CardFooter>
        </Card>
    );
}

const Skeleton = ({ className }: { className?: string }) => (
    <div className={cn("animate-pulse rounded-md bg-muted", className)} />
);