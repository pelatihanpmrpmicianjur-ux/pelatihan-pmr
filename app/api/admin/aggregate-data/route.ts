// File: app/api/admin/aggregate-data/route.ts
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
        // Ambil semua pendaftaran yang sudah DIKONFIRMASI
        const confirmedRegistrations = await prisma.registration.findMany({
            where: {
                status: 'CONFIRMED'
            },
            include: {
                participants: true,
                companions: true,
                tentBookings: {
                    include: {
                        tentType: true
                    }
                }
            }
        });

        // Olah data agar lebih mudah digunakan di frontend
        const allParticipants = confirmedRegistrations.flatMap(reg => 
            reg.participants.map(p => ({
                ...p,
                schoolName: reg.schoolName, // Tambahkan nama sekolah ke setiap peserta
            }))
        );

        const allCompanions = confirmedRegistrations.flatMap(reg => 
            reg.companions.map(c => ({
                ...c,
                schoolName: reg.schoolName,
            }))
        );

        const allTentBookings = confirmedRegistrations.flatMap(reg => 
            reg.tentBookings.map(b => ({
                schoolName: reg.schoolName,
                capacity: b.tentType.capacity,
                quantity: b.quantity,
                totalCapacity: b.tentType.capacity * b.quantity
            }))
        );

        return NextResponse.json({
            participants: allParticipants,
            companions: allCompanions,
            tents: allTentBookings,
        });

    } catch (error) {
        console.error("Error fetching aggregate data:", error);
        return NextResponse.json({ message: "Gagal memuat data agregat" }, { status: 500 });
    }
}