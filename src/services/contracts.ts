import type { Category, Unit, Product, Expense, StockMovement, WarehouseSummary, User } from "@/lib/types";
import type { PaymentMethod, StockMovementType } from "@/lib/types";

// --- DTOs ---
export type ProductCreateDTO = {
  id?: string; // restore uchun
  name: string;
  barcode?: string;
  categoryId: string;
  unitId: string;
  price?: number;
  salePrice?: number;
  shopPrice?: number;
  labourPrice?: number;
  active: boolean;
  images?: string[];
};

export type ProductUpdateDTO = Partial<ProductCreateDTO>;

export type ExpenseCreateDTO = {
  id?: string; // restore uchun
  date: string; // YYYY-MM-DD
  categoryId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  note?: string;
  batchId?: string;
  productId?: string;
  quantity?: number;
  expenseItemId?: string;
};

export type ExpenseUpdateDTO = Partial<ExpenseCreateDTO>;

export type StockMovementCreateDTO = {
  productId: string;
  type: StockMovementType;
  quantity: number;
  date?: string;
  note?: string;
  createdById?: string;
};

export type StockMovementUpdateDTO = Partial<
  Omit<StockMovementCreateDTO, "createdById">
>;

export type CategoryCreateDTO = { name: string };
export type UnitCreateDTO = { name: string; short: string };

// --- Service interfaces (UI shular bilan ishlaydi) ---
export interface IProductsService {
  list(): Promise<Product[]>;
  create(dto: ProductCreateDTO): Promise<Product>;
  update(id: string, dto: ProductUpdateDTO): Promise<void>;
  remove(id: string): Promise<void>;
  uploadImages(id: string, files: File[]): Promise<string[]>;
}

export interface IExpensesService {
  list(): Promise<Expense[]>;
  create(dto: ExpenseCreateDTO): Promise<Expense>;
  update(id: string, dto: ExpenseUpdateDTO): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface ICategoriesService {
  list(): Promise<Category[]>;
  create(name: string): Promise<Category>;
  update(id: string, name: string): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface IUnitsService {
  list(): Promise<Unit[]>;
  create(name: string, short: string): Promise<Unit>;
  update(id: string, patch: { name: string; short: string }): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface IUsersService {
  list(): Promise<User[]>;
  create(dto: { name: string; username: string; password: string; role: string; roleLabel?: string; branchId?: string }): Promise<User>;
  update(
    id: string,
    dto: { name?: string; username?: string; password?: string; role?: string; roleLabel?: string; active?: boolean; branchId?: string }
  ): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface IWarehouseService {
  summary(): Promise<WarehouseSummary>;
  movements(limit?: number): Promise<StockMovement[]>;
  createMovement(dto: StockMovementCreateDTO): Promise<StockMovement>;
  updateMovement(id: string, dto: StockMovementUpdateDTO): Promise<StockMovement>;
  removeMovement(id: string): Promise<void>;
}
