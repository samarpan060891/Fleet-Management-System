-- CreateTable
CREATE TABLE "option_list_items" (
    "id" TEXT NOT NULL,
    "list_key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "option_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "option_list_items_list_key_value_key" ON "option_list_items"("list_key", "value");
