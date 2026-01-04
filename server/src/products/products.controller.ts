import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ProductsService } from "./products.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@Controller("products")
export class ProductsController {
    constructor(private service: ProductsService) { }

    @Get()
    list() {
        return this.service.list();
    }

    @Post()
    create(@Body() dto: CreateProductDto) {
        return this.service.create(dto);
    }

    @Patch(":id")
    update(@Param("id") id: string, @Body() dto: UpdateProductDto) {
        return this.service.update(id, dto);
    }

    @Delete(":id")
    remove(@Param("id") id: string) {
        return this.service.remove(id);
    }
}
