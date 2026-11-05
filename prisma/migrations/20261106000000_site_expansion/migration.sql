-- AlterTable
ALTER TABLE "SurvayerMessage" ADD COLUMN     "approved" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "chefs_pick" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "SiteSetting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "phone" TEXT,
    "email" TEXT,
    "address_en" TEXT,
    "address_kh" TEXT,
    "map_url" TEXT,
    "map_embed" TEXT,
    "facebook" TEXT,
    "instagram" TEXT,
    "telegram" TEXT,
    "tiktok" TEXT,
    "hours" JSONB,
    "notice" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "party_size" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "time" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "admin_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockedDate" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "reason" TEXT,

    CONSTRAINT "BlockedDate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" SERIAL NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'contact',
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "status" TEXT NOT NULL DEFAULT 'new',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" SERIAL NOT NULL,
    "title_en" TEXT NOT NULL,
    "title_kh" TEXT,
    "type_en" TEXT,
    "type_kh" TEXT,
    "description_en" TEXT,
    "description_kh" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GalleryImage" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "caption_en" TEXT,
    "caption_kh" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GalleryImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" SERIAL NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'offer',
    "title_en" TEXT NOT NULL,
    "title_kh" TEXT,
    "body_en" TEXT,
    "body_kh" TEXT,
    "image_url" TEXT,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faq" (
    "id" SERIAL NOT NULL,
    "question_en" TEXT NOT NULL,
    "question_kh" TEXT,
    "answer_en" TEXT NOT NULL,
    "answer_kh" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Faq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogPost" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "title_kh" TEXT,
    "excerpt_en" TEXT,
    "excerpt_kh" TEXT,
    "cover_url" TEXT,
    "html_en" TEXT NOT NULL DEFAULT '',
    "html_kh" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" SERIAL NOT NULL,
    "actor" TEXT NOT NULL,
    "role" TEXT,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reservation_date_idx" ON "Reservation"("date");

-- CreateIndex
CREATE UNIQUE INDEX "BlockedDate_date_key" ON "BlockedDate"("date");

-- CreateIndex
CREATE INDEX "ContactMessage_kind_status_idx" ON "ContactMessage"("kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPost_slug_key" ON "BlogPost"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");

-- CreateIndex
CREATE INDEX "ActivityLog_created_at_idx" ON "ActivityLog"("created_at");

