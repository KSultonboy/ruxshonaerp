import { IsString, MinLength } from "class-validator";

export class CreateUnitDto {
    @IsString()
    @MinLength(1)
    name: string;

    @IsString()
    @MinLength(1)
    short: string;
}
