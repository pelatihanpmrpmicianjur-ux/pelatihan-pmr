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
        if (!credentials?.username || !credentials?.password) {
          return null;
        }
        const user = await prisma.adminUser.findUnique({
          where: { username: credentials.username }
        });
        if (!user) {
          return null;
        }
        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );
        if (!isPasswordValid) {
          return null;
        }
        return {
          id: user.id,
          username: user.username,
        };
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