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
import { getTotalParticipantsAction, reserveTentsAction, getSummaryAction } from '@/actions/registration';

type TentOrderItem = {
  tentTypeId: number;
  quantity: number;
};

export default function PilihTendaPage() {
    const router = useRouter();
    const [registrationId, setRegistrationId] = useState<string | null>(null);
    const [tentTypes, setTentTypes] = useState<TentType[]>([]);
    const [order, setOrder] = useState<TentOrderItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [totalParticipants, setTotalParticipants] = useState(0);
    const isInitialMount = useRef(true); // Flag untuk render pertama kali
    const debouncedOrder = useDebounce(order, 750); // Debounce untuk server action

    // --- Fungsi untuk memuat data awal (hanya memuat esensi) ---
    const fetchInitialData = useCallback(async (regId: string) => {
        setIsLoading(true);
        try {
            // Ambil hanya data tenda dan jumlah peserta total (sangat ringan)
            const [tentsRes, totalResult] = await Promise.all([
                fetch('/api/tents'), // API Route umum untuk data publik tenda
                getTotalParticipantsAction(regId) // Server Action khusus yang super cepat
            ]);

            if (!tentsRes.ok) throw new Error('Gagal memuat data tenda dari server.');
            const tentsData: TentType[] = await tentsRes.json();
            
            if (tentsData.length === 0) {
                throw new Error("Tipe tenda tidak tersedia. Silakan hubungi panitia.");
            }
            if (!totalResult.success) {
                throw new Error(totalResult.message);
            }
            
            setTentTypes(tentsData);
            setTotalParticipants(totalResult.total);
            
            // Inisialisasi order, prioritaskan dari Server (jika ada reservasi yang sedang berjalan)
            const initialServerOrderResult = await reserveTentsAction(regId, []); // Panggil action dengan payload kosong untuk ambil order yang ada
            if (initialServerOrderResult.success && initialServerOrderResult.data?.updatedOrder) {
                const initialOrder = tentsData.map(tent => {
                    const existingReservation = initialServerOrderResult.data!.updatedOrder.find(
                        (res: TentOrderItem) => res.tentTypeId === tent.id
                    );
                    return { tentTypeId: tent.id, quantity: existingReservation?.quantity || 0 };
                });
                setOrder(initialOrder);
                localStorage.setItem(`tent_order_${regId}`, JSON.stringify(initialOrder)); // Cache di lokal juga
            } else {
                // Jika tidak ada reservasi di server, coba dari localStorage, atau default 0
                const cachedOrder = localStorage.getItem(`tent_order_${regId}`);
                if (cachedOrder) {
                    setOrder(JSON.parse(cachedOrder));
                } else {
                    setOrder(tentsData.map(t => ({ tentTypeId: t.id, quantity: 0 })));
                }
            }

        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Terjadi kesalahan saat memuat data.";
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Effect untuk memicu pengambilan data awal
    useEffect(() => {
        const id = localStorage.getItem('registrationId');
        if (!id) {
            toast.error("Sesi tidak ditemukan. Harap mulai dari Langkah 1.");
            router.push('/pendaftaran/1-data-sekolah');
            return;
        }
        setRegistrationId(id);
        fetchInitialData(id);
    }, [router, fetchInitialData]);
  
    // --- Fungsi untuk memperbarui reservasi di server (Optimistic UI) ---
    const updateReservation = useCallback(async (currentOrder: TentOrderItem[], regId: string | null) => {
        if (!regId) return;

        localStorage.setItem(`tent_order_${regId}`, JSON.stringify(currentOrder)); // Update cache lokal
        
        const result = await reserveTentsAction(regId, currentOrder);

        if (!result.success) {
            toast.error(result.message, { duration: 5000 });
            // Jika gagal karena stok/kapasitas, paksa refresh data tenda dari server
            if (result.message.includes("Stok") || result.message.includes("Kapasitas")) {
                await fetchInitialData(regId); // Panggil ulang untuk mendapatkan stok/order yang benar
            }
        }
        // Tidak ada toast sukses di sini karena interaksi sudah terasa instan
    }, [fetchInitialData]);

    // Effect untuk memicu updateReservation setelah debounce
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        if (registrationId && !isLoading) { // Pastikan halaman sudah dimuat sepenuhnya
            updateReservation(debouncedOrder, registrationId);
        }
    }, [debouncedOrder, registrationId, updateReservation, isLoading]);

    // Fungsi untuk mengubah kuantitas (instan di UI)
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
  
    // useMemo untuk kalkulasi biaya dan kapasitas
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
        return { totalCapacitySelected: totalCap, maxCapacityAllowed: maxCap, totalCost: cost, isCapacityExceeded: totalCap > maxCap && maxCap > 0 };
    }, [order, tentTypes, totalParticipants]);

    // Tampilan Loading Awal
    if (isLoading) {
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
                                    <p className="text-sm font-semibold text-red-800">Total Rombongan Anda:</p>
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
                                <Card key={tent.id} className="transition-all hover:shadow-md">
                                    <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                                        <div className="flex items-center gap-4 w-full sm:w-auto">
                                            <Tent className="h-10 w-10 text-red-500 flex-shrink-0" />
                                            <div>
                                                <h3 className="font-bold">Tenda Kapasitas {tent.capacity} Orang</h3>
                                                <p className="text-sm text-green-600 font-semibold">Rp {tent.price.toLocaleString('id-ID')}</p>
                                                <p className={`text-sm ${tent.stockAvailable < 5 ? 'text-red-500' : 'text-muted-foreground'}`}>Stok Tersisa: {tent.stockAvailable}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <Button size="icon" variant="outline" onClick={() => handleQuantityChange(tent.id, -1)} disabled={currentQuantity === 0}>-</Button>
                                            <span className="w-10 text-center font-bold text-lg">{currentQuantity}</span>
                                            <Button size="icon" variant="outline" onClick={() => handleQuantityChange(tent.id, 1)} disabled={isPlusDisabled}>+</Button>
                                        </div>
                                    </CardContent>
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
                                        Informasi Rombongan
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