"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import Modal from "@/components/ui/Modal";
import Receipt from "@/components/pos/Receipt";
import { branchesService } from "@/services/branches";
import { salesService } from "@/services/sales";
import { telegramCashbackService } from "@/services/telegram-cashback";
import { printCurrentWindowByMode } from "@/lib/desktop-printer";
import { formatDigitsWithSpaces } from "@/lib/mask";
import type {
  Branch,
  BranchStock,
  PaymentMethod,
  SaleHistoryGroup,
  TelegramCashbackUser,
} from "@/lib/types";

interface ProductLookupResult {
  product: {
    id: string;
    name: string;
    barcode?: string;
    salePrice?: number;
    price?: number;
  };
  stock?: {
    quantity: number;
  };
}

interface CartItem {
  barcode: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  stock: number;
}

type PendingCartItem = Omit<CartItem, "quantity">;

interface CustomerSession {
  id: string;
  label: string;
  cartItems: CartItem[];
  pendingItem: PendingCartItem | null;
  quantityInput: string;
  payment: PaymentMethod;
  cashbackBarcode: string;
  cashbackRedeemAmount: string;
  cashbackUser: TelegramCashbackUser | null;
}

interface SaleReceiptData {
  id: string;
  date: string;
  productName: string;
  quantity: number;
  price?: number;
  paymentMethod?: PaymentMethod;
  branchName?: string;
  subtotal?: number;
  cashbackUsed?: number;
  cashbackEarned?: number;
  finalPaid?: number;
  cashbackBalance?: number;
  items?: Array<{
    name: string;
    quantity: number;
    price?: number;
  }>;
}

type SidebarMode = "customers" | "history";

function sanitizeDecimalInput(value: string) {
  let normalized = value.replace(",", ".").replace(/[^0-9.]/g, "");
  const firstDot = normalized.indexOf(".");
  if (firstDot >= 0) {
    normalized = normalized.slice(0, firstDot + 1) + normalized.slice(firstDot + 1).replace(/\./g, "");
  }
  return normalized;
}

function parseQuantity(value: string) {
  const parsed = Number.parseFloat(sanitizeDecimalInput(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function sanitizeMoneyInput(value: string) {
  return value.replace(/\D/g, "");
}

function parseMoneyInput(value: string) {
  const parsed = Number.parseInt(sanitizeMoneyInput(value), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function extractErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    const raw = error.message;
    const apiPayload = raw.match(/^API\s+\d+:\s*(.*)$/s)?.[1]?.trim() ?? raw;
    if (apiPayload.startsWith("{") || apiPayload.startsWith("[")) {
      try {
        const parsed = JSON.parse(apiPayload) as { message?: string | string[] };
        const message = Array.isArray(parsed.message)
          ? parsed.message.join(", ")
          : parsed.message;
        if (message && String(message).trim()) return String(message);
      } catch {
        // no-op
      }
    }
    return raw;
  }
  return fallback;
}

function isMembershipVerificationError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("tasdiqlanmagan") ||
    normalized.includes("a'zolik") ||
    normalized.includes("membership")
  );
}

function formatMoney(value: number) {
  return formatDigitsWithSpaces(String(Math.round(value || 0)));
}

function paymentLabel(payment: PaymentMethod, t: (key: string) => string) {
  if (payment === "CARD") return t("Karta");
  if (payment === "TRANSFER") return t("O'tkazma");
  return t("Naqd");
}

function todayIso() {
  const now = new Date();
  const tzOffsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 10);
}

function createSaleGroupId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sale-group-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function formatHistoryDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

async function waitForNextPaint() {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function createCustomerSession(index: number): CustomerSession {
  return {
    id: `customer-${index + 1}`,
    label: `Mijoz ${index + 1}`,
    cartItems: [],
    pendingItem: null,
    quantityInput: "",
    payment: "CASH",
    cashbackBarcode: "",
    cashbackRedeemAmount: "",
    cashbackUser: null,
  };
}

export default function SalesCashierPage() {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const { user } = useAuth();
  const barcodeRef = useRef<HTMLInputElement>(null);
  const quantityRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cashbackInputRef = useRef<HTMLInputElement>(null);
  const submitInProgressRef = useRef(false);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<string | undefined>(user?.branchId ?? undefined);
  const [barcode, setBarcode] = useState("");
  const [activeCustomerIndex, setActiveCustomerIndex] = useState(0);
  const [customerSessions, setCustomerSessions] = useState<CustomerSession[]>(() =>
    Array.from({ length: 5 }, (_, index) => createCustomerSession(index))
  );
  const [lookupLoading, setLookupLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const [searchOpen, setSearchOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [cashbackOpen, setCashbackOpen] = useState(false);
  const [confirmPrintOpen, setConfirmPrintOpen] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>("customers");
  const [confirmClearCustomerIndex, setConfirmClearCustomerIndex] = useState<number | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogItems, setCatalogItems] = useState<BranchStock[]>([]);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [todaySalesTotal, setTodaySalesTotal] = useState(0);
  const [todaySalesLoading, setTodaySalesLoading] = useState(false);
  const [cashbackLookupLoading, setCashbackLookupLoading] = useState(false);
  const [recentSalesLoading, setRecentSalesLoading] = useState(false);
  const [recentSaleGroups, setRecentSaleGroups] = useState<SaleHistoryGroup[]>([]);
  const [historyActionBusyId, setHistoryActionBusyId] = useState<string | null>(null);
  const [editingHistoryGroup, setEditingHistoryGroup] = useState<SaleHistoryGroup | null>(null);
  const [lastSale, setLastSale] = useState<SaleReceiptData | null>(null);
  const [documentNo] = useState(
    () => `KASSA-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 9000) + 1000}`
  );

  const canChooseBranch = user?.role === "ADMIN";
  const activeCustomer = customerSessions[activeCustomerIndex] ?? customerSessions[0];
  const cartItems = activeCustomer?.cartItems ?? [];
  const pendingItem = activeCustomer?.pendingItem ?? null;
  const quantityInput = activeCustomer?.quantityInput ?? "";
  const payment = activeCustomer?.payment ?? "CASH";
  const cashbackBarcode = activeCustomer?.cashbackBarcode ?? "";
  const cashbackRedeemAmount = activeCustomer?.cashbackRedeemAmount ?? "";
  const cashbackUser = activeCustomer?.cashbackUser ?? null;

  useEffect(() => {
    let active = true;
    branchesService
      .list()
      .then((list) => {
        if (!active) return;
        setBranches(list);
        if (!branchId && list[0]) {
          setBranchId(list[0].id);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [branchId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (pendingItem) {
        quantityRef.current?.focus();
        quantityRef.current?.select();
        return;
      }
      barcodeRef.current?.focus();
    }, 20);
    return () => window.clearTimeout(timer);
  }, [activeCustomerIndex, pendingItem]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    void loadCatalog();
  }, [searchOpen, branchId]);

  useEffect(() => {
    if (!searchOpen) return;
    const timer = window.setTimeout(() => searchInputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [searchOpen]);

  useEffect(() => {
    if (!cashbackOpen) return;
    const timer = window.setTimeout(() => cashbackInputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [cashbackOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "F3") {
        event.preventDefault();
        openSearchModal();
      }
      if (event.key === "F5") {
        event.preventDefault();
        setSidebarMode((prev) => (prev === "history" ? "customers" : "history"));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pendingItem]);

  const cartTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.price || 0), 0),
    [cartItems]
  );

  const customerTotals = useMemo(
    () =>
      customerSessions.map((session) => ({
        id: session.id,
        label: session.label,
        total: session.cartItems.reduce(
          (sum, item) => sum + Number(item.quantity || 0) * Number(item.price || 0),
          0
        ),
        lineCount: session.cartItems.length,
        pending: Boolean(session.pendingItem),
      })),
    [customerSessions]
  );

  const selectedBranchName = useMemo(() => {
    if (!branchId) return t("Filial");
    return branches.find((branch) => branch.id === branchId)?.name ?? t("Filial");
  }, [branchId, branches, t]);

  const filteredCatalog = useMemo(() => {
    const query = catalogQuery.trim().toLowerCase();
    if (!query) return catalogItems;
    return catalogItems.filter((item) => {
      const name = String(item.product?.name ?? "").toLowerCase();
      const code = String(item.product?.barcode ?? "").toLowerCase();
      return name.includes(query) || code.includes(query);
    });
  }, [catalogItems, catalogQuery]);

  function updateCustomerSession(index: number, updater: (session: CustomerSession) => CustomerSession) {
    setCustomerSessions((prev) => {
      const session = prev[index];
      if (!session) return prev;
      const next = [...prev];
      next[index] = updater(session);
      return next;
    });
  }

  function updateActiveCustomerSession(updater: (session: CustomerSession) => CustomerSession) {
    updateCustomerSession(activeCustomerIndex, updater);
  }

  function resetCustomerSession(index: number) {
    updateCustomerSession(index, (session) => ({
      ...session,
      cartItems: [],
      pendingItem: null,
      quantityInput: "",
      payment: "CASH",
      cashbackBarcode: "",
      cashbackRedeemAmount: "",
      cashbackUser: null,
    }));
  }

  function switchCustomer(index: number) {
    if (index === activeCustomerIndex) {
      if (pendingItem) {
        quantityRef.current?.focus();
      } else {
        barcodeRef.current?.focus();
      }
      return;
    }

    setSearchOpen(false);
    setPaymentOpen(false);
    setCashbackOpen(false);
    setConfirmPrintOpen(false);
    setSidebarMode("customers");
    setBarcode("");
    setActiveCustomerIndex(index);
  }

  function requestClearCustomer(index: number) {
    setConfirmClearCustomerIndex(index);
  }

  function confirmClearCustomer() {
    if (confirmClearCustomerIndex == null) return;

    resetCustomerSession(confirmClearCustomerIndex);
    if (confirmClearCustomerIndex === activeCustomerIndex) {
      setEditingHistoryGroup(null);
      setBarcode("");
      setSearchOpen(false);
      setPaymentOpen(false);
      setCashbackOpen(false);
      setConfirmPrintOpen(false);
      barcodeRef.current?.focus();
    }
    setConfirmClearCustomerIndex(null);
  }

  function clearCashbackForActiveCustomer() {
    updateActiveCustomerSession((session) => ({
      ...session,
      cashbackBarcode: "",
      cashbackRedeemAmount: "",
      cashbackUser: null,
    }));
  }

  function continueWithoutCashback() {
    clearCashbackForActiveCustomer();
    setCashbackOpen(false);
    setConfirmPrintOpen(true);
  }

  async function confirmCashback() {
    const normalized = cashbackBarcode.trim();
    if (!normalized) {
      toast.error(t("Xatolik"), t("Cashback barcode ni kiriting yoki Kerak emas ni bosing"));
      cashbackInputRef.current?.focus();
      return;
    }

    setCashbackLookupLoading(true);
    try {
      const customer = await telegramCashbackService.lookup(normalized);
      if (!customer.verifiedMember) {
        toast.error(
          t("A'zolik tekshiruvi kerak"),
          t("Mijoz botda /check bosib a'zolikni tasdiqlasin, keyin qayta skan qiling")
        );
        return;
      }
      const redeemedAmount = parseMoneyInput(cashbackRedeemAmount);
      if (redeemedAmount > customer.balance) {
        toast.error(t("Xatolik"), t("Ishlatiladigan cashback balansdan katta bo'lmasligi kerak"));
        return;
      }
      if (redeemedAmount > cartTotal) {
        toast.error(t("Xatolik"), t("Ishlatiladigan cashback jami summadan katta bo'lmasligi kerak"));
        return;
      }
      updateActiveCustomerSession((session) => ({
        ...session,
        cashbackBarcode: normalized,
        cashbackRedeemAmount: redeemedAmount > 0 ? String(redeemedAmount) : "",
        cashbackUser: customer,
      }));
      toast.success(
        t("Tasdiqlandi"),
        t("Cashback mijoz topildi: {name}. Balans: {balance} so'm", {
          name: customer.firstName,
          balance: formatMoney(customer.balance),
        })
      );
      setCashbackOpen(false);
      setConfirmPrintOpen(true);
    } catch (error: unknown) {
      const message = extractErrorMessage(error, t("Cashback barcode topilmadi"));
      toast.error(
        t("Xatolik"),
        isMembershipVerificationError(message)
          ? t("Mijoz botda /check bosib a'zolikni tasdiqlamaguncha cashback ishlamaydi")
          : message
      );
      cashbackInputRef.current?.focus();
      cashbackInputRef.current?.select();
    } finally {
      setCashbackLookupLoading(false);
    }
  }

  function appendToCart({
    barcode: lineBarcode,
    productId,
    name,
    price,
    stock,
    quantity,
  }: {
    barcode: string;
    productId: string;
    name: string;
    price: number;
    stock: number;
    quantity: number;
  }, customerIndex = activeCustomerIndex) {
    if (stock <= 0) {
      toast.error(t("Xatolik"), t("Bu mahsulot omborda yo'q, shuning uchun sotuvga qo'sha olmaysiz"));
      return;
    }
    if (quantity > stock) {
      toast.error(t("Xatolik"), t("Mavjud qoldiqdan katta miqdor kiritildi"));
      return;
    }

    updateCustomerSession(customerIndex, (session) => {
      const existing = session.cartItems.find((item) => item.barcode === lineBarcode);
      if (!existing) {
        return {
          ...session,
          cartItems: [...session.cartItems, { barcode: lineBarcode, productId, name, price, quantity, stock }],
        };
      }

      const nextQty = existing.quantity + quantity;
      if (nextQty > existing.stock) {
        toast.error(t("Xatolik"), t("Mavjud qoldiqdan katta miqdor kiritildi"));
        return session;
      }
      return {
        ...session,
        cartItems: session.cartItems.map((item) =>
          item.barcode === lineBarcode ? { ...item, quantity: nextQty } : item
        ),
      };
    });
  }

  function stagePendingItem(item: PendingCartItem, customerIndex = activeCustomerIndex) {
    updateCustomerSession(customerIndex, (session) => ({
      ...session,
      pendingItem: item,
      quantityInput: "",
    }));
    setBarcode("");
  }

  async function loadCatalog() {
    setCatalogLoading(true);
    try {
      const list = await salesService.branchStock(branchId);
      const available = list
        .filter((item) => Number(item.quantity ?? 0) > 0 && item.product?.id)
        .sort((a, b) => String(a.product?.name ?? "").localeCompare(String(b.product?.name ?? "")));
      setCatalogItems(available);
    } catch (error: unknown) {
      toast.error(t("Xatolik"), extractErrorMessage(error, t("Ma'lumotlarni yuklab bo'lmadi")));
      setCatalogItems([]);
    } finally {
      setCatalogLoading(false);
    }
  }

  function openSearchModal() {
    if (pendingItem) {
      quantityRef.current?.focus();
      return;
    }
    setCatalogQuery("");
    setSearchOpen(true);
  }

  async function loadRecentSaleGroups() {
    setRecentSalesLoading(true);
    try {
      const groups = await salesService.recentGroups(branchId, 5);
      setRecentSaleGroups(groups);
    } catch {
      setRecentSaleGroups([]);
    } finally {
      setRecentSalesLoading(false);
    }
  }

  async function refreshTodaySalesTotal() {
    setTodaySalesLoading(true);
    try {
      const today = todayIso();
      const list = await salesService.list({ from: today, to: today, branchId });
      const total = list.reduce((sum, sale) => sum + Number(sale.quantity || 0) * Number(sale.price || 0), 0);
      setTodaySalesTotal(total);
    } catch {
      setTodaySalesTotal(0);
    } finally {
      setTodaySalesLoading(false);
    }
  }

  function loadHistoryGroupIntoCart(group: SaleHistoryGroup) {
    updateActiveCustomerSession((session) => ({
      ...session,
      cartItems: group.items.map((item) => ({
        barcode: item.barcode,
        productId: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        stock: item.editableStock,
      })),
      pendingItem: null,
      quantityInput: "",
      payment: group.paymentMethod,
      cashbackBarcode: "",
      cashbackRedeemAmount: "",
      cashbackUser: null,
    }));
    setEditingHistoryGroup(group);
    setSidebarMode("customers");
    setBarcode("");
    setSearchOpen(false);
    setPaymentOpen(false);
    setCashbackOpen(false);
    setConfirmPrintOpen(false);
    window.setTimeout(() => barcodeRef.current?.focus(), 20);
  }

  async function editRecentSale(group: SaleHistoryGroup) {
    if (group.cashbackLocked) {
      toast.error(t("Xatolik"), t("Cashback bilan bog'langan sotuvni bu yerdan tahrirlab bo'lmaydi"));
      return;
    }

    const activeHasData = cartItems.length > 0 || Boolean(pendingItem);
    if (activeHasData && editingHistoryGroup?.id !== group.id) {
      const confirmed = window.confirm(t("Joriy mijoz oynasidagi ma'lumotlar almashtirilsinmi?"));
      if (!confirmed) return;
    }

    loadHistoryGroupIntoCart(group);
    toast.success(t("Tarix yuklandi"), t("Sotuv chap oynaga tahrirlash uchun olib kelindi"));
  }

  async function deleteRecentSale(group: SaleHistoryGroup) {
    if (group.cashbackLocked) {
      toast.error(t("Xatolik"), t("Cashback bilan bog'langan sotuvni bu yerdan o'chirib bo'lmaydi"));
      return;
    }

    const confirmed = window.confirm(
      t("Haqiqatan ham ushbu sotuv tarixini o'chirmoqchimisiz? Ombordagi qoldiq qayta tiklanadi.")
    );
    if (!confirmed) return;

    setHistoryActionBusyId(group.id);
    try {
      await salesService.deleteGroup(group.id);
      if (editingHistoryGroup?.id === group.id) {
        setEditingHistoryGroup(null);
        clearCart();
      }
      toast.success(t("O'chirildi"), t("Sotuv tarixi o'chirildi va qoldiq qayta tiklandi"));
      await Promise.all([refreshTodaySalesTotal(), loadRecentSaleGroups()]);
    } catch (error: unknown) {
      toast.error(t("Xatolik"), extractErrorMessage(error, t("Sotuvni o'chirib bo'lmadi")));
    } finally {
      setHistoryActionBusyId(null);
    }
  }

  async function stageProductFromBarcode() {
    const customerIndex = activeCustomerIndex;

    if (pendingItem) {
      quantityRef.current?.focus();
      return;
    }

    if (!barcode.trim()) {
      toast.error(t("Xatolik"), t("Barcode ni kiriting"));
      return;
    }

    setLookupLoading(true);
    try {
      const lookup = (await salesService.productByBarcode(barcode.trim(), branchId)) as ProductLookupResult;
      const currentStock = Number(lookup.stock?.quantity ?? 0);
      const productBarcode = lookup.product?.barcode?.trim() ?? "";
      const productId = lookup.product?.id;

      if (!productId || !productBarcode) {
        toast.error(t("Xatolik"), t("Mahsulot topilmadi"));
        return;
      }

      if (currentStock <= 0) {
        toast.error(t("Xatolik"), t("Bu mahsulot omborda yo'q, shuning uchun sotuvga qo'sha olmaysiz"));
        return;
      }

      const unitPrice = Number(lookup.product.salePrice ?? lookup.product.price ?? 0);
      stagePendingItem({
        barcode: productBarcode,
        productId,
        name: lookup.product.name,
        price: unitPrice,
        stock: currentStock,
      }, customerIndex);
    } catch (error: unknown) {
      toast.error(t("Xatolik"), extractErrorMessage(error, t("Mahsulot topilmadi")));
    } finally {
      setLookupLoading(false);
    }
  }

  function confirmPendingItem() {
    if (!pendingItem) {
      toast.error(t("Xatolik"), t("Avval barcode ni skan qiling"));
      barcodeRef.current?.focus();
      return;
    }

    const qty = parseQuantity(quantityInput);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error(t("Xatolik"), t("Miqdor noto'g'ri"));
      quantityRef.current?.focus();
      quantityRef.current?.select();
      return;
    }

    appendToCart({
      ...pendingItem,
      quantity: qty,
    });

    updateActiveCustomerSession((session) => ({
      ...session,
      pendingItem: null,
      quantityInput: "",
    }));
    barcodeRef.current?.focus();
  }

  function stageProductFromCatalog(item: BranchStock) {
    const customerIndex = activeCustomerIndex;
    const product = item.product;
    const lineBarcode = product?.barcode?.trim() ?? "";
    if (!product?.id || !product?.name || !lineBarcode) {
      toast.error(t("Xatolik"), t("Mahsulot topilmadi"));
      return;
    }

    const stock = Number(item.quantity ?? 0);
    const price = Number(product.salePrice ?? product.price ?? 0);

    if (stock <= 0) {
      toast.error(t("Xatolik"), t("Bu mahsulot omborda yo'q, shuning uchun sotuvga qo'sha olmaysiz"));
      return;
    }

    stagePendingItem({
      barcode: lineBarcode,
      productId: product.id,
      name: product.name,
      price,
      stock,
    }, customerIndex);

    setSearchOpen(false);
  }

  function removeLine(barcodeValue: string) {
    updateActiveCustomerSession((session) => ({
      ...session,
      cartItems: session.cartItems.filter((item) => item.barcode !== barcodeValue),
    }));
  }

  function clearCart() {
    setEditingHistoryGroup(null);
    resetCustomerSession(activeCustomerIndex);
    setBarcode("");
    barcodeRef.current?.focus();
  }

  async function submitSale(shouldPrintReceipt: boolean) {
    const customerIndex = activeCustomerIndex;
    const currentCustomer = customerSessions[customerIndex];
    const currentCartItems = currentCustomer?.cartItems ?? [];
    const currentPayment = currentCustomer?.payment ?? "CASH";
    const currentCashbackBarcode = currentCustomer?.cashbackBarcode?.trim() ?? "";
    const currentRedeemedAmount = parseMoneyInput(currentCustomer?.cashbackRedeemAmount ?? "");
    const currentCashbackUser = currentCustomer?.cashbackUser ?? null;

    if (submitInProgressRef.current) return;
    if (currentCartItems.length === 0) {
      toast.error(t("Xatolik"), t("Sotuv uchun mahsulot qo'shing"));
      return;
    }

    if (currentCartItems.some((item) => !Number.isFinite(item.quantity) || item.quantity <= 0)) {
      toast.error(t("Xatolik"), t("Miqdor noto'g'ri"));
      return;
    }

    submitInProgressRef.current = true;
    setSaving(true);
    try {
      const saleDate = editingHistoryGroup?.date ?? todayIso();
      const saleGroupId = editingHistoryGroup?.saleGroupId ?? editingHistoryGroup?.id ?? createSaleGroupId();
      const sold =
        editingHistoryGroup != null
          ? await salesService.updateGroup(saleGroupId, {
              date: saleDate,
              paymentMethod: currentPayment,
              items: currentCartItems.map((item) => ({
                barcode: item.barcode,
                quantity: Number(item.quantity),
              })),
            })
          : [];
      const grossSaleAmount = currentCartItems.reduce(
        (sum, item) => sum + Number(item.quantity || 0) * Number(item.price || 0),
        0,
      );
      if (!editingHistoryGroup) {
        for (const item of currentCartItems) {
          const sale = await salesService.sell({
            barcode: item.barcode,
            quantity: Number(item.quantity),
            paymentMethod: currentPayment,
            branchId,
            date: saleDate,
            saleGroupId,
          });
          sold.push(sale);
        }
      }

      let cashbackUsed = 0;
      let cashbackEarned = 0;
      let cashbackBalance = currentCashbackUser?.balance ?? 0;

      if (currentCashbackBarcode && currentCashbackUser && sold.length > 0) {
        try {
          const cashbackResult = await telegramCashbackService.settle({
            barcode: currentCashbackBarcode,
            saleIds: sold.map((sale) => sale.id),
            redeemedAmount: currentRedeemedAmount,
          });

          cashbackUsed = cashbackResult.redeemedAmount;
          cashbackEarned = cashbackResult.earnedAmount;
          cashbackBalance = cashbackResult.balance;

          if (cashbackResult.redeemedAmount > 0 || cashbackResult.earnedAmount > 0) {
            toast.success(
              t("Cashback yangilandi"),
              t("Ishlatildi: {used} so'm. Yozildi: {earned} so'm. Yangi balans: {balance} so'm", {
                used: formatMoney(cashbackResult.redeemedAmount),
                earned: formatMoney(cashbackResult.earnedAmount),
                balance: formatMoney(cashbackResult.balance),
              })
            );
          }
        } catch (cashbackError: unknown) {
          const message = extractErrorMessage(cashbackError, t("Sotuv saqlandi, lekin cashback yozilmadi"));
          toast.error(
            t("Cashback xatolik"),
            isMembershipVerificationError(message)
              ? t("Sotuv saqlandi. Cashback uchun mijoz botda /check orqali a'zolikni tasdiqlashi kerak")
              : message
          );
        }
      }

      const receiptItems = currentCartItems.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      }));
      const totalQty = receiptItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      const firstSale = sold[0];
      const isSingleItem = receiptItems.length === 1;

      const receiptData: SaleReceiptData = {
        id: firstSale?.id ?? String(Date.now()),
        date: firstSale?.date ?? new Date().toISOString(),
        productName: isSingleItem ? receiptItems[0].name : t("Bir nechta mahsulot"),
        quantity: isSingleItem ? receiptItems[0].quantity : totalQty,
        price: isSingleItem ? receiptItems[0].price : undefined,
        paymentMethod: currentPayment,
        branchName: selectedBranchName,
        subtotal: grossSaleAmount,
        cashbackUsed,
        cashbackEarned,
        finalPaid: Math.max(0, grossSaleAmount - cashbackUsed),
        cashbackBalance,
        items: receiptItems,
      };

      flushSync(() => {
        setLastSale(receiptData);
      });

      if (shouldPrintReceipt) {
        await waitForNextPaint();
        try {
          await printCurrentWindowByMode("RECEIPT");
        } catch (printError: unknown) {
          toast.error(t("Xatolik"), extractErrorMessage(printError, t("Chek chiqarilmadi")));
        }
      }
      toast.success(
        t("Saqlandi"),
        editingHistoryGroup
          ? t("Sotuv tarixi yangilandi")
          : t("{count} ta sotuv kiritildi", { count: currentCartItems.length })
      );
      setEditingHistoryGroup(null);
      resetCustomerSession(customerIndex);
      setBarcode("");
      barcodeRef.current?.focus();
      void refreshTodaySalesTotal();
      void loadRecentSaleGroups();
    } catch (error: unknown) {
      toast.error(t("Xatolik"), extractErrorMessage(error, t("Saqlab bo'lmadi")));
    } finally {
      submitInProgressRef.current = false;
      setSaving(false);
    }
  }

  useEffect(() => {
    void refreshTodaySalesTotal();
    void loadRecentSaleGroups();
  }, [branchId]);

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1440px] flex-col gap-2 overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-1.5">
        <div>
          <h1 className="font-display text-xl font-semibold text-cocoa-900 sm:text-2xl md:text-[30px]">{t("Kassa")}</h1>
          <p className="mt-0.5 text-xs text-cocoa-600 md:text-sm">
            {t("Filial")}: <span className="font-semibold text-cocoa-800">{selectedBranchName}</span>
          </p>
          <p className="mt-0.5 text-xs text-cocoa-600 md:text-sm">
            {t("Faol mijoz")}: <span className="font-semibold text-berry-700">{activeCustomer.label}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {canChooseBranch ? (
            <select
              className="rounded-xl border border-cream-200 bg-white px-2.5 py-1.5 text-xs text-cocoa-800 md:text-sm"
              value={branchId ?? ""}
              onChange={(event) => setBranchId(event.target.value)}
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            onClick={() => router.push("/sales/sell")}
            className="rounded-xl border border-cream-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-cocoa-700 hover:bg-cream-100 md:text-sm"
          >
            {t("Orqaga")}
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-2 md:grid-cols-[minmax(0,1fr)_220px] xl:grid-cols-[minmax(0,1fr)_240px]">
        <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-card">
          <div className="grid gap-2 border-b border-cream-200 bg-cream-50 p-2.5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.8fr)_220px] 2xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.8fr)_240px]">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cocoa-500 md:text-xs">
                {t("Sotuv (ochiq)")}: {documentNo}
              </div>
              <div className="mt-1 text-[11px] text-cocoa-700 md:text-xs">{clock.toLocaleString("uz-UZ")}</div>
              <div className="mt-1 text-[10px] text-cocoa-500 md:text-xs">
                {t("Bugungi sotuv")}:{" "}
                <span className="font-semibold text-cocoa-800">
                  {todaySalesLoading ? t("Yuklanmoqda...") : `${formatMoney(todaySalesTotal)} so'm`}
                </span>
              </div>
            </div>
            <div className="grid gap-0.5 text-[11px] lg:self-center md:text-xs">
              <div className="flex items-center justify-between text-cocoa-600">
                <span>{t("Hammasi")}:</span>
                <span className="font-semibold text-cocoa-900">{formatMoney(cartTotal)}</span>
              </div>
              <div className="flex items-center justify-between text-cocoa-600">
                <span>{t("Chegirma")}:</span>
                <span className="font-semibold text-cocoa-900">0</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPaymentOpen(true)}
              disabled={saving || cartItems.length === 0 || Boolean(pendingItem)}
              className="rounded-xl border border-berry-200 bg-white px-3 py-2 text-right shadow-sm transition hover:bg-berry-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide text-cocoa-500 md:text-xs">{t("To'lov")}</div>
              <div className="mt-0.5 text-lg font-bold text-cocoa-900 md:text-xl">{formatMoney(cartTotal)} so'm</div>
              <div className="mt-0.5 text-[11px] font-semibold text-berry-700 md:text-xs">{paymentLabel(payment, t)}</div>
            </button>
          </div>

          <div className="border-b border-cream-200 p-2.5">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_88px_104px] md:grid-cols-[minmax(0,1fr)_96px_116px]">
              <input
                ref={barcodeRef}
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void stageProductFromBarcode();
                  }
                }}
                disabled={Boolean(pendingItem)}
                placeholder={t("Barcode ni skan qiling")}
                className="flex-1 rounded-xl border border-cream-300 px-2 py-2 text-xs text-cocoa-900 outline-none ring-berry-300 transition focus:ring-2 md:text-sm"
              />
              <input
                ref={quantityRef}
                value={quantityInput}
                onChange={(event) =>
                  updateActiveCustomerSession((session) => ({
                    ...session,
                    quantityInput: sanitizeDecimalInput(event.target.value),
                  }))
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    confirmPendingItem();
                  }
                }}
                placeholder={pendingItem ? t("Miqdor") : t("Avval barcode ni skan qiling")}
                inputMode="decimal"
                disabled={!pendingItem}
                className="w-full rounded-xl border border-cream-300 px-2 py-2 text-[11px] text-cocoa-900 outline-none ring-berry-300 transition focus:ring-2 md:text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  if (pendingItem) {
                    confirmPendingItem();
                    return;
                  }
                  void stageProductFromBarcode();
                }}
                disabled={lookupLoading}
                className="w-full rounded-xl bg-berry-700 px-3 py-2 text-xs font-semibold text-cream-50 hover:bg-berry-800 disabled:cursor-not-allowed disabled:opacity-60 md:text-sm"
              >
                {lookupLoading ? t("Yuklanmoqda...") : pendingItem ? t("Tasdiqlash") : t("Qo'shish")}
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <table className="min-w-full text-[11px] md:text-xs">
              <thead className="sticky top-0 z-10 bg-cream-100 text-[10px] uppercase tracking-wide text-cocoa-600">
                <tr>
                  <th className="w-10 px-2.5 py-2 text-left">#</th>
                  <th className="px-2.5 py-2 text-left">{t("Kodi")}</th>
                  <th className="px-2.5 py-2 text-left">{t("Nomlanishi")}</th>
                  <th className="w-20 px-2.5 py-2 text-right">{t("Soni")}</th>
                  <th className="w-24 px-2.5 py-2 text-right">{t("Narxi")}</th>
                  <th className="w-28 px-2.5 py-2 text-right">{t("Jami")}</th>
                  <th className="w-20 px-2.5 py-2 text-right">{t("Delete")}</th>
                </tr>
              </thead>
              <tbody>
                {cartItems.length === 0 && !pendingItem ? (
                  <tr>
                    <td colSpan={7} className="px-2.5 py-12 text-center text-xs text-cocoa-500 md:text-sm">
                      {t("Hali mahsulot qo'shilmagan")}
                    </td>
                  </tr>
                ) : (
                  <>
                    {cartItems.map((item, index) => (
                      <tr
                        key={item.barcode}
                      className={`border-t border-cream-200 ${
                          index % 2 === 0 ? "bg-white" : "bg-cream-50/40"
                        } hover:bg-cream-100/70`}
                      >
                        <td className="px-2.5 py-2 text-cocoa-600">{index + 1}</td>
                        <td className="px-2.5 py-2 font-medium text-cocoa-800">{item.barcode}</td>
                        <td className="px-2.5 py-2 font-medium text-cocoa-900">{item.name}</td>
                        <td className="px-2.5 py-2 text-right font-semibold text-cocoa-900">{item.quantity}</td>
                        <td className="px-2.5 py-2 text-right text-cocoa-700">{formatMoney(item.price)}</td>
                        <td className="px-2.5 py-2 text-right font-bold text-cocoa-900">
                          {formatMoney(item.price * item.quantity)}
                        </td>
                        <td className="px-2.5 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeLine(item.barcode)}
                            className="rounded-lg border border-rose-200 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                          >
                            {t("Delete")}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {pendingItem ? (
                      <tr className="border-t border-amber-200 bg-amber-50/70">
                        <td className="px-2.5 py-2 text-cocoa-600">{cartItems.length + 1}</td>
                        <td className="px-2.5 py-2 font-medium text-cocoa-800">{pendingItem.barcode}</td>
                        <td className="px-2.5 py-2 font-medium text-cocoa-900">
                          <div className="flex items-center justify-between gap-3">
                            <span>{pendingItem.name}</span>
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                              {t("Miqdor kiriting")}
                            </span>
                          </div>
                        </td>
                        <td className="px-2.5 py-2 text-right font-semibold text-cocoa-500">-</td>
                        <td className="px-2.5 py-2 text-right text-cocoa-700">{formatMoney(pendingItem.price)}</td>
                        <td className="px-2.5 py-2 text-right font-bold text-cocoa-500">-</td>
                        <td className="px-2.5 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              updateActiveCustomerSession((session) => ({
                                ...session,
                                pendingItem: null,
                                quantityInput: "",
                              }));
                              barcodeRef.current?.focus();
                            }}
                            className="rounded-lg border border-rose-200 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                          >
                            {t("Delete")}
                          </button>
                        </td>
                      </tr>
                    ) : null}
                  </>
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-cream-200 bg-cream-50 p-2">
          <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
            <button
              type="button"
              onClick={openSearchModal}
              disabled={Boolean(pendingItem)}
                className="h-11 rounded-xl border border-cream-300 bg-white px-3 text-base font-bold text-cocoa-700 hover:bg-cream-100"
              >
                {t("Qidiruv (F3)")}
              </button>
            <button
              type="button"
              onClick={() => setSidebarMode((prev) => (prev === "history" ? "customers" : "history"))}
              className={`h-11 rounded-xl border px-4 text-sm font-semibold transition ${
                sidebarMode === "history"
                  ? "border-berry-700 bg-berry-700 text-cream-50"
                  : "border-cream-300 bg-white text-cocoa-700 hover:bg-cream-100"
              }`}
            >
              {sidebarMode === "history" ? t("Mijozlar (F5)") : t("Tarix (F5)")}
            </button>
            <button
              type="button"
              onClick={() => {
                clearCart();
                  router.push("/sales/sell");
                }}
                className="h-11 rounded-xl bg-berry-700 px-4 text-sm font-semibold text-cream-50 hover:bg-berry-800"
              >
                {t("Chiqish (F12)")}
              </button>
            </div>
          </div>
        </section>

        <aside className="min-h-0">
          <div className="flex h-full flex-col gap-2 overflow-auto rounded-2xl border border-cream-200 bg-white p-2 shadow-card">
            <div>
              <h2 className="font-display text-lg font-semibold text-cocoa-900">
                {sidebarMode === "history" ? t("Tarix") : t("Mijozlar")}
              </h2>
              <p className="mt-0.5 text-xs text-cocoa-600">
                {sidebarMode === "history"
                  ? t("Oxirgi 5 ta sotuvni shu yerdan tahrirlash yoki o'chirish mumkin")
                  : t("5 ta mijozga bir vaqtda xizmat ko'rsatish rejimi")}
              </p>
            </div>
            {editingHistoryGroup ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-cocoa-800">
                <div className="font-semibold text-amber-900">{t("Tahrirlanayotgan sotuv")}</div>
                <div className="mt-1 text-xs text-cocoa-600">
                  {t("{date} dagi sotuv chap oynaga yuklangan. O'zgartirib qayta saqlashingiz mumkin.", {
                    date: formatHistoryDateTime(editingHistoryGroup.createdAt),
                  })}
                </div>
              </div>
            ) : null}
            {sidebarMode === "history" ? (
              <div className="grid gap-2">
                {recentSalesLoading ? (
                  <div className="rounded-2xl border border-cream-200 bg-cream-50 px-3 py-6 text-center text-sm text-cocoa-500">
                    {t("Yuklanmoqda...")}
                  </div>
                ) : recentSaleGroups.length === 0 ? (
                  <div className="rounded-2xl border border-cream-200 bg-cream-50 px-3 py-6 text-center text-sm text-cocoa-500">
                    {t("Hozircha sotuv tarixi yo'q")}
                  </div>
                ) : (
                  recentSaleGroups.map((group) => {
                    const busy = historyActionBusyId === group.id;
                    const isEditing = editingHistoryGroup?.id === group.id;
                    return (
                      <div
                        key={group.id}
                        className={`rounded-2xl border px-3 py-3 transition ${
                          isEditing
                            ? "border-amber-300 bg-amber-50 shadow-sm"
                            : "border-cream-200 bg-cream-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-cocoa-900">
                              {formatHistoryDateTime(group.createdAt)}
                            </div>
                            <div className="mt-1 text-[11px] text-cocoa-500">
                              {paymentLabel(group.paymentMethod, t)} • {group.items.length} {t("qator")}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-berry-700">{formatMoney(group.total)} so'm</div>
                            {group.cashbackLocked ? (
                              <div className="mt-1 text-[11px] font-semibold text-amber-700">
                                {t("Cashback bilan bog'langan")}
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-3 space-y-1 text-xs text-cocoa-700">
                          {group.items.map((item) => (
                            <div key={item.saleId} className="flex items-center justify-between gap-2">
                              <span className="truncate">{item.name}</span>
                              <span className="shrink-0 font-semibold">
                                {item.quantity} x {formatMoney(item.price)}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              void editRecentSale(group);
                            }}
                            disabled={busy}
                            className="rounded-xl border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-cocoa-700 hover:bg-cream-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isEditing ? t("Yuklangan") : t("Edit")}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void deleteRecentSale(group);
                            }}
                            disabled={busy}
                            className="rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {busy ? t("Yuklanmoqda...") : t("Delete")}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="grid gap-2">
                {customerTotals.map((customer, index) => {
                  const isActive = index === activeCustomerIndex;
                  const hasData = customer.lineCount > 0 || customer.pending;
                  return (
                    <div
                      key={customer.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => switchCustomer(index)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          switchCustomer(index);
                        }
                      }}
                      className={`rounded-2xl border px-3 py-3 text-left transition ${
                        isActive
                          ? "border-berry-700 bg-berry-700 text-cream-50 shadow-lg shadow-berry-700/20"
                          : "border-cream-200 bg-cream-50 text-cocoa-800 hover:bg-cream-100"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">{customer.label}</div>
                          <div
                            className={`mt-1 text-[11px] ${
                              isActive ? "text-cream-100/90" : "text-cocoa-500"
                            }`}
                          >
                            {customer.pending ? t("Miqdor kutilmoqda") : t("Tayyor")}
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            isActive ? "bg-white/15 text-cream-50" : "bg-white text-cocoa-600"
                          }`}
                        >
                          {customer.lineCount} {t("qator")}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="text-xl font-bold">{formatMoney(customer.total)} so'm</div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            requestClearCustomer(index);
                          }}
                          disabled={!hasData}
                          className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                            isActive
                              ? "border border-white/20 bg-white/10 text-cream-50 hover:bg-white/15"
                              : "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                          } disabled:cursor-not-allowed disabled:opacity-50`}
                        >
                          {t("Ochirish")}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>

      <Modal title={t("Qidiruv (F3)")} open={searchOpen} onClose={() => setSearchOpen(false)}>
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              ref={searchInputRef}
              value={catalogQuery}
              onChange={(event) => setCatalogQuery(event.target.value)}
              placeholder={t("Mahsulot nomi yoki barcode bo'yicha qidiring")}
              className="flex-1 rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm text-cocoa-900 outline-none ring-berry-300 transition focus:ring-2"
            />
            <button
              type="button"
              onClick={() => {
                void loadCatalog();
              }}
              className="w-full rounded-xl border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-cocoa-700 hover:bg-cream-100 sm:w-auto"
            >
              {catalogLoading ? t("Yuklanmoqda...") : t("Yangilash")}
            </button>
          </div>

          <div className="max-h-[52vh] overflow-auto rounded-2xl border border-cream-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-cream-50 text-xs uppercase tracking-wide text-cocoa-500">
                <tr>
                  <th className="px-3 py-2 text-left">{t("Nomlanishi")}</th>
                  <th className="px-3 py-2 text-left">{t("Kodi")}</th>
                  <th className="px-3 py-2 text-right">{t("Soni")}</th>
                  <th className="px-3 py-2 text-right">{t("Narxi")}</th>
                  <th className="px-3 py-2 text-right">{t("Qo'shish")}</th>
                </tr>
              </thead>
              <tbody>
                {catalogLoading ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-cocoa-500">
                      {t("Yuklanmoqda...")}
                    </td>
                  </tr>
                ) : filteredCatalog.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-cocoa-500">
                      {t("Hech narsa topilmadi.")}
                    </td>
                  </tr>
                ) : (
                  filteredCatalog.map((item) => {
                    const price = Number(item.product?.salePrice ?? item.product?.price ?? 0);
                    return (
                      <tr key={item.id} className="border-t border-cream-200">
                        <td className="px-3 py-2 text-cocoa-900">{item.product?.name}</td>
                        <td className="px-3 py-2 text-cocoa-700">{item.product?.barcode ?? "-"}</td>
                        <td className="px-3 py-2 text-right text-cocoa-900">{item.quantity}</td>
                        <td className="px-3 py-2 text-right text-cocoa-700">{formatMoney(price)}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => stageProductFromCatalog(item)}
                            className="rounded-lg bg-berry-700 px-3 py-1 text-xs font-semibold text-cream-50 hover:bg-berry-800"
                          >
                            {t("Qo'shish")}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      <Modal title={t("To'lov turi")} open={paymentOpen} onClose={() => setPaymentOpen(false)}>
        <div className="space-y-4">
          <p className="text-sm text-cocoa-700">{t("To'lov turini tanlang")}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(["CASH", "CARD", "TRANSFER"] as PaymentMethod[]).map((method) => {
              const active = payment === method;
              return (
                <button
                  key={method}
                  type="button"
                  onClick={() =>
                    updateActiveCustomerSession((session) => ({
                      ...session,
                      payment: method,
                    }))
                  }
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    active
                      ? "border-berry-700 bg-berry-700 text-cream-50"
                      : "border-cream-300 bg-white text-cocoa-700 hover:bg-cream-100"
                  }`}
                >
                  {paymentLabel(method, t)}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setPaymentOpen(false)}
              className="rounded-xl border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-cocoa-700 hover:bg-cream-100"
            >
              {t("Bekor qilish")}
            </button>
            <button
              type="button"
              onClick={() => {
                setPaymentOpen(false);
                setCashbackOpen(true);
              }}
              disabled={saving || cartItems.length === 0}
              className="rounded-xl bg-berry-700 px-4 py-2 text-sm font-semibold text-cream-50 hover:bg-berry-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t("Davom etish")}
            </button>
          </div>
        </div>
      </Modal>

      <Modal title={t("Telegram cashback")} open={cashbackOpen} onClose={() => setCashbackOpen(false)}>
        <div className="space-y-4">
          <p className="text-sm text-cocoa-700">
            {t("Telegram bot bergan cashback barcode ni kiriting. Kerak bo'lmasa o'tkazib yuboring.")}
          </p>
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wide text-cocoa-500">
              {t("Cashback barcode")}
            </label>
            <input
              ref={cashbackInputRef}
              value={cashbackBarcode}
              onChange={(event) => {
                const nextValue = event.target.value.replace(/\D/g, "").slice(0, 13);
                updateActiveCustomerSession((session) => ({
                  ...session,
                  cashbackBarcode: nextValue,
                  cashbackUser:
                    session.cashbackUser?.barcode === nextValue ? session.cashbackUser : null,
                }));
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void confirmCashback();
                }
              }}
              inputMode="numeric"
              placeholder={t("13 xonali barcode")}
              className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm text-cocoa-900 outline-none ring-berry-300 transition focus:ring-2"
            />
            {cashbackUser ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                {t("Mijoz")}: <span className="font-semibold">{cashbackUser.firstName}</span>
                {cashbackUser.lastName ? ` ${cashbackUser.lastName}` : ""}
                {" | "}
                {t("Balans")}: <span className="font-semibold">{formatMoney(cashbackUser.balance)} so'm</span>
              </div>
            ) : null}
            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wide text-cocoa-500">
                {t("Ishlatiladigan cashback")}
              </label>
              <input
                value={cashbackRedeemAmount}
                onChange={(event) =>
                  updateActiveCustomerSession((session) => ({
                    ...session,
                    cashbackRedeemAmount: sanitizeMoneyInput(event.target.value),
                  }))
                }
                inputMode="numeric"
                placeholder={t("0 qoldiring, faqat cashback yig'iladi")}
                className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm text-cocoa-900 outline-none ring-berry-300 transition focus:ring-2"
              />
              <p className="text-[11px] text-cocoa-500">
                {t("Maksimal ishlatish mumkin")}: {formatMoney(Math.min(cashbackUser?.balance ?? 0, cartTotal))} so'm
              </p>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={continueWithoutCashback}
              disabled={saving || cashbackLookupLoading}
              className="rounded-xl border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-cocoa-700 hover:bg-cream-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t("Kerak emas")}
            </button>
            <button
              type="button"
              onClick={() => {
                void confirmCashback();
              }}
              disabled={saving || cashbackLookupLoading || !cashbackBarcode.trim()}
              className="rounded-xl bg-berry-700 px-4 py-2 text-sm font-semibold text-cream-50 hover:bg-berry-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cashbackLookupLoading ? t("Tekshirilmoqda...") : t("Tasdiqlash")}
            </button>
          </div>
        </div>
      </Modal>

      <Modal title={t("Chek chiqarilsinmi?")} open={confirmPrintOpen} onClose={() => setConfirmPrintOpen(false)}>
        <div className="space-y-4">
          <p className="text-sm text-cocoa-700">{t("To'lov saqlangandan keyin chek default printerga yuborilsinmi?")}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setConfirmPrintOpen(false);
                void submitSale(false);
              }}
              disabled={saving}
              className="rounded-xl border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-cocoa-700 hover:bg-cream-100"
            >
              {t("Yo'q")}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmPrintOpen(false);
                void submitSale(true);
              }}
              disabled={saving}
              className="rounded-xl bg-berry-700 px-4 py-2 text-sm font-semibold text-cream-50 hover:bg-berry-800"
            >
              {t("Ha")}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        title={t("Mijoz buyurtmasini ochirish")}
        open={confirmClearCustomerIndex !== null}
        onClose={() => setConfirmClearCustomerIndex(null)}
      >
        <div className="space-y-4">
          <p className="text-sm text-cocoa-700">
            {t("Haqiqatan ham {customer} dagi barcha buyurtmalarni ochirmoqchimisiz?", {
              customer:
                confirmClearCustomerIndex !== null
                  ? customerSessions[confirmClearCustomerIndex]?.label ?? t("Mijoz")
                  : t("Mijoz"),
            })}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmClearCustomerIndex(null)}
              className="rounded-xl border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-cocoa-700 hover:bg-cream-100"
            >
              {t("Yo'q")}
            </button>
            <button
              type="button"
              onClick={confirmClearCustomer}
              className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-cream-50 hover:bg-rose-700"
            >
              {t("Ha, ochir")}
            </button>
          </div>
        </div>
      </Modal>

      {lastSale && (
        <div className="hidden print:block">
          <Receipt type="SALE" data={lastSale} />
        </div>
      )}
    </div>
  );
}
