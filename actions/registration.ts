'use server';


import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase/server';
import { registrationQueue } from '@/lib/queue';
import { slugify, normalizeSchoolName } from '@/lib/utils';
import { Registration, Participant, Companion, TentBooking, TentReservation, TentType } from '@prisma/client';
import ExcelJS from 'exceljs';
import sharp from 'sharp';
// Definisikan tipe untuk hasil (return value) dari action
type ActionResult = {
    success: boolean;
    message: string;
};

type DraftDetails = {
    schoolName: string;
    updatedAt: string;
} | null;

export type RegistrationDetail = Registration & {
    participants: Participant[];
    companions: Companion[];
    tentBookings: (TentBooking & { tentType: TentType })[];
    tentReservations: (TentReservation & { tentType: TentType })[];
    excelUrl: string | null;
    paymentProofUrl: string | null;
    receiptUrl: string | null; // <-- Menambahkan ini
};

type ReceiptUrlResult = {
    status: 'processing' | 'ready' | 'not_found' | 'error';
    downloadUrl?: string;
    message: string;
}

export async function requestUploadUrlAction(registrationId: string, fileName: string, fileType: string): Promise<{ success: boolean; signedUrl?: string; path?: string; message: string; }> {
    const registration = await prisma.registration.findUnique({ where: { id: registrationId }, select: { schoolNameNormalized: true } });
    if (!registration) {
        return { success: false, message: 'Pendaftaran tidak ditemukan.' };
    }
    const schoolSlug = slugify(registration.schoolNameNormalized);
    const timestamp = Date.now();
    const filePath = `temp/${schoolSlug}/excel/${timestamp}_${slugify(fileName)}`;

    try {
        const { data, error } = await supabaseAdmin.storage.from('registrations').createSignedUploadUrl(filePath);
        if (error) throw error;
        return { success: true, signedUrl: data.signedUrl, path: data.path, message: 'URL berhasil dibuat.' };
    } catch (error) {
        return { success: false, message: 'Gagal membuat URL upload.' };
    }
}

export type VerificationData = {
    schoolNameNormalized: string;
    status: 'DRAFT' | 'SUBMITTED' | 'CONFIRMED' | 'REJECTED';
    updatedAt: Date;
    customOrderId: string | null;
} | null; // Bisa null jika tidak ditemukan

export async function getVerificationDataAction(registrationId: string): Promise<VerificationData> {
    if (!registrationId || typeof registrationId !== 'string') {
        // Sebaiknya tidak melempar error agar Server Component bisa menanganinya
        return null;
    }

    try {
        const registration = await prisma.registration.findUnique({
            where: { id: registrationId },
            select: {
                schoolNameNormalized: true,
                status: true,
                updatedAt: true,
                customOrderId: true,
            }
        });

        // Jika tidak ditemukan, prisma.findUnique mengembalikan null
        return registration;

    } catch (error) {
        // Ini akan menangani jika ID bukan CUID yang valid dan Prisma melempar error
        console.error(`[ACTION_GET_VERIFICATION] Error for ID ${registrationId}:`, error);
        return null; // Selalu kembalikan null jika ada error
    }
}

type ImageReference = {
    type: 'image';
    imageId: string; // Ternyata ini string, bukan number
    range: ExcelJS.ImageRange;
};

interface ParticipantRowData {
  rowNumber: number | null;
  fullName: string;
  birthInfo: string;
  address: string;
  religion: string;
  bloodType: string | null;
  entryYear: number;
  phone: string | null;
  gender: string;
  photoPath: string | null;
  // Properti sementara untuk pemrosesan
  imageIdToProcess?: string;
}

interface CompanionRowData {
  rowNumber: number | null;
  fullName: string;
  birthInfo: string;
  address: string;
  religion: string;
  bloodType: string | null;
  entryYear: number;
  phone: string | null;
  gender: string;
}


type SummaryData = {
    schoolInfo: {
        schoolName: string | null;
        coachName: string | null;
        coachPhone: string | null;
        schoolCategory: string | null;
    };
    costSummary: {
        peserta: number;
        pendamping: number;
        tenda: number;
        grandTotal: number;
    };
    participantSummary: {
        count: number;
        preview: string[];
    };
    companionSummary: {
        count: number;
        preview: string[];
    };
    tentSummary: {
        capacity: number;
        quantity: number;
        price: number;
        subtotal: number;
    }[];
};

export async function processExcelAction(registrationId: string, filePath: string): Promise<{ success: boolean; summary?: any; message: string; }> {
    const DATA_START_ROW = 7;
    const COST_PESERTA = 40000;
    const COST_PENDAMPING = 25000;

    function getPhotoPath(schoolSlug: string, fileName: string): string {
        return `temp/${schoolSlug}/photos/${fileName}`;
    }

    try {
        const registration = await prisma.registration.findUnique({ where: { id: registrationId } });
        if (!registration) {
            return { success: false, message: 'Pendaftaran tidak ditemukan.' };
        }

        const schoolSlug = slugify(registration.schoolNameNormalized);
        const { data: fileBlob, error: downloadError } = await supabaseAdmin.storage.from('registrations').download(filePath);
        if (downloadError) {
            console.error("Supabase download error:", downloadError);
            return { success: false, message: `Gagal mengunduh file dari storage: ${downloadError.message}` };
        }
        
        const fileBuffer = await fileBlob.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(fileBuffer);
        
        const pesertaSheet = workbook.getWorksheet('Data Peserta');
        const pendampingSheet = workbook.getWorksheet('Data Pendamping');

        if (!pesertaSheet) {
            return { success: false, message: "Sheet 'Data Peserta' tidak ditemukan di dalam file Excel. Harap gunakan template yang benar." };
        }
        const imageReferences: ImageReference[] = pesertaSheet.getImages();
        const pesertaData: ParticipantRowData[] = [];
        const pendampingData: CompanionRowData[] = [];
        const images = pesertaSheet.getImages();
        // --- Tahap 1: Baca data dari Excel (Operasi Cepat) ---
        pesertaSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber < DATA_START_ROW) return;
            const rowData: ParticipantRowData = {
                rowNumber: row.getCell(1).value as number | null,
                fullName: row.getCell(2).value as string || 'N/A',
                birthInfo: row.getCell(3).value as string || 'N/A',
                address: row.getCell(4).value as string || 'N/A',
                religion: row.getCell(5).value as string || 'N/A',
                bloodType: row.getCell(6).value as string || null,
                entryYear: row.getCell(7).value as number || new Date().getFullYear(),
                phone: row.getCell(8).value?.toString() || null,
                gender: row.getCell(9).value as string || 'N/A',
                photoPath: null,
            };

              const imageRef = imageReferences.find((img) => {
                if (!img.range || !img.range.tl) return false;
                // `img.range` sekarang dijamin ada karena tipe kita
                const range = img.range;
                const isCorrectColumn = range.tl.nativeCol === 9;
                if (!isCorrectColumn) return false;
                
                if (!range.br) {
                    return (range.tl.nativeRow + 1) === rowNumber;
                } else {
                    return rowNumber >= (range.tl.nativeRow + 1) && rowNumber <= (range.br.nativeRow + 1);
                }
            });

            if (imageRef) {
                // Simpan imageId (yang merupakan string) untuk diproses nanti
                rowData.imageIdToProcess = imageRef.imageId;
            }
            
            pesertaData.push(rowData);
        });

        if (pendampingSheet) {
            pendampingSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
                if (rowNumber < DATA_START_ROW) return;
                pendampingData.push({
                  rowNumber: row.getCell(1).value as number | null,
                  fullName: row.getCell(2).value as string || 'N/A',
                  birthInfo: row.getCell(3).value as string || 'N/A',
                  address: row.getCell(4).value as string || 'N/A',
                  religion: row.getCell(5).value as string || 'N/A',
                  bloodType: row.getCell(6).value as string || null,
                  entryYear: row.getCell(7).value as number || new Date().getFullYear(),
                  phone: row.getCell(8).value?.toString() || null,
                  gender: row.getCell(9).value as string || 'N/A',
                });
            });
        }
    
        // --- Tahap 2: Lakukan semua operasi I/O lambat (upload) DI LUAR TRANSAKSI ---
        console.log(`[ACTION_PROCESS_EXCEL] Memulai pra-proses dan upload untuk ${pesertaData.length} peserta.`);
        
       await Promise.all(pesertaData.map(async (p) => {
            if (p.imageIdToProcess) {
                const image = workbook.getImage(parseInt(p.imageIdToProcess, 10));
                if (image && image.buffer) {
                    const optimizedBuffer = await sharp(image.buffer).resize({ width: 400, height: 600, fit: 'inside' }).jpeg({ quality: 80 }).toBuffer();
                    const participantSlug = slugify(p.fullName || `peserta-${p.rowNumber}`);
                    const uniqueFileName = `${participantSlug}_${registrationId}_row_${p.rowNumber}.jpeg`;
                    const photoPath = getPhotoPath(schoolSlug, uniqueFileName);
                    
                    const { error: uploadError } = await supabaseAdmin.storage.from('registrations').upload(photoPath, optimizedBuffer, { contentType: 'image/jpeg', upsert: true });
                    
                    if (uploadError) {
                        console.error(`Gagal upload foto untuk peserta ${p.fullName}:`, uploadError.message);
                        p.photoPath = null;
                    } else {
                        p.photoPath = photoPath;
                    }
                }
            }
        }));
        
        console.log(`[ACTION_PROCESS_EXCEL] Selesai pra-proses dan upload.`);

        // --- Tahap 3: Jalankan transaksi database yang SANGAT CEPAT ---
        console.log(`[ACTION_PROCESS_EXCEL] Memulai transaksi database...`);
        await prisma.$transaction(async (tx) => {
            await tx.participant.deleteMany({ where: { registrationId } });
            await tx.companion.deleteMany({ where: { registrationId } });

            if (pesertaData.length > 0) {
                await tx.participant.createMany({ 
                    data: pesertaData.map(p => ({
                        registrationId,
                        rowNumber: p.rowNumber,
                        fullName: p.fullName,
                        birthInfo: p.birthInfo,
                        address: p.address,
                        religion: p.religion,
                        bloodType: p.bloodType,
                        entryYear: p.entryYear,
                        phone: p.phone,
                        gender: p.gender,
                        photoPath: p.photoPath,
                    })) 
                });
            }
            
            if (pendampingData.length > 0) {
                await tx.companion.createMany({ 
                    data: pendampingData.map(p => ({
                        registrationId,
                        rowNumber: p.rowNumber,
                        fullName: p.fullName,
                        birthInfo: p.birthInfo,
                        address: p.address,
                        religion: p.religion,
                        bloodType: p.bloodType,
                        entryYear: p.entryYear,
                        phone: p.phone,
                        gender: p.gender,
                    }))
                });
            }
            
            const totalCostPeserta = pesertaData.length * COST_PESERTA;
            const totalCostPendamping = pendampingData.length * COST_PENDAMPING;
            
            await tx.registration.update({
                where: { id: registrationId },
                data: { excelTempPath: filePath, totalCostPeserta, totalCostPendamping },
            });
        }, {
            timeout: 20000, // 20 detik (Peningkatan timeout sebagai jaring pengaman)
        });
        console.log(`[ACTION_PROCESS_EXCEL] Transaksi database selesai.`);

        const previewPesertaForClient = pesertaData.map(p => ({
                        rowNumber: p.rowNumber,
                        fullName: p.fullName,
                        birthInfo: p.birthInfo,
                        address: p.address,
                        religion: p.religion,
                        bloodType: p.bloodType,
                        entryYear: p.entryYear,
                        phone: p.phone,
                        gender: p.gender,
            photoPath: p.photoPath,
        }));
        
        const previewPendampingForClient = pendampingData.map(p => ({
                        rowNumber: p.rowNumber,
                        fullName: p.fullName,
                        birthInfo: p.birthInfo,
                        address: p.address,
                        religion: p.religion,
                        bloodType: p.bloodType,
                        entryYear: p.entryYear,
                        phone: p.phone,
                        gender: p.gender,
        }));
    
        return {
            success: true,
            message: 'File Excel berhasil diproses.',
            summary: {
                pesertaCount: pesertaData.length,
                pendampingCount: pendampingData.length,
                totalBiaya: (pesertaData.length * COST_PESERTA) + (pendampingData.length * COST_PENDAMPING),
                previewPeserta: previewPesertaForClient,
                previewPendamping: previewPendampingForClient,
            }
        };
    
    } catch (error: unknown) {
        console.error("Error processing excel action:", error);
        if (error instanceof Error) {
            return { success: false, message: `Gagal memproses file Excel: ${error.message}` };
        }
        return { success: false, message: 'Terjadi kesalahan yang tidak diketahui saat memproses file.' };
    }
}

export async function reserveTentsAction(
    registrationId: string, 
    reservations: { tentTypeId: number, quantity: number }[]
): Promise<{ success: boolean; message: string; expiresAt?: string }> {
    const RESERVATION_DURATION_MINUTES = 15;

    // Validasi input dasar
    if (!registrationId || !Array.isArray(reservations)) {
        return { success: false, message: 'Input tidak valid.' };
    }

    try {
        // Logika validasi kapasitas berlebih (dibandingkan total peserta)
        const registration = await prisma.registration.findUnique({
            where: { id: registrationId },
            include: { participants: true, companions: true }
        });
        if (!registration) {
            return { success: false, message: 'Pendaftaran tidak ditemukan.' };
        }
        
        const totalParticipants = registration.participants.length + registration.companions.length;
        const maxCapacityAllowed = totalParticipants > 0 ? totalParticipants + 10 : 0;
        
        let totalCapacityRequested = 0;
        // Gunakan Promise.all untuk mengambil data tenda secara paralel agar lebih efisien
        const tentTypes = await prisma.tentType.findMany({
            where: { id: { in: reservations.map(r => r.tentTypeId) } }
        });

        for (const res of reservations) {
            if (res.quantity > 0) {
                const tentType = tentTypes.find(t => t.id === res.tentTypeId);
                totalCapacityRequested += (tentType?.capacity || 0) * res.quantity;
            }
        }
        
        if (totalCapacityRequested > maxCapacityAllowed && maxCapacityAllowed > 0) {
            return { success: false, message: `Kapasitas tenda yang diminta (${totalCapacityRequested}) melebihi batas maksimum (${maxCapacityAllowed}).` };
        }

        const expiresAt = new Date(Date.now() + RESERVATION_DURATION_MINUTES * 60 * 1000);

        await prisma.$transaction(async (tx) => {
            const oldReservations = await tx.tentReservation.findMany({ where: { registrationId } });
            for (const oldRes of oldReservations) {
                await tx.tentType.update({ where: { id: oldRes.tentTypeId }, data: { stockAvailable: { increment: oldRes.quantity } } });
            }
            await tx.tentReservation.deleteMany({ where: { registrationId } });

            for (const res of reservations) {
                if (res.quantity === 0) continue;
                await tx.tentType.update({
                    where: { id: res.tentTypeId, stockAvailable: { gte: res.quantity } },
                    data: { stockAvailable: { decrement: res.quantity } },
                });
                await tx.tentReservation.create({
                    data: { registrationId, tentTypeId: res.tentTypeId, quantity: res.quantity, expiresAt },
                });
            }

            const newTentCost = reservations.reduce((acc, res) => {
            if (res.quantity > 0) {
                const tentType = tentTypes.find(t => t.id === res.tentTypeId);
                return acc + (tentType?.price || 0) * res.quantity;
            }
            return acc;
        }, 0); 
            
            await tx.registration.update({ where: { id: registrationId }, data: { totalCostTenda: newTentCost } });
        });

        return { success: true, message: 'Reservasi tenda berhasil diperbarui.', expiresAt: expiresAt.toISOString() };

    } catch (error: unknown) {
        let errorMessage = 'Gagal melakukan reservasi tenda.';
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
            errorMessage = 'Stok tenda tidak mencukupi untuk jumlah yang diminta.';
        } else if (error instanceof Error) {
            errorMessage = error.message;
        }
        
        console.error('[RESERVE_TENT_ERROR]', error);
        return { success: false, message: errorMessage };
    }
}

export async function getDraftDetailsAction(registrationId: string): Promise<DraftDetails> {
    try {
        const draft = await prisma.registration.findFirst({
            where: {
                id: registrationId,
                status: 'DRAFT',
            },
            select: {
                schoolName: true,
                updatedAt: true,
            }
        });

        if (!draft) {
            return null; // Kembalikan null jika draf tidak ditemukan
        }

        // Pastikan schoolName tidak null sebelum dikembalikan
        return {
            schoolName: draft.schoolName,
            updatedAt: draft.updatedAt.toISOString(),
        };

    } catch (error) {
        console.error("Gagal memuat detail draf:", error);
        return null; // Kembalikan null jika terjadi error
    }
}

export async function getSummaryAction(registrationId: string): Promise<{ success: boolean; data?: SummaryData; message: string }> {
    if (!registrationId) {
        return { success: false, message: 'ID Pendaftaran tidak valid.' };
    }

    try {
        const registration = await prisma.registration.findUnique({
            where: { id: registrationId },
            include: {
                participants: {
                    select: { fullName: true }, // Hanya ambil fullName untuk preview
                    orderBy: { id: 'asc' },
                    take: 5 // Batasi pengambilan data di level database
                },
                companions: {
                    select: { fullName: true },
                    orderBy: { id: 'asc' },
                    take: 5
                },
                tentReservations: {
                    include: {
                        tentType: true,
                    },
                },
            },
        });

        if (!registration) {
            return { success: false, message: 'Pendaftaran tidak ditemukan.' };
        }
        
        // Hitung ulang jumlah total karena kita hanya mengambil 5 preview
        const participantCount = await prisma.participant.count({ where: { registrationId }});
        const companionCount = await prisma.companion.count({ where: { registrationId }});

        const grandTotal = registration.totalCostPeserta + registration.totalCostPendamping + registration.totalCostTenda;
        
        // Update grand total di DB
        // Ini adalah "side effect", tapi bisa diterima di sini.
        await prisma.registration.update({
            where: { id: registrationId },
            data: { grandTotal }
        });

        // Sajikan data yang sudah dirapikan sesuai tipe SummaryData
        const responseData: SummaryData = {
            schoolInfo: {
                schoolName: registration.schoolName,
                coachName: registration.coachName,
                coachPhone: registration.coachPhone,
                schoolCategory: registration.schoolCategory,
            },
            costSummary: {
                peserta: registration.totalCostPeserta,
                pendamping: registration.totalCostPendamping,
                tenda: registration.totalCostTenda,
                grandTotal: grandTotal,
            },
            participantSummary: {
                count: participantCount,
                preview: registration.participants.map(p => p.fullName),
            },
            companionSummary: {
                count: companionCount,
                preview: registration.companions.map(c => c.fullName),
            },
            tentSummary: registration.tentReservations.map(res => ({
                capacity: res.tentType.capacity,
                quantity: res.quantity,
                price: res.tentType.price,
                subtotal: res.tentType.price * res.quantity
            }))
        };

        return { success: true, data: responseData, message: 'Summary berhasil dimuat.' };

    } catch (error: unknown) {
        let errorMessage = 'Gagal memuat ringkasan pendaftaran.';
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        console.error('Error fetching summary:', error);
        return { success: false, message: errorMessage };
    }
}

export async function getReceiptUrlAction(registrationId: string): Promise<ReceiptUrlResult> {
    if (!registrationId) {
        return { status: 'error', message: 'ID Pendaftaran tidak valid.' };
    }

    try {
        const registration = await prisma.registration.findUnique({
            where: { id: registrationId },
            select: { receiptPath: true, receiptTempPath: true }
        });

        if (!registration) {
            return { status: 'not_found', message: "Pendaftaran tidak ditemukan." };
        }

        const pathToUse = registration.receiptPath || registration.receiptTempPath;

        if (!pathToUse) {
            return { status: 'processing', message: "Kwitansi sedang diproses. Silakan coba lagi nanti." };
        }

        const { data, error } = await supabaseAdmin.storage
            .from('registrations')
            .createSignedUrl(pathToUse, 60); // Berlaku 1 menit

        if (error) {
            throw new Error("Gagal membuat URL download.");
        }
        
        return { status: 'ready', downloadUrl: data.signedUrl, message: "URL Kwitansi berhasil dibuat." };

    } catch (error: unknown) {
        let errorMessage = 'Gagal mendapatkan kwitansi.';
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        console.error(`Error saat mengambil kwitansi untuk ${registrationId}:`, error);
        return { status: 'error', message: errorMessage };
    }
}


export async function confirmRegistrationAction(registrationId: string): Promise<ActionResult> {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return { success: false, message: 'Unauthorized' };
    }
    const adminId = session.user.id;

    try {
        const registration = await prisma.registration.findFirst({
            where: { id: registrationId, status: 'SUBMITTED' }
        });
        
        if (!registration) {
            return { success: false, message: 'Pendaftaran tidak ditemukan atau statusnya tidak valid.' };
        }
        
        await registrationQueue.add('finalize-registration', { 
            registrationId, 
            adminId 
        });

        await prisma.registration.update({
            where: { id: registrationId },
            data: { status: 'DRAFT' } // Gunakan DRAFT sebagai status "processing"
        });
        
        return { success: true, message: 'Proses konfirmasi telah dimulai.' };

    } catch (error) {
        console.error("Failed to enqueue finalization job:", error);
        return { success: false, message: 'Gagal memulai proses konfirmasi.' };
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

// ==========================================================
// === AKSI BARU: DELETE REGISTRATION ===
// ==========================================================
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
        await registrationQueue.add('delete-registration', {
            schoolNameNormalized: registrationToDelete.schoolNameNormalized
        });

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