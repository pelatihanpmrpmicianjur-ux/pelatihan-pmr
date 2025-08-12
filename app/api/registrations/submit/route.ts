// File: app/api/registrations/[id]/submit/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase/server';
import { registrationQueue } from '@/lib/queue';
import { slugify } from '@/lib/utils';

function generateOrderId(schoolName: string): string {
  const timestamp = new Date().getTime();
  const month = new Date().toLocaleString('id-ID', { month: 'short' }).toUpperCase();
  const year = new Date().getFullYear();
  const schoolPart = schoolName.replace(/\s+/g, '-').substring(0, 15).toUpperCase();
  return `${schoolPart}${timestamp}/PP-PMICJR/${month}/${year}`;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const paymentProof = formData.get('paymentProof') as File;
    
    // --- AMBIL ID DARI FORMDATA, BUKAN DARI PARAMS ---
    const registrationId = formData.get('registrationId') as string;

    if (!paymentProof) {
        return NextResponse.json({ message: 'Bukti pembayaran wajib diunggah.' }, { status: 400 });
    }
    if (!registrationId) {
        return NextResponse.json({ message: 'ID Pendaftaran tidak ditemukan dalam request.' }, { status: 400 });
    }
    
    const registration = await prisma.registration.findFirst({ 
        where: { id: registrationId, status: 'DRAFT' } 
    });
    if (!registration) {
        return NextResponse.json({ message: 'Pendaftaran tidak ditemukan atau sudah disubmit.' }, { status: 404 });
    }

    const schoolSlug = slugify(registration.schoolNameNormalized);
    const proofPath = `temp/${schoolSlug}/payment_proofs/${Date.now()}_${paymentProof.name}`;
    
    const { error: uploadError } = await supabaseAdmin.storage
        .from('registrations')
        .upload(proofPath, paymentProof, { upsert: true });
    if (uploadError) {
        throw new Error(`Gagal mengunggah bukti pembayaran: ${uploadError.message}`);
    }

    const orderId = generateOrderId(registration.schoolName);
    
    const finalRegistration = await prisma.registration.update({
        where: { id: registrationId },
        data: { status: 'SUBMITTED', customOrderId: orderId, paymentProofTempPath: proofPath }
    });

    await registrationQueue.add('generate-receipt', { registrationId });

    return NextResponse.json({ 
        message: 'Pendaftaran berhasil dikirim! Menunggu verifikasi admin.',
        orderId: finalRegistration.customOrderId,
    });

  } catch (error: unknown) {
    console.error('[SUBMIT_REGISTRATION_ERROR]', error);
    let errorMessage = "Terjadi kesalahan yang tidak diketahui saat mengirim pendaftaran.";
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}