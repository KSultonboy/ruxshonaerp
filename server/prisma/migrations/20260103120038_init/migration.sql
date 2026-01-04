-- CreateEnum
CREATE TYPE "public"."ProductType" AS ENUM ('PRODUCT', 'INGREDIENT', 'DECOR', 'UTILITY');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER');

-- CreateTable
CREATE TABLE "public"."Unit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExpenseCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."ProductType" NOT NULL,
    "price" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "categoryId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Expense" (
    "id" TEXT NOT NULL,
    "date" VARCHAR(10) NOT NULL,
    "amount" INTEGER NOT NULL,
    "paymentMethod" "public"."PaymentMethod" NOT NULL,
    "note" TEXT,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Unit_name_short_key" ON "public"."Unit"("name", "short");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_name_key" ON "public"."ProductCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_name_key" ON "public"."ExpenseCategory"("name");

-- CreateIndex
CREATE INDEX "Product_type_idx" ON "public"."Product"("type");

-- CreateIndex
CREATE INDEX "Product_active_idx" ON "public"."Product"("active");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "public"."Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_unitId_idx" ON "public"."Product"("unitId");

-- CreateIndex
CREATE INDEX "Expense_date_idx" ON "public"."Expense"("date");

-- CreateIndex
CREATE INDEX "Expense_categoryId_idx" ON "public"."Expense"("categoryId");

-- CreateIndex
CREATE INDEX "Expense_paymentMethod_idx" ON "public"."Expense"("paymentMethod");

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."ProductCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "public"."Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
