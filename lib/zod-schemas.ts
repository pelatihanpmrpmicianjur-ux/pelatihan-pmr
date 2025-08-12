// File: lib/zod-schemas.ts
import { z } from 'zod';

export const SchoolInfoSchema = z.object({
  schoolName: z.string().min(5, { message: "Nama sekolah minimal 5 karakter." }),
  coachName: z.string().min(3, { message: "Nama pembina minimal 3 karakter." }),
  coachPhone: z.string().min(10, { message: "Nomor WhatsApp minimal 10 digit." }).regex(/^(\+62|0)8[1-9][0-9]{7,10}$/, { message: "Format nomor WhatsApp tidak valid." }),
  schoolCategory: z.enum(['Wira', 'Madya'], { message: "Pilih kategori sekolah." }),
});

export type SchoolInfoValues = z.infer<typeof SchoolInfoSchema>;