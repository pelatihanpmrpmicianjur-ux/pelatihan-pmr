// File: app/pendaftaran/4-ringkasan/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Loader2, ArrowRight, ArrowLeft, School, Users, Tent } from 'lucide-react';
import { motion } from 'framer-motion';
import { BackgroundGradient } from '@/components/ui/background-gradient'; // Impor dari Aceternity UI
import { getSummaryAction } from '@/actions/registration';

type SummaryData = Awaited<ReturnType<typeof getSummaryAction>>['data'];

const SummaryItem = ({ label, value }: { label: string, value: string | number | null }) => (
    <div className="flex justify-between items-center py-2">
        <p className="text-muted-foreground">{label}</p>
        <p className="font-semibold">{value || '-'}</p>
    </div>
);

const Section = ({ icon: Icon, title, children }: { icon: React.ElementType, title: string, children: React.ReactNode }) => (
    <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
        <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <Icon className="h-5 w-5 text-red-600" />
            </div>
            <h2 className="text-xl font-bold">{title}</h2>
        </div>
        <div className="pl-14 pt-2 space-y-2">{children}</div>
    </motion.div>
);

export default function RingkasanPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const registrationId = localStorage.getItem('registrationId');

    // Guard Clause #1: Hentikan semua jika tidak ada ID
    if (!registrationId) {
      toast.error("Sesi tidak ditemukan. Harap mulai dari Langkah 1.");
      router.push('/pendaftaran/1-data-sekolah');
      return;
    }

    // Fungsi fetch yang hanya akan dipanggil dengan ID yang valid
    async function fetchSummary(regId: string) {
      setIsLoading(true);
      try {
        // Panggilan ini sekarang dijamin aman karena `regId` adalah `string`
        const result = await getSummaryAction(regId);
        if (!result.success || !result.data) {
            throw new Error(result.message);
        }
        setSummary(result.data);
      } catch (error: unknown) {
        if (error instanceof Error) {
            toast.error(error.message);
        } else {
            toast.error("Gagal memuat ringkasan pendaftaran.");
        }
        // Jika gagal, mungkin arahkan pengguna kembali
        router.push('/pendaftaran/3-pilih-tenda');
      } finally {
        setIsLoading(false);
      }
    }
    
    // Panggil fungsi dengan ID yang kita tahu adalah string
    fetchSummary(registrationId);

  }, [router]);

   if (isLoading) return <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>;
  if (!summary) return <div className="p-8 text-center text-red-500">Gagal memuat data. Silakan kembali dan coba lagi.</div>;
  
  const { schoolInfo, costSummary, participantSummary, companionSummary, tentSummary } = summary;
  
  // Varian untuk animasi stagger
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2, // Setiap anak akan muncul dengan jeda 0.2 detik
      },
    },
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center">
            <h1 className="text-3xl font-bold">Langkah 4: Ringkasan Pendaftaran</h1>
            <p className="text-muted-foreground mt-2">Harap periksa kembali semua data. Jika ada yang salah, silakan kembali ke langkah sebelumnya.</p>
        </div>
        
        <Card className="shadow-2xl shadow-slate-200">
            <CardHeader>
                <CardTitle>Invoice Pendaftaran Awal</CardTitle>
                <CardDescription>No. Pesanan Sementara: #{localStorage.getItem('registrationId')?.substring(0, 8)}</CardDescription>
            </CardHeader>
            <CardContent>
                <motion.div
                    className="space-y-6"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <Section icon={School} title="Data Sekolah">
                        <SummaryItem label="Nama Sekolah" value={schoolInfo.schoolName} />
                        <SummaryItem label="Nama Pembina" value={schoolInfo.coachName} />
                        <SummaryItem label="No. WhatsApp" value={schoolInfo.coachPhone} />
                        <SummaryItem label="Kategori" value={schoolInfo.schoolCategory} />
                    </Section>

                    <Separator />
                    
                    <Section icon={Users} title="Rombongan">
                        <SummaryItem label="Jumlah Peserta" value={`${participantSummary.count} orang`} />
                        <SummaryItem label="Jumlah Pendamping" value={`${companionSummary.count} orang`} />
                    </Section>
                    
                    <Separator />

                    <Section icon={Tent} title="Akomodasi Tenda">
                        {tentSummary.length > 0 ? tentSummary.map(t => (
                            <SummaryItem key={t.capacity} label={`Tenda Kap. ${t.capacity} (${t.quantity} unit)`} value={`Rp ${t.subtotal.toLocaleString('id-ID')}`} />
                        )) : <p className="text-muted-foreground">Tidak ada tenda yang disewa.</p>}
                    </Section>
                    
                    <Separator />
                    
                    <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
                        <div className="bg-slate-50 p-6 rounded-lg">
                            <SummaryItem label="Subtotal Peserta & Pendamping" value={`Rp ${(costSummary.peserta + costSummary.pendamping).toLocaleString('id-ID')}`} />
                            <SummaryItem label="Subtotal Tenda" value={`Rp ${costSummary.tenda.toLocaleString('id-ID')}`} />
                            <div className="flex justify-between items-center pt-4 mt-4 border-t">
                                <span className="text-xl font-bold">GRAND TOTAL</span>
                                <span className="text-2xl font-bold text-red-600">Rp {costSummary.grandTotal.toLocaleString('id-ID')}</span>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            </CardContent>
            <CardFooter className="flex justify-between mt-6">
                <Button variant="outline" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Kembali
                </Button>
                <BackgroundGradient className="rounded-md">
                    <Button size="lg" className="bg-red-600 hover:bg-red-700 text-white font-bold w-full" onClick={() => router.push('/pendaftaran/5-pembayaran')}>
                        Lanjutkan ke Pembayaran
                        <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                </BackgroundGradient>
            </CardFooter>
        </Card>
    </div>
  );
}