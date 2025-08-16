'use server';

import { prisma } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';
import ExcelJS from 'exceljs';
import sharp from 'sharp';
import qrcode from 'qrcode';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import path from 'path';

// Definisikan tipe untuk hasil (return value) dari action


type DraftDetails = {
    schoolName: string;
    updatedAt: string;
} | null;



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
    const uniquePrefix = registrationId.substring(0, 8);
    const schoolSlug = slugify(registration.schoolNameNormalized);
    const newFileName = `${uniquePrefix}-${schoolSlug}${path.extname(fileName)}`;
    const filePath = `temp/${schoolSlug}/excel/${newFileName}`;

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
    const COST_PENDAMPING = 30000;

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

        // ====================================================================
        // === LOGIKA PENCOCOKAN BARU YANG JAUH LEBIH SEDERHANA DAN KETAT ===
        // ====================================================================
        
        // 1. Buat sebuah Map untuk akses gambar yang cepat berdasarkan baris mulainya
        const imageMap = new Map<number, ExcelJS.Image>();
        images.forEach(img => {
            if (img.range?.tl?.nativeCol === 9) { // Hanya gambar di kolom Foto
                const startRow = img.range.tl.nativeRow + 1; // Konversi ke 1-based index
                // Hanya simpan gambar pertama yang ditemukan untuk satu baris, mencegah duplikat
                if (!imageMap.has(startRow)) {
                    imageMap.set(startRow, workbook.getImage(parseInt(img.imageId, 10)));
                }
            }
        });
        
        console.log(`[PHOTO_DEBUG] Total ${imageMap.size} gambar unik dipetakan ke baris.`);
        
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

            if (imageMap.has(rowNumber)) {
                const matchedImage = imageMap.get(rowNumber);
                // Kita tidak lagi butuh imageIdToProcess, langsung simpan buffer-nya
                (rowData as any).imageBufferToProcess = matchedImage?.buffer; 
                console.log(`[PHOTO_DEBUG] Baris ${rowNumber} (${rowData.fullName}): GAMBAR DITEMUKAN.`);
            } else {
                 console.log(`[PHOTO_DEBUG] Baris ${rowNumber} (${rowData.fullName}): TIDAK ADA GAMBAR COCOK.`);
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
        
 await Promise.all(pesertaData.map(async (p: any) => {
            // Cek properti baru: imageBufferToProcess
            if (p.imageBufferToProcess) {
                try {
                    const optimizedBuffer = await sharp(p.imageBufferToProcess).resize({ width: 400, height: 600, fit: 'inside' }).jpeg({ quality: 80 }).toBuffer();
                    const participantSlug = slugify(p.fullName || `peserta-${p.rowNumber}`);
                    const uniqueFileName = `${participantSlug}_${registrationId}_row_${p.rowNumber}.jpeg`;
                    const photoPath = getPhotoPath(schoolSlug, uniqueFileName);
                    const { error } = await supabaseAdmin.storage.from('registrations').upload(photoPath, optimizedBuffer, { contentType: 'image/jpeg', upsert: true });
                    
                    if (error) throw error;
                    p.photoPath = photoPath; // Set path jika berhasil
                } catch (uploadError) {
                    console.error(`Gagal upload foto untuk ${p.fullName}:`, uploadError);
                    p.photoPath = null;
                }
            }
            // Hapus properti sementara
            delete p.imageBufferToProcess;
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
            photoPath: p.photoPath, // Ini akan null jika upload gagal
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
        // --- TAMBAHKAN BLOK INI ---
        schoolInfo: {
            schoolName: registration.schoolName,
            coachName: registration.coachName,
            coachPhone: registration.coachPhone,
            schoolCategory: registration.schoolCategory,
        }
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

export async function getTotalParticipantsAction(registrationId: string): Promise<{ success: boolean; total: number; message: string; }> {
    if (!registrationId) {
        return { success: false, total: 0, message: "ID Pendaftaran tidak valid." };
    }
    try {
        const [participantCount, companionCount] = await Promise.all([
            prisma.participant.count({ where: { registrationId } }),
            prisma.companion.count({ where: { registrationId } })
        ]);
        return { success: true, total: participantCount + companionCount, message: "Total berhasil dihitung." };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Gagal menghitung jumlah peserta.";
        console.error("[GET_TOTAL_PARTICIPANTS_ERROR]", error);
        return { success: false, total: 0, message };
    }
}

export async function reserveTentsAction(
    registrationId: string, 
    reservations: { tentTypeId: number, quantity: number }[]
): Promise<{ success: boolean; message: string; data?: { updatedOrder: { tentTypeId: number, quantity: number }[] } }> {
    const RESERVATION_DURATION_MINUTES = 15;

    console.log(`\n--- [ACTION] reserveTentsAction Dimulai untuk regId: ${registrationId} ---`);
    console.log("Menerima payload `reservations` dari frontend:", JSON.stringify(reservations, null, 2));

    if (!registrationId || !Array.isArray(reservations)) {
        console.error("[ACTION] Validasi gagal: input tidak valid.");
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
            console.error("[ACTION] Validasi gagal: pendaftaran tidak ditemukan.");
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
            console.log("[TRANSACTION] Memulai.");
            // 1. Lepaskan reservasi lama
            const oldReservations = await tx.tentReservation.findMany({ where: { registrationId }, select: { tentTypeId: true, quantity: true }});
            console.log(`[TRANSACTION] Menemukan ${oldReservations.length} reservasi lama untuk dilepaskan.`);
            if (oldReservations.length > 0) {
                // 2. Kembalikan semua stok lama dalam beberapa panggilan paralel, BUKAN loop serial
                const restoreStockPromises = oldReservations.map(oldRes => 
                    tx.tentType.update({
                        where: { id: oldRes.tentTypeId },
                        data: { stockAvailable: { increment: oldRes.quantity } }
                    })
                );
                await Promise.all(restoreStockPromises);
                
                // 3. Hapus semua reservasi lama dalam satu panggilan
                 await tx.tentReservation.deleteMany({ where: { registrationId } });
                console.log("[TRANSACTION] Reservasi lama berhasil dihapus.");
            }

            // 4. Buat semua reservasi baru
             const reservationsToCreate = reservations.filter(r => r.quantity > 0);
            console.log(`[TRANSACTION] Ditemukan ${reservationsToCreate.length} item di payload dengan kuantitas > 0 untuk dibuat.`);
            if (reservationsToCreate.length > 0) {

                // 5. Ambil semua stok baru secara paralel
                const takeStockPromises = reservationsToCreate.map(res =>
                    tx.tentType.update({
                        where: { id: res.tentTypeId, stockAvailable: { gte: res.quantity } },
                        data: { stockAvailable: { decrement: res.quantity } },
                    })
                );
                console.log("[TRANSACTION] Stok berhasil dikurangi. Mencoba membuat record baru...");
                // Menjalankan ini akan melempar error jika ada stok yang tidak cukup
                await Promise.all(takeStockPromises);

                // 6. Buat semua record reservasi baru dalam SATU panggilan
                await tx.tentReservation.createMany({
                    data: reservationsToCreate.map(res => ({
                        registrationId,
                        tentTypeId: res.tentTypeId,
                        quantity: res.quantity,
                        expiresAt
                    }))
                });
                console.log(`[TRANSACTION] Berhasil membuat ${reservationsToCreate.length} record TentReservation baru.`);
            }

            // 3. Hitung dan update total biaya tenda di pendaftaran
            const newTentCost = reservations.reduce((acc, res) => {
                if (res.quantity > 0) {
                    const tentType = tentTypes.find(t => t.id === res.tentTypeId);
                    return acc + (tentType?.price || 0) * res.quantity;
                }
                return acc;
            }, 0); 

                const newGrandTotal = 
                (registration.totalCostPeserta || 0) + 
                (registration.totalCostPendamping || 0) + 
                newTentCost;

            // Update SEMUA biaya terkait dalam satu panggilan
            await tx.registration.update({ 
                where: { id: registrationId }, 
                data: { 
                    totalCostTenda: newTentCost,
                    grandTotal: newGrandTotal // <-- Sekarang `grandTotal` di-update di sini
                } 
            });
            
            await tx.registration.update({ where: { id: registrationId }, data: { totalCostTenda: newTentCost } });
       console.log("[TRANSACTION] Selesai.");
        });



        // 4. Ambil data reservasi terbaru untuk dikirim kembali ke frontend
        const newReservations = await prisma.tentReservation.findMany({
            where: { registrationId },
            select: { tentTypeId: true, quantity: true }
        });
        console.log(`[ACTION] Sukses. Data final di DB: ${JSON.stringify(newReservations, null, 2)}`);
        
        return { 
            success: true, 
            message: 'Reservasi tenda berhasil diperbarui.', 
            data: { updatedOrder: newReservations } 
        };

    } catch (error: unknown) {
        console.error('[RESERVE_TENT_ACTION_ERROR]', error);
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
              tentReservations: { // <-- INI YANG PENTING
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
                grandTotal: registration.grandTotal, 
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


// File: actions/registration.ts





/**
 * Membuat Order ID yang berurutan dan deskriptif.
 * Format: [Nomor Urut]-[Nama Sekolah]/PMR-CJR/[Bulan Romawi]/[Tahun]
 * Contoh: 01-SMKN-1-CIPANAS/PMR-CJR/VIII/2025
 * @param schoolName Nama sekolah dari input pengguna.
 * @returns Promise yang resolve menjadi string Order ID.
 */
async function generateOrderId(schoolName: string): Promise<string> {
  // 1. Dapatkan nomor urut berikutnya
  // Hitung berapa banyak pendaftaran yang sudah "final" (bukan DRAFT)
  const existingRegistrationsCount = await prisma.registration.count({
    where: {
      status: {
        not: 'DRAFT' // Hitung semua yang sudah SUBMITTED, CONFIRMED, atau REJECTED
      }
    }
  });

  const nextRegistrationNumber = existingRegistrationsCount + 1;
  // Format menjadi dua digit dengan nol di depan jika perlu (misal: 1 -> "01")
  const formattedRegistrationNumber = String(nextRegistrationNumber).padStart(2, '0');

  // 2. Siapkan bagian lain dari ID
  const schoolPart = slugify(schoolName).substring(0, 20).toUpperCase();
  const date = new Date();
  const year = date.getFullYear();

  // 3. Konversi bulan menjadi angka Romawi
  const romanMonths = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  const month = romanMonths[date.getMonth()]; // getMonth() mengembalikan 0-11

  // 4. Gabungkan semuanya
  return `${formattedRegistrationNumber}-${schoolPart}/PMR-CJR/${month}/${year}`;
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
    const orderId = await generateOrderId(registration.schoolName);

    try {
        // --- Langkah 1: Upload bukti pembayaran (Operasi I/O Kritis) ---
        const proofPath = `temp/${schoolSlug}/payment_proofs/${Date.now()}_${paymentProof.name}`;
        
        const { error: uploadError } = await supabaseAdmin.storage
            .from('registrations')
            .upload(proofPath, paymentProof, { upsert: true });

        if (uploadError) {
            throw new Error(`Gagal mengunggah bukti pembayaran: ${uploadError.message}`);
        }

         await prisma.$transaction(async (tx) => {
            
            // --- LOGIKA BARU: Perpanjang masa berlaku reservasi tenda ---
            // Beri waktu, misalnya, 7 hari dari sekarang agar admin punya waktu untuk verifikasi
            const newExpiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); 

            const updatedReservations = await tx.tentReservation.updateMany({
                where: { registrationId: registrationId },
                data: { expiresAt: newExpiryDate }
            });

            if (updatedReservations.count > 0) {
                console.log(`[ACTION] Berhasil memperpanjang ${updatedReservations.count} reservasi tenda untuk regId: ${registrationId}`);
            }
            // -----------------------------------------------------------
            
            // Lanjutkan dengan update status registrasi
            await tx.registration.update({
                where: { id: registrationId },
                data: {
                    status: 'SUBMITTED',
                    customOrderId: orderId,
                    paymentProofTempPath: proofPath,
                }
            });
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
                grandTotal: true, // <-- Ambil grandTotal terbaru
                _count: {
                    select: {
                        participants: true,
                        companions: true,
                    }
                }
            }
        });

        if (!dataForReceipt) throw new Error("Data pendaftaran tidak ditemukan untuk membuat kwitansi.");

        const APP_URL = process.env.NEXTAUTH_URL;
        const verificationUrl = `${APP_URL}/verifikasi/${dataForReceipt.id}`;

        const qrCodeImage = await qrcode.toDataURL(verificationUrl, { errorCorrectionLevel: 'H', margin: 1 });
        const qrCodePngBytes = Buffer.from(qrCodeImage.split(',')[1], 'base64');
         const logoUrl = `${APP_URL}/logo-pmi.png`;

            console.log(`[PDF_ASSET_DEBUG] Mencoba mengunduh logo dari: ${logoUrl}`);
            
            const logoResponse = await fetch(logoUrl);
            if (!logoResponse.ok) {
                throw new Error(`Gagal mengunduh file logo. Status: ${logoResponse.status}`);
            }

            // Ubah respons menjadi ArrayBuffer, lalu menjadi Buffer Node.js
            const logoArrayBuffer = await logoResponse.arrayBuffer();
            const logoPngBytes = Buffer.from(logoArrayBuffer);

        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([595.28, 419.53]); // A5 Landscape
        const { height: A5_HEIGHT } = page.getSize();

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
        page.drawText(orderId, { x: 430, y: A5_HEIGHT - 45, font: boldFont, size: 10, color: white });

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
        
        // Gunakan count dari `dataForReceipt._count`
        const participantCount = dataForReceipt._count.participants;
        const companionCount = dataForReceipt._count.companions;

        // Gunakan biaya dari `dataForReceipt`
        const rows = [
            ["Biaya Pendaftaran Peserta", `${participantCount} orang`, formatCurrency(dataForReceipt.totalCostPeserta)],
            ...(companionCount > 0 ? [["Biaya Pendaftaran Pendamping", `${companionCount} orang`, formatCurrency(dataForReceipt.totalCostPendamping)]] : []),
            ...(dataForReceipt.totalCostTenda > 0 ? [["Sewa Tenda", "-", formatCurrency(dataForReceipt.totalCostTenda)]] : []),
        ];

        rows.forEach(([desc, qty, subtotal]) => {
            page.drawText(desc, { x: margin, y: startY, font: font, size: 10, color: textBlack });
            page.drawText(qty, { x: 300, y: startY, font: font, size: 10, color: textGray });
            page.drawText(subtotal, { x: 470, y: startY, font: font, size: 10, color: textBlack });
            startY -= rowHeight;
        });

        // --- Total ---
        // Gunakan grandTotal dari `dataForReceipt`
        page.drawText("Total Dibayar", { x: 350, y: startY - 10, font: boldFont, size: 12, color: textBlack });
        page.drawText(formatCurrency(dataForReceipt.grandTotal), { x: 470, y: startY - 10, font: boldFont, size: 14, color: pmiRed });

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
        
        const safeFileNameBase = orderId.replace(/[^a-zA-Z0-9]/g, '_');
        const receiptPath = `temp/${schoolSlug}/receipts/kwitansi_${safeFileNameBase}.pdf`;

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




// Server action baru untuk mengambil data dengan filter



