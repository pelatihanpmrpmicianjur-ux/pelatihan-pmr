// File: app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth'; // <-- Impor dari file baru

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };