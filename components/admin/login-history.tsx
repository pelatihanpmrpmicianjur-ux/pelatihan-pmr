// File: components/admin/login-history.tsx
'use client';
import { useEffect, useState } from "react";
import { getLoginHistory } from "@/app/admin/dashboard/page"; // Impor server action
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area"; // npx shadcn-ui@latest add scroll-area
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";

type LoginHistoryItem = Awaited<ReturnType<typeof getLoginHistory>>[0];

export function LoginHistory() {
    const [history, setHistory] = useState<LoginHistoryItem[]>([]);

    useEffect(() => {
        getLoginHistory().then(setHistory);
    }, []);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Riwayat Login Admin Terbaru</CardTitle>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-72">
                    <div className="space-y-4">
                        {history.map(item => (
                            <div key={item.id} className="flex items-center">
                                <div className="ml-4 space-y-1">
                                    <p className="text-sm font-medium leading-none">
                                        <span className="font-bold">{item.adminUser.username}</span> 
                                        {item.status === 'SUCCESS' ? " berhasil login" : " gagal login"}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true, locale: id })} dari IP {item.ipAddress}
                                    </p>
                                </div>
                                <div className="ml-auto font-medium">
                                    <Badge variant={item.status === 'SUCCESS' ? 'default' : 'destructive'}>
                                        {item.status}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                        {history.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-10">
                                Belum ada riwayat login yang tercatat.
                            </p>
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}