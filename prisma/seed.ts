// File: prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');
  
  // ===============================================
  // HAPUS DATA LAMA DAN ISI DATA TENDA BARU
  // ===============================================
  console.log('Deleting old tent types...');
  await prisma.tentType.deleteMany({});
  
  console.log('Seeding new tent types...');
  await prisma.tentType.createMany({
    data: [
      { name: 'Dome', capacityDisplay: '10-12 Orang', capacity: 12, price: 400000, stockInitial: 50, stockAvailable: 50 },
      { name: 'Dome', capacityDisplay: '20-25 Orang', capacity: 25, price: 600000, stockInitial: 30, stockAvailable: 30 },
      { name: 'Family', capacityDisplay: '35-40 Orang', capacity: 40, price: 750000, stockInitial: 20, stockAvailable: 20 },
      { name: 'Family Dinsos', capacityDisplay: '40-45 Orang', capacity: 45, price: 950000, stockInitial: 10, stockAvailable: 10 },
      { name: 'Pleton', capacityDisplay: '80-90 Orang', capacity: 90, price: 1200000, stockInitial: 5, stockAvailable: 5 },
      { name: 'Merah Putih Dinsos', capacityDisplay: '100-110 Orang', capacity: 110, price: 1300000, stockInitial: 5, stockAvailable: 5 },
    ],
  });
  console.log('Seeded 6 new tent types.');

   console.log('Seeding admin users...');

  // 1. Definisikan semua admin yang ingin dibuat dalam sebuah array
  const adminUsersData = [
    { username: 'FahmiFirmansyah', password: 'sekre01' },
    { username: 'Sehabudin', password: 'sekre02' },
    // Tambahkan admin lain di sini jika perlu
  ];

const existingAdmins = await prisma.adminUser.findMany({
      where: { username: { in: adminUsersData.map(u => u.username) } }
  });

  const newAdmins = adminUsersData.filter(
      u => !existingAdmins.some(admin => admin.username === u.username)
  );

  if (newAdmins.length > 0) {
      console.log(`Seeding ${newAdmins.length} new admin users...`);
      for (const adminData of newAdmins) {
          const hashedPassword = await bcrypt.hash(adminData.password, 10);
          await prisma.adminUser.create({
              data: {
                  username: adminData.username,
                  password: hashedPassword,
              },
          });
          console.log(`Admin user created: ${adminData.username}`);
      }
  } else {
      console.log('Admin users are up to date.');
  }

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