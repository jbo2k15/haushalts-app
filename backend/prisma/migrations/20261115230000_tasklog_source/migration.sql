-- Familien-Display: Herkunft einer Erledigung (App oder Wanddisplay)
ALTER TABLE "TaskLog" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'app';
