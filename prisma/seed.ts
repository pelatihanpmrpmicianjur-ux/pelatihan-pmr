// File: prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // Hapus data tenda lama untuk menghindari duplikat saat seeding ulang
  await prisma.tentType.deleteMany({});
  console.log('Deleted old tent types.');

  await prisma.tentType.createMany({
    data: [
      { capacity: 15, price: 250000, stockInitial: 15, stockAvailable: 15 },
      { capacity: 20, price: 400000, stockInitial: 10, stockAvailable: 10 },
      { capacity: 50, price: 700000, stockInitial: 5, stockAvailable: 5 },
    ],
  });
  console.log('Seeded new tent types.');

   console.log('Seeding admin users...');

  // 1. Definisikan semua admin yang ingin dibuat dalam sebuah array
  const adminUsersData = [
    { username: 'FahmiFirmansyah', password: 'sekre01' },
    { username: 'Sehabudin', password: 'sekre02' },
    // Tambahkan admin lain di sini jika perlu
  ];

  // 2. Hapus semua admin lama untuk memastikan data bersih
  await prisma.adminUser.deleteMany({});
  console.log('Deleted old admin users.');

  // 3. Loop melalui array dan buat setiap admin dengan password yang sudah di-hash
  for (const adminData of adminUsersData) {
    const hashedPassword = await bcrypt.hash(adminData.password, 10);
    await prisma.adminUser.create({
      data: {
        username: adminData.username,
        password: hashedPassword,
      },
    });
    console.log(`Admin user created -> username: ${adminData.username}, password: ${adminData.password}`);
  }
  // ===============================================
  // PERUBAHAN SELESAI
  // ===============================================

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });