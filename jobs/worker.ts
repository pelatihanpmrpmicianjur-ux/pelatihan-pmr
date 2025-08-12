// File: jobs/worker.ts
import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';
import jobProcessor from './processor'; // <-- KEMBALI KE IMPORT TANPA EKSTENSI
import prisma from './db-client'; // <-- KEMBALI KE IMPORT TANPA EKSTENSI

// Pastikan variabel lingkungan dimuat
import 'dotenv/config'; 

console.log('--- Worker Process Starting ---');

const connectionString = process.env.REDIS_URL;
if (!connectionString) {
    console.error("REDIS_URL environment variable is not set. Worker cannot start.");
    process.exit(1);
}

const connection = new IORedis(connectionString, {
  maxRetriesPerRequest: null,
});

function startWorkers() {
    console.log("Initializing workers...");

    // === CRON WORKER ===
    const cronQueue = new Queue('pmr-cron-jobs', { connection });
    async function setupCronJobs() {
        await cronQueue.add('cleanup-expired-reservations', {}, { repeat: { pattern: '*/5 * * * *' } });
        await cronQueue.add('cleanup-stale-drafts', {}, { repeat: { pattern: '0 1 * * *' } });
        console.log('[Cron] Repeatable jobs have been set up.');
    }
    setupCronJobs();

    const cronWorker = new Worker('pmr-cron-jobs', async (job) => {
        console.log(`[Cron Worker] Processing cron job: ${job.name}`);
        if (job.name === 'cleanup-expired-reservations') {
            const expiredReservations = await prisma.tentReservation.findMany({ where: { expiresAt: { lt: new Date() } } });
            for (const res of expiredReservations) {
                await prisma.$transaction(async (tx) => {
                    await tx.tentType.update({ where: { id: res.tentTypeId }, data: { stockAvailable: { increment: res.quantity } } });
                    await tx.tentReservation.delete({ where: { id: res.id } });
                    console.log(`[Cron] Released reservation ${res.id} for ${res.quantity} tents.`);
                });
            }
        } else if (job.name === 'cleanup-stale-drafts') {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const staleDrafts = await prisma.registration.findMany({ where: { status: 'DRAFT', updatedAt: { lt: thirtyDaysAgo } } });
            if (staleDrafts.length > 0) {
                // TODO: Hapus file dari storage sebelum menghapus record
                await prisma.registration.deleteMany({ where: { id: { in: staleDrafts.map(d => d.id) } } });
                console.log(`[Cron] Deleted ${staleDrafts.length} stale drafts.`);
            }
        }
    }, { connection });


    // === MAIN WORKER ===
    const mainWorker = new Worker('pmr-registration-queue', jobProcessor, {
      connection,
      concurrency: 5,
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    });

    // === EVENT LISTENERS ===
    const setupListeners = (workerInstance: Worker, workerName: string) => {
        workerInstance.on('completed', (job) => {
            console.log(`[${workerName}] Job ${job.id} (type: ${job.name}) has completed.`);
        });
        workerInstance.on('failed', (job, err) => {
            if (job) {
                console.error(`[${workerName}] Job ${job.id} (type: ${job.name}) has failed with ${err.message}`);
            } else {
                console.error(`[${workerName}] An unknown job has failed with ${err.message}`);
            }
        });
    }

    setupListeners(mainWorker, "Main Worker");
    setupListeners(cronWorker, "Cron Worker");

    console.log('All workers are now listening for jobs...');

    return { cronWorker, mainWorker };
}

// Jalankan fungsi untuk memulai semuanya
startWorkers();