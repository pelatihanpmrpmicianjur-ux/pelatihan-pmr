// File: app/api/admin/companions/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() { // Anda bisa ganti ke GET(_request: Request)
    const session = await getServerSession(authOptions);
    // Anda bisa perkuat dengan if (!session?.user?.id)
    if (!session) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const companions = await prisma.companion.findMany({
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
        const flattenedCompanions = companions.map(c => ({
            id: c.id,
            fullName: c.fullName,
            schoolName: c.registration.schoolName,
            birthInfo: c.birthInfo,
            phone: c.phone,
            gender: c.gender,
            bloodType: c.bloodType,
            address: c.address,
        }));

        return NextResponse.json(flattenedCompanions);
    } catch (error) {
        console.error("Error fetching companions data:", error);
        return NextResponse.json({ message: "Gagal memuat data pendamping" }, { status: 500 });
    }
}