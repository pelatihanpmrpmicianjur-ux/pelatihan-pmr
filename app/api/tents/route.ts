// File: app/api/tents/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const tentTypes = await prisma.tentType.findMany({
      orderBy: {
        capacity: 'asc',
      },
    });
    return NextResponse.json(tentTypes);
  } catch (error) {
    console.error('Error fetching tent types:', error);
    return NextResponse.json({ message: 'Gagal memuat data tenda' }, { status: 500 });
  }
}

// Revalidate data setiap 60 detik untuk mendapatkan stok terbaru
export const revalidate = 60; 