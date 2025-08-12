// File: app/api/admin/participants/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const participants = await prisma.participant.findMany({
            where: {
                registration: {
                    status: 'CONFIRMED'
                }
            },
            include: {
                registration: {
                    select: {
                        schoolName: true
                    }
                }
            },
            orderBy: {
                registration: {
                    schoolName: 'asc'
                }
            }
        });

        // Olah data agar flat dan mudah digunakan
        const flattenedParticipants = participants.map(p => ({
            id: p.id,
            photoPath: p.photoPath, 
            fullName: p.fullName,
            schoolName: p.registration.schoolName,
            birthInfo: p.birthInfo,
            phone: p.phone,
            gender: p.gender,
            bloodType: p.bloodType,
            address: p.address,
        }));

        return NextResponse.json(flattenedParticipants);
    } catch (error) {
        console.error("Error fetching participants data:", error);
        return NextResponse.json({ message: "Gagal memuat data peserta" }, { status: 500 });
    }
}