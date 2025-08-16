'use server';

// Semua impor "berat" dan server-only ada di sini
import puppeteer from 'puppeteer';
import ReactDOMServer from 'react-dom/server';
import React from 'react';
import { DailyReportTemplate } from '@/jobs/templates/daily-report-template';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function generateDailyReportAction(reportDate: string): Promise<{ success: boolean, message: string, pdfBase64?: string }> {
    const session = await getServerSession(authOptions);
    const adminName = (session?.user as any)?.username || 'Admin';

    if (!session?.user?.id) {
        return { success: false, message: "Akses ditolak." };
    }

    try {
        const startDate = new Date(reportDate);
        startDate.setUTCHours(0, 0, 0, 0); // Mulai dari awal hari (UTC)
        const endDate = new Date(startDate);
        endDate.setUTCDate(startDate.getUTCDate() + 1); // Hingga awal hari berikutnya

        // 1. Ambil semua data yang dikonfirmasi pada hari tersebut
        const confirmedRegistrations = await prisma.registration.findMany({
            where: {
                status: 'CONFIRMED',
                updatedAt: { // Kita gunakan `updatedAt` karena saat konfirmasi kolom ini berubah
                    gte: startDate,
                    lt: endDate,
                }
            },
            include: {
                _count: { select: { participants: true, companions: true } },
                tentBookings: { include: { tentType: true } },
            }
        });

        // 2. Olah data untuk template
        const reportData = confirmedRegistrations.map(reg => ({
            schoolName: reg.schoolNameNormalized,
            participantCount: reg._count.participants,
            companionCount: reg._count.companions,
            tentInfo: reg.tentBookings.map(b => `${b.quantity}x ${b.tentType.name}`).join(', '),
            grandTotal: reg.grandTotal,
        }));
        
        const totalRevenue = confirmedRegistrations.reduce((sum, reg) => sum + reg.grandTotal, 0);

        // 3. Render template React menjadi HTML
        const htmlContent = ReactDOMServer.renderToString(
            React.createElement(DailyReportTemplate, {
                reportDate: startDate.toLocaleDateString('id-ID', { dateStyle: 'full' }),
                adminName,
                registrations: reportData,
                totalSchools: confirmedRegistrations.length,
                totalRevenue,
            })
        );
        
        // 4. Gunakan Puppeteer untuk membuat PDF
        let pdfBytes: Buffer;
        let browser = null;
        try {
            browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
            const page = await browser.newPage();
            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
            const pdfUint8Array = await page.pdf({ format: 'A4', printBackground: true });
            pdfBytes = Buffer.from(pdfUint8Array);
        } finally {
            if (browser) await browser.close();
        }
        
        // 5. Kembalikan PDF sebagai string Base64
        return {
            success: true,
            message: "Laporan berhasil dibuat.",
            pdfBase64: pdfBytes.toString('base64'),
        };

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Gagal membuat laporan.";
        console.error("[GENERATE_REPORT_ERROR]", error);
        return { success: false, message };
    }
}
