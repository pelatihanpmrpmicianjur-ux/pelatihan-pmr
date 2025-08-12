// File: lib/queue.ts
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

// Gunakan koneksi string dari environment variable
const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

// --- PERBAIKI DEFINISI TIPE DI SINI ---
type JobPayloads = {
  'finalize-registration': { registrationId: string; adminId: string };
  'generate-receipt': { registrationId: string };
  'delete-registration': { schoolNameNormalized: string };
};

type JobNames = keyof JobPayloads;

// Buat instance queue dengan nama 'pmr-registration-queue'
// dan tipe data yang sudah diperbarui
export const registrationQueue = new Queue<JobPayloads[JobNames], void, JobNames>(
    'pmr-registration-queue', 
    { connection }
);

// Jika Anda ingin lebih sederhana, bisa juga seperti ini:
// export const registrationQueue = new Queue<any>('pmr-registration-queue', { connection });
// Tapi menggunakan tipe eksplisit jauh lebih aman.