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

type TentOrderItem = {
  tentTypeId: number;
  quantity: number;
};

export default function PilihTendaPage() {
    const router = useRouter();
    const [registrationId, setRegistrationId] = useState<string | null>(null);
    const [tentTypes, setTentTypes] = useState<TentType[]>([]);
    const [order, setOrder] = useState<TentOrderItem[]>([]);
    const [isLoading, setIsLoading] = useState(true); // Mulai dengan true
    const [totalParticipants, setTotalParticipants] = useState(0);
    const isInitialMount = useRef(true);
    const debouncedOrder = useDebounce(order, 750);


     const fetchInitialData = useCallback(async (regId: string) => {
        // Jangan set isLoading di sini agar tidak memicu spinner saat re-fetch
        try {
            const [tentsRes, totalResult] = await Promise.all([
                fetch('/api/tents'),
                getTotalParticipantsAction(regId)
            ]);

            if (!tentsRes.ok) throw new Error('Gagal memuat data tenda.');
            const tentsData: TentType[] = await tentsRes.json();
            setTentTypes(tentsData);
            
            if (isInitialMount.current) { // Hanya set order dari cache saat pertama kali
                const cachedOrder = localStorage.getItem(`tent_order_${regId}`);
                if (cachedOrder) {
                    setOrder(JSON.parse(cachedOrder));
                } else {
                    setOrder(tentsData.map(t => ({ tentTypeId: t.id, quantity: 0 })));
                }
            }
            
            if (!totalResult.success) throw new Error(totalResult.message);
            setTotalParticipants(totalResult.total);

        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Terjadi kesalahan saat memuat data.";
            toast.error(message);
        } finally {
            if (isLoading) setIsLoading(false);
        }
    }, [isLoading]); // Tambahkan isLoading agar bisa mengubahnya di finally

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

    // ====================================================================
    // === TAMBAHKAN KEMBALI FUNGSI INI ===
    // ====================================================================
    const updateReservation = useCallback(async (currentOrder: TentOrderItem[], regId: string | null) => {
        if (!regId) return;

        localStorage.setItem(`tent_order_${regId}`, JSON.stringify(currentOrder));
        
        // Non-blocking, kita tidak set isUpdating lagi
        const result = await reserveTentsAction(regId, currentOrder);
        
        if (!result.success) {
            toast.error(result.message, { duration: 5000 });
            // Jika gagal, pulihkan state UI dengan data valid dari server
            if (result.message.includes("Stok") || result.message.includes("Kapasitas")) {
                await fetchInitialData(regId);
            }
        }
    }, [fetchInitialData]);
    // ====================================================================

    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        if (registrationId) {
            // Toast loading bisa ditambahkan di sini agar tidak duplikat dengan sukses
            const toastId = toast.loading("Menyimpan pilihan...");
            updateReservation(debouncedOrder, registrationId).then(() => {
                toast.dismiss(toastId); // Tutup toast setelah selesai
            });
        }
    }, [debouncedOrder, registrationId, updateReservation]);

    // Fungsi handleQuantityChange (instan di UI)
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
        console.log("--- [useMemo] Dihitung ulang ---"); 
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

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-[calc(100vh-200px)]">
                <Loader2 className="h-10 w-10 animate-spin text-red-600" />
            </div>
        );
    }

    return (
        <Card>
            <CardHeader className="text-center">
                <CardTitle className="text-3xl">Langkah 3: Pilih Akomodasi Tenda</CardTitle>
                <CardDescription>Pilih tenda yang disediakan panitia atau bawa sendiri. Stok terbatas.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-4">
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
                            console.log(`[RENDER] Merender Tenda ID: ${tent.id}, Kuantitas dari state 'order': ${order.find(o => o.tentTypeId === tent.id)?.quantity || 0}`)
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