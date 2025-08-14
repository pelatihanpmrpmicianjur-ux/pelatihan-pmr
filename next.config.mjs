// File: next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
   serverExternalPackages: ['bcrypt', 'bcryptjs'],
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