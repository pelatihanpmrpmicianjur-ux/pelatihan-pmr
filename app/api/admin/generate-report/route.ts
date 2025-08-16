// File: app/api/admin/generate-report/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import React from 'react';
import { DailyReportTemplate, type DailyReportProps } from '@/jobs/templates/daily-report-template';

// Tipe untuk satu item registrasi di dalam laporan
type ReportRegistrationItem = DailyReportProps['registrations'][0];

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ message: 'Akses ditolak.' }, { status: 401 });
    }
    const adminName = session.user.username || 'Admin';

    try {
        const { reportDate } = await request.json();
        if (!reportDate || typeof reportDate !== 'string') {
            return NextResponse.json({ message: 'Tanggal laporan (reportDate) harus diisi dan berupa string.' }, { status: 400 });
        }

        const startDate = new Date(reportDate);
        startDate.setUTCHours(0, 0, 0, 0);
        const endDate = new Date(startDate);
        endDate.setUTCDate(startDate.getUTCDate() + 1);

        console.log(`[GENERATE_REPORT] Membuat laporan untuk tanggal: ${startDate.toISOString()}`);

        // 1. Ambil semua data pendaftaran yang dikonfirmasi pada hari tersebut
        const confirmedRegistrations = await prisma.registration.findMany({
            where: {
                status: 'CONFIRMED',
                updatedAt: {
                    gte: startDate,
                    lt: endDate,
                }
            },
            include: {
                _count: { 
                    select: { 
                        participants: true, 
                        companions: true 
                    } 
                },
                tentBookings: { 
                    include: { 
                        tentType: true 
                    } 
                },
            }
        });

        // 2. Olah data agar sesuai dengan tipe yang diharapkan oleh template
        const reportData: ReportRegistrationItem[] = confirmedRegistrations.map(reg => {
            const tentInfo = reg.tentBookings
                .map(booking => `${booking.quantity}x ${booking.tentType.name} (Kap. ${booking.tentType.capacity})`)
                .join(', ');

            return {
                schoolName: reg.schoolNameNormalized,
                participantCount: reg._count.participants,
                companionCount: reg._count.companions,
                tentInfo: tentInfo || 'Bawa Sendiri',
                grandTotal: reg.grandTotal,
            };
        });
        
        const totalRevenue = confirmedRegistrations.reduce((sum, reg) => sum + reg.grandTotal, 0);

        // 3. Gunakan Impor Dinamis untuk pustaka server-only
        const ReactDOMServer = (await import('react-dom/server')).default;
        const puppeteer = (await import('puppeteer')).default;

        // 4. Render template React menjadi string HTML statis
        const htmlContent = ReactDOMServer.renderToString(
            React.createElement(DailyReportTemplate, {
                reportDate: startDate.toLocaleDateString('id-ID', { dateStyle: 'full' }),
                adminName,
                registrations: reportData,
                totalSchools: confirmedRegistrations.length,
                totalRevenue,
            })
        );
        
        // 5. Gunakan Puppeteer untuk mengubah HTML menjadi PDF
        let pdfBytes: Buffer;
        let browser = null;
        try {
            console.log("[GENERATE_REPORT] Meluncurkan Puppeteer...");
            browser = await puppeteer.launch({ 
                headless: true, 
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--single-process'
                ] 
            });
            const page = await browser.newPage();
            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
            
            console.log("[GENERATE_REPORT] Membuat PDF dari HTML...");
            const pdfUint8Array = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '0px',
                    right: '0px',
                    bottom: '0px',
                    left: '0px',
                }
            });
            pdfBytes = Buffer.from(pdfUint8Array);
            console.log(`[GENERATE_REPORT] PDF berhasil dibuat dengan ukuran: ${(pdfBytes.length / 1024).toFixed(2)} KB`);

        } catch (puppeteerError) {
            console.error("Error spesifik saat menggunakan Puppeteer:", puppeteerError);
            throw puppeteerError;
        } finally {
            if (browser) {
                await browser.close();
                console.log("[GENERATE_REPORT] Browser Puppeteer ditutup.");
            }
        }
        
        // 6. Kembalikan PDF sebagai string Base64 dalam respons JSON
        return NextResponse.json({ 
            success: true, 
            message: "Laporan berhasil dibuat.", 
            pdfBase64: pdfBytes.toString('base64') 
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Gagal membuat laporan.";
        console.error("[GENERATE_REPORT_API_ERROR]", error);
        return NextResponse.json({ success: false, message: message }, { status: 500 });
    }
}
