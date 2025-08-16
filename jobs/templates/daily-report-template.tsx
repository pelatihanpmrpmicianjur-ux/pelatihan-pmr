// File: jobs/templates/daily-report-template.tsx
import React from 'react';

// Tipe data yang dibutuhkan oleh template
export type DailyReportProps = {
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
    // Definisi gaya inline untuk kebersihan kode
    const styles = {
        body: { fontFamily: "'Inter', sans-serif", margin: 0, padding: 0, color: '#111827', backgroundColor: '#ffffff', WebkitPrintColorAdjust: 'exact' as const },
        page: { width: '210mm', minHeight: '297mm', padding: '20mm', margin: 'auto', backgroundColor: 'white', boxSizing: 'border-box' as const },
        header: { textAlign: 'center' as const, borderBottom: '2px solid #374151', paddingBottom: '16px', marginBottom: '24px' },
        h1: { fontSize: '20px', margin: 0, textTransform: 'uppercase' as const, fontWeight: 700, letterSpacing: '1px' },
        h2: { fontSize: '16px', margin: '4px 0 0', fontWeight: 400 },
        p: { fontSize: '12px', margin: '2px 0 0', color: '#6B7280' },
        table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '10px', marginTop: '16px' },
        th: { backgroundColor: '#F9FAFB', fontWeight: 600, padding: '10px 8px', border: '1px solid #e5e7eb', textAlign: 'left' as const },
        td: { border: '1px solid #e5e7eb', padding: '8px', verticalAlign: 'top' as const },
        summary: { marginTop: '32px', padding: '16px', border: '1px solid #e5e7eb', backgroundColor: '#F9FAFB', borderRadius: '8px' },
        signatures: { marginTop: '80px', display: 'flex', justifyContent: 'space-between', textAlign: 'center' as const, fontSize: '12px' },
        signatureBox: { width: '180px', display: 'flex', flexDirection: 'column' as const, justifyContent: 'space-between' },
        signatureLine: { borderTop: '1px solid #6B7280', paddingTop: '4px', marginTop: '70px' },
    };

    return (
        <html lang="id">
            <head>
                <meta charSet="UTF-8" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
            </head>
            <body style={styles.body}>
                <div style={styles.page}>
                    <header style={styles.header}>
                        <h1 style={styles.h1}>Laporan Keuangan Harian</h1>
                        <h2 style={styles.h2}>Pendaftaran PMR Kabupaten Cianjur 2025</h2>
                        <p style={styles.p}>Dokumen ini dibuat secara otomatis oleh sistem</p>
                    </header>

                    <div style={{ marginBottom: '24px' }}>
                        <p><strong>Tanggal Laporan:</strong> {reportDate}</p>
                    </div>
                    
                    <p style={{ fontSize: '12px', color: '#374151' }}>Rincian pendaftaran yang dikonfirmasi pada tanggal tersebut:</p>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={{ ...styles.th, width: '5%' }}>No.</th>
                                <th style={{ ...styles.th, width: '25%' }}>Nama Sekolah</th>
                                <th style={{ ...styles.th, width: '10%', textAlign: 'center' }}>Peserta</th>
                                <th style={{ ...styles.th, width: '10%', textAlign: 'center' }}>Pendamping</th>
                                <th style={{ ...styles.th, width: '25%' }}>Tenda Disewa</th>
                                <th style={{ ...styles.th, width: '25%', textAlign: 'right' }}>Total Biaya</th>
                            </tr>
                        </thead>
                        <tbody>
                            {registrations.map((reg, index) => (
                                <tr key={index}>
                                    <td style={{...styles.td, textAlign: 'center'}}>{index + 1}</td>
                                    <td style={styles.td}>{reg.schoolName}</td>
                                    <td style={{ ...styles.td, textAlign: 'center' }}>{reg.participantCount}</td>
                                    <td style={{ ...styles.td, textAlign: 'center' }}>{reg.companionCount}</td>
                                    <td style={styles.td}>{reg.tentInfo}</td>
                                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: 500 }}>{formatCurrency(reg.grandTotal)}</td>
                                </tr>
                            ))}
                            {registrations.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ ...styles.td, textAlign: 'center', padding: '24px', color: '#6B7280' }}>
                                        Tidak ada pendaftaran yang dikonfirmasi pada hari ini.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    <div style={styles.summary}>
                        <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0, marginBottom: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' }}>Ringkasan Harian</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', justifyContent: 'space-between', gap: '8px' }}>
                            <p style={{ margin: 0 }}>Total Sekolah Dikonfirmasi:</p><p style={{ margin: 0, fontWeight: 'bold' }}>{totalSchools}</p>
                            <p style={{ margin: 0 }}>Total Pemasukan Hari Ini:</p><p style={{ margin: 0, fontWeight: 'bold', color: '#DC2626' }}>{formatCurrency(totalRevenue)}</p>
                        </div>
                    </div>
                    
                    <div style={styles.signatures}>
                        <div style={styles.signatureBox}>
                            <p>Petugas/Admin</p>
                            <p style={styles.signatureLine}>{adminName}</p>
                        </div>
                        <div style={styles.signatureBox}>
                            <p>Koord. Kesekretariatan</p>
                            <p style={styles.signatureLine}>(.....................................)</p>
                        </div>
                        <div style={styles.signatureBox}>
                            <p>Bendahara</p>
                            <p style={styles.signatureLine}>(.....................................)</p>
                        </div>
                    </div>
                </div>
            </body>
        </html>
    );
};