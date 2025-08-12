-- CreateEnum
CREATE TYPE "public"."RegistrationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CONFIRMED', 'REJECTED');

-- CreateTable
CREATE TABLE "public"."Registration" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "public"."RegistrationStatus" NOT NULL DEFAULT 'DRAFT',
    "schoolName" TEXT NOT NULL,
    "schoolNameNormalized" TEXT NOT NULL,
    "coachName" TEXT,
    "coachPhone" TEXT,
    "schoolCategory" TEXT,
    "totalCostPeserta" INTEGER NOT NULL DEFAULT 0,
    "totalCostPendamping" INTEGER NOT NULL DEFAULT 0,
    "totalCostTenda" INTEGER NOT NULL DEFAULT 0,
    "grandTotal" INTEGER NOT NULL DEFAULT 0,
    "excelTempPath" TEXT,
    "paymentProofTempPath" TEXT,
    "receiptTempPath" TEXT,
    "excelPath" TEXT,
    "photosPath" TEXT,
    "paymentProofPath" TEXT,
    "receiptPath" TEXT,
    "rejectionReason" TEXT,
    "customOrderId" TEXT,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Participant" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "rowNumber" INTEGER,
    "fullName" TEXT NOT NULL,
    "birthInfo" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "religion" TEXT NOT NULL,
    "bloodType" TEXT,
    "entryYear" INTEGER NOT NULL,
    "phone" TEXT,
    "gender" TEXT NOT NULL,
    "photoPath" TEXT,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Companion" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "rowNumber" INTEGER,
    "fullName" TEXT NOT NULL,
    "birthInfo" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "religion" TEXT NOT NULL,
    "bloodType" TEXT,
    "entryYear" INTEGER NOT NULL,
    "phone" TEXT,
    "gender" TEXT NOT NULL,

    CONSTRAINT "Companion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TentType" (
    "id" SERIAL NOT NULL,
    "capacity" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "stockInitial" INTEGER NOT NULL,
    "stockAvailable" INTEGER NOT NULL,

    CONSTRAINT "TentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TentBooking" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "tentTypeId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "TentBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TentReservation" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "tentTypeId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TentReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetRegistrationId" TEXT NOT NULL,
    "details" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AdminUser" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Registration_customOrderId_key" ON "public"."Registration"("customOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_schoolNameNormalized_status_key" ON "public"."Registration"("schoolNameNormalized", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TentType_capacity_key" ON "public"."TentType"("capacity");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "public"."AdminUser"("username");

-- AddForeignKey
ALTER TABLE "public"."Participant" ADD CONSTRAINT "Participant_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "public"."Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Companion" ADD CONSTRAINT "Companion_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "public"."Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TentBooking" ADD CONSTRAINT "TentBooking_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "public"."Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TentBooking" ADD CONSTRAINT "TentBooking_tentTypeId_fkey" FOREIGN KEY ("tentTypeId") REFERENCES "public"."TentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TentReservation" ADD CONSTRAINT "TentReservation_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "public"."Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TentReservation" ADD CONSTRAINT "TentReservation_tentTypeId_fkey" FOREIGN KEY ("tentTypeId") REFERENCES "public"."TentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_targetRegistrationId_fkey" FOREIGN KEY ("targetRegistrationId") REFERENCES "public"."Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
