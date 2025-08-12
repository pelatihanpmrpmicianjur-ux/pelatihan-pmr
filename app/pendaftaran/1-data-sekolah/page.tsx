'use client';

import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch, Controller } from "react-hook-form";
import { SchoolInfoSchema, type SchoolInfoValues } from "@/lib/zod-schemas";
import { useDebounce } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getDraftDetailsAction } from '@/actions/registration';

export default function DataSekolahPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [isCheckingName, setIsCheckingName] = useState(false);
    const [validationStatus, setValidationStatus] = useState<{ isValid: boolean; message: string | null }>({ isValid: true, message: null });

    const [draftDetails, setDraftDetails] = useState<{ schoolName: string; updatedAt: string } | null>(null);
    const [isCheckingDraft, setIsCheckingDraft] = useState(true);
    const [showResumeModal, setShowResumeModal] = useState(false);

    const form = useForm<SchoolInfoValues>({
        resolver: zodResolver(SchoolInfoSchema),
        mode: 'onChange',
        defaultValues: {
            schoolName: "",
            coachName: "",
            coachPhone: "",
        },
    });

    const schoolNameValue = useWatch({ control: form.control, name: 'schoolName' });
    const debouncedSchoolName = useDebounce(schoolNameValue, 500);

    useEffect(() => {
        const registrationId = localStorage.getItem('registrationId');
        if (registrationId) {
            const fetchDraftDetails = async () => {
                try {
                    // --- GANTI LOGIKA FETCH DENGAN SERVER ACTION ---
                    const data = await getDraftDetailsAction(registrationId);

                    if (data) {
                        setDraftDetails(data);
                        setShowResumeModal(true);
                    } else {
                        // Jika action mengembalikan null, draf tidak valid
                        localStorage.removeItem('registrationId');
                    }
                } catch (error) {
                    console.error("Gagal memeriksa draf:", error);
                } finally {
                    setIsCheckingDraft(false);
                }
            };
            fetchDraftDetails();
        } else {
            setIsCheckingDraft(false);
        }
    }, []);

    useEffect(() => {
        if (!debouncedSchoolName || debouncedSchoolName.length < 5) {
            setValidationStatus({ isValid: true, message: null });
            return;
        }

        const checkSchoolName = async () => {
            setIsCheckingName(true);
            try {
                const response = await fetch('/api/registrations/validate-school', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ schoolName: debouncedSchoolName }),
                });
                const data = await response.json();
                setValidationStatus(data);
                if (!data.isValid) {
                    form.setError("schoolName", { type: "server", message: data.message });
                } else {
                    form.clearErrors("schoolName");
                }
            } catch (error) {
                console.error("Gagal memvalidasi nama sekolah:", error);
            } finally {
                setIsCheckingName(false);
            }
        };

        checkSchoolName();
    }, [debouncedSchoolName, form]);

    const handleResume = () => {
        toast.info("Sesi pendaftaran dilanjutkan.");
        router.push('/pendaftaran/2-upload-excel');
    };

 const handleStartNew = () => {
    const oldId = localStorage.getItem('registrationId');
    if (oldId) {
        // Hapus semua cache yang mungkin ada untuk ID lama
        localStorage.removeItem(`summary_${oldId}`);
        localStorage.removeItem(`order_${oldId}`);
    }
    localStorage.removeItem('registrationId'); // Hapus ID utama
    setShowResumeModal(false);
    toast.success("Silakan mulai pendaftaran baru.");
};
    
    async function onSubmit(values: SchoolInfoValues) {
        setIsLoading(true);
        const toastId = toast.loading("Membuat draf pendaftaran...");

        try {
            const response = await fetch('/api/registrations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || "Gagal membuat draf pendaftaran.");
            }
            toast.success("Draf berhasil dibuat! Melanjutkan ke langkah berikutnya.", { id: toastId });
            localStorage.setItem('registrationId', data.registrationId);
            router.push('/pendaftaran/2-upload-excel');
        } catch (error: unknown) {
    let errorMessage = "Terjadi kesalahan yang tidak diketahui.";
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    // Gunakan `errorMessage` di toast, console.log, dll.
    toast.error(errorMessage);
}
    }
    
    const school = [
        "SMK Negeri 1 Cianjur",
        "MAN 2 Cianjur",
        "SMP Islam Terpadu Al-Hanif",
        "MTS Negeri 3 Cianjur",
        "SMA Negeri 1 Ciranjang",
    ];

        const pembina = [
        "Ryan Alfaridzy",
        "Sehabudin",
        "Fahmi Firmansyah",
        "Silkia Nada",
        "Andri M. Sidik",
    ];

     const whatsapp = [
        "082212345678910",
        "08512345678910",
        "081912345678910",
    ];

   const renderValidationMessage = () => {
        if (isCheckingName) {
            return <p className="text-sm text-muted-foreground mt-2 flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mengecek ketersediaan...</p>;
        }
        if (validationStatus.message && (debouncedSchoolName?.length || 0) >= 5) {
            return (
                <p className={`text-sm mt-2 flex items-center ${validationStatus.isValid ? 'text-green-600' : 'text-red-600'}`}>
                    {validationStatus.isValid ? <CheckCircle className="mr-2 h-4 w-4" /> : <AlertCircle className="mr-2 h-4 w-4" />}
                    {validationStatus.message}
                </p>
            );
        }
        return null;
    };

       if (isCheckingDraft) {
        return (
            <div className="flex justify-center items-center h-[calc(100vh-200px)]">
                <Loader2 className="h-10 w-10 animate-spin text-red-600" />
            </div>
        );
    }

    return (
        <>
            <AlertDialog open={showResumeModal} onOpenChange={setShowResumeModal}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Sesi Ditemukan!</AlertDialogTitle>
                        <AlertDialogDescription>
                            Kami menemukan draf pendaftaran yang belum selesai untuk <strong>{draftDetails?.schoolName}</strong> yang terakhir diubah pada {draftDetails && new Date(draftDetails.updatedAt).toLocaleString('id-ID')}.
                            <br /><br />
                            Apakah Anda ingin melanjutkan?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <Button variant="outline" onClick={handleStartNew}>Mulai Baru</Button>
                        <Button className="bg-red-600 hover:bg-red-700" onClick={handleResume}>Lanjutkan Pendaftaran</Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Card className="w-full"> 
                <CardHeader>
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-red-600">Langkah 1</p>
                        <CardTitle className="text-3xl font-bold tracking-tight">Informasi Sekolah</CardTitle>
                        <CardDescription>Mulai pendaftaran dengan mengisi data dasar sekolah dan pembina Anda.</CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                       <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pt-4">
                            <FormField
                                control={form.control}
                                name="schoolName"
                                render={({ field }) => (
                                    <FormItem className="grid grid-cols-1 md:grid-cols-3 md:items-center md:gap-4">
                                        <FormLabel className="md:text-right font-semibold">Nama Sekolah</FormLabel>
                                        <div className="md:col-span-2">
                                            <FormControl>
                                                <PlaceholdersAndVanishInput
                                                    placeholders={school}
                                                    onChange={field.onChange}
                                                    onSubmit={(e) => e.preventDefault()}
                                                />
                                            </FormControl>
                                            {renderValidationMessage()}
                                            <FormMessage className="mt-2" />
                                        </div>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="coachName"
                                render={({ field }) => (
                                    <FormItem className="grid grid-cols-1 md:grid-cols-3 md:items-center md:gap-4">
                                        <FormLabel className="md:text-right font-semibold">Nama Pembina/Pelatih</FormLabel>
                                        <div className="md:col-span-2">
                                            <FormControl>
                                                 <PlaceholdersAndVanishInput
                                                    placeholders={pembina}
                                                    onChange={field.onChange}
                                                    onSubmit={(e) => e.preventDefault()}
                                                />
                                            </FormControl>
                                            <FormMessage className="mt-2" />
                                        </div>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="coachPhone"
                                render={({ field }) => (
                                    <FormItem className="grid grid-cols-1 md:grid-cols-3 md:items-center md:gap-4">
                                        <FormLabel className="md:text-right font-semibold">Nomor WhatsApp Aktif</FormLabel>
                                        <div className="md:col-span-2">
                                            <FormControl>
                                                 <PlaceholdersAndVanishInput
                                                    placeholders={whatsapp}
                                                    onChange={field.onChange}
                                                    onSubmit={(e) => e.preventDefault()}
                                                />
                                            </FormControl>
                                            <FormMessage className="mt-2" />
                                        </div>
                                    </FormItem>
                                )}
                            />

                            <Controller
                                control={form.control}
                                name="schoolCategory"
                                render={({ field }) => (
                                    <FormItem className="grid grid-cols-1 md:grid-cols-3 md:items-start md:gap-4 pt-2">
                                        <FormLabel className="md:text-right font-semibold">Kategori Sekolah</FormLabel>
                                        <div className="md:col-span-2">
                                            <FormControl>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <button
                                                        type="button"
                                                        onClick={() => field.onChange('Wira')}
                                                        className={cn("p-4 border rounded-lg text-center transition-all duration-200", field.value === 'Wira' ? "bg-red-600 text-white border-red-700 shadow-lg scale-105" : "bg-gray-100 hover:bg-gray-200")}
                                                    >
                                                        <span className="font-bold block">Wira</span>
                                                        <span className="text-xs">SMA / SMK / MA</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => field.onChange('Madya')}
                                                        className={cn("p-4 border rounded-lg text-center transition-all duration-200", field.value === 'Madya' ? "bg-red-600 text-white border-red-700 shadow-lg scale-105" : "bg-gray-100 hover:bg-gray-200")}
                                                    >
                                                        <span className="font-bold block">Madya</span>
                                                        <span className="text-xs">SMP / MTS</span>
                                                    </button>
                                                </div>
                                            </FormControl>
                                            <FormMessage className="mt-2" />
                                        </div>
                                    </FormItem>
                                )}
                            />
                            
                            {/* Tombol submit sekarang ditempatkan di dalam grid juga untuk alignment yang benar */}
                            <div className="grid grid-cols-1 md:grid-cols-3 md:gap-4">
                                <div className="md:col-start-2 md:col-span-2">
                                    <Button type="submit" size="lg" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold" disabled={isLoading || isCheckingName || !validationStatus.isValid || !form.formState.isValid}>
                                        {isLoading ? <Loader2 className="animate-spin" /> : "Simpan & Lanjutkan"}
                                    </Button>
                                </div>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </>
    );
}