import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, MinLength, Min } from "class-validator";
import { ProductType } from "@prisma/client";
import { Type } from "class-transformer";

export class CreateProductDto {
    @IsString()
    @MinLength(2)
    name: string;

    @IsEnum(ProductType)
    type: ProductType;

    @IsString()
    categoryId: string;

    @IsString()
    unitId: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    price?: number;

    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    active?: boolean;
}
