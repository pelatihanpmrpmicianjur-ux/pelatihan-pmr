// File: app/login/page.tsx
import { Suspense } from 'react';
import LoginForm from '@/components/features/login-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Komponen fallback untuk Suspense
const LoginFormSkeleton = () => {
    return (
        <Card className="w-full max-w-md animate-pulse">
            <CardHeader>
                <CardTitle className="text-2xl font-bold text-center">Admin Login</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-10 bg-gray-200 rounded"></div>
                </div>
                <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-10 bg-gray-200 rounded"></div>
                </div>
                <div className="h-10 bg-gray-300 rounded"></div>
            </CardContent>
        </Card>
    );
};

export default function LoginPage() {
    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
            <Suspense fallback={<LoginFormSkeleton />}>
                <LoginForm />
            </Suspense>
        </div>
    );
}