// File: lib/auth.ts
import { type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

// Definisikan authOptions di sini
export const authOptions: NextAuthOptions = {
  
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        console.log("\n--- [AUTHORIZE] FUNGSI DIPANGGIL ---");
        
        if (!credentials) {
            console.log("[AUTHORIZE] Gagal: Kredensial tidak ada.");
            return null;
        }

        // --- LOG KRUSIAL DI SINI ---
        // Kita akan log kredensial yang diterima, dibungkus tanda kutip untuk melihat spasi
        console.log(`[AUTHORIZE] Username diterima: "${credentials.username}"`);
        console.log(`[AUTHORIZE] Password diterima: "${credentials.password}"`);
        // -----------------------------

        // --- PERBAIKAN: Lakukan .trim() untuk membersihkan spasi ---
        const username = credentials.username.trim();
        const password = credentials.password;
        // --------------------------------------------------------

        if (!username || !password) {
          console.log("[AUTHORIZE] Gagal: Username atau password kosong setelah di-trim.");
          return null;
        }

        try {
          console.log(`[AUTHORIZE] Mencari user: "${username}"`);
          const user = await prisma.adminUser.findUnique({
            where: { username: username } // Gunakan username yang sudah di-trim
          });

          if (!user) {
            console.log(`[AUTHORIZE] Gagal: User '${username}' tidak ditemukan.`);
            return null;
          }
          console.log(`[AUTHORIZE] User ditemukan: ${user.username}`);

          console.log("[AUTHORIZE] Membandingkan password...");
          const isPasswordValid = await bcrypt.compare(
            password, // Gunakan password asli tanpa trim
            user.password
          );

          if (!isPasswordValid) {
            console.log("[AUTHORIZE] Gagal: Password tidak cocok.");
            return null;
          }
          console.log("[AUTHORIZE] Sukses: Password cocok.");
          
          return { id: user.id, username: user.username };

        } catch (error) {
          console.error("[AUTHORIZE] Error kritis:", error);
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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
       session.user.id = token.id;         // <-- Hapus 'as any'
        session.user.username = token.username; // <-- Hapus 'as any'
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};