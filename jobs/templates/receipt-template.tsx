// File: jobs/templates/receipt-template.tsx
import React from 'react';

// Tipe data yang dibutuhkan oleh template
type ReceiptTemplateProps = {
    registration: any; // Sebaiknya gunakan tipe Prisma yang lebih spesifik
    logoBase64: string;
    qrCodeBase64: string;
    participantCount: number;
    companionCount: number;
};

// Fungsi helper untuk format mata uang
const formatCurrency = (amount: number) => `Rp ${amount.toLocaleString('id-ID')},-`;

export const ReceiptTemplate: React.FC<ReceiptTemplateProps> = ({
    registration,
    logoBase64,
    qrCodeBase64,
    participantCount,
    companionCount
}) => {
    return (
        <html lang="id">
            <head>
                <meta charSet="UTF-8" />
                <style>{`
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&family=Merriweather:wght@700;900&display=swap');
                    body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; background-color: #f3f4f6; -webkit-print-color-adjust: exact; }
                    .container { width: 800px; margin: auto; background-color: white; border: 1px solid #e5e7eb; box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1); }
                    .pmi-red { color: #DC2626; }
                    .pmi-dark { color: #111827; }
                    .font-serif { font-family: 'Merriweather', serif; }
                `}</style>
            </head>
            <body>
                <div className="container">
                    <header style={{ padding: '32px', color: 'white', position: 'relative', overflow: 'hidden', backgroundColor: '#DC2626' }}>
                        <div style={{ position: 'absolute', right: '-64px', top: '-64px', width: '192px', height: '192px', border: '4px solid rgba(255, 255, 255, 0.2)', borderRadius: '50%' }}></div>
                        <div style={{ position: 'absolute', right: '-32px', top: '-32px', width: '128px', height: '128px', border: '2px solid rgba(255, 255, 255, 0.2)', borderRadius: '50%' }}></div>
                        <div style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{ backgroundColor: 'white', padding: '4px', borderRadius: '6px', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)', flexShrink: 0 }}>
                                    <img src={logoBase64} alt="Logo PMI" width="72" height="72" />
                                </div>
                                <div style={{ textAlign: 'left' }}>
                                    <h1 style={{ fontSize: '30px', fontWeight: 'bold', fontFamily: "'Merriweather', serif", letterSpacing: '-0.025em', margin: 0 }}>KWITANSI</h1>
                                    <p style={{ fontSize: '14px', opacity: 0.9, marginTop: '4px', margin: 0 }}>Pendaftaran PMR Kab. Cianjur 2025</p>
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.8, margin: 0 }}>No. Order</p>
                                <p style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 600, marginTop: '4px', wordBreak: 'break-all', margin: 0 }}>{registration.customOrderId}</p>
                            </div>
                        </div>
                    </header>
                    <main style={{ padding: '32px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '32px', marginBottom: '32px' }}>
                            <div>
                                <p style={{ fontSize: '14px', color: '#6B7280' }}>DITERIMA DARI</p>
                                <p style={{ fontFamily: "'Merriweather', serif", fontSize: '20px', fontWeight: 'bold', color: '#111827', marginTop: '4px' }}>{registration.schoolNameNormalized}</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ fontSize: '14px', color: '#6B7280' }}>TANGGAL PEMBAYARAN</p>
                                <p style={{ fontFamily: "'Merriweather', serif", fontSize: '20px', fontWeight: 'bold', color: '#111827', marginTop: '4px' }}>
                                    {new Date(registration.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </p>
                            </div>
                        </div>
                        <div>
                            <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                                <thead style={{ borderBottom: '2px solid #D1D5DB' }}>
                                    <tr style={{ textAlign: 'left', color: '#6B7280' }}>
                                        <th style={{ padding: '12px 0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deskripsi</th>
                                        <th style={{ padding: '12px 0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', width: '20%' }}>Jumlah</th>
                                        <th style={{ padding: '12px 0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', width: '25%' }}>Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                                        <td style={{ padding: '16px 0', textAlign: 'left', color: '#374151' }}>Biaya Pendaftaran Peserta</td>
                                        <td style={{ padding: '16px 0', textAlign: 'center', color: '#4B5563' }}>{participantCount} orang</td>
                                        <td style={{ padding: '16px 0', textAlign: 'right', fontWeight: 500, color: '#374151' }}>{formatCurrency(registration.totalCostPeserta)}</td>
                                    </tr>
                                    {companionCount > 0 && (
                                    <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                                        <td style={{ padding: '16px 0', textAlign: 'left', color: '#374151' }}>Biaya Pendaftaran Pendamping</td>
                                        <td style={{ padding: '16px 0', textAlign: 'center', color: '#4B5563' }}>{companionCount} orang</td>
                                        <td style={{ padding: '16px 0', textAlign: 'right', fontWeight: 500, color: '#374151' }}>{formatCurrency(registration.totalCostPendamping)}</td>
                                    </tr>
                                    )}
                                    {registration.totalCostTenda > 0 && (
                                    <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                                        <td style={{ padding: '16px 0', textAlign: 'left', color: '#374151' }}>Sewa Tenda</td>
                                        <td style={{ padding: '16px 0', textAlign: 'center', color: '#4B5563' }}>-</td>
                                        <td style={{ padding: '16px 0', textAlign: 'right', fontWeight: 500, color: '#374151' }}>{formatCurrency(registration.totalCostTenda)}</td>
                                    </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end' }}>
                            <div style={{ width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ borderTop: '2px dashed #E5E7EB', margin: '12px 0' }}></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#111827' }}>
                                    <span style={{ fontFamily: "'Merriweather', serif", fontSize: '20px', fontWeight: 'bold' }}>Total Dibayar</span>
                                    <span style={{ fontFamily: "'Merriweather', serif", fontSize: '24px', fontWeight: 'bold', color: '#DC2626' }}>{formatCurrency(registration.grandTotal)}</span>
                                </div>
                            </div>
                        </div>
                    </main>
                    <footer style={{ marginTop: '32px', padding: '32px', borderTop: '2px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB' }}>
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ padding: '12px', backgroundColor: '#DCFCE7', color: '#166534', borderRadius: '6px', display: 'inline-block' }}>
                                <span style={{ fontSize: '20px', fontWeight: 'bold', letterSpacing: '0.1em', textTransform: 'uppercase' }}>LUNAS</span>
                            </div>
                            <p style={{ fontSize: '12px', color: '#6B7280', maxWidth: '320px', marginTop: '16px' }}>
                                Kwitansi ini valid dan diterbitkan secara digital oleh sistem pendaftaran PMR Cianjur 2025.
                            </p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <img src={qrCodeBase64} alt="QR Code" width="90" height="90" />
                            <p style={{ fontFamily: 'sans-serif', fontSize: '10px', marginTop: '8px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scan untuk Verifikasi</p>
                        </div>
                    </footer>
                </div>
            </body>
        </html>
    );
};