import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../config/api';
import { useSettings } from '../hooks/useSettings';
import { formatCurrency } from '../utils/currency';
import { useAuth } from '../hooks/useAuth';
import {
  getCachedProducts,
  cacheProducts,
  getCachedCustomers,
  cacheCustomers,
  addLocalCustomer,
  enqueueOutboxItem,
  applyLocalStockDelta,
  saveLocalHeldBill,
  getLocalHeldBills,
  removeLocalHeldBill,
  newUuid,
} from '../db/db';
import { refreshPendingCount } from '../db/syncService';
import { openReceiptWindow } from '../print/receipt';
import {
  Search,
  ShoppingCart,
  User,
  UserPlus,
  Plus,
  Minus,
  Trash2,
  Pause,
  Play,
  RotateCcw,
  Zap,
  Camera,
  Printer,
  Bluetooth,
  Wifi,
  LayoutGrid,
  List,
  Sparkles,
  Percent,
  CheckCircle2,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  Star,
  ChevronDown,
  ShoppingBag,
  Clock,
  Package,
} from 'lucide-react';

export default function POS() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { can } = useAuth();
  const canDiscount = can('pos.apply_discount');

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);

  // New Customer Modal
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', phone: '', email: '', opening_balance: '' });

  // Pricing & Customer Type: 'normal', 'retail', 'wholesale', 'regular'
  const [customerType, setCustomerType] = useState('normal');

  // Category & Filter selection
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [filterTopSelling, setFilterTopSelling] = useState(false);

  // Card quantities
  const [cardQtys, setCardQtys] = useState({});

  // Display View: Grid vs Table List
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

  // Payment
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paidAmount, setPaidAmount] = useState('');

  // Discount Type: rupees or percentage
  const [discountType, setDiscountType] = useState('fixed'); // 'fixed' (₹) or 'percent' (%)
  const [discountValue, setDiscountValue] = useState('');

  // Serial & Addon Modals
  const [serialPicker, setSerialPicker] = useState(null);
  const [customizer, setCustomizer] = useState(null);
  const [addons, setAddons] = useState([]);

  // Held Bills
  const [heldBills, setHeldBills] = useState([]);
  const [showHeldModal, setShowHeldModal] = useState(false);

  // Status message
  const [message, setMessage] = useState('');

  // Scanner / Camera simulation / Hardware modal
  const [scannerOpen, setScannerOpen] = useState(false);
  const [printerModal, setPrinterModal] = useState(false);
  const [connectedPrinter, setConnectedPrinter] = useState('Default System Printer');

  const searchRef = useRef(null);
  const categoryDropdownRef = useRef(null);
  const currency = settings?.currency_symbol || '₹';
  const [dbCategories, setDbCategories] = useState([]);

  const loadProducts = async () => {
    try {
      let data = [];
      if (settings?.business_type) {
        const res = await api.get('/products', {
          params: { business_type: settings.business_type },
        });
        data = res.data;
      }

      // If business_type is not configured or returned 0 products,
      // load all active products so existing database records are never omitted or hidden
      if (!Array.isArray(data) || data.length === 0) {
        const resAll = await api.get('/products');
        if (Array.isArray(resAll.data) && resAll.data.length > 0) {
          data = resAll.data;
        }
      }

      const productList = Array.isArray(data) ? data : [];
      setProducts(productList);
      if (productList.length > 0) {
        cacheProducts(productList);
      }
    } catch {
      const cached = await getCachedProducts();
      setProducts(Array.isArray(cached) ? cached : []);
    }
  };

  const loadCategories = async (businessTypeOverride) => {
    try {
      const bt = businessTypeOverride ?? settings?.business_type;
      const params = bt ? { business_type: bt } : {};
      const { data } = await api.get('/categories', { params });
      if (Array.isArray(data)) setDbCategories(data);
    } catch {
      // offline / lookup fallback
    }
  };

  const loadCustomers = async () => {
    try {
      const { data } = await api.get('/customers');
      setCustomers(data);
      cacheCustomers(data);
    } catch {
      setCustomers(await getCachedCustomers());
    }
  };

  useEffect(() => {
    setSelectedCategory('all');
    loadProducts();
    loadCustomers();
    loadCategories();
    refreshHeldBills();
    api.get('/lookup/addons').then(({ data }) => setAddons(data.filter((a) => a.is_active))).catch(() => {});
    searchRef.current?.focus();
  }, [settings?.business_type]);

  // Close category dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target)) {
        setCategoryDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const refreshHeldBills = async () => {
    const local = await getLocalHeldBills();
    let serverBills = [];
    try {
      const { data } = await api.get('/held-bills');
      serverBills = data;
    } catch {
      // offline
    }
    const merged = [...local, ...serverBills.filter((s) => !local.some((l) => l.uuid === s.uuid))];
    setHeldBills(merged);
  };

  // Helper to extract product image safely from database record
  const getProductImage = (p) => {
    if (!p) return null;
    if (Array.isArray(p.images) && p.images.length > 0 && p.images[0]) {
      return p.images[0];
    }
    if (typeof p.images === 'string' && p.images.trim()) {
      try {
        const parsed = JSON.parse(p.images);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]) return parsed[0];
      } catch {
        if (p.images.startsWith('http') || p.images.startsWith('data:') || p.images.startsWith('/')) {
          return p.images;
        }
      }
    }
    if (p.image && typeof p.image === 'string' && p.image.trim()) return p.image;
    if (p.image_url && typeof p.image_url === 'string' && p.image_url.trim()) return p.image_url;
    return null;
  };

  // Helper to determine product price based on selected customerType
  const getProductPrice = (product) => {
    if (!product) return 0;
    if (customerType === 'wholesale' && Number(product.wholesale_price) > 0) {
      return Number(product.wholesale_price);
    }
    if ((customerType === 'regular' || customerType === 'customer-wise') && Number(product.customer_price) > 0) {
      return Number(product.customer_price);
    }
    return Number(product.selling_price || product.retail_price || product.mrp || 0);
  };

  // Categories list derived from database categories and products, strictly filtered by business_type
  const categoryList = useMemo(() => {
    const bt = settings?.business_type;
    const filteredDbCats = bt
      ? dbCategories.filter((c) => !c.business_type || c.business_type === bt)
      : dbCategories;
    const fromApi = filteredDbCats.map((c) => c.name).filter(Boolean);
    const validCategorySet = new Set(filteredDbCats.map((c) => c.name));

    const filteredProds = bt
      ? products.filter((p) => !p.business_type || p.business_type === bt)
      : products;
    const fromProducts = filteredProds
      .map((p) => p.category_name)
      .filter((name) => Boolean(name) && (!bt || validCategorySet.size === 0 || validCategorySet.has(name)));

    return Array.from(new Set([...fromApi, ...fromProducts]));
  }, [products, dbCategories, settings?.business_type]);

  // Filter products by search, category, and top-selling
  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    const bt = settings?.business_type;
    return products.filter((p) => {
      if (bt && p.business_type && p.business_type !== bt) {
        return false;
      }
      const pName = (p.name || '').toLowerCase();
      const pBarcode = (p.barcode || '').toLowerCase();
      const pSku = (p.sku || '').toLowerCase();
      const matchesSearch = !term || pName.includes(term) || pBarcode.includes(term) || pSku.includes(term);

      const matchesCategory =
        selectedCategory === 'all' || p.category_name === selectedCategory;

      const matchesTopSelling = !filterTopSelling || Number(p.stock_qty || 0) > 0;

      return matchesSearch && matchesCategory && matchesTopSelling;
    });
  }, [products, search, selectedCategory, filterTopSelling, settings?.business_type]);

  // Filter customers for dropdown search
  const filteredCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (c.phone || '').toLowerCase().includes(term)
    );
  }, [customers, customerSearch]);

  // Line calculations defined early to prevent reference errors
  const lineAddonsTotal = (line) => (line.addons || []).reduce((s, a) => s + Number(a.price), 0);
  const lineUnitWithAddons = (line) => Number(line.unit_price) + lineAddonsTotal(line);

  const recalcLine = (line) => {
    const base = line.qty * lineUnitWithAddons(line);
    const taxAmount = Math.round(((base * (line.tax_percent || 0)) / 100) * 100) / 100;
    return { ...line, tax_amount: taxAmount };
  };

  const getCardQty = (id) => cardQtys[id] || 1;
  const updateCardQty = (id, delta) => {
    setCardQtys((prev) => ({
      ...prev,
      [id]: Math.max(1, (prev[id] || 1) + delta),
    }));
  };

  const addToCart = (product, serial = null, variant = null, selectedAddons = [], qtyToAdd = 1) => {
    let unitPrice = getProductPrice(product);
    if (variant) {
      if (variant.selling_price && Number(variant.selling_price) > 0) {
        unitPrice = Number(variant.selling_price);
      } else {
        unitPrice = unitPrice + Number(variant.price_adjustment || 0);
      }
    }
    const taxPercent = Number(product.tax_percent || 0);

    if (serial) {
      setCart((c) => [
        ...c,
        {
          key: `${product.id}-${serial.id}`,
          product_id: product.id,
          serial_id: serial.id,
          product_name: `${product.name} (IMEI: ${serial.ime1 || serial.serial_no})`,
          qty: 1,
          unit_price: unitPrice,
          discount_amount: 0,
          tax_percent: taxPercent,
          tax_amount: Math.round(((unitPrice * taxPercent) / 100) * 100) / 100,
        },
      ]);
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id
            ? { ...p, available_serials: p.available_serials.filter((s) => s.id !== serial.id) }
            : p
        )
      );
      return;
    }

    setCart((c) => {
      const existing = c.find((l) => l.product_id === product.id && !l.serial_id && !l.variant_id);
      if (existing) {
        return c.map((l) => (l.key === existing.key ? recalcLine({ ...l, qty: l.qty + qtyToAdd }) : l));
      }
      const taxAmount = Math.round(((unitPrice * taxPercent) / 100) * 100) / 100;
      return [
        ...c,
        {
          key: `${product.id}-${variant ? variant.id : 'base'}`,
          product_id: product.id,
          variant_id: variant?.id || null,
          variant_label: variant?.variant_name || null,
          product_name: variant ? `${product.name} - ${variant.variant_name}` : product.name,
          qty: qtyToAdd,
          unit_price: unitPrice,
          discount_amount: 0,
          tax_percent: taxPercent,
          tax_amount: taxAmount,
          addons: selectedAddons,
        },
      ];
    });

    // Reset card qty after adding
    setCardQtys((prev) => ({ ...prev, [product.id]: 1 }));
  };

  const handleProductClick = (product) => {
    if (product.track_serial) {
      if (!product.available_serials?.length) {
        setMessage('Serial / IMEI devices are out of stock');
        return;
      }
      setSerialPicker(product);
      return;
    }
    const hasVariants = product.variants?.length > 0;
    const productAddons = Array.isArray(product.attributes?.addons) ? product.attributes.addons : [];
    const hasProductAddons = settings?.business_type === 'food' && productAddons.length > 0;

    if (hasVariants || hasProductAddons) {
      setCustomizer({
        product,
        variantId: product.variants?.[0]?.id || null,
        addonIds: [],
      });
      return;
    }

    const qty = getCardQty(product.id);
    addToCart(product, null, null, [], qty);
  };

  const confirmCustomizer = () => {
    if (!customizer) return;
    const { product, variantId, addonIds } = customizer;
    const variant = product.variants?.find((v) => v.id === variantId) || null;
    const selectedAddons = addons.filter((a) => addonIds.includes(a.id));
    const qty = getCardQty(product.id);
    addToCart(product, null, variant, selectedAddons, qty);
    setCustomizer(null);
  };

  const updateLineQty = (key, delta) => {
    setCart((c) =>
      c
        .map((l) => {
          if (l.key !== key) return l;
          const newQty = Math.max(0, l.qty + delta);
          if (newQty === 0) return null;
          return recalcLine({ ...l, qty: newQty });
        })
        .filter(Boolean)
    );
  };

  const removeLine = (key) => {
    setCart((c) => c.filter((l) => l.key !== key));
  };

  const clearCart = () => {
    setCart([]);
  };

  // Totals
  const totals = useMemo(() => {
    const subtotal = cart.reduce((s, l) => s + l.qty * lineUnitWithAddons(l), 0);
    let billDiscount = 0;
    const dv = Number(discountValue || 0);
    if (dv > 0) {
      billDiscount = discountType === 'percent' ? Math.round(((subtotal * dv) / 100) * 100) / 100 : dv;
    }
    billDiscount = Math.min(billDiscount, subtotal);
    const tax = cart.reduce((s, l) => s + (l.tax_amount || 0) * (l.qty || 1), 0);
    const grandTotal = Math.max(0, Math.round((subtotal - billDiscount + tax) * 100) / 100);
    return { subtotal, billDiscount, tax, grandTotal };
  }, [cart, discountType, discountValue]);

  useEffect(() => {
    if (paymentMethod === 'credit') {
      setPaidAmount('0.00');
    } else {
      setPaidAmount(totals.grandTotal.toFixed(2));
    }
  }, [totals.grandTotal, paymentMethod]);

  const holdBill = async () => {
    if (cart.length === 0) return;
    const entry = {
      uuid: newUuid(),
      customer_id: selectedCustomerId || null,
      customer_name: customers.find((c) => c.id === selectedCustomerId)?.name || 'Walk-in',
      cart,
      totals,
      discount_type: discountType,
      discount_value: discountValue,
      payment_method: paymentMethod,
      held_at: new Date().toISOString(),
    };
    await saveLocalHeldBill(entry);
    enqueueOutboxItem('post', '/held-bills', entry).catch(() => {});
    refreshPendingCount();
    clearCart();
    setMessage('Bill placed on hold');
    refreshHeldBills();
  };

  const recallBill = async (held) => {
    setCart(held.cart || []);
    setSelectedCustomerId(held.customer_id || '');
    setCustomerSearch(held.customer_name || '');
    setDiscountType(held.discount_type || 'fixed');
    setDiscountValue(held.discount_value || '');
    setPaymentMethod(held.payment_method || 'cash');
    await removeLocalHeldBill(held.uuid);
    enqueueOutboxItem('delete', `/held-bills/${held.uuid}`, {}).catch(() => {});
    refreshPendingCount();
    setShowHeldModal(false);
    refreshHeldBills();
  };

  const resetSale = () => {
    clearCart();
    setDiscountValue('');
    setPaymentMethod('cash');
    setSelectedCustomerId('');
    setCustomerSearch('');
  };

  // Add customer inline
  const saveNewCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomerForm.name.trim()) return;
    const custData = {
      id: Date.now(),
      name: newCustomerForm.name.trim(),
      phone: newCustomerForm.phone.trim(),
      email: newCustomerForm.email.trim(),
      opening_balance: Number(newCustomerForm.opening_balance || 0),
      balance: Number(newCustomerForm.opening_balance || 0),
    };
    try {
      const { data } = await api.post('/customers', custData);
      setCustomers((prev) => [data, ...prev]);
      setSelectedCustomerId(data.id);
      setCustomerSearch(`${data.name} (${data.phone || 'No phone'})`);
    } catch {
      await addLocalCustomer(custData);
      enqueueOutboxItem('post', '/customers', custData);
      refreshPendingCount();
      setCustomers((prev) => [custData, ...prev]);
      setSelectedCustomerId(custData.id);
      setCustomerSearch(`${custData.name} (${custData.phone || 'No phone'})`);
    }
    setShowNewCustomer(false);
    setNewCustomerForm({ name: '', phone: '', email: '', opening_balance: '' });
  };

  // Complete Sale
  const completeSale = async () => {
    if (cart.length === 0) return;
    const createdAt = new Date().toISOString();
    const uuid = newUuid();

    const salePayload = {
      uuid,
      customer_id: selectedCustomerId || null,
      customer_name: customers.find((c) => c.id === selectedCustomerId)?.name || 'Walk-in Customer',
      payment_method: paymentMethod,
      paid_amount: Number(paidAmount || totals.grandTotal),
      subtotal: totals.subtotal,
      discount_amount: totals.billDiscount,
      tax_amount: totals.tax,
      grand_total: totals.grandTotal,
      status: 'completed',
      source: 'offline',
      items: cart.map((l) => ({
        product_id: l.product_id,
        variant_id: l.variant_id || null,
        serial_id: l.serial_id || null,
        product_name_snapshot: l.product_name,
        qty: l.qty,
        unit_price: l.unit_price,
        line_total: l.qty * lineUnitWithAddons(l),
        addons: l.addons || [],
      })),
      created_at: createdAt,
    };

    // Update stock locally
    for (const l of cart) {
      applyLocalStockDelta(l.product_id, -l.qty).catch(() => {});
    }

    try {
      const { data } = await api.post('/invoices', salePayload);
      openReceiptWindow(data, settings);
      resetSale();
      loadProducts();
      return;
    } catch {
      // Offline fallback
      await enqueueOutboxItem('post', '/invoices', salePayload);
      refreshPendingCount();
    }

    openReceiptWindow(
      {
        invoice_no: `OFFLINE-${uuid.slice(0, 8)}`,
        created_at: createdAt,
        customer_name: customers.find((c) => c.id === selectedCustomerId)?.name || 'Walk-in Customer',
        items: cart.map((l) => ({
          product_name_snapshot: l.product_name,
          qty: l.qty,
          unit_price: l.unit_price,
          line_total: l.qty * lineUnitWithAddons(l),
        })),
        subtotal: totals.subtotal,
        discount_amount: totals.billDiscount,
        tax_amount: totals.tax,
        grand_total: totals.grandTotal,
        source: 'offline',
      },
      settings
    );
    resetSale();
  };

  return (
    <div className="flex flex-col lg:flex-row gap-5 h-[calc(100vh-6rem)] overflow-hidden font-sans">
      {/* Main Catalog View (matches reference screenshot 2) */}
      <div className="flex-1 flex flex-col bg-white dark:bg-[#121E2C] rounded-2xl border border-[#DCE5EF] dark:border-[#22354B] shadow-sm overflow-hidden">
        {/* Top Header: Customer Type Options + Quick Sale & Hold Bills */}
        <div className="p-4 border-b border-[#DCE5EF] dark:border-[#22354B] space-y-3.5 bg-white dark:bg-[#121E2C]">
          {/* Row 1: Customer Type pills + Quick Sale & Hold Bills */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#1C2736] dark:text-[#F1F5F9]">
                CUSTOMER TYPE:
              </span>
              <div className="flex items-center gap-1.5">
                {[
                  { id: 'normal', label: 'Normal' },
                  { id: 'retail', label: 'Retail' },
                  { id: 'wholesale', label: 'Wholesale' },
                  { id: 'customer-wise', label: 'Customer-Wise' },
                ].map((ct) => {
                  const active = customerType === ct.id;
                  return (
                    <button
                      key={ct.id}
                      type="button"
                      onClick={() => setCustomerType(ct.id)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                        active
                          ? 'bg-[#0A4174] text-white shadow-sm dark:bg-[#4A8CD2] dark:text-[#0B131E]'
                          : 'bg-white dark:bg-[#121E2C] text-[#5A6B82] dark:text-[#94A3B8] hover:bg-[#E2EDF8] border border-[#DCE5EF] dark:border-[#22354B]'
                      }`}
                    >
                      {ct.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedCustomerId('');
                  setCustomerSearch('Walk-in Customer');
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E] text-xs font-bold shadow-sm transition-all"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>+ Quick Sale</span>
              </button>

              <button
                type="button"
                onClick={() => setShowHeldModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white dark:bg-[#121E2C] border border-[#DCE5EF] dark:border-[#22354B] text-[#1C2736] dark:text-[#F1F5F9] text-xs font-bold hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] transition-all shadow-xs"
              >
                <Clock className="w-3.5 h-3.5 text-[#0A4174] dark:text-[#4A8CD2]" />
                <span>Hold Bills ({heldBills.length})</span>
              </button>
            </div>
          </div>

          {/* Row 2: Customer Search + Product Search + Scanner/Hardware icons */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search customer input */}
            <div className="relative flex-1 min-w-[200px]">
              <User className="w-4 h-4 text-[#5A6B82] dark:text-[#94A3B8] absolute left-3.5 top-2.5" />
              <input
                value={customerSearch}
                onFocus={() => setCustomerDropdownOpen(true)}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setCustomerDropdownOpen(true);
                }}
                placeholder="Search customer name / phone..."
                className="w-full pl-9 pr-8 py-2 rounded-full border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB] dark:bg-[#0B131E] text-xs focus:ring-2 focus:ring-[#0A4174] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowNewCustomer(true)}
                title="Add New Customer"
                className="absolute right-2 top-1.5 p-1 rounded-full text-[#0A4174] dark:text-[#4A8CD2] hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D]"
              >
                <UserPlus className="w-3.5 h-3.5" />
              </button>

              {/* Customer Dropdown */}
              {customerDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto bg-white dark:bg-[#121E2C] border border-[#DCE5EF] dark:border-[#22354B] rounded-xl shadow-xl z-30 text-xs divide-y divide-[#DCE5EF] dark:divide-[#22354B]">
                  <div
                    onClick={() => {
                      setSelectedCustomerId('');
                      setCustomerSearch('Walk-in Customer');
                      setCustomerDropdownOpen(false);
                    }}
                    className="p-2 hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] cursor-pointer font-medium text-[#5A6B82] dark:text-[#94A3B8]"
                  >
                    Walk-in Customer (General)
                  </div>
                  {filteredCustomers.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => {
                        setSelectedCustomerId(c.id);
                        setCustomerSearch(`${c.name} (${c.phone || 'No phone'})`);
                        setCustomerDropdownOpen(false);
                      }}
                      className="p-2 hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] cursor-pointer flex justify-between items-center"
                    >
                      <div>
                        <div className="font-semibold text-[#1C2736] dark:text-[#F1F5F9]">{c.name}</div>
                        <div className="text-[10px] text-[#5A6B82] dark:text-[#94A3B8]">{c.phone || c.email || 'No phone'}</div>
                      </div>
                      {Number(c.balance || 0) > 0 && (
                        <span className="text-[10px] text-[#0A4174] dark:text-[#4A8CD2] font-bold">
                          Due: {formatCurrency(c.balance, currency)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Search product input */}
            <div className="relative flex-1 min-w-[260px]">
              <Search className="w-4 h-4 text-[#5A6B82] dark:text-[#94A3B8] absolute left-3.5 top-2.5" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const term = search.trim().toLowerCase();
                    if (!term) return;
                    const match =
                      products.find(
                        (p) =>
                          (p.barcode && p.barcode.toLowerCase() === term) ||
                          (p.sku && p.sku.toLowerCase() === term)
                      ) || filteredProducts[0];
                    if (match) {
                      handleProductClick(match);
                      setSearch('');
                    }
                  }
                }}
                placeholder="Search product by name, SKU or barcode (Press Enter)..."
                className="w-full pl-9 pr-14 py-2 rounded-full border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB] dark:bg-[#0B131E] text-xs focus:ring-2 focus:ring-[#0A4174] focus:outline-none"
              />
              <div className="absolute right-3 top-2 flex items-center gap-1.5">
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="p-0.5 text-[#5A6B82] hover:text-[#1C2736] dark:hover:text-[#F1F5F9]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-mono text-[#5A6B82] dark:text-[#94A3B8] bg-[#E2EDF8] dark:bg-[#1A2A3D]">
                  F2
                </span>
              </div>
            </div>

            {/* Hardware Quick Action Icons */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                title="Camera & Photo Scanner"
                className="p-2 rounded-full border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] text-[#5A6B82] dark:text-[#94A3B8] hover:text-[#0A4174] dark:hover:text-[#4A8CD2] hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] transition-colors"
              >
                <Camera className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setPrinterModal(true)}
                title="WiFi Thermal Printer"
                className="p-2 rounded-full border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] text-[#5A6B82] dark:text-[#94A3B8] hover:text-[#0A4174] dark:hover:text-[#4A8CD2] hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] transition-colors"
              >
                <Wifi className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setPrinterModal(true)}
                title="Bluetooth Printer"
                className="p-2 rounded-full border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] text-[#5A6B82] dark:text-[#94A3B8] hover:text-[#0A4174] dark:hover:text-[#4A8CD2] hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] transition-colors"
              >
                <Bluetooth className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Row 3: Categories & View Mode (matching reference screenshot 2) */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              {/* All Items pill */}
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all');
                  setFilterTopSelling(false);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  selectedCategory === 'all' && !filterTopSelling
                    ? 'bg-[#0A4174] text-white shadow-xs dark:bg-[#4A8CD2] dark:text-[#0B131E]'
                    : 'bg-white dark:bg-[#121E2C] text-[#5A6B82] dark:text-[#94A3B8] hover:bg-[#E2EDF8] border border-[#DCE5EF] dark:border-[#22354B]'
                }`}
              >
                All Items
              </button>

              {/* Top Selling pill */}
              <button
                type="button"
                onClick={() => setFilterTopSelling((prev) => !prev)}
                className={`inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  filterTopSelling
                    ? 'bg-[#0A4174] text-white shadow-xs dark:bg-[#4A8CD2] dark:text-[#0B131E]'
                    : 'bg-white dark:bg-[#121E2C] text-[#5A6B82] dark:text-[#94A3B8] hover:bg-[#E2EDF8] border border-[#DCE5EF] dark:border-[#22354B]'
                }`}
              >
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>Top Selling</span>
              </button>

              {/* Categories dropdown pill */}
              <div className="relative" ref={categoryDropdownRef}>
                <button
                  type="button"
                  onClick={() => setCategoryDropdownOpen((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-[#121E2C] text-[#5A6B82] dark:text-[#94A3B8] hover:bg-[#E2EDF8] border border-[#DCE5EF] dark:border-[#22354B]"
                >
                  <span>
                    {selectedCategory === 'all'
                      ? `Categories (${categoryList.length})`
                      : selectedCategory}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {categoryDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1.5 w-48 max-h-56 overflow-y-auto bg-white dark:bg-[#121E2C] border border-[#DCE5EF] dark:border-[#22354B] rounded-xl shadow-xl z-30 text-xs py-1 scrollbar-thin">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory('all');
                        setCategoryDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] font-semibold text-[#0A4174] dark:text-[#4A8CD2]"
                    >
                      All Categories
                    </button>
                    {categoryList.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setSelectedCategory(cat);
                          setCategoryDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] ${
                          selectedCategory === cat ? 'font-bold text-[#0A4174] dark:text-[#4A8CD2] bg-[#E2EDF8]/60' : 'text-[#5A6B82] dark:text-[#94A3B8]'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* View Mode Toggle: List vs Grid */}
            <div className="flex items-center rounded-lg border border-[#DCE5EF] dark:border-[#22354B] p-0.5 bg-[#F4F7FB] dark:bg-[#0B131E]">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  viewMode === 'list'
                    ? 'bg-[#0A4174] text-white shadow-xs dark:bg-[#4A8CD2] dark:text-[#0B131E]'
                    : 'text-[#5A6B82] dark:text-[#94A3B8]'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>List</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-[#0A4174] text-white shadow-xs dark:bg-[#4A8CD2] dark:text-[#0B131E]'
                    : 'text-[#5A6B82] dark:text-[#94A3B8]'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Grid</span>
              </button>
            </div>
          </div>
        </div>

        {/* Product Catalog Display (matches Screenshot 2 grid cards) */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin bg-[#F4F7FB]/40 dark:bg-[#0B131E]/30">
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map((p) => {
                const price = getProductPrice(p);
                const stock = Number(p.stock_qty || 0);
                const isOutOfStock = stock <= 0;
                const qty = getCardQty(p.id);

                return (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-2xl border border-[#DCE5EF] dark:border-[#22354B] hover:border-[#0A4174] dark:hover:border-[#4A8CD2] bg-white dark:bg-[#121E2C] shadow-xs hover:shadow-md transition-all flex flex-col justify-between group relative"
                  >
                    <div>
                      {/* Top Right In Stock Badge */}
                      <div className="flex justify-end mb-2">
                        {isOutOfStock ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/40 dark:border-red-800">
                            Out of Stock
                          </span>
                        ) : (
                          <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800">
                            In Stock
                          </span>
                        )}
                      </div>

                      {/* Card Center: Product Image or Icon & Brand */}
                      {(() => {
                        const imgUrl = getProductImage(p);
                        if (imgUrl) {
                          return (
                            <div className="w-full h-28 mb-2 rounded-xl overflow-hidden bg-[#F4F7FB] dark:bg-[#0B131E] flex items-center justify-center border border-[#DCE5EF] dark:border-[#22354B] relative group-hover:border-[#0A4174] dark:group-hover:border-[#4A8CD2] transition-colors">
                              <img
                                src={imgUrl}
                                alt={p.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  const fallback = e.currentTarget.nextElementSibling;
                                  if (fallback) fallback.style.display = 'flex';
                                }}
                              />
                              <div style={{ display: 'none' }} className="flex-col items-center justify-center py-2 text-center w-full h-full">
                                <div className="w-10 h-10 rounded-xl bg-[#E2EDF8] dark:bg-[#1A2A3D] text-[#0A4174] dark:text-[#4A8CD2] flex items-center justify-center mb-1">
                                  <ShoppingBag className="w-5 h-5 stroke-[1.5]" />
                                </div>
                                <span className="text-[10px] text-[#5A6B82] dark:text-[#94A3B8] font-medium truncate max-w-[120px]">
                                  {p.brand_name || p.category_name || 'General'}
                                </span>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div className="flex flex-col items-center justify-center py-2 text-center">
                            <div className="w-12 h-12 rounded-xl bg-[#E2EDF8] dark:bg-[#1A2A3D] text-[#0A4174] dark:text-[#4A8CD2] flex items-center justify-center mb-1">
                              <ShoppingBag className="w-6 h-6 stroke-[1.5]" />
                            </div>
                            <span className="text-[11px] text-[#5A6B82] dark:text-[#94A3B8] font-medium truncate max-w-[140px]">
                              {p.brand_name || p.category_name || 'General'}
                            </span>
                          </div>
                        );
                      })()}

                      {/* Product Name */}
                      <div className="font-bold text-xs text-[#1C2736] dark:text-[#F1F5F9] line-clamp-2 mt-1 mb-2 group-hover:text-[#0A4174] dark:group-hover:text-[#4A8CD2] transition-colors">
                        {p.name}
                      </div>

                      {/* Price & SKU / Stock */}
                      <div className="flex items-baseline justify-between text-xs mt-1">
                        <span className="font-extrabold text-sm text-[#0A4174] dark:text-[#4A8CD2]">
                          {formatCurrency(price, currency)}
                        </span>
                        <div className="text-right text-[10px] text-[#5A6B82] dark:text-[#94A3B8]">
                          {p.sku && <div>SKU: {p.sku}</div>}
                          <div>Stock: {stock}</div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Actions: Quantity Stepper & Add to Cart button */}
                    <div className="mt-3 pt-2.5 border-t border-[#DCE5EF] dark:border-[#22354B] space-y-2">
                      {/* Quantity Stepper */}
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateCardQty(p.id, -1)}
                          className="w-6 h-6 rounded-md border border-[#DCE5EF] dark:border-[#22354B] flex items-center justify-center text-[#5A6B82] dark:text-[#94A3B8] hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D]"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold w-6 text-center">{qty}</span>
                        <button
                          type="button"
                          onClick={() => updateCardQty(p.id, 1)}
                          className="w-6 h-6 rounded-md border border-[#DCE5EF] dark:border-[#22354B] flex items-center justify-center text-[#5A6B82] dark:text-[#94A3B8] hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D]"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Add to Cart full-width button (matching reference) */}
                      <button
                        type="button"
                        onClick={() => handleProductClick(p)}
                        className="w-full py-2 rounded-xl bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E] text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add to Cart</span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredProducts.length === 0 && (
                <div className="col-span-full py-16 text-center text-[#5A6B82] dark:text-[#94A3B8] text-xs space-y-2">
                  <div className="w-12 h-12 rounded-full bg-[#E2EDF8] dark:bg-[#1A2A3D] text-[#0A4174] dark:text-[#4A8CD2] flex items-center justify-center mx-auto">
                    <Package className="w-6 h-6" />
                  </div>
                  <p className="font-semibold text-sm text-[#1C2736] dark:text-[#F1F5F9]">
                    {products.length === 0 ? 'No products available in database' : 'No products match your search or filter'}
                  </p>
                  {(search || selectedCategory !== 'all' || filterTopSelling) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('');
                        setSelectedCategory('all');
                        setFilterTopSelling(false);
                      }}
                      className="px-4 py-1.5 rounded-xl bg-[#0A4174] hover:bg-[#062E52] text-white dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] dark:text-[#0B131E] text-xs font-bold transition-all shadow-xs"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Table List View */
            <div className="overflow-x-auto rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C]">
              <table className="min-w-full text-xs">
                <thead className="bg-[#F4F7FB] dark:bg-[#1A2A3D] text-left font-semibold text-[#5A6B82] dark:text-[#94A3B8]">
                  <tr>
                    <th className="px-3.5 py-2.5">Product</th>
                    <th className="px-3.5 py-2.5">Category</th>
                    <th className="px-3.5 py-2.5">Barcode</th>
                    <th className="px-3.5 py-2.5 text-right">Price ({currency})</th>
                    <th className="px-3.5 py-2.5 text-right">Stock</th>
                    <th className="px-3.5 py-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE5EF] dark:divide-[#22354B]">
                  {filteredProducts.map((p) => {
                    const price = getProductPrice(p);
                    const stock = Number(p.stock_qty || 0);
                    const isOutOfStock = stock <= 0;
                    return (
                      <tr
                        key={p.id}
                        onClick={() => handleProductClick(p)}
                        className="hover:bg-[#E2EDF8]/40 dark:hover:bg-[#1A2A3D]/50 cursor-pointer transition-colors"
                      >
                        <td className="px-3.5 py-2.5 font-bold text-[#1C2736] dark:text-[#F1F5F9]">{p.name}</td>
                        <td className="px-3.5 py-2.5 text-[#5A6B82] dark:text-[#94A3B8]">{p.category_name || 'General'}</td>
                        <td className="px-3.5 py-2.5 font-mono text-[#5A6B82] dark:text-[#94A3B8]">{p.barcode || '—'}</td>
                        <td className="px-3.5 py-2.5 text-right font-extrabold text-[#0A4174] dark:text-[#4A8CD2]">
                          {formatCurrency(price, currency)}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-medium">
                          {isOutOfStock ? (
                            <span className="text-red-500 font-bold">Out of stock</span>
                          ) : (
                            <span>{stock} {p.unit_code || 'pcs'}</span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleProductClick(p);
                            }}
                            className="px-3 py-1 rounded-lg bg-[#0A4174] text-white dark:bg-[#4A8CD2] dark:text-[#0B131E] font-bold text-[11px] shadow-2xs hover:opacity-90"
                          >
                            + Add to Cart
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-[#5A6B82] dark:text-[#94A3B8] text-xs">
                        {products.length === 0 ? 'No products available in database' : 'No products match your search or filter'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Billing Section / Cart */}
      <div className="w-full lg:w-96 flex flex-col bg-white dark:bg-[#121E2C] rounded-2xl border border-[#DCE5EF] dark:border-[#22354B] shadow-sm overflow-hidden flex-shrink-0">
        {/* Current Bill Cart Section */}
        <div className="p-4 border-b border-[#DCE5EF] dark:border-[#22354B] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-[#0A4174] dark:text-[#4A8CD2]" />
            <span className="text-sm font-bold text-[#1C2736] dark:text-[#F1F5F9]">
              Current Bill ({cart.reduce((s, it) => s + it.qty, 0)} Items)
            </span>
          </div>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-red-500 hover:text-red-600 font-semibold flex items-center gap-1 hover:underline"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear Cart
            </button>
          )}
        </div>

        {/* Cart items list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 scrollbar-thin">
          {cart.map((line) => (
            <div
              key={line.key}
              className="p-3 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB]/70 dark:bg-[#0B131E]/60 text-xs space-y-2"
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <span className="font-bold text-[#1C2736] dark:text-[#F1F5F9] leading-snug">
                    {line.product_name}
                  </span>
                  <div className="text-[10px] text-[#5A6B82] dark:text-[#94A3B8]">
                    {formatCurrency(lineUnitWithAddons(line), currency)} each
                  </div>
                </div>
                <button
                  onClick={() => removeLine(line.key)}
                  className="text-[#5A6B82] dark:text-[#94A3B8] hover:text-red-500 transition-colors p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateLineQty(line.key, -1)}
                    className="w-5 h-5 rounded border border-[#DCE5EF] dark:border-[#22354B] flex items-center justify-center text-[#5A6B82] dark:text-[#94A3B8] hover:bg-[#E2EDF8] dark:hover:bg-[#22354B]"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="font-bold text-xs min-w-[20px] text-center">{line.qty}</span>
                  <button
                    onClick={() => updateLineQty(line.key, 1)}
                    className="w-5 h-5 rounded border border-[#DCE5EF] dark:border-[#22354B] flex items-center justify-center text-[#5A6B82] dark:text-[#94A3B8] hover:bg-[#E2EDF8] dark:hover:bg-[#22354B]"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                <div className="text-right">
                  <span className="font-black text-[#0A4174] dark:text-[#4A8CD2]">
                    {formatCurrency(line.qty * lineUnitWithAddons(line), currency)}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {cart.length === 0 && (
            <div className="py-16 text-center text-[#5A6B82] dark:text-[#94A3B8] text-xs flex flex-col items-center gap-2">
              <ShoppingCart className="w-10 h-10 stroke-[1.5] text-[#5A6B82] opacity-40" />
              <span className="font-medium">Cart is empty</span>
              <span className="text-[11px] text-[#5A6B82]">Click products or scan barcodes to begin sale</span>
            </div>
          )}
        </div>

        {/* Totals, Discount & Checkout */}
        <div className="p-4 border-t border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB]/50 dark:bg-[#0B131E]/80 space-y-3">
          {/* Discount Section */}
          {canDiscount && (
            <div className="flex items-center justify-between gap-2 text-xs">
              <label className="font-semibold text-[#1C2736] dark:text-[#94A3B8] whitespace-nowrap">
                Bill Discount:
              </label>
              <div className="flex items-center gap-1.5 flex-1 max-w-[170px]">
                <div className="flex rounded border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#1A2A3D] p-0.5">
                  <button
                    type="button"
                    onClick={() => setDiscountType('fixed')}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      discountType === 'fixed'
                        ? 'bg-[#0A4174] text-white dark:bg-[#4A8CD2] dark:text-[#0B131E]'
                        : 'text-[#5A6B82] dark:text-[#94A3B8]'
                    }`}
                  >
                    {currency}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('percent')}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      discountType === 'percent'
                        ? 'bg-[#0A4174] text-white dark:bg-[#4A8CD2] dark:text-[#0B131E]'
                        : 'text-[#5A6B82] dark:text-[#94A3B8]'
                    }`}
                  >
                    %
                  </button>
                </div>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountType === 'percent' ? '10%' : '100'}
                  className="w-full rounded-md border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#1A2A3D] px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-[#0A4174] font-semibold"
                />
              </div>
            </div>
          )}

          {/* Payment Method Tabs */}
          <div className="grid grid-cols-4 gap-1">
            {[
              { id: 'cash', label: 'Cash', icon: Banknote },
              { id: 'upi', label: 'UPI', icon: Smartphone },
              { id: 'card', label: 'Card', icon: CreditCard },
              { id: 'credit', label: 'Credit', icon: RotateCcw },
            ].map((m) => {
              const Icon = m.icon;
              const active = paymentMethod === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setPaymentMethod(m.id)}
                  className={`py-1.5 rounded-lg text-[11px] font-bold flex flex-col items-center gap-0.5 transition-colors ${
                    active
                      ? 'bg-[#0A4174] text-white dark:bg-[#4A8CD2] dark:text-[#0B131E] shadow-sm'
                      : 'bg-white dark:bg-[#1A2A3D] border border-[#DCE5EF] dark:border-[#22354B] text-[#5A6B82] dark:text-[#94A3B8]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>

          {/* Grand Total Display */}
          <div className="flex justify-between items-baseline pt-1">
            <span className="text-xs font-semibold text-[#5A6B82]">Net Payable:</span>
            <span className="text-xl font-black text-[#1C2736] dark:text-[#F1F5F9]">
              {formatCurrency(totals.grandTotal, currency)}
            </span>
          </div>

          {/* Action Buttons: Hold & Complete Sale */}
          <div className="flex gap-2">
            <button
              onClick={holdBill}
              disabled={cart.length === 0}
              className="px-3 py-2.5 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] text-[#1C2736] dark:text-[#94A3B8] hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 text-xs font-bold"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Hold</span>
            </button>
            <button
              onClick={completeSale}
              disabled={cart.length === 0}
              className="flex-1 py-2.5 rounded-xl bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E] disabled:opacity-50 font-black text-xs shadow-md transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Complete Sale</span>
            </button>
          </div>
        </div>
      </div>

      {/* Held Bills Modal */}
      {showHeldModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#121E2C] p-6 shadow-2xl border border-[#DCE5EF] dark:border-[#22354B] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#DCE5EF] dark:border-[#22354B]">
              <h3 className="font-bold text-sm text-[#1C2736] dark:text-[#F1F5F9] flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#0A4174] dark:text-[#4A8CD2]" />
                Held Bills ({heldBills.length})
              </h3>
              <button onClick={() => setShowHeldModal(false)} className="text-[#5A6B82] hover:text-[#1C2736]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2 text-xs">
              {heldBills.map((b) => (
                <div
                  key={b.uuid}
                  className="p-3 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] flex items-center justify-between hover:bg-[#E2EDF8]/40"
                >
                  <div>
                    <div className="font-bold text-[#1C2736] dark:text-[#F1F5F9]">{b.customer_name}</div>
                    <div className="text-[10px] text-[#5A6B82]">
                      {b.cart?.length || 0} items • {new Date(b.held_at).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-black text-sm text-[#0A4174] dark:text-[#4A8CD2]">
                      {formatCurrency(b.totals?.grandTotal || 0, currency)}
                    </span>
                    <button
                      onClick={() => recallBill(b)}
                      className="px-2.5 py-1 rounded-lg bg-[#0A4174] text-white dark:bg-[#4A8CD2] dark:text-[#0B131E] text-xs font-bold"
                    >
                      Recall
                    </button>
                  </div>
                </div>
              ))}
              {heldBills.length === 0 && (
                <div className="py-8 text-center text-[#5A6B82]">No bills currently on hold.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Customizer Modal for food / variants */}
      {customizer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#121E2C] p-5 shadow-2xl border border-[#DCE5EF] dark:border-[#22354B] space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#DCE5EF] dark:border-[#22354B]">
              <h3 className="font-bold text-sm text-[#1C2736] dark:text-[#F1F5F9]">{customizer.product.name}</h3>
              <button onClick={() => setCustomizer(null)} className="text-[#5A6B82]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {customizer.product.variants?.length > 0 && (
              <div className="space-y-1 text-xs">
                <span className="font-semibold text-[#5A6B82] block">Select Variant:</span>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {customizer.product.variants.map((v) => (
                    <label
                      key={v.id}
                      className={`flex items-center justify-between p-2 rounded-xl border cursor-pointer ${
                        customizer.variantId === v.id
                          ? 'border-[#0A4174] bg-[#E2EDF8]/60 dark:bg-[#1A2A3D]'
                          : 'border-[#DCE5EF] dark:border-[#22354B]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="pos_variant"
                          checked={customizer.variantId === v.id}
                          onChange={() => setCustomizer((c) => ({ ...c, variantId: v.id }))}
                          className="accent-[#0A4174]"
                        />
                        <span className="font-semibold text-[#1C2736] dark:text-[#F1F5F9]">{v.variant_name}</span>
                      </div>
                      <span className="text-[11px] font-bold text-[#0A4174] dark:text-[#4A8CD2]">
                        {v.selling_price && Number(v.selling_price) > 0
                          ? formatCurrency(v.selling_price, currency)
                          : Number(v.price_adjustment) !== 0
                          ? `${Number(v.price_adjustment) > 0 ? '+' : ''}${formatCurrency(v.price_adjustment, currency)}`
                          : formatCurrency(customizer.product.selling_price || 0, currency)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 flex gap-2 text-xs">
              <button
                onClick={() => setCustomizer(null)}
                className="flex-1 py-2 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] text-[#5A6B82]"
              >
                Cancel
              </button>
              <button
                onClick={confirmCustomizer}
                className="flex-1 py-2 rounded-xl bg-[#0A4174] text-white dark:bg-[#4A8CD2] dark:text-[#0B131E] font-bold"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Serial Picker Modal */}
      {serialPicker && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#121E2C] p-5 shadow-2xl border border-[#DCE5EF] dark:border-[#22354B] space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#DCE5EF] dark:border-[#22354B]">
              <h3 className="font-bold text-sm text-[#1C2736] dark:text-[#F1F5F9]">
                Select IMEI / Serial: {serialPicker.name}
              </h3>
              <button onClick={() => setSerialPicker(null)} className="text-[#5A6B82]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-56 overflow-y-auto space-y-1.5 text-xs">
              {serialPicker.available_serials?.map((s) => (
                <div
                  key={s.id}
                  onClick={() => {
                    addToCart(serialPicker, s);
                    setSerialPicker(null);
                  }}
                  className="p-2.5 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] hover:border-[#0A4174] hover:bg-[#E2EDF8]/50 cursor-pointer flex justify-between items-center"
                >
                  <span className="font-mono font-semibold">{s.imei1 || s.serial_no}</span>
                  <span className="text-[10px] text-emerald-600 font-bold">Pick</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showNewCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#121E2C] p-6 shadow-2xl border border-[#DCE5EF] dark:border-[#22354B] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#DCE5EF] dark:border-[#22354B]">
              <h3 className="font-bold text-sm text-[#1C2736] dark:text-[#F1F5F9] flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#0A4174] dark:text-[#4A8CD2]" />
                Add New Customer
              </h3>
              <button onClick={() => setShowNewCustomer(false)} className="text-[#5A6B82]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={saveNewCustomer} className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-[#1C2736] dark:text-[#F1F5F9]">Customer Name *</label>
                <input
                  required
                  value={newCustomerForm.name}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB] dark:bg-[#0B131E] px-3 py-2 text-xs focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-[#1C2736] dark:text-[#F1F5F9]">Phone Number</label>
                <input
                  value={newCustomerForm.phone}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB] dark:bg-[#0B131E] px-3 py-2 text-xs focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                />
              </div>
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewCustomer(false)}
                  className="flex-1 py-2 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] text-[#5A6B82]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-[#0A4174] text-white dark:bg-[#4A8CD2] dark:text-[#0B131E] font-bold"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Thermal Printer Settings Modal */}
      {printerModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#121E2C] p-6 shadow-2xl border border-[#DCE5EF] dark:border-[#22354B] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#DCE5EF] dark:border-[#22354B]">
              <h3 className="font-bold text-sm text-[#1C2736] dark:text-[#F1F5F9] flex items-center gap-2">
                <Printer className="w-4 h-4 text-[#0A4174] dark:text-[#4A8CD2]" />
                Wireless Thermal Printers
              </h3>
              <button onClick={() => setPrinterModal(false)} className="text-[#5A6B82]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div
                onClick={() => setConnectedPrinter('WiFi ESC/POS (192.168.1.200)')}
                className="p-3 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] hover:border-[#0A4174] flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Wifi className="w-4 h-4 text-emerald-500" />
                  <div>
                    <div className="font-bold text-[#1C2736] dark:text-[#F1F5F9]">WiFi Thermal 80mm</div>
                    <div className="text-[10px] text-[#5A6B82]">192.168.1.200:9100</div>
                  </div>
                </div>
                <span className="text-[10px] text-emerald-600 font-bold">Connect</span>
              </div>
              <div
                onClick={() => setConnectedPrinter('Bluetooth POS-80')}
                className="p-3 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] hover:border-[#0A4174] flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Bluetooth className="w-4 h-4 text-[#0A4174]" />
                  <div>
                    <div className="font-bold text-[#1C2736] dark:text-[#F1F5F9]">Bluetooth Mobile POS</div>
                    <div className="text-[10px] text-[#5A6B82]">Paired BT Device (COM3)</div>
                  </div>
                </div>
                <span className="text-[10px] text-[#0A4174] font-bold">Connect</span>
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-[#E2EDF8] dark:bg-[#1A2A3D] text-[11px] text-[#0A4174] dark:text-[#4A8CD2] font-medium">
              Active: <span className="font-bold">{connectedPrinter}</span>
            </div>
            <button
              onClick={() => setPrinterModal(false)}
              className="w-full py-2 rounded-xl bg-[#0A4174] hover:bg-[#062E52] text-white font-bold text-xs"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
