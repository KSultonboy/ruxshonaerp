export type ProductType = "PRODUCT" | "INGREDIENT" | "DECOR" | "UTILITY";
export type UserRole = "ADMIN" | "SALES" | "PRODUCTION";
export type StockMovementType = "IN" | "OUT";
export type TransferStatus = "PENDING" | "RECEIVED" | "CANCELED";
export type TransferTargetType = "BRANCH" | "SHOP";
export type ReturnStatus = "PENDING" | "APPROVED" | "REJECTED";
export type ReturnSourceType = "BRANCH" | "SHOP";
export type ShiftStatus = "OPEN" | "CLOSED";
export type BranchWarehouseMode = "CENTRAL" | "SEPARATE";

export type ReceiptTemplateSettings = {
  storeName: string;
  headerLine: string;
  thankYouLine: string;
  footerLine: string;
  paperWidthMm: number;
  baseFontSizePx: number;
  titleFontSizePx: number;
  labelWidthMm: number;
  labelHeightMm: number;
  labelPaddingMm: number;
  labelBarcodeWidthMm: number;
  labelBarcodeHeightMm: number;
  labelNameFontPx: number;
  labelMetaFontPx: number;
  showLabelProductName: boolean;
  showLabelBarcodeText: boolean;
  showLabelProductionDate: boolean;
  showReceiptType: boolean;
  showDate: boolean;
  showBranchBlock: boolean;
  showPaymentMethod: boolean;
  showUnitPrice: boolean;
  showLineTotal: boolean;
  showTotal: boolean;
  showSignatures: boolean;
  showReceiptId: boolean;
};

export type Category = {
  id: string;
  name: string;
};

export type ExpenseCategoryType = "NORMAL" | "SELLABLE";

export type ExpenseCategory = Category & {
  type: ExpenseCategoryType;
  productCategoryId?: string | null;
};

export type Unit = {
  id: string;
  name: string;   // Kilogram, Dona...
  short: string;  // kg, dona...
};

export type Product = {
  id: string;
  name: string;
  barcode?: string;
  type: ProductType;
  categoryId: string;
  unitId: string;
  price?: number;
  salePrice?: number;
  shopPrice?: number;
  images?: string[];
  active: boolean;
  stock: number;
  minStock: number;
  labourPrice: number;
  createdAt: string;  // ISO
  updatedAt: string;  // ISO
};

export type PaymentMethod = "CASH" | "CARD" | "TRANSFER";
export type PaymentSourceType = "BRANCH" | "SHOP";

export type Permission =
  | "USERS_READ"
  | "USERS_WRITE"
  | "BRANCHES_READ"
  | "BRANCHES_WRITE"
  | "SHOPS_READ"
  | "SHOPS_WRITE"
  | "PRODUCTS_READ"
  | "PRODUCTS_WRITE"
  | "EXPENSES_READ"
  | "EXPENSES_WRITE"
  | "WAREHOUSE_READ"
  | "WAREHOUSE_WRITE"
  | "TRANSFERS_READ"
  | "TRANSFERS_WRITE"
  | "TRANSFERS_RECEIVE"
  | "RETURNS_READ"
  | "RETURNS_WRITE"
  | "RETURNS_APPROVE"
  | "SALES_READ"
  | "SALES_WRITE"
  | "PAYMENTS_READ"
  | "PAYMENTS_WRITE"
  | "REPORTS_READ"
  | "ALERTS_READ"
  | "ALERTS_WRITE"
  | "AUDIT_READ";

export type AlertRuleType = "BRANCH_DEBT_LIMIT" | "BRANCH_STOCK_MIN" | "PAYMENT_OVERDUE_DAYS";

export type UserPermission = {
  id: string;
  userId: string;
  permission: Permission;
  branchId?: string | null;
  branch?: { id: string; name: string } | null;
  user?: { id: string; username: string } | null;
  createdAt: string;
};

export type AuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId?: string | null;
  method: string;
  path: string;
  userId?: string | null;
  userRole?: UserRole | null;
  meta?: any;
  createdAt: string;
  user?: { id: string; username: string; role: UserRole } | null;
};

export type AlertRule = {
  id: string;
  type: AlertRuleType;
  threshold: number;
  active: boolean;
  note?: string | null;
  branchId?: string | null;
  productId?: string | null;
  branch?: { id: string; name: string } | null;
  product?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type Alert = {
  type: AlertRuleType;
  ruleId: string;
  message: string;
  branch?: { id: string; name: string } | null;
  product?: { id: string; name: string } | null;
  value?: number;
  threshold?: number;
};

export type ReportOverview = {
  revenue: number;
  expensesTotal: number;
  paymentsTotal: number;
  transfersTotal: number;
  returnsTotal: number;
  netProfit: number;
  debtTotal: number;
};

export type ReportGranularity = "day" | "week" | "month";
export type ReportMetric = "revenue" | "expenses" | "payments" | "transfers" | "returns" | "netProfit" | "debt";
export type ReportSegmentBy =
  | "none"
  | "branch"
  | "shop"
  | "product"
  | "category"
  | "paymentMethod"
  | "sourceType";

export type ReportSeriesPoint = {
  start: string;
  end: string;
  value: number;
};

export type ReportSeries = {
  metric: ReportMetric;
  granularity: ReportGranularity;
  points: ReportSeriesPoint[];
};

export type ReportSegmentRow = {
  key: string;
  label: string;
  value: number;
};

export type ReportExportData = {
  headers: string[];
  rows: (string | number)[][];
};

export type ReportFilters = {
  from?: string;
  to?: string;
  branchId?: string;
  shopId?: string;
  productId?: string;
  categoryId?: string;
  paymentMethod?: PaymentMethod;
  sourceType?: PaymentSourceType;
};

export type Expense = {
  id: string;
  date: string;       // YYYY-MM-DD
  categoryId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  note?: string;
  productId?: string | null;
  quantity?: number | null;
  expenseItemId?: string | null;
  expenseItem?: ExpenseItem | null;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseItem = {
  id: string;
  name: string;
  categoryId: string;
  productId?: string | null;
  product?: { id?: string; name?: string; salePrice?: number };
  createdAt: string;
  updatedAt: string;
};

export type StockMovement = {
  id: string;
  date: string;
  type: StockMovementType;
  quantity: number;
  note?: string;
  productId: string;
  product?: {
    id: string;
    name: string;
    type: ProductType;
    unit?: { name: string; short: string };
  };
  createdById?: string;
  createdAt: string;
  updatedAt: string;
};

export type WarehouseSummary = {
  totalProducts: number;
  totalStock: number;
  lowStockCount: number;
  todayIn: number;
  todayOut: number;
};

export type StatsOverview = {
  productsCount: number;
  categoriesCount: number;
  expensesCount: number;
  branchValue: number;
  workersCount: number;
  branchShopCount: number;
  revenue: number;
  returns: number;
  received: number;
  expensesTotal: number;
  netProfit: number;
};

export type AuthUser = {
  id: string;
  name?: string;
  username: string;
  role: UserRole;
  roleLabel?: string;
  active: boolean;
  branchId?: string | null;
};

export type User = AuthUser & {
  branch?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type Branch = {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  warehouseMode?: BranchWarehouseMode;
  createdAt: string;
  updatedAt: string;
};

export type Shop = {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
};

export type BranchStock = {
  id: string;
  branchId: string;
  productId: string;
  quantity: number;
  product?: {
    id: string;
    name: string;
    barcode?: string;
    type: ProductType;
    salePrice?: number;
    price?: number;
    unit?: { name: string; short: string };
    images?: string[];
  };
  createdAt: string;
  updatedAt: string;
};

export type TransferItem = {
  id: string;
  productId: string;
  quantity: number;
  product?: Product;
};

export type Transfer = {
  id: string;
  date: string;
  status: TransferStatus;
  targetType: TransferTargetType;
  note?: string | null;
  branchId?: string | null;
  shopId?: string | null;
  createdById: string;
  receivedById?: string | null;
  branch?: { id: string; name: string } | null;
  shop?: { id: string; name: string } | null;
  items: TransferItem[];
  createdAt: string;
  updatedAt: string;
};

export type ReturnItem = {
  id: string;
  productId: string;
  quantity: number;
  product?: Product;
};

export type Return = {
  id: string;
  date: string;
  status: ReturnStatus;
  sourceType: ReturnSourceType;
  note?: string | null;
  branchId?: string | null;
  shopId?: string | null;
  createdById: string;
  approvedById?: string | null;
  branch?: { id: string; name: string } | null;
  shop?: { id: string; name: string } | null;
  items: ReturnItem[];
  createdAt: string;
  updatedAt: string;
};

export type Shift = {
  id: string;
  date: string;
  status: ShiftStatus;
  photos: string[];
  branchId: string;
  openedById: string;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Sale = {
  id: string;
  date: string;
  quantity: number;
  paymentMethod: PaymentMethod;
  price: number;
  branchId: string;
  productId: string;
  product?: Product;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export type OrderStatus = "NEW" | "IN_DELIVERY" | "DELIVERED" | "CANCELED";
export type OrderChannel = "WEBSITE" | "TELEGRAM" | "PHONE" | "OTHER";
export type OrderSource = "ERP" | "WEBSITE" | "MOBILE";

export type OrderItem = {
  id: string;
  orderId: string;
  productId?: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type Order = {
  id: string;
  trackCode?: string | null;
  date: string;
  customerName: string;
  phone?: string;
  address?: string;
  source?: OrderSource | string;
  channel: OrderChannel;
  status: OrderStatus;
  total: number;
  note?: string;
  items?: OrderItem[];
  createdAt: string;
  updatedAt: string;
};

export type CashEntrySource = "BRANCH" | "SHOP";

export type CashEntry = {
  id: string;
  date: string;
  sourceType: CashEntrySource;
  sourceId: string;
  branchId?: string | null;
  shopId?: string | null;
  amount: number;
  paymentMethod: PaymentMethod;
  note?: string;
  createdAt: string;
  updatedAt: string;
  branch?: { id: string; name: string } | null;
  shop?: { id: string; name: string } | null;
};

export type PlatformStatus = "CONNECTED" | "DISCONNECTED";
export type PlatformKey = "website" | "telegram" | "mobile";

export type PlatformConfig = {
  key: PlatformKey;
  status: PlatformStatus;
  url?: string;
  username?: string;
  token?: string;
  packageId?: string;
  updatedAt?: string;
  note?: string;
};

export type MarketingStats = {
  totalOrders: number;
  totalSales: number;
  newCustomers: number;
  newOrders: number;
  inDeliveryOrders: number;
  deliveredOrders: number;
  canceledOrders: number;
  recentOrders: number;
  topProducts: { name: string; quantity: number }[];
  couponStats: {
    code: string;
    usedCount: number;
    discount: number;
  }[];
};

export type Coupon = {
  id: string;
  code: string;
  discount: number;
  isPercent: boolean;
  minOrder: number;
  maxUses: number;
  usedCount: number;
  expiresAt?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};
