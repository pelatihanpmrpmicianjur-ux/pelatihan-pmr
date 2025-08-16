'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Registration, Participant, Companion, TentBooking, TentReservation, TentType, Prisma } from '@prisma/client';
import { supabaseAdmin } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { slugify } from '@/lib/utils';
import path from 'path';

type ActionResult = {
    success: boolean;
    message: string;
};

export type RegistrationDetail = Registration & {
    participants: Participant[];
    companions: Companion[];
    tentBookings: (TentBooking & { tentType: TentType })[];
    tentReservations: (TentReservation & { tentType: TentType })[];
    excelUrl: string | null;
    paymentProofUrl: string | null;
    receiptUrl: string | null; // <-- Menambahkan ini
};

export async function getRegistrations(filters: { category?: 'Wira' | 'Madya'; date?: string }) {
    // Tipe `any` digunakan di sini untuk fleksibilitas pembuatan query
    // Ini adalah kasus penggunaan yang bisa diterima untuk `whereClause` dinamis
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {
        status: { not: 'DRAFT' }
    };

    if (filters.category) {
        whereClause.schoolCategory = filters.category;
    }

    if (filters.date) {
        const startDate = new Date(filters.date);
        const endDate = new Date(startDate);
endDate.setUTCDate(startDate.getUTCDate() + 1); // Gunakan UTC untuk konsistensi
        whereClause.createdAt = {
            gte: startDate,
            lt: endDate,
        };
    }

    return prisma.registration.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        include: {
            tentBookings: {
                include: {
                    tentType: true,
                },
            },
        },
    });
}

export type RegistrationWithTents = Registration & {
    tentBookings: (TentBooking & {
        tentType: TentType;
    })[];
};

export async function getRegistrationDetailsAction(registrationId: string): Promise<RegistrationDetail | null> {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        console.error("Unauthorized attempt to get registration details.");
        return null;
    }

    try {
        const registration = await prisma.registration.findUnique({
            where: { id: registrationId },
            include: {
                participants: { orderBy: { id: 'asc' } },
                companions: { orderBy: { id: 'asc' } },
                tentBookings: { include: { tentType: true } },
                tentReservations: { include: { tentType: true } },
            }
        });

        if (!registration) {
            return null;
        }
        
        const createSignedUrl = async (path: string | null) => {
            if (!path) return null;
            const { data, error } = await supabaseAdmin.storage
                .from('registrations')
                .createSignedUrl(path, 60 * 5); // Berlaku 5 menit
            return error ? null : data.signedUrl;
        };

        const responseData: RegistrationDetail = {
            ...registration,
            excelUrl: await createSignedUrl(registration.excelPath || registration.excelTempPath),
            paymentProofUrl: await createSignedUrl(registration.paymentProofPath || registration.paymentProofTempPath),
            receiptUrl: await createSignedUrl(registration.receiptPath || registration.receiptTempPath), // <-- Menambahkan ini
        };

        return responseData;

    } catch (error) {
        console.error(`Error fetching detail for registration ${registrationId}:`, error);
        return null;
    }
}

export async function confirmRegistrationAction(registrationId: string): Promise<{ success: boolean; message: string; }> {
    const session = await getServerSession(authOptions);
    const adminId = (session?.user as any)?.id;
    if (!adminId) {
        return { success: false, message: 'Akses ditolak. Anda harus login sebagai admin.' };
    }

    try {
        const registration = await prisma.registration.findFirst({
            where: { id: registrationId, status: 'SUBMITTED' }
        });
        
        if (!registration) {
            return { success: false, message: 'Pendaftaran tidak ditemukan atau statusnya tidak valid untuk dikonfirmasi.' };
        }
        
        console.log(`[ACTION] Memulai finalisasi untuk: ${registrationId}`);
        const schoolSlug = slugify(registration.schoolNameNormalized);
        
        const permanentPathsToUpdate: Prisma.RegistrationUpdateInput = {};
        const photoPathUpdates: { fromPath: string; toPath: string }[] = [];
        
        // --- Tahap 1: Operasi Pemindahan File ---
        const fileMovePromises: Promise<any>[] = [];
        
        // --- LOGIKA BARU UNTUK MEMBERI NAMA ULANG FILE EXCEL ---
        if (registration.excelTempPath) {
            // Ekstrak nomor urut dari customOrderId
            const registrationNumber = registration.customOrderId 
                ? registration.customOrderId.split('-')[0] 
                : registration.id.substring(0, 4); // Fallback
            
            const originalExtension = path.extname(registration.excelTempPath);
            const finalExcelName = `${registrationNumber}-${schoolSlug}${originalExtension}`;
            const toPath = `permanen/${schoolSlug}/excel/${finalExcelName}`;

            fileMovePromises.push(
                supabaseAdmin.storage.from('registrations').move(registration.excelTempPath, toPath)
                    .then(({ error }) => {
                        if (error) console.error(`Gagal memindahkan Excel: ${error.message}`);
                        else permanentPathsToUpdate.excelPath = toPath;
                    })
            );
        }

        // Pemindahan file lain (bukti bayar & kwitansi) tidak perlu diubah namanya
        const otherFileTypes: ('paymentProofTempPath' | 'receiptTempPath')[] = ['paymentProofTempPath', 'receiptTempPath'];
        const folderNames = { paymentProofTempPath: 'payment_proofs', receiptTempPath: 'receipts' };

        otherFileTypes.forEach(fileType => {
            const tempPath = registration[fileType];
            if (tempPath) {
                const fileName = path.basename(tempPath);
                const toPath = `permanen/${schoolSlug}/${folderNames[fileType]}/${fileName}`;
                fileMovePromises.push(
                    supabaseAdmin.storage.from('registrations').move(tempPath, toPath)
                        .then(({ error }) => {
                            if (!error) {
                                const key = fileType.replace('TempPath', 'Path') as keyof typeof permanentPathsToUpdate;
                                permanentPathsToUpdate[key] = toPath;
                            } else {
                                console.error(`Gagal memindahkan file ${fileType}:`, error.message);
                            }
                        })
                );
            }
        });
        
        // Jalankan pemindahan file utama (Excel, bukti, kwitansi) secara paralel
        await Promise.all(fileMovePromises);

        // Pindahkan foto secara berkelompok (batching)
        const tempPhotoDir = `temp/${schoolSlug}/photos/`;
        const { data: photoFiles } = await supabaseAdmin.storage.from('registrations').list(tempPhotoDir);
        
        if (photoFiles && photoFiles.length > 0) {
            permanentPathsToUpdate.photosPath = `permanen/${schoolSlug}/photos/`;
            const BATCH_SIZE = 10;
            
            for (let i = 0; i < photoFiles.length; i += BATCH_SIZE) {
                const batch = photoFiles.slice(i, i + BATCH_SIZE);
                console.log(`[ACTION] Memproses batch foto ${Math.floor(i / BATCH_SIZE) + 1} dari ${Math.ceil(photoFiles.length / BATCH_SIZE)}...`);
                
                const movePhotoPromises = batch.map(file => {
                    const fromPath = `${tempPhotoDir}${file.name}`;
                    const toPath = `${permanentPathsToUpdate.photosPath}${file.name}`;
                    return supabaseAdmin.storage.from('registrations').move(fromPath, toPath)
                        .then(({ error }) => {
                            if (!error) photoPathUpdates.push({ fromPath, toPath });
                            else console.error(`Gagal memindahkan foto ${fromPath}:`, error.message);
                        });
                });
                
                await Promise.all(movePhotoPromises);
            }
        }
        console.log(`[ACTION] Semua operasi file selesai.`);
        
        // --- Tahap 2: Lakukan satu transaksi database besar ---
        console.log(`[ACTION] Memulai transaksi database dengan ${photoPathUpdates.length} pembaruan path...`);
        await prisma.$transaction(async (tx) => {
            if (photoPathUpdates.length > 0) {
                for (const update of photoPathUpdates) {
                    await tx.participant.updateMany({ where: { photoPath: update.fromPath }, data: { photoPath: update.toPath } });
                }
            }

            await tx.registration.update({
                where: { id: registrationId },
                data: {
                    status: 'CONFIRMED',
                    excelPath: permanentPathsToUpdate.excelPath,
                    paymentProofPath: permanentPathsToUpdate.paymentProofPath,
                    photosPath: permanentPathsToUpdate.photosPath,
                    receiptPath: permanentPathsToUpdate.receiptPath,
                    excelTempPath: null,
                    paymentProofTempPath: null,
                    receiptTempPath: null,
                }
            });
            
            await tx.auditLog.create({
                data: { action: 'REGISTRATION_CONFIRMED', actorId: adminId, targetRegistrationId: registrationId, details: { message: 'Pendaftaran dikonfirmasi via Server Action.' } }
            });
            
            const reservations = await tx.tentReservation.findMany({ where: { registrationId } });
            if (reservations.length > 0) {
                await tx.tentBooking.createMany({ data: reservations.map(r => ({ registrationId: r.registrationId, tentTypeId: r.tentTypeId, quantity: r.quantity })) });
                await tx.tentReservation.deleteMany({ where: { registrationId } });
            }
        }, {
            timeout: 45000
        });
        
        console.log(`[ACTION] Transaksi database dan finalisasi untuk ${registrationId} selesai.`);
        
        revalidatePath('/admin/dashboard');
        revalidatePath(`/admin/registrations/${registrationId}`);
        revalidatePath('/admin/participants');
        revalidatePath('/admin/companions');
        revalidatePath('/admin/tents');
        
        return { success: true, message: 'Pendaftaran berhasil dikonfirmasi.' };
    } catch (error: unknown) {
        let errorMessage = 'Gagal mengkonfirmasi pendaftaran.';
        if (error instanceof Error) errorMessage = error.message;
        console.error(`[CONFIRM_REGISTRATION_ACTION_ERROR] for ${registrationId}:`, error);
        return { success: false, message: errorMessage };
    }
}

export async function rejectRegistrationAction(registrationId: string, reason: string): Promise<ActionResult> {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return { success: false, message: 'Unauthorized' };
    }

    if (!reason || reason.trim() === '') {
        return { success: false, message: 'Alasan penolakan wajib diisi.' };
    }

    try {
        await prisma.registration.update({
            where: { id: registrationId, status: 'SUBMITTED' }, // Pastikan hanya bisa menolak yang berstatus SUBMITTED
            data: {
                status: 'REJECTED',
                rejectionReason: reason.trim(),
            }
        });

        // TODO: Kirim notifikasi ke pengguna (bisa menjadi job BullMQ)

        // Revalidate path dashboard agar data di-refresh
        revalidatePath('/admin/dashboard');

        return { success: true, message: 'Pendaftaran berhasil ditolak.' };

    } catch (error) {
        console.error(`Error rejecting registration ${registrationId}:`, error);
        return { success: false, message: 'Gagal menolak pendaftaran.' };
    }
}

export async function deleteRegistrationAction(registrationId: string): Promise<ActionResult> {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return { success: false, message: 'Unauthorized' };
    }

    try {
        // 1. Ambil data pendaftaran SEBELUM dihapus untuk mendapatkan path file
        const registrationToDelete = await prisma.registration.findUnique({
            where: { id: registrationId },
            select: { schoolNameNormalized: true }
        });

        if (!registrationToDelete) {
            return { success: false, message: "Pendaftaran tidak ditemukan." };
        }

        // 2. Hapus record dari database (onDelete: Cascade akan menangani relasi)
        await prisma.registration.delete({
            where: { id: registrationId }
        });

        // 3. Masukkan job ke antrian untuk menghapus file-file di storage

        // Revalidate path dashboard dan halaman data lainnya
        revalidatePath('/admin/dashboard');
        revalidatePath('/admin/participants');
        revalidatePath('/admin/companions');
        revalidatePath('/admin/tents');
        
        return { success: true, message: 'Pendaftaran dan semua data terkait berhasil dihapus.' };

    } catch (error) {
        console.error(`Error deleting registration ${registrationId}:`, error);
        return { success: false, message: 'Gagal menghapus pendaftaran.' };
    }
}

export type Stats = Awaited<ReturnType<typeof getDashboardStats>>;
// Server action untuk statistik
export async function getDashboardStats() {
    const [totalRegistrations, totalRevenueResult] = await Promise.all([
        prisma.registration.count({
            where: { status: { not: 'DRAFT' } }
        }),
        prisma.registration.aggregate({
            _sum: { grandTotal: true },
            where: { status: 'CONFIRMED' }
        })
    ]);
    
    return {
        totalRegistrations,
        totalRevenue: totalRevenueResult._sum.grandTotal || 0
    };
}

export type LoginHistoryItem = Awaited<ReturnType<typeof getLoginHistory>>[0];

export async function getLoginHistory() {
    return prisma.adminLoginHistory.findMany({
        take: 10, // Ambil 10 entri terakhir
        orderBy: { timestamp: 'desc' },
        include: {
            adminUser: {
                select: { username: true } // Ambil username admin
            }
        }
    });
}

