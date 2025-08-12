// File: components/shared/admin-header.tsx
'use client'; // <-- INI ADALAH KUNCI UTAMA

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import Image from "next/image"; // Import Image
import { LayoutDashboard, LogOut, Users, Tent, UserCheck } from "lucide-react"; // Import ikon

export const AdminHeader = () => {
    const { data: session } = useSession();

    return (
        <header className="bg-white shadow-md p-4 flex justify-between items-center sticky top-0 z-50">
            <nav className="flex items-center gap-4 md:gap-6">
                <Link href="/admin/dashboard" className="flex items-center gap-2">
                    <Image src="/logo-pmi.png" alt="Logo PMI" width={80} height={80} />
                </Link>
                <div className="h-6 w-px bg-gray-200 hidden md:block"></div>
                <div className="flex items-center gap-2 md:gap-4">
                    <Link href="/admin/dashboard" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                        <LayoutDashboard className="h-4 w-4" />
                        <span className="hidden md:inline">Pendaftaran</span>
                    </Link>
                    <Link href="/admin/participants" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                        <Users className="h-4 w-4" />
                        <span className="hidden md:inline">Peserta</span>
                    </Link>
                    <Link href="/admin/companions" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                        <UserCheck className="h-4 w-4" />
                        <span className="hidden md:inline">Pendamping</span>
                    </Link>
                    <Link href="/admin/tents" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                        <Tent className="h-4 w-4" />
                        <span className="hidden md:inline">Tenda</span>
                    </Link>
                </div>
            </nav>
            <div>
                {session?.user && (
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground hidden lg:inline"> {session.user.name || session.user.username}</span>
                        <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: '/' })}>
                            <LogOut className="h-4 w-4 mr-2" />
                            Logout
                        </Button>
                    </div>
                )}
            </div>
        </header>
    );
}