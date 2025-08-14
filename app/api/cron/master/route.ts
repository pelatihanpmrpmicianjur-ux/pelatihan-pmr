// File: app/api/cron/master/route.ts
import { NextResponse } from 'next/server';
import { cleanupExpiredReservations, cleanupStaleDrafts } from '@/lib/cron-jobs';

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401 });
    }

    console.log("[CRON_MASTER] Dijalankan...");
    
    try {
        const results = {
            reservationsReleased: 0,
            draftsCleaned: 0,
        };

        // --- TUGAS 1: Selalu jalankan pembersihan reservasi ---
        results.reservationsReleased = await cleanupExpiredReservations();

        // --- TUGAS 2: Jalankan pembersihan draf hanya pada waktu tertentu ---
        // Cek apakah menit saat ini antara 0-4. Ini akan berjalan sekali per jam
        // pada panggilan pertama setelah jam baru.
        const currentMinute = new Date().getUTCMinutes();
        if (currentMinute >= 0 && currentMinute < 5) {
            console.log("[CRON_MASTER] Waktunya menjalankan pembersihan draf...");
            const ONE_HOUR_IN_MS = 60 * 60 * 1000;
            results.draftsCleaned = await cleanupStaleDrafts(ONE_HOUR_IN_MS);
        }
        
        console.log("[CRON_MASTER] Selesai.", results);
        return NextResponse.json({ success: true, results });

    } catch (error) {
        console.error('[CRON_MASTER_ERROR]', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}