// File: app/api/admin/registrations/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
    // 1. Lindungi endpoint dengan memeriksa sesi admin
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as any)?.id) {
        return NextResponse.json({ message: 'Akses Ditolak' }, { status: 401 });
    }

    try {
        // 2. Ambil semua data pendaftaran dari database
        const registrations = await prisma.registration.findMany({
            // Urutkan berdasarkan yang terbaru dulu
            orderBy: {
                createdAt: 'desc',
            },
            // Pilih hanya kolom yang dibutuhkan oleh tabel dashboard
            select: {
                id: true,
                createdAt: true,
                status: true,
                schoolName: true,
                coachName: true, // Meskipun tidak ditampilkan, baik untuk ada
                grandTotal: true,
                customOrderId: true,
            }
        });

        // 3. Kembalikan data sebagai JSON dengan status 200 OK
        return NextResponse.json(registrations, { status: 200 });

    } catch (error) {
        // 4. Tangani error jika query database gagal
        console.error("Error saat mengambil data pendaftaran untuk admin:", error);
        return NextResponse.json({ message: 'Gagal memuat data pendaftaran dari server' }, { status: 500 });
    }
}