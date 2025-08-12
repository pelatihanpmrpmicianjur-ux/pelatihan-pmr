// File: jobs/processor.ts

import { Job } from 'bullmq';
import prisma from './db-client';
import { supabaseAdmin } from '../lib/supabase/server';
import path from 'path';
import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib';
import qrcode from 'qrcode';
import { slugify } from '../lib/utils';
import fs from 'fs/promises';
import puppeteer from 'puppeteer';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { ReceiptTemplate } from './templates/receipt-template';
/**
 * Menangani finalisasi pendaftaran setelah dikonfirmasi oleh admin.
 * Tugasnya adalah memindahkan semua file dari folder sementara ke folder permanen
 * dan memperbarui status pendaftaran di database.
 * @param job - Objek job dari BullMQ yang berisi data pendaftaran.
 */
const handleFinalizeRegistration = async (job: Job) => {
  const { registrationId, adminId } = job.data;
  console.log(`[Worker] Memulai finalisasi untuk pendaftaran: ${registrationId}`);
  await job.updateProgress(5);
  
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: { 
        schoolNameNormalized: true, 
        excelTempPath: true,
        paymentProofTempPath: true,
        receiptTempPath: true,
    }
  });

  if (!registration) {
    throw new Error(`Pendaftaran dengan ID ${registrationId} tidak ditemukan.`);
  }

  const schoolSlug = slugify(registration.schoolNameNormalized);
  
  const permanentPaths: {
    excelPath: string | null;
    paymentProofPath: string | null;
    photosPath: string | null;
    receiptPath: string | null;
  } = {
    excelPath: null,
    paymentProofPath: null,
    photosPath: null,
    receiptPath: null,
  };

  try {
    // 1. Pindahkan File Excel Asli
    if (registration.excelTempPath) {
      await job.updateProgress(15);
      const excelFileName = path.basename(registration.excelTempPath);
      const toPath = `permanen/${schoolSlug}/excel/${excelFileName}`;
      
      const { error } = await supabaseAdmin.storage.from('registrations').move(registration.excelTempPath, toPath);
      if (error) {
        console.error(`[Worker] Gagal memindahkan Excel ${registration.excelTempPath}: ${error.message}`);
      } else {
        console.log(`[Worker] Berhasil memindahkan Excel ke: ${toPath}`);
        permanentPaths.excelPath = toPath;
      }
    }

    // 2. Pindahkan Bukti Pembayaran
    if (registration.paymentProofTempPath) {
      await job.updateProgress(30);
      const proofFileName = path.basename(registration.paymentProofTempPath);
      const toPath = `permanen/${schoolSlug}/payment_proofs/${proofFileName}`;
      
      const { error } = await supabaseAdmin.storage.from('registrations').move(registration.paymentProofTempPath, toPath);
      if (error) {
        console.error(`[Worker] Gagal memindahkan bukti bayar ${registration.paymentProofTempPath}: ${error.message}`);
      } else {
        console.log(`[Worker] Berhasil memindahkan bukti bayar ke: ${toPath}`);
        permanentPaths.paymentProofPath = toPath;
      }
    }

    // 3. Pindahkan Kwitansi
    if (registration.receiptTempPath) {
        await job.updateProgress(45);
        const receiptFileName = path.basename(registration.receiptTempPath);
        const toPath = `permanen/${schoolSlug}/receipts/${receiptFileName}`;
        
        const { error } = await supabaseAdmin.storage.from('registrations').move(registration.receiptTempPath, toPath);
        if (error) {
            console.error(`[Worker] Gagal memindahkan kwitansi ${registration.receiptTempPath}: ${error.message}`);
        } else {
            console.log(`[Worker] Berhasil memindahkan kwitansi ke: ${toPath}`);
            permanentPaths.receiptPath = toPath;
        }
    }

    // 4. Pindahkan Folder Foto Peserta & UPDATE PATH di DB secara bersamaan
    await job.updateProgress(60);
    const tempPhotoDir = `temp/${schoolSlug}/photos/`;
    const permanentPhotoDir = `permanen/${schoolSlug}/photos/`;
    const { data: photoFiles } = await supabaseAdmin.storage.from('registrations').list(tempPhotoDir);
    
    if (photoFiles && photoFiles.length > 0) {
      for (const file of photoFiles) {
        const fromPath = `${tempPhotoDir}${file.name}`;
        const toPath = `${permanentPhotoDir}${file.name}`;
        
        // Pindahkan file fisik
        await supabaseAdmin.storage.from('registrations').move(fromPath, toPath);

        // Langsung update path di database setelah file berhasil dipindah
        // Ini memastikan data di DB selalu sinkron dengan lokasi file fisik
        await prisma.participant.updateMany({
            where: {
                photoPath: fromPath // Cari berdasarkan path sementara yang lama
            },
            data: {
                photoPath: toPath // Update dengan path permanen yang baru
            }
        });
      }
      console.log(`[Worker] Berhasil memindahkan dan memperbarui path untuk ${photoFiles.length} foto.`);
      permanentPaths.photosPath = permanentPhotoDir; // Set path folder permanen
    }

    await job.updateProgress(80);

    // 5. Update tabel Registration utama dengan path permanen dan status
    await prisma.$transaction(async (tx) => {
      await tx.registration.update({
          where: { id: registrationId },
          data: {
              status: 'CONFIRMED',
              excelPath: permanentPaths.excelPath,
              paymentProofPath: permanentPaths.paymentProofPath,
              photosPath: permanentPaths.photosPath,
              receiptPath: permanentPaths.receiptPath,
              // Kosongkan semua path sementara
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
              details: { message: 'Pendaftaran dikonfirmasi dan file dipindahkan ke lokasi permanen.' }
          }
      });

      // Ubah reservasi tenda menjadi booking permanen
      const reservations = await tx.tentReservation.findMany({ where: { registrationId }});
      if (reservations.length > 0) {
          await tx.tentBooking.createMany({
              data: reservations.map(r => ({
                  registrationId: r.registrationId,
                  tentTypeId: r.tentTypeId,
                  quantity: r.quantity,
              }))
          });
          await tx.tentReservation.deleteMany({ where: { registrationId } });
      }
    });

    await job.updateProgress(100);
    console.log(`[Worker] Finalisasi untuk pendaftaran ${registrationId} selesai.`);
  } catch (error: any) {
    console.error(`[Worker] Error saat finalisasi pendaftaran ${registrationId}:`, error.message);
    throw error;
  }
};

/**
 * Menangani pembuatan kwitansi PDF setelah pendaftaran berhasil disubmit.
 * @param job - Objek job dari BullMQ yang berisi data pendaftaran.
 */
const handleGenerateReceipt = async (job: Job) => {
    const { registrationId } = job.data;
    console.log(`[Worker] Memulai pembuatan kwitansi (Puppeteer) untuk: ${registrationId}`);
    
    const registration = await prisma.registration.findUnique({ where: { id: registrationId } });
    if (!registration) throw new Error(`Pendaftaran ${registrationId} tidak ditemukan.`);

    // 1. Ambil semua data yang dibutuhkan oleh template
    const participantCount = await prisma.participant.count({ where: { registrationId } });
    const companionCount = await prisma.companion.count({ where: { registrationId } });
    const APP_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const verificationUrl = `${APP_URL}/verifikasi/${registration.id}`;

    // 2. Siapkan aset sebagai Base64 Data URL agar bisa disematkan di HTML
    const qrCodeBase64 = await qrcode.toDataURL(verificationUrl);
    const logoPath = path.join(__dirname, 'assets', 'logo-pmi.png');
    const logoBuffer = await fs.readFile(logoPath);
    const logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    
    // 3. Render komponen React menjadi string HTML
    const htmlContent = ReactDOMServer.renderToString(
        React.createElement(ReceiptTemplate, {
            registration,
            logoBase64,
            qrCodeBase64,
            participantCount,
            companionCount,
        })
    );

    // 4. Gunakan Puppeteer untuk mengubah HTML menjadi PDF
    let browser = null;
    let pdfBytes: Buffer;
    try {
        browser = await puppeteer.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'] // Penting untuk environment server
        });
        const page = await browser.newPage();
        
        // Atur konten halaman dengan HTML kita
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

        // Generate PDF
        const pdfUint8Array = await page.pdf({
    format: 'A4',
    printBackground: true,
});
pdfBytes = Buffer.from(pdfUint8Array);
    } catch (error) {
        console.error("Error saat menggunakan Puppeteer:", error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
    
    // 5. Simpan dan Upload PDF
    const safeOrderId = (registration.customOrderId || `REG-${registration.id}`).replace(/\//g, '_');
    const receiptPath = `temp/${slugify(registration.schoolNameNormalized)}/receipts/kwitansi_${safeOrderId}.pdf`;
    
    const { error: uploadError } = await supabaseAdmin.storage
        .from('registrations')
        .upload(receiptPath, pdfBytes, { contentType: 'application/pdf', upsert: true });

    if (uploadError) throw new Error(`Gagal mengunggah kwitansi: ${uploadError.message}`);

    await prisma.registration.update({
        where: { id: registrationId },
        data: { receiptTempPath: receiptPath },
    });
    
    console.log(`[Worker] Kwitansi (Puppeteer) untuk ${registrationId} berhasil dibuat.`);
};

const handleDeleteRegistration = async (job: Job) => {
    const { schoolNameNormalized } = job.data;
    if (!schoolNameNormalized) {
        throw new Error("schoolNameNormalized dibutuhkan untuk menghapus file.");
    }
    
    const schoolSlug = slugify(schoolNameNormalized);
    console.log(`[Worker] Memulai penghapusan file untuk slug: ${schoolSlug}`);

    // Fungsi helper untuk menghapus semua file dalam sebuah folder
    const deleteFilesInFolder = async (folderPath: string) => {
        const { data: files, error: listError } = await supabaseAdmin.storage
            .from('registrations')
            .list(folderPath, { limit: 1000 }); // Ambil daftar file

        if (listError) {
            console.error(`[Worker] Gagal me-list file di folder ${folderPath}:`, listError.message);
            return 0; // Kembalikan 0 jika gagal
        }

        if (!files || files.length === 0) {
            console.log(`[Worker] Tidak ada file di folder ${folderPath}.`);
            return 0;
        }

        // Buat array path lengkap dari file yang akan dihapus
        const pathsToDelete = files.map(file => `${folderPath}/${file.name}`);
        
        const { data: deletedData, error: deleteError } = await supabaseAdmin.storage
            .from('registrations')
            .remove(pathsToDelete);

        if (deleteError) {
            console.error(`[Worker] Terjadi error saat menghapus file dari ${folderPath}:`, deleteError.message);
            return 0;
        }
        
        const deletedCount = deletedData?.length || 0;
        console.log(`[Worker] Berhasil menghapus ${deletedCount} file dari ${folderPath}.`);
        return deletedCount;
    };

    // Array dari semua subfolder yang mungkin berisi file
    const subfolders = ['excel', 'payment_proofs', 'photos', 'receipts'];
    
    // Hapus konten dari setiap subfolder di 'permanen'
    console.log(`--- Menghapus file di folder 'permanen/${schoolSlug}' ---`);
    for (const subfolder of subfolders) {
        await deleteFilesInFolder(`permanen/${schoolSlug}/${subfolder}`);
    }

    // Hapus konten dari setiap subfolder di 'temp'
    console.log(`--- Menghapus file di folder 'temp/${schoolSlug}' ---`);
    for (const subfolder of subfolders) {
        await deleteFilesInFolder(`temp/${schoolSlug}/${subfolder}`);
    }
    
    console.log(`[Worker] Proses penghapusan file untuk slug ${schoolSlug} selesai.`);
};

/**
 * Wrapper utama yang akan dipanggil oleh worker.
 * Ia akan menentukan fungsi mana yang harus dijalankan berdasarkan nama job.
 * @param job - Objek job dari BullMQ.
 */
const jobProcessor = async (job: Job) => {
  console.log(`[Worker] Menerima job: ${job.name} dengan ID: ${job.id}`);
  
  try {
    switch (job.name) {
      case 'finalize-registration':
        await handleFinalizeRegistration(job);
        break;
      case 'generate-receipt':
        await handleGenerateReceipt(job);
        break;
        case 'delete-registration': // <-- TAMBAHKAN CASE BARU
        await handleDeleteRegistration(job);
        break;
      default:
        throw new Error(`Job dengan nama ${job.name} tidak dikenali.`)
    }
  } catch (error: any) {
    console.error(`[Worker] Job ${job.id} gagal:`, error.message);
    throw error;
  }
};

export default jobProcessor;