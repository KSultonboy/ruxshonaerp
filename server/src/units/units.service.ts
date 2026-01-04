import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateUnitDto } from "./dto/create-unit.dto";
import { UpdateUnitDto } from "./dto/update-unit.dto";

@Injectable()
export class UnitsService {
    constructor(private prisma: PrismaService) { }

    list() {
        return this.prisma.unit.findMany({ orderBy: { name: "asc" } });
    }

    async create(dto: CreateUnitDto) {
        try {
            return await this.prisma.unit.create({ data: dto });
        } catch (e: any) {
            throw new BadRequestException("Unit create error");
        }
    }

    async update(id: string, dto: UpdateUnitDto) {
        const exists = await this.prisma.unit.findUnique({ where: { id } });
        if (!exists) throw new NotFoundException("Unit not found");
        await this.prisma.unit.update({ where: { id }, data: dto });
        return { ok: true };
    }

    async remove(id: string) {
        const exists = await this.prisma.unit.findUnique({ where: { id } });
        if (!exists) throw new NotFoundException("Unit not found");
        try {
            await this.prisma.unit.delete({ where: { id } });
            return { ok: true };
        } catch {
            throw new BadRequestException("Unit is in use (products).");
        }
    }
}
