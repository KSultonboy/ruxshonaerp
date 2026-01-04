import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ExpenseCategoriesService } from "./expense-categories.service";
import { CreateExpenseCategoryDto } from "./dto/create-expense-category.dto";
import { UpdateExpenseCategoryDto } from "./dto/update-expense-category.dto";

@Controller("expense-categories")
export class ExpenseCategoriesController {
    constructor(private service: ExpenseCategoriesService) { }

    @Get()
    list() {
        return this.service.list();
    }

    @Post()
    create(@Body() dto: CreateExpenseCategoryDto) {
        return this.service.create(dto);
    }

    @Patch(":id")
    update(@Param("id") id: string, @Body() dto: UpdateExpenseCategoryDto) {
        return this.service.update(id, dto);
    }

    @Delete(":id")
    remove(@Param("id") id: string) {
        return this.service.remove(id);
    }
}
