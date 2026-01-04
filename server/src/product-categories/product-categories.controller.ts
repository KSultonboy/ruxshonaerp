import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ProductCategoriesService } from "./product-categories.service";
import { CreateProductCategoryDto } from "./dto/create-product-category.dto";
import { UpdateProductCategoryDto } from "./dto/update-product-category.dto";

@Controller("product-categories")
export class ProductCategoriesController {
    constructor(private service: ProductCategoriesService) { }

    @Get()
    list() {
        return this.service.list();
    }

    @Post()
    create(@Body() dto: CreateProductCategoryDto) {
        return this.service.create(dto);
    }

    @Patch(":id")
    update(@Param("id") id: string, @Body() dto: UpdateProductCategoryDto) {
        return this.service.update(id, dto);
    }

    @Delete(":id")
    remove(@Param("id") id: string) {
        return this.service.remove(id);
    }
}
