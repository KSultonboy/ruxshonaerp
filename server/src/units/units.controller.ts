import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { UnitsService } from "./units.service";
import { CreateUnitDto } from "./dto/create-unit.dto";
import { UpdateUnitDto } from "./dto/update-unit.dto";

@Controller("units")
export class UnitsController {
    constructor(private service: UnitsService) { }

    @Get()
    list() {
        return this.service.list();
    }

    @Post()
    create(@Body() dto: CreateUnitDto) {
        return this.service.create(dto);
    }

    @Patch(":id")
    update(@Param("id") id: string, @Body() dto: UpdateUnitDto) {
        return this.service.update(id, dto);
    }

    @Delete(":id")
    remove(@Param("id") id: string) {
        return this.service.remove(id);
    }
}
