-- Familien-Display: Zugangsschluessel fuer das Wanddisplay
CREATE TABLE "DisplayToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" DATETIME
);

CREATE UNIQUE INDEX "DisplayToken_tokenHash_key" ON "DisplayToken"("tokenHash");
