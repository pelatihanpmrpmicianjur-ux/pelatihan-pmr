// File: app/api/admin/generate-report/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { format } from 'date-fns';

const formatCurrency = (amount: number) => `Rp ${amount.toLocaleString('id-ID')},-`;

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
        
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage(); // A4 Portrait (595.28 x 841.89)
        const { width, height } = page.getSize();
        
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        const margin = 50;
        let currentY = height - margin;

        // Header Dokumen
        page.drawText("LAPORAN KEUANGAN HARIAN", { x: margin, y: currentY, font: boldFont, size: 18 });
        currentY -= 25;
        page.drawText(`Tanggal Laporan: ${format(startDate, 'dd MMMM yyyy')}`, { x: margin, y: currentY, font: font, size: 12 });
        currentY -= 15;
        page.drawText(`Dibuat oleh: ${adminName}`, { x: margin, y: currentY, font: font, size: 10, color: rgb(0.5, 0.5, 0.5) });
        currentY -= 30;

        // Garis pemisah
        page.drawLine({
            start: { x: margin, y: currentY },
            end: { x: width - margin, y: currentY },
            thickness: 1,
            color: rgb(0.9, 0.9, 0.9)
        });
        currentY -= 25;

        // Header Tabel
        const tableTopY = currentY;
        page.drawText("NAMA SEKOLAH", { x: margin, y: tableTopY, font: boldFont, size: 9, color: rgb(0.4, 0.4, 0.4) });
        page.drawText("PESERTA", { x: 300, y: tableTopY, font: boldFont, size: 9, color: rgb(0.4, 0.4, 0.4) });
        page.drawText("PENDAMPING", { x: 380, y: tableTopY, font: boldFont, size: 9, color: rgb(0.4, 0.4, 0.4) });
        page.drawText("TOTAL BIAYA", { x: width - margin - 100, y: tableTopY, font: boldFont, size: 9, color: rgb(0.4, 0.4, 0.4) });
        currentY -= 20;

        // Isi Tabel
        confirmedRegistrations.forEach(reg => {
            page.drawLine({ start: { x: margin, y: currentY + 8 }, end: { x: width - margin, y: currentY + 8 }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) });
            
            page.drawText(reg.schoolNameNormalized, { x: margin, y: currentY, font: font, size: 10 });
            page.drawText(reg._count.participants.toString(), { x: 315, y: currentY, font: font, size: 10 });
            page.drawText(reg._count.companions.toString(), { x: 405, y: currentY, font: font, size: 10 });
            
            const totalText = formatCurrency(reg.grandTotal);
            const textWidth = boldFont.widthOfTextAtSize(totalText, 10);
            page.drawText(totalText, { x: width - margin - textWidth, y: currentY, font: boldFont, size: 10 });
            
            currentY -= 25;
        });

        if (confirmedRegistrations.length === 0) {
            page.drawText("Tidak ada pendaftaran yang dikonfirmasi pada tanggal ini.", { x: margin, y: currentY, font: font, size: 10, color: rgb(0.5, 0.5, 0.5) });
            currentY -= 25;
        }

        // Garis pemisah bawah tabel
        page.drawLine({ start: { x: margin, y: currentY + 15 }, end: { x: width - margin, y: currentY + 15 }, thickness: 1, color: rgb(0.9, 0.9, 0.9) });
        currentY -= 20;
        
        // Ringkasan Total
        const totalSchools = confirmedRegistrations.length;
        const totalRevenue = confirmedRegistrations.reduce((sum, reg) => sum + reg.grandTotal, 0);
        
        const summaryX = width - margin - 280;
        
        page.drawText("Total Sekolah Dikonfirmasi:", { x: summaryX, y: currentY, font: font, size: 11 });
        const schoolsText = `${totalSchools} sekolah`;
        const schoolsWidth = boldFont.widthOfTextAtSize(schoolsText, 11);
        page.drawText(schoolsText, { x: width - margin - schoolsWidth, y: currentY, font: boldFont, size: 11 });
        currentY -= 25;
        
        page.drawText("TOTAL PEMASUKAN HARI INI:", { x: summaryX, y: currentY, font: boldFont, size: 14, color: rgb(0.8, 0, 0) });
        const revenueText = formatCurrency(totalRevenue);
        const revenueWidth = boldFont.widthOfTextAtSize(revenueText, 14);
        page.drawText(revenueText, { x: width - margin - revenueWidth, y: currentY, font: boldFont, size: 14, color: rgb(0.8, 0, 0) });

        // Tanda Tangan
        const signatureY = 80;
        const signatureWidth = 150;
        const signatureX1 = margin;
        const signatureX2 = (width / 2) - (signatureWidth / 2);
        const signatureX3 = width - margin - signatureWidth;
        
        const drawSignatureBox = (x: number, title: string, name: string) => {
            page.drawText(title, { x, y: signatureY + 20, font: font, size: 10, color: rgb(0.5,0.5,0.5) });
            page.drawText(name, { x, y: signatureY - 60, font: boldFont, size: 11 });
            page.drawLine({ start: { x, y: signatureY - 50 }, end: { x: x + signatureWidth, y: signatureY - 50 }, thickness: 0.5 });
        };

        drawSignatureBox(signatureX1, "Petugas / Admin", adminName);
        drawSignatureBox(signatureX2, "Koordinator Kesekretariatan", "(.....................................)");
        drawSignatureBox(signatureX3, "Bendahara", "(.....................................)");

        // Simpan PDF
        const pdfBytes = await pdfDoc.save();

        return NextResponse.json({ 
            success: true, 
            message: "Laporan berhasil dibuat.", 
            pdfBase64: Buffer.from(pdfBytes).toString('base64') 
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Gagal membuat laporan.";
        console.error("[GENERATE_REPORT_API_ERROR]", error);
        return NextResponse.json({ success: false, message: message }, { status: 500 });
    }
}