// File: lib/auth.ts
import { type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { headers } from 'next/headers';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        
        // ===============================================
        // === PERBAIKAN: Gunakan 'headers()' dengan benar ===
        // ===============================================
        let ip = 'N/A';
        let userAgent = 'N/A';

        try {
            const reqHeaders = await headers();
            ip = reqHeaders.get('x-forwarded-for') || reqHeaders.get('x-vercel-forwarded-for') || 'N/A';
            userAgent = reqHeaders.get('user-agent') || 'N/A';
        } catch (error) {
            // headers() akan melempar error jika dipanggil di luar konteks request
            // (misalnya, saat build). Kita tangkap ini untuk keamanan.
            console.warn("Tidak dapat mengambil headers, mungkin di luar konteks request.");
        }
        // ===============================================
        

        if (!credentials?.username || !credentials?.password) {
          return null;
        }
        
        const username = credentials.username.trim();
        const password = credentials.password;

        if (!username || !password) {
          return null;
        }

        try {
          const user = await prisma.adminUser.findUnique({
            where: { username: username }
          });

          if (!user) {
            console.warn(`Upaya login GAGAL: User tidak ditemukan - '${username}' dari IP: ${ip}`);
            return null;
          }

          const isPasswordValid = await bcrypt.compare(
            password,
            user.password
          );

          if (!isPasswordValid) {
            await prisma.adminLoginHistory.create({
                data: { adminUserId: user.id, ipAddress: ip, userAgent: userAgent, status: 'FAILED' }
            });
            console.warn(`Upaya login GAGAL: Password salah - '${username}' dari IP: ${ip}`);
            return null;
          }
          
          await prisma.adminLoginHistory.create({
            data: { adminUserId: user.id, ipAddress: ip, userAgent: userAgent, status: 'SUCCESS' }
          });
          
          console.log(`Login BERHASIL: '${username}' dari IP: ${ip}`);
          
          return { id: user.id, username: user.username };

        } catch (error) {
          console.error("[AUTHORIZE] Terjadi error kritis saat otentikasi:", error);
          return null;
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    // Tipe 'user' dan 'token' diperluas melalui `types/next-auth.d.ts`
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
      }
      return token;
    },
    async session({ session, token }) {
      // Pastikan session.user ada sebelum menugasinya
      if (session.user && token) {
        session.user.id = token.id;
        session.user.username = token.username;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};