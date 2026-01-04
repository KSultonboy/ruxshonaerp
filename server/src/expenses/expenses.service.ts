import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateExpenseDto } from "./dto/create-expense.dto";
import { UpdateExpenseDto } from "./dto/update-expense.dto";

@Injectable()
export class ExpensesService {
    constructor(private prisma: PrismaService) { }

    list() {
        return this.prisma.expense.findMany({
            orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        });
    }

    async create(dto: CreateExpenseDto) {
        try {
            return await this.prisma.expense.create({
                data: {
                    date: dto.date,
                    categoryId: dto.categoryId,
                    amount: dto.amount,
                    paymentMethod: dto.paymentMethod,
                    note: dto.note?.trim() || null,
                },
            });
        } catch {
            throw new BadRequestException("Expense create error (check categoryId)");
        }
    }

    async update(id: string, dto: UpdateExpenseDto) {
        const exists = await this.prisma.expense.findUnique({ where: { id } });
        if (!exists) throw new NotFoundException("Expense not found");

        try {
            await this.prisma.expense.update({
                where: { id },
                data: {
                    ...dto,
                    note: dto.note === undefined ? undefined : dto.note?.trim() || null,
                },
            });
            return { ok: true };
        } catch {
            throw new BadRequestException("Expense update error");
        }
    }

    async remove(id: string) {
        const exists = await this.prisma.expense.findUnique({ where: { id } });
        if (!exists) throw new NotFoundException("Expense not found");
        await this.prisma.expense.delete({ where: { id } });
        return { ok: true };
    }
}
