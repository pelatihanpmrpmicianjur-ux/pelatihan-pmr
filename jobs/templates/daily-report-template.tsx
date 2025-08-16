// File: jobs/templates/daily-report-template.tsx
import React from 'react';

// Tipe data yang dibutuhkan oleh template
type DailyReportProps = {
    reportDate: string;
    adminName: string;
    registrations: {
        schoolName: string;
        participantCount: number;
        companionCount: number;
        tentInfo: string;
        grandTotal: number;
    }[];
    totalSchools: number;
    totalRevenue: number;
};

const formatCurrency = (amount: number) => `Rp ${amount.toLocaleString('id-ID')},-`;

export const DailyReportTemplate: React.FC<DailyReportProps> = ({
    reportDate,
    adminName,
    registrations,
    totalSchools,
    totalRevenue
}) => {
    return (
        <html lang="id">
            <head>
                <meta charSet="UTF-8" />
                <style>{`
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap');
                    body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; color: #111827; -webkit-print-color-adjust: exact; }
                    .page { width: 210mm; min-height: 297mm; padding: 20mm; margin: auto; background-color: white; }
                    .header { text-align: center; border-bottom: 2px solid black; padding-bottom: 12px; }
                    .header h1 { font-size: 18px; margin: 0; text-transform: uppercase; }
                    .header h2 { font-size: 16px; margin: 4px 0 0; }
                    .header p { font-size: 12px; margin: 2px 0 0; color: #4B5563; }
                    .report-details { margin: 24px 0; }
                    table { width: 100%; border-collapse: collapse; font-size: 10px; }
                    th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
                    th { background-color: #f9fafb; font-weight: 600; }
                    .summary { margin-top: 24px; padding: 16px; border: 1px solid #e5e7eb; background-color: #f9fafb; }
                    .signatures { margin-top: 60px; display: grid; grid-template-columns: repeat(3, 1fr); text-align: center; font-size: 12px; }
                    .signature-box { display: flex; flex-direction: column; justify-content: space-between; height: 120px; }
                `}</style>
            </head>
            <body>
                <div className="page">
                    <header className="header">
                        <h1>Laporan Keuangan Harian</h1>
                        <h2>Pendaftaran PMR Kabupaten Cianjur 2025</h2>
                        <p>Dokumen ini dibuat secara otomatis oleh sistem</p>
                    </header>

                    <div className="report-details">
                        <p><strong>Tanggal Laporan:</strong> {reportDate}</p>
                    </div>
                    
                    <p>Rincian pendaftaran yang dikonfirmasi pada tanggal tersebut:</p>
                    <table>
                        <thead>
                            <tr>
                                <th>No.</th>
                                <th>Nama Sekolah</th>
                                <th style={{ textAlign: 'center' }}>Peserta</th>
                                <th style={{ textAlign: 'center' }}>Pendamping</th>
                                <th>Tenda Disewa</th>
                                <th style={{ textAlign: 'right' }}>Total Biaya</th>
                            </tr>
                        </thead>
                        <tbody>
                            {registrations.map((reg, index) => (
                                <tr key={index}>
                                    <td>{index + 1}</td>
                                    <td>{reg.schoolName}</td>
                                    <td style={{ textAlign: 'center' }}>{reg.participantCount}</td>
                                    <td style={{ textAlign: 'center' }}>{reg.companionCount}</td>
                                    <td>{reg.tentInfo || 'Bawa Sendiri'}</td>
                                    <td style={{ textAlign: 'right' }}>{formatCurrency(reg.grandTotal)}</td>
                                </tr>
                            ))}
                            {registrations.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '24px' }}>Tidak ada pendaftaran yang dikonfirmasi pada hari ini.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    <div className="summary">
                        <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0, marginBottom: '12px' }}>Ringkasan Harian</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <p><strong>Total Sekolah Dikonfirmasi:</strong></p><p>{totalSchools}</p>
                            <p><strong>Total Pemasukan Hari Ini:</strong></p><p style={{ fontWeight: 'bold', color: '#DC2626' }}>{formatCurrency(totalRevenue)}</p>
                        </div>
                    </div>
                    
                    <div className="signatures">
                        <div className="signature-box">
                            <div>
                                <p>Mengetahui,</p>
                                <p style={{ marginTop: '4px' }}><strong>Petugas/Admin</strong></p>
                            </div>
                            <div>
                                <p style={{ borderTop: '1px solid #9ca3af', paddingTop: '4px', display: 'inline-block' }}>{adminName}</p>
                            </div>
                        </div>
                        <div className="signature-box">
                            <div>
                                <p>&nbsp;</p>
                                <p style={{ marginTop: '4px' }}><strong>Koord. Kesekretariatan</strong></p>
                            </div>
                             <div>
                                <p style={{ borderTop: '1px solid #9ca3af', paddingTop: '4px', display: 'inline-block' }}>(.....................................)</p>
                            </div>
                        </div>
                        <div className="signature-box">
                             <div>
                                <p>&nbsp;</p>
                                <p style={{ marginTop: '4px' }}><strong>Bendahara</strong></p>
                            </div>
                             <div>
                                <p style={{ borderTop: '1px solid #9ca3af', paddingTop: '4px', display: 'inline-block' }}>(.....................................)</p>
                            </div>
                        </div>
                    </div>
                </div>
            </body>
        </html>
    );
};