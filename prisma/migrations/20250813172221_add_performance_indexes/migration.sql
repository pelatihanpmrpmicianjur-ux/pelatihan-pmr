-- CreateIndex
CREATE INDEX "Companion_registrationId_idx" ON "public"."Companion"("registrationId");

-- CreateIndex
CREATE INDEX "Participant_registrationId_idx" ON "public"."Participant"("registrationId");

-- CreateIndex
CREATE INDEX "Registration_status_idx" ON "public"."Registration"("status");

-- CreateIndex
CREATE INDEX "TentReservation_registrationId_idx" ON "public"."TentReservation"("registrationId");
