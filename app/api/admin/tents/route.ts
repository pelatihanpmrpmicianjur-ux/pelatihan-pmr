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
 const tentBookings = await prisma.tentBooking.findMany({
        where: {
            registration: {
                status: 'CONFIRMED'
            }
        },
        include: {
            registration: { select: { schoolName: true } },
            tentType: true
        },
        orderBy: {
            registration: { schoolName: 'asc' }
        }
    });

    const flattenedTents = tentBookings.map(b => ({
        schoolName: b.registration.schoolName,
        capacity: b.tentType.capacity,
        price: b.tentType.price,
        quantity: b.quantity,
        totalCapacity: b.tentType.capacity * b.quantity
    }));
    
    return NextResponse.json(flattenedTents);
} catch (error) {
        console.error("Error fetching tents data:", error);
        return NextResponse.json({ message: "Gagal memuat data tenda" }, { status: 500 });
    }
}