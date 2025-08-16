// File: app/api/admin/generate-report/route.ts
import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import ReactDOMServer from 'react-dom/server';
import React from 'react';
import { DailyReportTemplate } from '@/jobs/templates/daily-report-template';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    const adminName = (session?.user as any)?.username || 'Admin';

    if (!session?.user?.id) {
        return NextResponse.json({ message: 'Akses ditolak. Anda harus login.' }, { status: 401 });
    }

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

        // 2. Olah data untuk dikirim ke template
        const reportData = confirmedRegistrations.map(reg => ({
            schoolName: reg.schoolNameNormalized,
            participantCount: reg._count.participants,
            companionCount: reg._count.companions,
            tentInfo: reg.tentBookings.map(b => `${b.quantity}x ${b.tentType.name}`).join(', '),
            grandTotal: reg.grandTotal,
        }));
        
        const totalRevenue = confirmedRegistrations.reduce((sum, reg) => sum + reg.grandTotal, 0);

        // 3. Render template React menjadi string HTML statis
        const htmlContent = ReactDOMServer.renderToString(
            React.createElement(DailyReportTemplate, {
                reportDate: startDate.toLocaleDateString('id-ID', { dateStyle: 'full' }),
                adminName,
                registrations: reportData,
                totalSchools: confirmedRegistrations.length,
                totalRevenue,
            })
        );
        
        // 4. Gunakan Puppeteer untuk mengubah HTML menjadi PDF
        let pdfBytes: Buffer;
        let browser = null;
        try {
            console.log("[GENERATE_REPORT] Meluncurkan Puppeteer...");
            browser = await puppeteer.launch({ 
                headless: true, 
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox',
                    // Flag tambahan untuk Vercel
                    '--disable-dev-shm-usage',
                    '--single-process'
                ] 
            });
            const page = await browser.newPage();
            // Set konten. `waitUntil: 'networkidle0'` penting agar font eksternal (Google Fonts) sempat dimuat.
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
            throw puppeteerError; // Lempar kembali error agar ditangkap oleh catch utama
        } finally {
            if (browser) {
                await browser.close();
                console.log("[GENERATE_REPORT] Browser Puppeteer ditutup.");
            }
        }
        
        // 5. Kembalikan PDF sebagai string Base64 dalam respons JSON
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