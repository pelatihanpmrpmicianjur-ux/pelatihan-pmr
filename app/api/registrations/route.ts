// File: app/api/registrations/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { normalizeSchoolName } from '@/lib/utils';

const SchoolInfoSchema = z.object({
  schoolName: z.string().min(5, { message: "Nama sekolah minimal 5 karakter." }),
  coachName: z.string().min(3, { message: "Nama pembina minimal 3 karakter." }),
  coachPhone: z.string().min(10, { message: "Nomor WhatsApp minimal 10 digit." }),
  schoolCategory: z.enum(['Wira', 'Madya'], { message: "Pilih kategori sekolah." }),
});

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const validation = SchoolInfoSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ message: 'Data tidak valid', errors: validation.error.flatten().fieldErrors }, { status: 400 });
        }

        const { schoolName, coachName, coachPhone, schoolCategory } = validation.data;
        const normalizedName = normalizeSchoolName(schoolName);
        
        const existingFinalRegistration = await prisma.registration.findFirst({
            where: {
                schoolNameNormalized: normalizedName,
                status: { in: ['SUBMITTED', 'CONFIRMED'] }
            }
        });

        if (existingFinalRegistration) {
            return NextResponse.json({ message: `Sekolah dengan nama "${schoolName}" sudah terdaftar.` }, { status: 409 });
        }

        const newDraft = await prisma.registration.create({
            data: {
                schoolName,
                schoolNameNormalized: normalizedName,
                coachName,
                coachPhone,
                schoolCategory,
                status: 'DRAFT',
            },
        });

        return NextResponse.json({ 
            message: 'Draft pendaftaran berhasil dibuat!',
            registrationId: newDraft.id 
        }, { status: 201 });

    } catch (error) {
        console.error("[REGISTRATION_POST_ERROR]", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}