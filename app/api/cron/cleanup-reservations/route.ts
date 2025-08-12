// File: app/api/cron/cleanup-reservations/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
    // 1. Ambil authorization header dari request
    const authHeader = request.headers.get('authorization');

    // 2. Verifikasi secret
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401 });
    }

    console.log('[CRON_JOB] Menjalankan pembersihan reservasi tenda yang kedaluwarsa...');

    try {
        // 3. Cari semua reservasi yang sudah lewat dari expiresAt
        const expiredReservations = await prisma.tentReservation.findMany({
            where: { expiresAt: { lt: new Date() } }
        });

        if (expiredReservations.length === 0) {
            console.log('[CRON_JOB] Tidak ada reservasi yang kedaluwarsa untuk dibersihkan.');
            return NextResponse.json({ success: true, message: "Tidak ada reservasi yang perlu dibersihkan." });
        }

        // 4. Loop dan kembalikan stok
        let releasedCount = 0;
        for (const res of expiredReservations) {
            await prisma.$transaction(async (tx) => {
                await tx.tentType.update({
                    where: { id: res.tentTypeId },
                    data: { stockAvailable: { increment: res.quantity } }
                });
                await tx.tentReservation.delete({ where: { id: res.id } });
                releasedCount++;
            });
        }
        
        console.log(`[CRON_JOB] Berhasil melepaskan ${releasedCount} reservasi.`);
        return NextResponse.json({ success: true, released: releasedCount });

    } catch (error) {
        console.error('[CRON_JOB_ERROR] Gagal membersihkan reservasi:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}