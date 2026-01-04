import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProductCategoryDto } from "./dto/create-product-category.dto";
import { UpdateProductCategoryDto } from "./dto/update-product-category.dto";

@Injectable()
export class ProductCategoriesService {
    constructor(private prisma: PrismaService) { }

    list() {
        return this.prisma.productCategory.findMany({ orderBy: { name: "asc" } });
    }

    async create(dto: CreateProductCategoryDto) {
        try {
            return await this.prisma.productCategory.create({ data: dto });
        } catch {
            throw new BadRequestException("Category already exists");
        }
    }

    async update(id: string, dto: UpdateProductCategoryDto) {
        const exists = await this.prisma.productCategory.findUnique({ where: { id } });
        if (!exists) throw new NotFoundException("Category not found");
        await this.prisma.productCategory.update({ where: { id }, data: dto });
        return { ok: true };
    }

    async remove(id: string) {
        const exists = await this.prisma.productCategory.findUnique({ where: { id } });
        if (!exists) throw new NotFoundException("Category not found");
        try {
            await this.prisma.productCategory.delete({ where: { id } });
            return { ok: true };
        } catch {
            throw new BadRequestException("Category is in use (products).");
        }
    }
}
