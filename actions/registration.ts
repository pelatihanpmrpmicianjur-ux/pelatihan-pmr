'use server';


import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';
import { Registration, Participant, Companion, TentBooking, TentReservation, TentType } from '@prisma/client';
import ExcelJS from 'exceljs';
import path from 'path';
import sharp from 'sharp';
import qrcode from 'qrcode';
import fs from 'fs/promises';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
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
        const fileBlob = await (await supabaseAdmin.storage.from('registrations').download(filePath)).data?.arrayBuffer();
        if (!fileBlob) throw new Error("Gagal mengunduh file Excel dari storage.");
        
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(fileBlob);
        
        const pesertaSheet = workbook.getWorksheet('Data Peserta');
        if (!pesertaSheet) return { success: false, message: "Sheet 'Data Peserta' tidak ditemukan." };
        
        const images = pesertaSheet.getImages();
        const pesertaData: ParticipantRowData[] = [];
        
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

            const imageRef = images.find(img => {
                if (!img.range?.tl) return false;
                const range = img.range;
                const isCorrectColumn = range.tl.nativeCol === 9;
                if (!isCorrectColumn) return false;
                if (!range.br) return (range.tl.nativeRow + 1) === rowNumber;
                return rowNumber >= (range.tl.nativeRow + 1) && rowNumber <= (range.br.nativeRow + 1);
            });

            // *** PERBAIKAN KRUSIAL #1: SIMPAN imageId ***
            if (imageRef) {
                rowData.imageIdToProcess = imageRef.imageId;
            }
            
            pesertaData.push(rowData);
        });

        const pendampingSheet = workbook.getWorksheet('Data Pendamping');
        const pendampingData: CompanionRowData[] = [];
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
                if (image?.buffer) {
                    const optimizedBuffer = await sharp(image.buffer).resize({ width: 400, height: 600, fit: 'inside' }).jpeg({ quality: 80 }).toBuffer();
                    const participantSlug = slugify(p.fullName || `peserta-${p.rowNumber}`);
                    const uniqueFileName = `${participantSlug}_${registrationId}_row_${p.rowNumber}.jpeg`;
                    const photoPath = getPhotoPath(schoolSlug, uniqueFileName);
                    const { error } = await supabaseAdmin.storage.from('registrations').upload(photoPath, optimizedBuffer, { contentType: 'image/jpeg', upsert: true });
                    if (error) console.error(`Gagal upload foto untuk ${p.fullName}:`, error.message);
                    else p.photoPath = photoPath;
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
): Promise<{ success: boolean; message: string; data?: { expiresAt?: string, updatedOrder: { tentTypeId: number, quantity: number }[] } }> {
    const RESERVATION_DURATION_MINUTES = 15;

    if (!registrationId || !Array.isArray(reservations)) {
        return { success: false, message: 'Input tidak valid.' };
    }

    try {
        const registration = await prisma.registration.findUnique({
            where: { id: registrationId },
            include: { 
                participants: { select: { id: true } }, // Hanya select ID untuk efisiensi
                companions: { select: { id: true } } 
            }
        });
        if (!registration) {
            return { success: false, message: 'Pendaftaran tidak ditemukan.' };
        }
        
        const totalParticipants = registration.participants.length + registration.companions.length;
        const maxCapacityAllowed = totalParticipants > 0 ? totalParticipants + 10 : 0;
        
        let totalCapacityRequested = 0;
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
            // 1. Lepaskan semua reservasi lama untuk pendaftaran ini
            const oldReservations = await tx.tentReservation.findMany({ where: { registrationId } });
            for (const oldRes of oldReservations) {
                // Kembalikan stok
                await tx.tentType.update({ 
                    where: { id: oldRes.tentTypeId }, 
                    data: { stockAvailable: { increment: oldRes.quantity } } 
                });
            }
            // Hapus record reservasi lama
            await tx.tentReservation.deleteMany({ where: { registrationId } });

            // 2. Buat reservasi baru
            for (const res of reservations) {
                if (res.quantity === 0) continue; // Lewati jika kuantitas 0
                
                // Ambil stok dan kurangi
                await tx.tentType.update({
                    where: { id: res.tentTypeId, stockAvailable: { gte: res.quantity } },
                    data: { stockAvailable: { decrement: res.quantity } },
                });

                // Buat record reservasi baru
                await tx.tentReservation.create({
                    data: { registrationId, tentTypeId: res.tentTypeId, quantity: res.quantity, expiresAt },
                });
            }

            // 3. Hitung dan update total biaya tenda di pendaftaran
            const newTentCost = reservations.reduce((acc, res) => {
                if (res.quantity > 0) {
                    const tentType = tentTypes.find(t => t.id === res.tentTypeId);
                    return acc + (tentType?.price || 0) * res.quantity;
                }
                return acc;
            }, 0); 
            
            await tx.registration.update({ where: { id: registrationId }, data: { totalCostTenda: newTentCost } });
        });

        // 4. Ambil data reservasi terbaru untuk dikirim kembali ke frontend
        const newReservations = await prisma.tentReservation.findMany({
            where: { registrationId },
            select: { tentTypeId: true, quantity: true }
        });

        return { 
            success: true, 
            message: 'Reservasi tenda berhasil diperbarui.', 
            data: { 
                expiresAt: expiresAt.toISOString(), 
                updatedOrder: newReservations 
            } 
        };

    } catch (error: unknown) {
        let errorMessage = 'Gagal melakukan reservasi tenda.';
        // Tangani error spesifik dari Prisma jika stok tidak cukup
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
            errorMessage = 'Stok tenda tidak mencukupi untuk jumlah yang diminta.';
        } else if (error instanceof Error) {
            errorMessage = error.message;
        }
        
        console.error('[RESERVE_TENT_ACTION_ERROR]', error);
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


export async function confirmRegistrationAction(registrationId: string): Promise<{ success: boolean; message: string; }> {
    const session = await getServerSession(authOptions);
    // Di next-auth v5, session.user.id mungkin tidak ada, tergantung callback.
    // Gunakan pengecekan yang lebih aman.
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
        
        console.log(`[ACTION] Memulai finalisasi (sinkron, paralel) untuk: ${registrationId}`);
        const schoolSlug = slugify(registration.schoolNameNormalized);
        const permanentPaths = {
            excelPath: null as string | null,
            paymentProofPath: null as string | null,
            photosPath: null as string | null,
            receiptPath: null as string | null,
        };

        const allPromises: Promise<any>[] = [];
        
        // --- Siapkan semua "janji" (Promise) untuk dieksekusi secara paralel ---

        // Janji untuk memindahkan File Excel
        if (registration.excelTempPath) {
            const fileName = path.basename(registration.excelTempPath);
            const toPath = `permanen/${schoolSlug}/excel/${fileName}`;
            allPromises.push(
                supabaseAdmin.storage.from('registrations').move(registration.excelTempPath, toPath)
                    .then(({ error }) => {
                        if (error) {
                            console.error(`Gagal memindahkan Excel: ${error.message}`);
                        } else {
                            permanentPaths.excelPath = toPath;
                        }
                    })
            );
        }

        // Janji untuk memindahkan Bukti Bayar
        if (registration.paymentProofTempPath) {
            const fileName = path.basename(registration.paymentProofTempPath);
            const toPath = `permanen/${schoolSlug}/payment_proofs/${fileName}`;
            allPromises.push(
                supabaseAdmin.storage.from('registrations').move(registration.paymentProofTempPath, toPath)
                    .then(({ error }) => {
                        if (error) {
                            console.error(`Gagal memindahkan Bukti Bayar: ${error.message}`);
                        } else {
                            permanentPaths.paymentProofPath = toPath;
                        }
                    })
            );
        }
        
        // Janji untuk memindahkan Kwitansi
        if (registration.receiptTempPath) {
            const fileName = path.basename(registration.receiptTempPath);
            const toPath = `permanen/${schoolSlug}/receipts/${fileName}`;
            allPromises.push(
                supabaseAdmin.storage.from('registrations').move(registration.receiptTempPath, toPath)
                    .then(({ error }) => {
                        if (error) {
                            console.error(`Gagal memindahkan Kwitansi: ${error.message}`);
                        } else {
                            permanentPaths.receiptPath = toPath;
                        }
                    })
            );
        }

        // Janji untuk memindahkan Foto & Update Path Peserta
        const tempPhotoDir = `temp/${schoolSlug}/photos/`;
        const { data: photoFiles } = await supabaseAdmin.storage.from('registrations').list(tempPhotoDir);

        if (photoFiles && photoFiles.length > 0) {
            permanentPaths.photosPath = `permanen/${schoolSlug}/photos/`;
            for (const file of photoFiles) {
                const fromPath = `${tempPhotoDir}${file.name}`;
                const toPath = `${permanentPaths.photosPath}${file.name}`;
                
                // Tambahkan janji untuk memindahkan file fisik, yang kemudian
                // akan memicu janji untuk update path di database.
                allPromises.push(
                    supabaseAdmin.storage.from('registrations').move(fromPath, toPath)
                        .then(({ error }) => {
                            if (!error) {
                                // Jika pemindahan berhasil, kembalikan janji untuk update DB
                                return prisma.participant.updateMany({
                                    where: { photoPath: fromPath },
                                    data: { photoPath: toPath }
                                });
                            } else {
                                console.error(`Gagal memindahkan foto ${fromPath}: ${error.message}`);
                            }
                        })
                );
            }
        }
        
        // Jalankan SEMUA operasi I/O secara bersamaan
        console.log(`[ACTION] Menjalankan ${allPromises.length} operasi I/O secara paralel...`);
        await Promise.all(allPromises);
        console.log(`[ACTION] Semua operasi I/O selesai.`);

        // Lakukan Transaksi Database Final (ini sudah cepat)
        await prisma.$transaction(async (tx) => {
            // Update tabel Registration utama dengan path permanen dan status
            await tx.registration.update({
                where: { id: registrationId },
                data: {
                    status: 'CONFIRMED',
                    excelPath: permanentPaths.excelPath,
                    paymentProofPath: permanentPaths.paymentProofPath,
                    photosPath: permanentPaths.photosPath,
                    receiptPath: permanentPaths.receiptPath,
                    excelTempPath: null,
                    paymentProofTempPath: null,
                    receiptTempPath: null,
                }
            });
            
            // Buat audit log untuk tindakan konfirmasi
            await tx.auditLog.create({
                data: { 
                    action: 'REGISTRATION_CONFIRMED', 
                    actorId: adminId, 
                    targetRegistrationId: registrationId, 
                    details: { message: 'Pendaftaran dikonfirmasi via Server Action.' } 
                }
            });
            
            // Ubah reservasi tenda menjadi booking permanen
            const reservations = await tx.tentReservation.findMany({ where: { registrationId } });
            if (reservations.length > 0) {
                await tx.tentBooking.createMany({ 
                    data: reservations.map(r => ({ 
                        registrationId: r.registrationId, 
                        tentTypeId: r.tentTypeId, 
                        quantity: r.quantity 
                    })) 
                });
                await tx.tentReservation.deleteMany({ where: { registrationId } });
            }
        });
        
        console.log(`[ACTION] Finalisasi (sinkron, paralel) untuk ${registrationId} selesai.`);
        
        // Revalidate path agar data di-refresh di sisi klien
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

function generateOrderId(schoolName: string): string {
  const timestamp = new Date().getTime();
  const month = new Date().toLocaleString('id-ID', { month: 'short' }).toUpperCase();
  const year = new Date().getFullYear();
  const schoolPart = slugify(schoolName).substring(0, 15).toUpperCase();
  return `${schoolPart}-${timestamp}/PP-PMICJR/${month}/${year}`;
}

export async function submitRegistrationAction(registrationId: string, formData: FormData): Promise<{ success: boolean; message: string; orderId?: string }> {
    const paymentProof = formData.get('paymentProof') as File;

    if (!paymentProof) {
        return { success: false, message: 'Bukti pembayaran wajib diunggah.' };
    }

    const registration = await prisma.registration.findFirst({ 
        where: { id: registrationId, status: 'DRAFT' } 
    });

    if (!registration) {
        return { success: false, message: 'Pendaftaran tidak ditemukan atau sudah disubmit.' };
    }

    const schoolSlug = slugify(registration.schoolNameNormalized);
    const orderId = generateOrderId(registration.schoolName);

    try {
        // --- Langkah 1: Upload bukti pembayaran (Operasi I/O Kritis) ---
        const proofPath = `temp/${schoolSlug}/payment_proofs/${Date.now()}_${paymentProof.name}`;
        
        const { error: uploadError } = await supabaseAdmin.storage
            .from('registrations')
            .upload(proofPath, paymentProof, { upsert: true });

        if (uploadError) {
            throw new Error(`Gagal mengunggah bukti pembayaran: ${uploadError.message}`);
        }

        // --- Langkah 2: Update Database menjadi SUBMITTED (Operasi Kritis) ---
        await prisma.registration.update({
            where: { id: registrationId },
            data: {
                status: 'SUBMITTED',
                customOrderId: orderId,
                paymentProofTempPath: proofPath,
            }
        });

    } catch (error: unknown) {
        // Jika langkah kritis (upload bukti bayar atau update DB) gagal, seluruh aksi gagal.
        let errorMessage = "Gagal memproses pendaftaran.";
        if (error instanceof Error) errorMessage = error.message;
        console.error('[SUBMIT_REGISTRATION_CRITICAL_ERROR]', error);
        return { success: false, message: errorMessage };
    }

    // --- Langkah 3: Buat Kwitansi PDF (Operasi Tambahan, Tidak Kritis) ---
    // Dibungkus dalam try...catch terpisah. Jika ini gagal, pendaftaran tetap dianggap sukses.
    try {
        console.log(`[ACTION] Membuat kwitansi PDF untuk: ${registrationId}`);
        
        const dataForReceipt = await prisma.registration.findUnique({
            where: { id: registrationId },
            select: {
                id: true,
                createdAt: true,
                schoolNameNormalized: true,
                customOrderId: true,
                totalCostPeserta: true,
                totalCostPendamping: true,
                totalCostTenda: true,
                grandTotal: true,
                _count: {
                    select: {
                        participants: true,
                        companions: true,
                    }
                }
            }
        });

        if (!dataForReceipt) throw new Error("Data pendaftaran tidak ditemukan untuk membuat kwitansi.");

        const APP_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        const verificationUrl = `${APP_URL}/verifikasi/${dataForReceipt.id}`;

        const qrCodeImage = await qrcode.toDataURL(verificationUrl, { errorCorrectionLevel: 'H', margin: 1 });
        const qrCodePngBytes = Buffer.from(qrCodeImage.split(',')[1], 'base64');
        const logoPath = path.join(process.cwd(), 'jobs', 'assets', 'logo-pmi.png');
        const logoPngBytes = await fs.readFile(logoPath);


        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([595.28, 419.53]); // A5 Landscape
        const { width: A5_WIDTH, height: A5_HEIGHT } = page.getSize();

        // Setup font dan gambar
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const logoImage = await pdfDoc.embedPng(logoPngBytes);
        const qrImage = await pdfDoc.embedPng(qrCodePngBytes);

        // Warna
        const pmiRed = rgb(0.86, 0.15, 0.18);
        const textBlack = rgb(0.07, 0.07, 0.07);
        const textGray = rgb(0.45, 0.45, 0.45);
        const white = rgb(1, 1, 1);

        const margin = 40;

        // --- Header ---
        const headerHeight = 80;
        page.drawRectangle({ x: 0, y: A5_HEIGHT - headerHeight, width: 595.28, height: headerHeight, color: pmiRed });

        const logoSize = 56;
        page.drawRectangle({ x: margin, y: A5_HEIGHT - headerHeight + 12, width: logoSize, height: logoSize, color: white });
        const logoDims = logoImage.scale(0.08);
        page.drawImage(logoImage, {
            x: margin + (logoSize - logoDims.width) / 2,
            y: A5_HEIGHT - headerHeight + (logoSize - logoDims.height) / 2 + 12,
            width: logoDims.width,
            height: logoDims.height
        });

        page.drawText("KWITANSI", { x: margin + logoSize + 20, y: A5_HEIGHT - 38, font: boldFont, size: 22, color: white });
        page.drawText("Pendaftaran PMR Kab. Cianjur 2025", { x: margin + logoSize + 20, y: A5_HEIGHT - 55, font: font, size: 10, color: rgb(0.9, 0.9, 0.9) });

        page.drawText("No. Order", { x: 430, y: A5_HEIGHT - 30, font: font, size: 8, color: white });
        page.drawText(registration.customOrderId || '-', { x: 430, y: A5_HEIGHT - 45, font: boldFont, size: 10, color: white });

        // --- Info Sekolah & Tanggal ---
        page.drawText("DITERIMA DARI", { x: margin, y: A5_HEIGHT - 110, font: font, size: 10, color: textGray });
        page.drawText(registration.schoolNameNormalized, { x: margin, y: A5_HEIGHT - 125, font: boldFont, size: 14, color: textBlack });

        page.drawText("TANGGAL PEMBAYARAN", { x: 350, y: A5_HEIGHT - 110, font: font, size: 10, color: textGray });
        page.drawText(new Date(registration.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }), {
            x: 350,
            y: A5_HEIGHT - 125,
            font: boldFont,
            size: 14,
            color: textBlack
        });

        // --- Tabel Biaya ---
        let startY = A5_HEIGHT - 160;
        const rowHeight = 20;

        const formatCurrency = (amount: number) => `Rp ${amount.toLocaleString('id-ID')},-`;
         const participantCount = await prisma.participant.count({
        where: { registrationId: registration.id }
         });
        const companionCount = await prisma.companion.count({
            where: { registrationId: registration.id }
        });
         const rows = [
        ["Biaya Pendaftaran Peserta", `${participantCount} orang`, formatCurrency(registration.totalCostPeserta)],
        ...(companionCount > 0 ? [["Biaya Pendaftaran Pendamping", `${companionCount} orang`, formatCurrency(registration.totalCostPendamping)]] : []),
        ...(registration.totalCostTenda > 0 ? [["Sewa Tenda", "-", formatCurrency(registration.totalCostTenda)]] : []),
    ];

        rows.forEach(([desc, qty, subtotal]) => {
            page.drawText(desc, { x: margin, y: startY, font: font, size: 10, color: textBlack });
            page.drawText(qty, { x: 300, y: startY, font: font, size: 10, color: textGray });
            page.drawText(subtotal, { x: 470, y: startY, font: font, size: 10, color: textBlack });
            startY -= rowHeight;
        });

        // --- Total ---
        page.drawText("Total Dibayar", { x: 350, y: startY - 10, font: boldFont, size: 12, color: textBlack });
        page.drawText(formatCurrency(registration.grandTotal), { x: 470, y: startY - 10, font: boldFont, size: 14, color: pmiRed });

        // --- Footer ---
        page.drawRectangle({ x: 0, y: 0, width: 595.28, height: 70, color: rgb(0.98, 0.98, 0.98) });

        page.drawText("LUNAS", { x: margin, y: 40, font: boldFont, size: 14, color: rgb(0.1, 0.5, 0.2) });
        page.drawText("Kwitansi ini valid dan diterbitkan secara digital oleh sistem pendaftaran PMR Cianjur 2025", {
            x: margin,
            y: 25,
            font: font,
            size: 8,
            color: textGray
        });

        const qrDims = qrImage.scale(0.3);
        page.drawImage(qrImage, { x: 500, y: 10, width: qrDims.width, height: qrDims.height });
        page.drawText("Scan untuk Verifikasi", { x: 500, y: 5, font: font, size: 6, color: textGray });

        // --- Simpan PDF ---
         const pdfBytes = await pdfDoc.save();
        
        const safeOrderId = (orderId).replace(/\//g, '_');
        const receiptPath = `temp/${schoolSlug}/receipts/kwitansi_${safeOrderId}.pdf`;

        const { error: receiptUploadError } = await supabaseAdmin.storage.from('registrations').upload(receiptPath, pdfBytes, { contentType: 'application/pdf', upsert: true });
        if (receiptUploadError) throw new Error(`Gagal mengunggah kwitansi: ${receiptUploadError.message}`);

        await prisma.registration.update({
            where: { id: registrationId },
            data: { receiptTempPath: receiptPath },
        });

        console.log(`[ACTION] Kwitansi PDF untuk ${registrationId} berhasil dibuat.`);
    } catch (error: unknown) {
        // Jika HANYA pembuatan PDF yang gagal, log error tapi jangan gagalkan pendaftaran
        console.error(`[SUBMIT_REGISTRATION_PDF_ERROR] Gagal membuat kwitansi untuk ${registrationId}, tetapi pendaftaran tetap berhasil:`, error);
    }
    // Selalu kembalikan sukses jika langkah kritis (update DB) berhasil
    return { success: true, message: 'Pendaftaran berhasil dikirim! Kwitansi akan segera tersedia.', orderId };
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