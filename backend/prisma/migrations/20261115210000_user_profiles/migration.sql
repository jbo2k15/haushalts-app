-- Familien-Display: Profile ohne Anmeldung und Anzeigefarbe pro Person
ALTER TABLE "User" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'account';
ALTER TABLE "User" ADD COLUMN "color" TEXT;
