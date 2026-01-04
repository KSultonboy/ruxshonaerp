import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./health/health.module";
import { UnitsModule } from "./units/units.module";
import { ProductCategoriesModule } from "./product-categories/product-categories.module";
import { ExpenseCategoriesModule } from "./expense-categories/expense-categories.module";
import { ProductsModule } from "./products/products.module";
import { ExpensesModule } from "./expenses/expenses.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    UnitsModule,
    ProductCategoriesModule,
    ExpenseCategoriesModule,
    ProductsModule,
    ExpensesModule,
  ],
})
export class AppModule { }
