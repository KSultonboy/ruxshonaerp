import { IsEnum, IsInt, IsOptional, IsString, Min, MinLength, MaxLength } from "class-validator";
import { PaymentMethod } from "@prisma/client";
import { Type } from "class-transformer";

export class CreateExpenseDto {
    @IsString()
    @MinLength(10)
    @MaxLength(10)
    date: string; // YYYY-MM-DD

    @IsString()
    categoryId: string;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    amount: number;

    @IsEnum(PaymentMethod)
    paymentMethod: PaymentMethod;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    note?: string;
}
