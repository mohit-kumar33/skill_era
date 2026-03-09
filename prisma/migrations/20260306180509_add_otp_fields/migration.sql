-- AlterTable
ALTER TABLE "users" ADD COLUMN     "current_otp" TEXT,
ADD COLUMN     "otp_expiry" TIMESTAMPTZ;
