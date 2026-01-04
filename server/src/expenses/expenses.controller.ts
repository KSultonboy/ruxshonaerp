import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ExpensesService } from "./expenses.service";
import { CreateExpenseDto } from "./dto/create-expense.dto";
import { UpdateExpenseDto } from "./dto/update-expense.dto";

@Controller("expenses")
export class ExpensesController {
    constructor(private service: ExpensesService) { }

    @Get()
    list() {
        return this.service.list();
    }

    @Post()
    create(@Body() dto: CreateExpenseDto) {
        return this.service.create(dto);
    }

    @Patch(":id")
    update(@Param("id") id: string, @Body() dto: UpdateExpenseDto) {
        return this.service.update(id, dto);
    }

    @Delete(":id")
    remove(@Param("id") id: string) {
        return this.service.remove(id);
    }
}
