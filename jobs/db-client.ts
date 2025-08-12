// File: jobs/db-client.ts
import { PrismaClient } from '@prisma/client';

// Inisialisasi Prisma Client baru yang bersih, khusus untuk worker.
// Tidak ada pola singleton 'global' di sini.
const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

export default prisma;