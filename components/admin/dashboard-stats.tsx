// File: components/admin/dashboard-stats.tsx
'use client';
import { getDashboardStats, Stats } from "@/actions/registration";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { School, DollarSign, RefreshCw } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { Button } from "../ui/button";

type DashboardStatsProps = {
    initialStats: Stats;
    refetchStats: () => Promise<void>; // <-- Terima fungsi refetch
};

export function DashboardStats({ initialStats, refetchStats }: DashboardStatsProps) {
    const [stats, setStats] = useState(initialStats);
    const [isPending, startTransition] = useTransition();

    // Fungsi untuk memuat ulang data hanya untuk statistik ini
    const handleRefresh = () => {
        startTransition(async () => {
            const newStats = await getDashboardStats();
            setStats(newStats);
        });
    };

    // Effect untuk update jika induk meminta refresh
    useEffect(() => {
        setStats(initialStats);
    }, [initialStats]);
    
    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isPending}>
                    <RefreshCw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
                </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Sekolah Terdaftar</CardTitle>
                    <School className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalRegistrations}</div>
                    <p className="text-xs text-muted-foreground">Termasuk yang menunggu konfirmasi</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Pemasukan (Terkonfirmasi)</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">Rp {stats.totalRevenue.toLocaleString('id-ID')}</div>
                    <p className="text-xs text-muted-foreground">Hanya dari pendaftaran yang lunas</p>
                </CardContent>
            </Card>
       </div>
        </div>
    );
}