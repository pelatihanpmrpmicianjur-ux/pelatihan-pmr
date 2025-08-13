// File: app/pendaftaran/3-pilih-tenda/page.tsx
'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useDebounce } from '@/hooks/use-debounce';
import { type TentType } from '@prisma/client';
import { AlertCircle, Tent, Users } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { reserveTentsAction, getTotalParticipantsAction, getSummaryAction } from '@/actions/registration';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

type TentOrderItem = {
  tentTypeId: number;
  quantity: number;
};

// ====================================================================
// === PERBAIKAN: DEFINISI TIPE YANG EKSPLISIT DAN BENAR ===
// ====================================================================
type SummaryDataFromAction = {
    schoolInfo: any;
    costSummary: any;
    participantSummary: { count: number; preview: string[] };
    companionSummary: { count: number; preview: string[] };
    // Definisikan bentuk `tentReservations` secara eksplisit
    tentReservations: {
        registrationId: string;
        tentTypeId: number;
        quantity: number;
    }[];
};

type SummaryResult = {
    success: boolean;
    data?: SummaryDataFromAction;
    message: string;
};
// ====================================================================


// Komponen skeleton khusus untuk kartu tenda, agar kode utama lebih bersih
const TentCardSkeleton = () => (
    <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 w-full sm:w-auto">
                <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
                <div className="space-y-2 w-full">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-32" />
                </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                <Skeleton className="h-10 w-10 rounded-md" />
                <Skeleton className="h-8 w-10" />
                <Skeleton className="h-10 w-10 rounded-md" />
            </div>
        </CardContent>
    </Card>
);


export default function PilihTendaPage() {
    const router = useRouter();
    const [registrationId, setRegistrationId] = useState<string | null>(null);
    const [tentTypes, setTentTypes] = useState<TentType[]>([]);
    const [order, setOrder] = useState<TentOrderItem[]>([]);
    const [totalParticipants, setTotalParticipants] = useState(0);
    const [isLoadingInitialData, setIsLoadingInitialData] = useState(true);
    const [isReservationSaving, setIsReservationSaving] = useState(false);
    const isInitialMount = useRef(true);
    const debouncedOrder = useDebounce(order, 750);
    
    const fetchInitialData = useCallback(async (regId: string) => {
        setIsLoadingInitialData(true);
        try {
            const [tentsRes, totalResult, summaryResult] = await Promise.all([
                fetch('/api/tents'),
                getTotalParticipantsAction(regId),
                getSummaryAction(regId) as Promise<SummaryResult> // Beri tahu TypeScript tentang tipe hasil
            ]);

            if (!tentsRes.ok) throw new Error('Gagal memuat data tenda.');
            const tentsData: TentType[] = await tentsRes.json();
            setTentTypes(tentsData);

            if (!totalResult.success) throw new Error(totalResult.message);
            setTotalParticipants(totalResult.total);

            if (summaryResult.success && summaryResult.data) {
                const summaryData = summaryResult.data;
                const savedReservations = summaryData.tentReservations || [];

                const savedOrder = tentsData.map(tent => {
                    const savedItem = savedReservations.find(item => item.tentTypeId === tent.id);
                    return {
                        tentTypeId: tent.id,
                        quantity: savedItem?.quantity || 0,
                    };
                });
                setOrder(savedOrder);
            } else {
                setOrder(tentsData.map(t => ({ tentTypeId: t.id, quantity: 0 })));
            }

        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Terjadi kesalahan saat memuat data.";
            toast.error(message);
        } finally {
            setIsLoadingInitialData(false);
        }
    }, []);

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
  
    const updateReservation = useCallback(async (currentOrder: TentOrderItem[], regId: string | null) => {
        if (!regId) return;
        
        setIsReservationSaving(true);
        localStorage.setItem(`tent_order_${regId}`, JSON.stringify(currentOrder));

        const result = await reserveTentsAction(regId, currentOrder);
        
        setIsReservationSaving(false);

        if (!result.success) {
            toast.error(result.message, { duration: 5000 });
            await fetchInitialData(regId);
        }
    }, [fetchInitialData]);

    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        if (registrationId) {
            updateReservation(debouncedOrder, registrationId);
        }
    }, [debouncedOrder, registrationId, updateReservation]);

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
                        
                        {isLoadingInitialData ? (
                            <>
                                <TentCardSkeleton />
                                <TentCardSkeleton />
                                <TentCardSkeleton />
                            </>
                        ) : (
                            tentTypes.map(tent => {
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
                            })
                        )}

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
                                <CardHeader><CardTitle>Informasi Pendaftar</CardTitle></CardHeader>
                                <CardContent className="space-y-2">
                                    {isLoadingInitialData ? (
                                        <div className="space-y-2">
                                            <Skeleton className="h-5 w-full" />
                                            <Skeleton className="h-5 w-3/4" />
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex justify-between text-sm"><span>Total Orang:</span> <span className="font-bold">{totalParticipants} orang</span></div>
                                            <div className="flex justify-between text-sm"><span>Kapasitas Sewa Maks:</span> <span className="font-bold">{maxCapacityAllowed} orang</span></div>
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                            <Card className="bg-slate-50">
                                <CardHeader><CardTitle>Ringkasan Pesanan Tenda</CardTitle></CardHeader>
                                <CardContent>
                                    {isLoadingInitialData ? (
                                        <div className="space-y-2">
                                            <Skeleton className="h-5 w-full" />
                                            <div className="border-t pt-4 mt-4">
                                                <Skeleton className="h-7 w-1/2 ml-auto" />
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex justify-between text-sm"><span>Kapasitas Terpilih:</span> <span className={`font-bold ${isCapacityExceeded ? 'text-red-500' : ''}`}>{totalCapacitySelected} orang</span></div>
                                            <div className="flex justify-between mt-4 pt-4 border-t">
                                                <span className="text-lg">Total Biaya:</span>
                                                <span className="text-lg font-bold text-red-600">Rp {totalCost.toLocaleString('id-ID')}</span>
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                            <Button size="lg" className="w-full bg-red-600 hover:bg-red-700" onClick={() => router.push('/pendaftaran/4-ringkasan')} disabled={isCapacityExceeded || isLoadingInitialData || isReservationSaving}>
                                {isReservationSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</> : "Lanjut ke Ringkasan"}
                            </Button>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}