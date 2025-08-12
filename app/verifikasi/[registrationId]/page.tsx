// File: app/verifikasi/[registrationId]/page.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getVerificationDataAction } from '@/actions/registration';
import { notFound } from 'next/navigation';

// Hapus definisi tipe `VerificationPageProps` sepenuhnya.

const formatDate = (dateString: Date | string) => { // Buat lebih toleran
    return new Date(dateString).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function VerificationPage(props: any) {
    // Akses params dengan aman dari props yang sekarang bertipe 'any'
    const registrationId = props?.params?.registrationId;

    if (!registrationId || typeof registrationId !== 'string') {
        notFound();
    }

    // Panggil Server Action langsung
    const registration = await getVerificationDataAction(registrationId);
    
    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <Card className="w-full max-w-lg shadow-xl">
                <CardHeader className="text-center">
                    <Image src="/logo-pmi.png" alt="Logo PMI" width={80} height={80} className="mx-auto mb-4" />
                    <CardTitle className="text-2xl font-bold">Verifikasi Keaslian Kwitansi</CardTitle>
                    <CardDescription>Pendaftaran PMR Kabupaten Cianjur 2025</CardDescription>
                </CardHeader>
                <CardContent>
                    {registration ? (
                        <div>
                            {registration.status === 'CONFIRMED' ? (
                                <div className="text-center p-6 bg-green-50 border border-green-200 rounded-lg">
                                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                                    <h2 className="text-xl font-bold text-green-800">Dokumen Terverifikasi</h2>
                                    <p className="text-green-700 mt-1">Pendaftaran ini telah dikonfirmasi oleh panitia.</p>
                                </div>
                            ) : (
                                <div className="text-center p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
                                    <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
                                    <h2 className="text-xl font-bold text-yellow-800">Status Menunggu</h2>
                                    <p className="text-yellow-700 mt-1">Pendaftaran ini telah diterima namun masih dalam proses verifikasi.</p>
                                </div>
                            )}

                            <div className="mt-6 space-y-3 text-sm">
                                <div className="flex justify-between"><span className="text-muted-foreground">Nama Sekolah:</span><span className="font-semibold text-right">{registration.schoolNameNormalized}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">No. Pendaftaran:</span><span className="font-mono text-xs text-right">{registration.customOrderId}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Status Terakhir:</span><span className="font-semibold text-right">{registration.status}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Diperbarui pada:</span><span className="font-semibold text-right">{formatDate(registration.updatedAt)}</span></div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center p-6 bg-red-50 border border-red-200 rounded-lg">
                            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                            <h2 className="text-xl font-bold text-red-800">Dokumen Tidak Ditemukan</h2>
                            <p className="text-red-700 mt-1">Pendaftaran dengan ID ini tidak ada di sistem kami. Pastikan QR Code berasal dari sumber yang valid.</p>
                        </div>
                    )}

                    <div className="mt-8 text-center">
                        <Button asChild variant="outline">
                            <Link href="/">Kembali ke Halaman Utama</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}