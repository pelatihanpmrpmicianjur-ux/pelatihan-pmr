// File: lib/queries.ts
import { prisma } from './db';

export async function getRegistrationDetails(id: string) {
  if (!id) return null;

  try {
    return await prisma.registration.findUnique({
      where: { id },
      select: {
        schoolName: true,
        customOrderId: true,
        status: true,
        createdAt: true,
        grandTotal: true,
      },
    });
  } catch (error) {
    console.error('Database error in getRegistrationDetails:', error);
    return null;
  }
}
