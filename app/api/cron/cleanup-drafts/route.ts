// File: app/api/cron/cleanup-drafts/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { slugify } from '@/lib/utils';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401 });
    }

    console.log('[CRON_JOB] Menjalankan pembersihan draf pendaftaran lama...');

    try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        // 1. Cari semua draf yang lebih tua dari 30 hari
        const staleDrafts = await prisma.registration.findMany({
            where: {
                status: 'DRAFT',
                updatedAt: { lt: thirtyDaysAgo }
            },
            select: { id: true, schoolNameNormalized: true }
        });

        if (staleDrafts.length === 0) {
            console.log('[CRON_JOB] Tidak ada draf lama untuk dibersihkan.');
            return NextResponse.json({ success: true, message: "Tidak ada draf lama." });
        }

        // ======================================================
        // === PERBAIKAN UTAMA: HAPUS FOLDER SECARA LANGSUNG ===
        // ======================================================

        // 2. Siapkan semua path folder yang akan dihapus dari Supabase Storage
        const foldersToDelete = staleDrafts.map(draft => {
            const schoolSlug = slugify(draft.schoolNameNormalized);
            return `temp/${schoolSlug}`; // Path ke folder utama draf
        });

        if (foldersToDelete.length > 0) {
            console.log(`[CRON_JOB] Menyiapkan penghapusan folder di storage:`, foldersToDelete);
            
            // Panggil .remove() sekali dengan array semua folder
            const { data, error } = await supabaseAdmin.storage
                .from('registrations')
                .remove(foldersToDelete);

            if (error) {
                // Log error tapi jangan hentikan proses, agar penghapusan DB tetap berjalan
                console.error('[CRON_JOB] Terjadi error saat menghapus folder dari storage:', error.message);
            } else {
                console.log(`[CRON_JOB] Hasil penghapusan dari storage: ${data?.length || 0} item diproses.`);
            }
        }
        
        // ======================================================
        
        // 3. Hapus record dari database
        const { count } = await prisma.registration.deleteMany({
            where: { id: { in: staleDrafts.map(d => d.id) } }
        });
        
        console.log(`[CRON_JOB] Berhasil menghapus ${count} draf lama dari database.`);
        return NextResponse.json({ success: true, deleted: count });
        
    } catch (error) {
        console.error('[CRON_JOB_ERROR] Gagal membersihkan draf:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}