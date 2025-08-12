// File: next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Tambahkan ini agar middleware bisa bekerja dengan benar
  experimental: {
   serverExternalPackages: ['bcrypt', 'bcryptjs'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'silkdkwcccxtouzcjbmx.supabase.co', // <-- PASTIKAN HOSTNAME INI BENAR
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;