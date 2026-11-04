import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../config/api';
import { useSettings } from '../hooks/useSettings';
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
  Smartphone
} from 'lucide-react';

const SLOGANS = [
  'Thank you for shopping with us! Have a wonderful day.',
  'Quality is our top priority. We look forward to seeing you again!',
  'Your trust is our greatest asset. Thank you for your business.',
  'Serving you with honesty, value and pride!',
  'Great products for great customers. Visit us again soon!',
];

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

  // Pricing & Customer Type: retail, wholesale, regular
  const [customerType, setCustomerType] = useState('retail');

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
  const currency = settings?.currency_symbol || '₹';

  const loadProducts = async () => {
    if (!settings?.business_type) return;
    try {
      const { data } = await api.get('/products', {
        params: { business_type: settings.business_type },
      });
      setProducts(data);
      cacheProducts(data);
    } catch {
      setProducts(await getCachedProducts());
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
    loadProducts();
    loadCustomers();
    refreshHeldBills();
    api.get('/lookup/addons').then(({ data }) => setAddons(data.filter((a) => a.is_active))).catch(() => {});
    searchRef.current?.focus();
  }, [settings?.business_type]);

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

  // Helper to determine product price based on selected customerType
  const getProductPrice = (product) => {
    if (customerType === 'wholesale' && Number(product.wholesale_price) > 0) {
      return Number(product.wholesale_price);
    }
    if (customerType === 'regular' && Number(product.customer_price) > 0) {
      return Number(product.customer_price);
    }
    return Number(product.selling_price || product.retail_price || 0);
  };

  // Filter products by search
  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.barcode || '').toLowerCase().includes(term) ||
        (p.sku || '').toLowerCase().includes(term)
    );
  }, [products, search]);

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

  const addToCart = (product, serial = null, variant = null, selectedAddons = []) => {
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
          product_name: `${product.name} (IMEI: ${serial.imei1 || serial.serial_no})`,
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
        return c.map((l) => (l.key === existing.key ? recalcLine({ ...l, qty: l.qty + 1 }) : l));
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
          qty: 1,
          unit_price: unitPrice,
          discount_amount: 0,
          tax_percent: taxPercent,
          tax_amount: taxAmount,
          addons: selectedAddons,
        },
      ];
    });
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
    // Check if product specifically has addons attached, or if variants exist
    const productAddons = Array.isArray(product.attributes?.addons) ? product.attributes.addons : [];
    const hasProductAddons = settings?.business_type === 'food' && productAddons.length > 0;
    if (hasVariants || hasProductAddons) {
      setCustomizer({ product, variantId: product.variants?.[0]?.id ?? null, addonIds: [] });
      return;
    }
    addToCart(product);
  };

  const confirmCustomizer = () => {
    if (!customizer) return;
    const { product, variantId, addonIds } = customizer;
    const variant = product.variants?.find((v) => v.id === variantId) || null;
    const selectedAddons = addons.filter((a) => addonIds.includes(a.id)).map((a) => ({ name: a.name, price: Number(a.price) }));
    addToCart(product, null, variant, selectedAddons);
    setCustomizer(null);
  };

  const updateLineQty = (key, delta) => {
    setCart((c) =>
      c
        .map((l) => {
          if (l.key !== key) return l;
          const newQty = Math.max(1, l.qty + delta);
          return recalcLine({ ...l, qty: newQty });
        })
        .filter(Boolean)
    );
  };

  const lineAddonsTotal = (line) => (line.addons || []).reduce((s, a) => s + Number(a.price), 0);
  const lineUnitWithAddons = (line) => Number(line.unit_price) + lineAddonsTotal(line);

  const recalcLine = (line) => {
    const base = line.qty * lineUnitWithAddons(line);
    const taxAmount = Math.round((((base - line.discount_amount) * (line.tax_percent || 0)) / 100) * 100) / 100;
    return { ...line, tax_amount: taxAmount };
  };

  const removeLine = (key) => setCart((c) => c.filter((l) => l.key !== key));
  const clearCart = () => setCart([]);

  // Calculate Subtotal, Discounts, Taxes, Grand Total
  const totals = useMemo(() => {
    const subtotal = cart.reduce((s, l) => s + l.qty * lineUnitWithAddons(l), 0);
    let billDiscount = 0;
    if (discountValue) {
      if (discountType === 'percent') {
        billDiscount = Math.round(((subtotal * Number(discountValue)) / 100) * 100) / 100;
      } else {
        billDiscount = Number(discountValue);
      }
    }
    const tax = cart.reduce((s, l) => s + Number(l.tax_amount || 0), 0);
    const grandTotal = Math.max(0, Math.round((subtotal - billDiscount + tax) * 100) / 100);
    return { subtotal, billDiscount, tax, grandTotal };
  }, [cart, discountType, discountValue]);

  useEffect(() => {
    if (paymentMethod !== 'credit') {
      setPaidAmount(totals.grandTotal.toFixed(2));
    } else {
      setPaidAmount('0');
    }
  }, [totals.grandTotal, paymentMethod]);

  const resetSale = () => {
    setCart([]);
    setSelectedCustomerId('');
    setCustomerSearch('');
    setPaymentMethod('cash');
    setDiscountValue('');
    searchRef.current?.focus();
  };

  // Hold Bill
  const holdBill = async () => {
    if (cart.length === 0) return;
    const uuid = newUuid();
    const bill = {
      uuid,
      label: `Hold ${new Date().toLocaleTimeString()} (${cart.length} items)`,
      customer_id: typeof selectedCustomerId === 'number' ? selectedCustomerId : null,
      payload: { cart, customer_id: selectedCustomerId, customerType },
      created_at: new Date().toISOString(),
    };
    await saveLocalHeldBill(bill);
    try {
      await api.post('/held-bills', bill);
    } catch {
      // offline
    }
    resetSale();
    refreshHeldBills();
    setMessage('Bill placed on hold');
  };

  const resumeBill = async (bill) => {
    const payload = typeof bill.payload === 'string' ? JSON.parse(bill.payload) : bill.payload;
    setCart(payload.cart || []);
    if (payload.customer_id) {
      setSelectedCustomerId(payload.customer_id);
      const cust = customers.find((c) => c.id === payload.customer_id);
      if (cust) setCustomerSearch(cust.name);
    }
    if (payload.customerType) setCustomerType(payload.customerType);

    await removeLocalHeldBill(bill.uuid);
    try {
      if (bill.id) await api.delete(`/held-bills/${bill.id}`);
    } catch {
      // ignore
    }
    setShowHeldModal(false);
    refreshHeldBills();
  };

  // Create New Customer from POS Modal
  const createNewCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomerForm.name.trim()) return;

    const uuid = newUuid();
    const payload = {
      uuid,
      name: newCustomerForm.name.trim(),
      phone: newCustomerForm.phone.trim() || null,
      email: newCustomerForm.email.trim() || null,
      opening_balance: Number(newCustomerForm.opening_balance || 0),
      balance: Number(newCustomerForm.opening_balance || 0),
    };

    try {
      const { data } = await api.post('/customers', payload);
      setCustomers((c) => [...c, data]);
      setSelectedCustomerId(data.id);
      setCustomerSearch(data.name);
    } catch {
      const localCustomer = { id: `local-${uuid}`, ...payload };
      await addLocalCustomer(localCustomer);
      await enqueueOutboxItem({ client_id: uuid, type: 'customer', payload });
      refreshPendingCount();
      setCustomers((c) => [...c, localCustomer]);
      setSelectedCustomerId(localCustomer.id);
      setCustomerSearch(localCustomer.name);
    }

    setNewCustomerForm({ name: '', phone: '', email: '', opening_balance: '' });
    setShowNewCustomer(false);
  };

  // Finalize Sale
  const finalizeSale = async () => {
    if (cart.length === 0) return;
    const uuid = newUuid();
    const randomSlogan = SLOGANS[Math.floor(Math.random() * SLOGANS.length)];

    const items = cart.map((l) => ({
      product_id: l.product_id,
      serial_id: l.serial_id || null,
      variant_id: l.variant_id || null,
      product_name: l.product_name,
      qty: l.qty,
      unit_price: l.unit_price,
      discount_amount: l.discount_amount,
      tax_amount: l.tax_amount,
      addons: l.addons || [],
      customization: l.variant_label ? { variant: l.variant_label } : undefined,
    }));

    const customerIdNumeric = typeof selectedCustomerId === 'number' ? selectedCustomerId : null;
    const payments = [{ payment_method: paymentMethod, amount: Number(paidAmount) || 0 }];

    const basePayload = {
      uuid,
      customer_id: customerIdNumeric,
      items,
      payments,
      discount_amount: totals.billDiscount,
      slogan: randomSlogan,
      customer_type: customerType,
    };

    if (navigator.onLine) {
      try {
        const { data } = await api.post('/invoices', { ...basePayload, source: 'online' });
        loadProducts();
        setMessage(`Invoice ${data.invoice_no} completed!`);
        openReceiptWindow(data, settings);
        resetSale();
        return;
      } catch (err) {
        if (err.response) {
          alert(err.response.data?.error || 'Failed to generate invoice');
          return;
        }
      }
    }

    // Offline mode
    const createdAt = new Date().toISOString();
    await enqueueOutboxItem({
      client_id: uuid,
      type: 'invoice',
      payload: { ...basePayload, source: 'offline', created_at: createdAt },
    });
    for (const line of cart) {
      await applyLocalStockDelta(line.product_id, -line.qty);
    }
    refreshPendingCount();
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
        slogan: randomSlogan,
      },
      settings
    );
    resetSale();
  };

  return (
    <div className="flex flex-col lg:flex-row gap-5 h-[calc(100vh-6rem)] overflow-hidden">
      {/* Left Column: Product Catalog & Quick Actions */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Top Header: Search, View Mode Toggle, Camera Scanner & Hardware Connectors */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex-1 min-w-[220px] relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product by name, barcode, SKU... (F2)"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5">
            {/* View Mode Toggle: Grid vs List */}
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
              <button
                onClick={() => setViewMode('grid')}
                title="Grid View"
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'grid' ? 'bg-white dark:bg-slate-900 shadow-sm text-amber-500' : 'text-slate-400'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                title="List View"
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'list' ? 'bg-white dark:bg-slate-900 shadow-sm text-amber-500' : 'text-slate-400'
                }`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Camera / Barcode Photo Scanner Button */}
            <button
              onClick={() => setScannerOpen(true)}
              title="Camera & Photo Scanner"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-amber-500 transition-colors"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>

            {/* WiFi & Bluetooth Thermal Printer Setup */}
            <button
              onClick={() => setPrinterModal(true)}
              title="WiFi / Bluetooth Thermal Printer"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-amber-500 transition-colors flex items-center gap-1 text-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-medium">Printer</span>
            </button>
          </div>
        </div>

        {/* Product Catalog Display (Grid or List Table) */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredProducts.map((p) => {
                const price = getProductPrice(p);
                const stock = Number(p.stock_qty || 0);
                const isOutOfStock = stock <= 0;
                return (
                  <div
                    key={p.id}
                    onClick={() => handleProductClick(p)}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-500 bg-white dark:bg-slate-900/80 hover:shadow-md cursor-pointer transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="font-semibold text-xs text-slate-800 dark:text-slate-200 line-clamp-2 group-hover:text-amber-500 transition-colors">
                        {p.name}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {p.category_name || settings?.business_type}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="font-bold text-sm text-amber-600 dark:text-amber-400">
                        {currency}{price.toFixed(2)}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          isOutOfStock
                            ? 'bg-red-50 dark:bg-red-950/40 text-red-500'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}
                      >
                        {stock} {p.unit_code || 'pcs'}
                      </span>
                    </div>
                  </div>
                );
              })}
              {filteredProducts.length === 0 && (
                <div className="col-span-full py-16 text-center text-slate-400 text-xs">
                  No products found for {settings?.business_type} catalog
                </div>
              )}
            </div>
          ) : (
            /* Table List View */
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-left font-semibold text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2">Barcode</th>
                    <th className="px-3 py-2 text-right">Price ({currency})</th>
                    <th className="px-3 py-2 text-right">Stock</th>
                    <th className="px-3 py-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredProducts.map((p) => {
                    const price = getProductPrice(p);
                    const stock = Number(p.stock_qty || 0);
                    return (
                      <tr
                        key={p.id}
                        onClick={() => handleProductClick(p)}
                        className="hover:bg-amber-50/40 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                      >
                        <td className="px-3 py-2 font-medium">{p.name}</td>
                        <td className="px-3 py-2 font-mono text-slate-400">{p.barcode || '—'}</td>
                        <td className="px-3 py-2 text-right font-bold text-amber-600">{price.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right">{stock}</td>
                        <td className="px-3 py-2 text-center">
                          <button className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold text-[10px]">
                            + Add
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Billing Section / Cart */}
      <div className="w-full lg:w-96 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex-shrink-0">
        {/* Customer & Pricing Profile Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
          {/* Customer Type Selector & Quick Sale Toggle */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1">
              <span className="font-semibold text-slate-600 dark:text-slate-400 text-[11px]">Pricing:</span>
              <select
                value={customerType}
                onChange={(e) => setCustomerType(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-xs font-semibold focus:outline-none"
              >
                <option value="retail">Retail Pricing</option>
                <option value="wholesale">Wholesale Pricing</option>
                <option value="regular">Regular Customer</option>
              </select>
            </div>

            <button
              onClick={() => {
                setSelectedCustomerId('');
                setCustomerSearch('Walk-in Customer');
              }}
              title="Quick Sale"
              className="flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg hover:bg-amber-100 transition-colors"
            >
              <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
              Quick Sale
            </button>
          </div>

          {/* Customer Search + Dropdown Selection */}
          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  value={customerSearch}
                  onFocus={() => setCustomerDropdownOpen(true)}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setCustomerDropdownOpen(true);
                  }}
                  placeholder="Select or Search Customer..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              <button
                onClick={() => setShowNewCustomer(true)}
                title="Add New Customer"
                className="p-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors"
              >
                <UserPlus className="w-4 h-4" />
              </button>
            </div>

            {/* Dropdown Results */}
            {customerDropdownOpen && (
              <div className="absolute left-0 right-0 top-10 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-30 text-xs divide-y divide-slate-100 dark:divide-slate-800">
                <div
                  onClick={() => {
                    setSelectedCustomerId('');
                    setCustomerSearch('Walk-in Customer');
                    setCustomerDropdownOpen(false);
                  }}
                  className="p-2 hover:bg-amber-50/60 dark:hover:bg-slate-800 cursor-pointer font-medium text-slate-600 dark:text-slate-400"
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
                    className="p-2 hover:bg-amber-50/60 dark:hover:bg-slate-800 cursor-pointer flex justify-between items-center"
                  >
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{c.name}</div>
                      <div className="text-[10px] text-slate-400">{c.phone || c.email || 'No phone'}</div>
                    </div>
                    {Number(c.balance || 0) > 0 && (
                      <span className="text-[10px] text-amber-600 font-bold">
                        Due: {currency}{Number(c.balance).toFixed(2)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Current Bill Cart Section */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 scrollbar-thin">
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Current Bill ({cart.reduce((s, it) => s + it.qty, 0)} Items)
            </span>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-[11px] text-red-500 hover:text-red-600 font-semibold flex items-center gap-1 hover:underline"
              >
                <Trash2 className="w-3 h-3" /> Clear Cart
              </button>
            )}
          </div>

          {cart.map((line) => (
            <div
              key={line.key}
              className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-xs space-y-1.5"
            >
              <div className="flex justify-between items-start gap-2">
                <span className="font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                  {line.product_name}
                </span>
                <button
                  onClick={() => removeLine(line.key)}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateLineQty(line.key, -1)}
                    className="w-5 h-5 rounded border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="font-bold text-xs min-w-[20px] text-center">{line.qty}</span>
                  <button
                    onClick={() => updateLineQty(line.key, 1)}
                    className="w-5 h-5 rounded border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                <div className="text-right">
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    {currency}{(line.qty * lineUnitWithAddons(line)).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {cart.length === 0 && (
            <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <ShoppingCart className="w-8 h-8 stroke-[1.5] text-slate-300 dark:text-slate-700" />
              <span>Cart is empty. Click products or scan barcodes to begin sale.</span>
            </div>
          )}
        </div>

        {/* Totals, Discount Input & Checkout Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/90 space-y-3">
          {/* Discount Section with Label and Unit Toggle */}
          {canDiscount && (
            <div className="flex items-center justify-between gap-2 text-xs">
              <label className="font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                Bill Discount:
              </label>
              <div className="flex items-center gap-1.5 flex-1 max-w-[170px]">
                <div className="flex rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5">
                  <button
                    type="button"
                    onClick={() => setDiscountType('fixed')}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      discountType === 'fixed' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
                    }`}
                  >
                    {currency}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('percent')}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      discountType === 'percent' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
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
                  className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold"
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
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
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
            <span className="text-xs font-semibold text-slate-500">Net Payable:</span>
            <span className="text-xl font-black text-slate-900 dark:text-white">
              {currency}{totals.grandTotal.toFixed(2)}
            </span>
          </div>

          {/* Action Buttons: Hold & Complete Sale */}
          <div className="flex gap-2">
            <button
              onClick={holdBill}
              disabled={cart.length === 0}
              className="px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 text-xs font-bold"
              title="Hold this bill"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Hold</span>
            </button>

            {heldBills.length > 0 && (
              <button
                onClick={() => setShowHeldModal(true)}
                className="px-2.5 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 font-bold text-xs"
                title="Recall held bills"
              >
                ({heldBills.length})
              </button>
            )}

            <button
              onClick={finalizeSale}
              disabled={cart.length === 0}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Checkout & Print</span>
            </button>
          </div>
        </div>
      </div>

      {/* Customizer Modal for Food Addons / Variants */}
      {customizer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                {customizer.product.name}
              </h3>
              <button onClick={() => setCustomizer(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {customizer.product.variants?.length > 0 && (
              <div className="space-y-1.5 text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300 block">Select Variant / Size</span>
                <div className="space-y-1">
                  {customizer.product.variants.map((v) => (
                    <label
                      key={v.id}
                      className={`flex items-center justify-between p-2 rounded-xl border cursor-pointer transition-colors ${
                        customizer.variantId === v.id
                          ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="pos_variant"
                          checked={customizer.variantId === v.id}
                          onChange={() => setCustomizer((c) => ({ ...c, variantId: v.id }))}
                          className="accent-amber-500"
                        />
                        <span className="font-semibold text-slate-900 dark:text-white">{v.variant_name}</span>
                      </div>
                      <span className="text-[11px] font-bold text-amber-600">
                        {v.selling_price && Number(v.selling_price) > 0
                          ? `${currency}${Number(v.selling_price).toFixed(2)}`
                          : Number(v.price_adjustment) !== 0
                          ? `${Number(v.price_adjustment) > 0 ? '+' : ''}${currency}${Number(v.price_adjustment).toFixed(2)}`
                          : `${currency}${Number(customizer.product.selling_price || 0).toFixed(2)}`}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {settings?.business_type === 'food' && (
              (() => {
                const productAddonNames = Array.isArray(customizer.product.attributes?.addons) ? customizer.product.attributes.addons : [];
                const availableAddons = addons.filter((a) => productAddonNames.length === 0 || productAddonNames.includes(a.name));
                if (availableAddons.length === 0) return null;
                return (
                  <div className="space-y-1.5 text-xs pt-1">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 block">Extra Add-ons</span>
                    <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                      {availableAddons.map((a) => (
                        <label
                          key={a.id}
                          className={`flex items-center justify-between p-2 rounded-xl border cursor-pointer transition-colors ${
                            customizer.addonIds.includes(a.id)
                              ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30'
                              : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={customizer.addonIds.includes(a.id)}
                              onChange={(e) =>
                                setCustomizer((c) => ({
                                  ...c,
                                  addonIds: e.target.checked
                                    ? [...c.addonIds, a.id]
                                    : c.addonIds.filter((id) => id !== a.id),
                                }))
                              }
                              className="accent-amber-500 rounded"
                            />
                            <span className="font-medium">{a.name}</span>
                          </div>
                          <span className="text-[11px] font-semibold text-amber-600">
                            +{currency}{Number(a.price).toFixed(2)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })()
            )}

            <div className="pt-2 flex gap-2 text-xs">
              <button
                type="button"
                onClick={confirmCustomizer}
                className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 transition-colors shadow-sm"
              >
                Add to Cart
              </button>
              <button
                type="button"
                onClick={() => setCustomizer(null)}
                className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Serial / IMEI Device Picker Modal */}
      {serialPicker && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Barcode className="w-4 h-4 text-amber-500" />
                Select Device IMEI / Serial
              </h3>
              <button onClick={() => setSerialPicker(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 text-xs font-mono">
              {serialPicker.available_serials.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    addToCart(serialPicker, s);
                    setSerialPicker(null);
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-amber-500 hover:bg-amber-50/50 dark:hover:bg-amber-950/30 text-left transition-colors font-bold text-slate-800 dark:text-slate-200"
                >
                  {s.imei1 ? `IMEI 1: ${s.imei1}` : ''} {s.imei2 ? `| IMEI 2: ${s.imei2}` : ''} {s.serial_no ? `| S/N: ${s.serial_no}` : ''}
                </button>
              ))}
            </div>

            <button
              onClick={() => setSerialPicker(null)}
              className="w-full py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* New Customer Modal */}
      {showNewCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-amber-500" />
                Add New Customer
              </h3>
              <button onClick={() => setShowNewCustomer(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={createNewCustomer} className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">Customer Name *</label>
                <input
                  required
                  value={newCustomerForm.name}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">Phone Number (10 Digits)</label>
                <input
                  maxLength={10}
                  value={newCustomerForm.phone}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value.replace(/\D/g, '') })}
                  placeholder="e.g. 9876543210"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">Opening Balance ({currency})</label>
                <input
                  type="number"
                  value={newCustomerForm.opening_balance}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, opening_balance: e.target.value })}
                  placeholder="0"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 transition-colors shadow-sm"
                >
                  Save & Select
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewCustomer(false)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Held Bills Modal */}
      {showHeldModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Pause className="w-4 h-4 text-amber-500" />
                Held Bills
              </h3>
              <button onClick={() => setShowHeldModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1 text-xs">
              {heldBills.map((b) => (
                <div
                  key={b.uuid}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold block text-slate-800 dark:text-slate-200">{b.label}</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(b.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <button
                    onClick={() => resumeBill(b)}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
                  >
                    Resume Bill
                  </button>
                </div>
              ))}
              {heldBills.length === 0 && (
                <div className="py-8 text-center text-slate-400 italic">No held bills found</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Camera / Barcode Photo Scanner Simulation Modal */}
      {scannerOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Camera className="w-4 h-4 text-amber-500" />
                Camera & Photo Scanner
              </h3>
              <button onClick={() => setScannerOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="h-44 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center text-slate-400 text-xs gap-2 relative overflow-hidden">
              <div className="w-48 h-24 border-2 border-dashed border-amber-500/80 rounded-lg flex items-center justify-center text-[10px] text-amber-400">
                Align Barcode / QR Here
              </div>
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500 animate-pulse"></div>
            </div>

            <div className="text-xs text-slate-500">
              Select or type a barcode to simulate scan:
            </div>
            <div className="flex gap-2">
              <input
                placeholder="Scan or enter barcode"
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-1.5 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const match = products.find((p) => p.barcode === e.target.value.trim());
                    if (match) {
                      handleProductClick(match);
                      setScannerOpen(false);
                    } else {
                      alert('Product barcode not found');
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Thermal Printer Hardware Modal */}
      {printerModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Printer className="w-4 h-4 text-amber-500" />
                Wireless Thermal Printers
              </h3>
              <button onClick={() => setPrinterModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div
                onClick={() => setConnectedPrinter('WiFi ESC/POS (192.168.1.200)')}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-amber-500 flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Wifi className="w-4 h-4 text-emerald-500" />
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">WiFi Thermal 80mm</div>
                    <div className="text-[10px] text-slate-400">192.168.1.200:9100</div>
                  </div>
                </div>
                <span className="text-[10px] text-emerald-600 font-bold">Connect</span>
              </div>

              <div
                onClick={() => setConnectedPrinter('Bluetooth POS-80')}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-amber-500 flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Bluetooth className="w-4 h-4 text-indigo-500" />
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">Bluetooth Mobile POS</div>
                    <div className="text-[10px] text-slate-400">Paired BT Device (COM3)</div>
                  </div>
                </div>
                <span className="text-[10px] text-indigo-600 font-bold">Connect</span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-[11px] text-amber-800 dark:text-amber-200 font-medium">
              Active: <span className="font-bold">{connectedPrinter}</span>
            </div>

            <button
              onClick={() => setPrinterModal(false)}
              className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
