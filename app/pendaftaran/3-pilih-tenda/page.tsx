// File: app/pendaftaran/3-pilih-tenda/page.tsx
'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useDebounce } from '@/hooks/use-debounce';
import { type TentType } from '@prisma/client';
import { AlertCircle, Tent, Loader2, Users } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getTotalParticipantsAction, reserveTentsAction } from '@/actions/registration';
import Image from 'next/image';

type TentOrderItem = {
  tentTypeId: number;
  quantity: number;
};

export default function PilihTendaPage() {
    const router = useRouter();
    const [registrationId, setRegistrationId] = useState<string | null>(null);
    const [tentTypes, setTentTypes] = useState<TentType[]>([]);
    const [order, setOrder] = useState<TentOrderItem[]>([]);
    const [totalParticipants, setTotalParticipants] = useState(0);
    const [pageState, setPageState] = useState<'initializing' | 'ready' | 'error'>('initializing');
    
    const isInitialMount = useRef(true);
    const debouncedOrder = useDebounce(order, 750);

    // useEffect ini HANYA membaca dari localStorage, membuatnya sangat cepat.
    useEffect(() => {
        const id = localStorage.getItem('registrationId');
        if (!id) {
            toast.error("Sesi tidak ditemukan. Harap kembali ke Langkah 1.");
            router.push('/pendaftaran/1-data-sekolah');
            return;
        }
        setRegistrationId(id);

        try {
            // 1. Baca data yang sudah disiapkan oleh langkah sebelumnya
            const prefetchDataJSON = localStorage.getItem(`next_step_data_${id}`);
            if (!prefetchDataJSON) {
                throw new Error("Data persiapan untuk langkah ini tidak ditemukan.");
            }
            const prefetchData = JSON.parse(prefetchDataJSON);

            // 2. Isi semua state yang dibutuhkan
            setTentTypes(prefetchData.tents || []);
            setTotalParticipants(prefetchData.totalParticipants || 0);
            
            // 3. Inisialisasi order, prioritaskan cache order jika ada
            const cachedOrder = localStorage.getItem(`tent_order_${id}`);
            if (cachedOrder) {
                setOrder(JSON.parse(cachedOrder));
            } else {
                setOrder((prefetchData.tents || []).map((t: TentType) => ({ tentTypeId: t.id, quantity: 0 })));
            }

            // 4. Halaman siap ditampilkan
            setPageState('ready');

        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Gagal memuat data.";
            toast.error(message);
            setPageState('error');
            // Arahkan kembali ke langkah sebelumnya jika data tidak siap
            router.push('/pendaftaran/2-upload-excel');
        }
    }, [router]);
  
    // Fungsi ini mengirim pembaruan ke server di latar belakang
    const updateReservation = useCallback(async (currentOrder: TentOrderItem[], regId: string | null) => {
        if (!regId) return;

        // Simpan state UI terbaru ke localStorage sebagai backup cepat
        localStorage.setItem(`tent_order_${regId}`, JSON.stringify(currentOrder));
        
        // Panggil server action. Tidak ada `setIsUpdating` yang mengunci UI.
        const result = await reserveTentsAction(regId, currentOrder);
        
        if (!result.success) {
            toast.error(result.message, { duration: 5000 });
            
            // Jika gagal karena stok, kita harus memulihkan state dari server.
            // Kita akan memuat ulang halaman untuk cara yang paling sederhana dan andal.
            if (result.message.includes("Stok") || result.message.includes("Kapasitas")) {
                toast.info("Memuat ulang data stok terbaru...");
                router.refresh();
            }
        }
    }, [router]);

    // Effect ini memicu `updateReservation` setelah pengguna berhenti berinteraksi
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        if (registrationId && pageState === 'ready') {
            updateReservation(debouncedOrder, registrationId);
        }
    }, [debouncedOrder, registrationId, pageState, updateReservation]);

    // Fungsi ini mengubah kuantitas secara instan di UI
    const handleQuantityChange = (tentTypeId: number, change: number) => {
        setOrder(currentOrder => 
            currentOrder.map(item => {
                if (item.tentTypeId === tentTypeId) {
                    const newQuantity = item.quantity + change;
                    return { ...item, quantity: Math.max(0, newQuantity) };
                }
                return item;
            })
        );
    };
  
    const { totalCapacitySelected, maxCapacityAllowed, totalCost, isCapacityExceeded } = useMemo(() => {
        const totalCap = order.reduce((acc, item) => {
            const tentType = tentTypes.find(t => t.id === item.tentTypeId);
            return acc + (tentType?.capacity || 0) * item.quantity;
        }, 0);
        const maxCap = totalParticipants > 0 ? totalParticipants + 10 : 0;
        const cost = order.reduce((total, item) => {
            const tentType = tentTypes.find(t => t.id === item.tentTypeId);
            return total + (tentType?.price || 0) * item.quantity;
        }, 0);
        return {
            totalCapacitySelected: totalCap,
            maxCapacityAllowed: maxCap,
            totalCost: cost,
            isCapacityExceeded: totalCap > maxCap && maxCap > 0,
        };
    }, [order, tentTypes, totalParticipants]);

    if (pageState !== 'ready') {
        return (
            <div className="flex justify-center items-center h-[calc(100vh-200px)]">
                <Loader2 className="h-10 w-10 animate-spin text-red-600" />
            </div>
        );
    }

    // Tampilan UI Utama (setelah loading selesai)
    return (
        <Card>
            <CardHeader className="text-center">
                <CardTitle className="text-3xl">Langkah 3: Pilih Akomodasi Tenda</CardTitle>
                <CardDescription>Pilih tenda yang disediakan panitia atau bawa sendiri. Stok terbatas.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-4">
                        <Card className="bg-red-50/20 border-red-200">
                            <CardContent className="p-4 flex items-center gap-4">
                                <Users className="text-red-600 h-8 w-8 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold text-red-800">Total Peserta dan Pendamping Anda:</p>
                                    <p className="font-bold text-lg text-red-900">{totalParticipants} orang</p>
                                    <p className="text-xs text-red-700">Kapasitas sewa tenda maksimum: {maxCapacityAllowed} orang</p>
                                </div>
                            </CardContent>
                        </Card>
                        {isCapacityExceeded && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Kapasitas Berlebih!</AlertTitle>
                                <AlertDescription>
                                    Total kapasitas tenda yang Anda sewa ({totalCapacitySelected}) melebihi batas maksimum yang diizinkan ({maxCapacityAllowed}).
                                </AlertDescription>
                            </Alert>
                        )}
                        {tentTypes.map(tent => {
                            const currentOrderItem = order.find(item => item.tentTypeId === tent.id);
                            const currentQuantity = currentOrderItem?.quantity || 0;
                            const nextTotalCapacity = totalCapacitySelected - (currentQuantity * tent.capacity) + ((currentQuantity + 1) * tent.capacity);
                            const wouldExceedCapacity = nextTotalCapacity > maxCapacityAllowed && maxCapacityAllowed > 0;
                            const isPlusDisabled = currentQuantity >= tent.stockAvailable || wouldExceedCapacity;
                           return (
                                <Card key={tent.id} className="overflow-hidden transition-all hover:shadow-lg">
                                    <div className="grid grid-cols-1 sm:grid-cols-3">
                                        {/* --- KOLOM GAMBAR BARU --- */}
                                        <div className="sm:col-span-1 relative h-40 sm:h-full">
                                            <Image 
                                                 src={tent.imageUrl || '/default-avatar.png'} // Sediakan gambar fallback
                                                alt={`Tenda ${tent.name}`} 
                                                fill // Ganti layout="fill" dengan `fill`
                                                className="object-cover"
                                            />
                                        </div>

                                        {/* --- KOLOM KONTEN --- */}
                                        <div className="sm:col-span-2">
                                            <CardContent className="p-4 flex flex-col justify-between h-full">
                                                <div>
                                                    <h3 className="font-bold text-lg">{tent.name}</h3>
                                                    <p className="text-sm text-muted-foreground">{tent.capacityDisplay}</p>
                                                    <p className="text-lg text-green-600 font-semibold mt-1">Rp {tent.price.toLocaleString('id-ID')}</p>
                                                </div>
                                                <div className="flex items-center justify-between mt-4">
                                                    <p className={`text-sm font-medium ${tent.stockAvailable < 5 ? 'text-red-500' : 'text-muted-foreground'}`}>
                                                        Stok Tersisa: {tent.stockAvailable}
                                                    </p>
                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                        <Button size="icon" variant="outline" onClick={() => handleQuantityChange(tent.id, -1)} disabled={currentQuantity === 0}>-</Button>
                                                        <span className="w-10 text-center font-bold text-lg">{currentQuantity}</span>
                                                        <Button size="icon" variant="outline" onClick={() => handleQuantityChange(tent.id, 1)} disabled={isPlusDisabled}>+</Button>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                        <Card className="bg-slate-50">
                            <CardContent className="p-4">
                                <h3 className="font-bold">Bawa Tenda Sendiri</h3>
                                <p className="text-sm text-muted-foreground">Pilih opsi ini jika Anda tidak menyewa tenda atau membawa sebagian tenda sendiri.</p>
                            </CardContent>
                        </Card>
                    </div>
                    <div className="lg:col-span-1">
                        <div className="sticky top-24 space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Users className="h-4 w-4"/>
                                        Informasi Kontingen
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <div className="flex justify-between text-sm"><span>Total Orang:</span> <span className="font-bold">{totalParticipants} orang</span></div>
                                    <div className="flex justify-between text-sm"><span>Kapasitas Sewa Maks:</span> <span className="font-bold">{maxCapacityAllowed} orang</span></div>
                                </CardContent>
                            </Card>
                            <Card className="bg-slate-50">
                                <CardHeader><CardTitle className="text-base">Ringkasan Pesanan Tenda</CardTitle></CardHeader>
                                <CardContent>
                                    <div className="flex justify-between text-sm"><span>Kapasitas Terpilih:</span> <span className={`font-bold ${isCapacityExceeded ? 'text-red-500' : ''}`}>{totalCapacitySelected} orang</span></div>
                                    <div className="flex justify-between items-baseline mt-4 pt-4 border-t">
                                        <span className="text-lg font-semibold">Total Biaya:</span>
                                        <span className="text-2xl font-bold text-red-600">Rp {totalCost.toLocaleString('id-ID')}</span>
                                    </div>
                                </CardContent>
                            </Card>
                            <Button size="lg" className="w-full bg-red-600 hover:bg-red-700" onClick={() => router.push('/pendaftaran/4-ringkasan')} disabled={isCapacityExceeded}>
                                Lanjut ke Ringkasan
                            </Button>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}