// File: prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');
  
  // ===============================================
  // HAPUS DATA LAMA DAN ISI DATA TENDA BARU
  // ===============================================
  console.log('Seeding new tent types with images...');
await prisma.tentType.deleteMany({}); // Hapus data lama

await prisma.tentType.createMany({
 data: [
    { name: 'Dome', capacityDisplay: '10-12 Orang', capacity: 12, price: 400000, stockInitial: 300, stockAvailable: 300, imageUrl: '/images/tents/dome-10-12.jpg' },
    { name: 'Dome', capacityDisplay: '20-25 Orang', capacity: 25, price: 600000, stockInitial: 2, stockAvailable: 2, imageUrl: '/images/tents/dome-20-25.png' },
    { name: 'Family', capacityDisplay: '35-40 Orang', capacity: 40, price: 750000, stockInitial: 5, stockAvailable: 5, imageUrl: '/images/tents/family-35-40.jpg' },
    { name: 'Army Dinsos', capacityDisplay: '40-45 Orang', capacity: 45, price: 950000, stockInitial: 4, stockAvailable: 4, imageUrl: '/images/tents/army-dinsos-40-45.png' },
    { name: 'Family Dinsos', capacityDisplay: '15-17 Orang', capacity: 17, price: 750000, stockInitial: 5, stockAvailable: 5, imageUrl: '/images/tents/family-dinsos-15-17.jpg' },
    { name: 'Pleton', capacityDisplay: '80-90 Orang', capacity: 90, price: 1200000, stockInitial: 2, stockAvailable: 2, imageUrl: '/images/tents/pleton-80-90.png' },
    { name: 'Merah Putih Dinsos', capacityDisplay: '100-110 Orang', capacity: 110, price: 1300000, stockInitial: 2, stockAvailable: 2, imageUrl: '/images/tents/merah-putih-dinsos-100-110.jpg' },
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