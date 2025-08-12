// File: scripts/force-cleanup.ts
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceKey) {
    throw new Error("Supabase URL atau Service Key tidak ditemukan di .env");
}

const supabaseAdmin = createClient(supabaseUrl, serviceKey);
const BUCKET_NAME = 'registrations';

/**
 * Secara rekursif me-list semua file di dalam sebuah path.
 * @param path Path awal (misalnya, 'permanen/smkn-1-cipanas')
 * @returns Array dari path lengkap semua file.
 */
async function listAllFilesRecursive(path: string): Promise<string[]> {
    let allFiles: string[] = [];
    const { data: items, error } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .list(path, { limit: 1000 });

    if (error) {
        console.error(`Gagal me-list path ${path}:`, error.message);
        return [];
    }
    
    for (const item of items) {
        const currentPath = `${path}/${item.name}`;
        if (item.id === null) { // Ini adalah folder
            // Lakukan panggilan rekursif untuk masuk ke dalam folder
            const subFiles = await listAllFilesRecursive(currentPath);
            allFiles = allFiles.concat(subFiles);
        } else { // Ini adalah file
            allFiles.push(currentPath);
        }
    }
    
    // Jika folder itu sendiri memiliki objek placeholder (kadang terjadi)
    // dan tidak terdeteksi sebagai file, kita tambahkan path folder itu sendiri
    // untuk dicoba dihapus.
    if (items.length === 0 && path !== '') {
        // Ini mungkin tidak perlu, tapi sebagai jaring pengaman
    }

    return allFiles;
}

async function forceCleanupFolder(folderPath: string) {
    console.log(`\n--- Memulai pembersihan paksa untuk folder: '${folderPath}' ---`);

    // 1. Dapatkan daftar lengkap semua file di dalam folder secara rekursif
    const filesToDelete = await listAllFilesRecursive(folderPath);

    if (filesToDelete.length === 0) {
        console.log("Tidak ada file yang ditemukan untuk dihapus. Mencoba menghapus folder itu sendiri.");
        // Jika tidak ada file, coba hapus objek folder itu sendiri
        const { error } = await supabaseAdmin.storage.from(BUCKET_NAME).remove([folderPath]);
        if (error) {
            console.error(`Gagal menghapus objek folder '${folderPath}':`, error.message);
        } else {
            console.log(`Objek folder '${folderPath}' berhasil dihapus.`);
        }
        return;
    }

    console.log(`Ditemukan ${filesToDelete.length} file untuk dihapus:`);
    filesToDelete.forEach(f => console.log(`  - ${f}`));
    
    // 2. Hapus semua file yang ditemukan
    const { data: deletedData, error: deleteError } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .remove(filesToDelete);

    if (deleteError) {
        console.error(`Terjadi error saat menghapus file:`, deleteError.message);
    } else {
        console.log(`Berhasil menghapus ${deletedData?.length || 0} file.`);
    }

    console.log(`--- Pembersihan untuk '${folderPath}' selesai ---`);
}

async function main() {
    // Ganti array ini dengan nama folder yang ingin Anda bersihkan
    const foldersToClean = [
        "permanen/smkn-1-cipanas",
        "permanen/smpit-al-hanif",
        // Tambahkan path lain di sini jika perlu
    ];

    for (const folder of foldersToClean) {
        await forceCleanupFolder(folder);
    }
}

main();