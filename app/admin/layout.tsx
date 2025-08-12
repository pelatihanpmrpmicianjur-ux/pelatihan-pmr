// File: app/admin/layout.tsx
import AuthProvider from "@/components/providers/session-provider";
import { ReactNode } from "react";
import { AdminHeader } from "@/components/shared/admin-header"; // <-- Impor komponen baru

export default function AdminLayout({ children }: { children: ReactNode }) {
    return (
        <AuthProvider>
            <div className="min-h-screen bg-gray-50">
                <AdminHeader />
                <main className="p-4 md:p-8">
                    {children}
                </main>
            </div>
        </AuthProvider>
    )
}