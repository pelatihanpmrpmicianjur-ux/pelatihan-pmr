// File: lib/cron-jobs.ts
import { prisma } from '@/lib/db';
import { slugify } from '@/lib/utils';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * Membersihkan reservasi tenda yang kedaluwarsa.
 * @returns Jumlah reservasi yang dilepaskan.
 */
export async function cleanupExpiredReservations(): Promise<number> {
    const expiredReservations = await prisma.tentReservation.findMany({
        where: { expiresAt: { lt: new Date() } }
    });

    if (expiredReservations.length === 0) {
        return 0;
    }

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
    
    console.log(`[CRON_LOGIC] Berhasil melepaskan ${releasedCount} reservasi tenda.`);
    return releasedCount;
}


/**
 * Membersihkan draf pendaftaran yang terbengkalai.
 * @param timeoutMs - Durasi dalam milidetik (misalnya, 1 jam = 3600000).
 * @returns Jumlah draf yang dihapus.
 */
export async function cleanupStaleDrafts(timeoutMs: number): Promise<number> {
    const cutoffDate = new Date(Date.now() - timeoutMs);
    
    const staleDrafts = await prisma.registration.findMany({
        where: {
            status: 'DRAFT',
            updatedAt: { lt: cutoffDate }
        },
        select: { id: true, schoolNameNormalized: true }
    });

    if (staleDrafts.length === 0) {
        return 0;
    }

    const foldersToDelete = staleDrafts.map(draft => `temp/${slugify(draft.schoolNameNormalized)}`);
    if (foldersToDelete.length > 0) {
        await supabaseAdmin.storage.from('registrations').remove(foldersToDelete);
        console.log(`[CRON_LOGIC] Mencoba menghapus ${foldersToDelete.length} folder draf dari storage.`);
    }

    const { count } = await prisma.registration.deleteMany({
        where: { id: { in: staleDrafts.map(d => d.id) } }
    });
    
    console.log(`[CRON_LOGIC] Berhasil menghapus ${count} draf lama dari database.`);
    return count;
}