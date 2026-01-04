import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@Injectable()
export class ProductsService {
    constructor(private prisma: PrismaService) { }

    list() {
        return this.prisma.product.findMany({
            orderBy: { createdAt: "desc" },
        });
    }

    async create(dto: CreateProductDto) {
        try {
            return await this.prisma.product.create({
                data: {
                    name: dto.name.trim(),
                    type: dto.type,
                    categoryId: dto.categoryId,
                    unitId: dto.unitId,
                    price: dto.price ?? null,
                    active: dto.active ?? true,
                },
            });
        } catch (e: any) {
            throw new BadRequestException("Product create error (check category/unit IDs)");
        }
    }

    async update(id: string, dto: UpdateProductDto) {
        const exists = await this.prisma.product.findUnique({ where: { id } });
        if (!exists) throw new NotFoundException("Product not found");

        try {
            await this.prisma.product.update({
                where: { id },
                data: {
                    ...dto,
                    name: dto.name ? dto.name.trim() : undefined,
                    price: dto.price === undefined ? undefined : dto.price ?? null,
                },
            });
            return { ok: true };
        } catch {
            throw new BadRequestException("Product update error");
        }
    }

    async remove(id: string) {
        const exists = await this.prisma.product.findUnique({ where: { id } });
        if (!exists) throw new NotFoundException("Product not found");
        await this.prisma.product.delete({ where: { id } });
        return { ok: true };
    }
}
