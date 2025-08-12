// File: app/api/registrations/validate-school/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { normalizeSchoolName } from '@/lib/utils';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { schoolName } = body;

        if (!schoolName || String(schoolName).length < 5) {
            return NextResponse.json({ isValid: true, message: null });
        }

        const normalizedName = normalizeSchoolName(String(schoolName));

        const existingFinalRegistration = await prisma.registration.findFirst({
            where: {
                schoolNameNormalized: normalizedName,
                status: {
                    in: ['SUBMITTED', 'CONFIRMED']
                }
            }
        });

        if (existingFinalRegistration) {
            return NextResponse.json({ 
                isValid: false, 
                message: "Sekolah ini sudah terdaftar dan menyelesaikan pendaftaran." 
            });
        }

        return NextResponse.json({ 
            isValid: true, 
            message: "Nama sekolah tersedia." 
        });

    } catch (error) {
        console.error("[VALIDATE_SCHOOL_NAME_ERROR]", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}