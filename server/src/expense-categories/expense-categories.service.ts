import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateExpenseCategoryDto } from "./dto/create-expense-category.dto";
import { UpdateExpenseCategoryDto } from "./dto/update-expense-category.dto";

@Injectable()
export class ExpenseCategoriesService {
    constructor(private prisma: PrismaService) { }

    list() {
        return this.prisma.expenseCategory.findMany({ orderBy: { name: "asc" } });
    }

    async create(dto: CreateExpenseCategoryDto) {
        try {
            return await this.prisma.expenseCategory.create({ data: dto });
        } catch {
            throw new BadRequestException("Category already exists");
        }
    }

    async update(id: string, dto: UpdateExpenseCategoryDto) {
        const exists = await this.prisma.expenseCategory.findUnique({ where: { id } });
        if (!exists) throw new NotFoundException("Category not found");
        await this.prisma.expenseCategory.update({ where: { id }, data: dto });
        return { ok: true };
    }

    async remove(id: string) {
        const exists = await this.prisma.expenseCategory.findUnique({ where: { id } });
        if (!exists) throw new NotFoundException("Category not found");
        try {
            await this.prisma.expenseCategory.delete({ where: { id } });
            return { ok: true };
        } catch {
            throw new BadRequestException("Category is in use (expenses).");
        }
    }
}
