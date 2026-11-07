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
import InvoicePreviewModal from '../components/InvoicePreviewModal';
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
  Sparkles,
  Percent,
  CheckCircle2,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  Clock,
  Package,
  Layers,
  Scale,
  Barcode,
  Cloud,
  Tag,
  AlertTriangle,
  Gift,
  Crown,
  ChevronDown,
  ArrowRight,
  Apple,
  Milk,
  ShoppingBag,
  Croissant,
  Coffee,
  Home,
  Check,
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

  // Category selection
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Payment method
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paidAmount, setPaidAmount] = useState('');

  // Discount Type: fixed (₹) or percent (%)
  const [discountType, setDiscountType] = useState('fixed');
  const [discountValue, setDiscountValue] = useState('');

  // Serial & Addon Modals
  const [serialPicker, setSerialPicker] = useState(null);
  const [customizer, setCustomizer] = useState(null);
  const [addons, setAddons] = useState([]);

  // Held Bills
  const [heldBills, setHeldBills] = useState([]);
  const [showHeldModal, setShowHeldModal] = useState(false);

  // Quick Sale Modal
  const [showQuickSale, setShowQuickSale] = useState(false);
  const [quickSaleForm, setQuickSaleForm] = useState({ name: '', qty: '1', price: '' });

  // Status & Hardware Modals
  const [message, setMessage] = useState('');
  const [printerModal, setPrinterModal] = useState(false);
  const [connectedPrinter, setConnectedPrinter] = useState('Default Wireless ESC/POS');
  const [scaleStatus, setScaleStatus] = useState({ connected: true, weight: '0.000 kg' });
  const [scannerStatus, setScannerStatus] = useState('Connected');
  const [offlinePendingCount, setOfflinePendingCount] = useState(0);

  // Completed Invoice Preview Modal State
  const [completedInvoicePreview, setCompletedInvoicePreview] = useState(null);

  // Set when arriving from Orders ("Convert to Bill") via ?order_id= — on
  // successful sale we link the resulting invoice back to that order.
  const [sourceOrderId, setSourceOrderId] = useState(null);

  const searchRef = useRef(null);
  const categoryScrollRef = useRef(null);
  const currency = settings?.currency_symbol || '₹';
  const [dbCategories, setDbCategories] = useState([]);

  // Mock Invoice ID / Prefix
  const invoicePrefix = settings?.invoice_prefix || 'POS';
  const currentInvoiceNo = useMemo(() => {
    return `#${invoicePrefix}-${(1048 + Math.floor(Math.random() * 5)).toString().padStart(4, '0')}`;
  }, [invoicePrefix]);

  const loadProducts = async () => {
    try {
      let data = [];
      if (settings?.business_type) {
        const res = await api.get('/products', {
          params: { business_type: settings.business_type },
        });
        data = res.data;
      }
      if (!Array.isArray(data) || data.length === 0) {
        const resAll = await api.get('/products');
        if (Array.isArray(resAll.data) && resAll.data.length > 0) {
          data = resAll.data;
        }
      }
      const productList = Array.isArray(data) ? data : [];
      setProducts(productList);
      if (productList.length > 0) cacheProducts(productList);
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
      // offline fallback
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

  const refreshHeldBills = async () => {
    const local = await getLocalHeldBills();
    let serverBills = [];
    try {
      const { data } = await api.get('/held-bills');
      if (Array.isArray(data)) {
        serverBills = data.map((s) => {
          const payload = s.payload || {};
          const cart = Array.isArray(payload.cart) ? payload.cart : (Array.isArray(s.cart) ? s.cart : []);
          const totals = payload.totals || s.totals || {
            grandTotal: cart.reduce((sum, item) => sum + (Number(item.qty || 1) * Number(item.unit_price || 0)), 0),
          };
          return {
            uuid: s.uuid || `server-${s.id}`,
            id: s.id,
            customer_name: s.customer_name || payload.customer_name || 'Walk-in Customer',
            customer_id: s.customer_id || payload.customer_id || null,
            cart,
            totals,
            discount_type: payload.discount_type || s.discount_type || 'fixed',
            discount_value: payload.discount_value || s.discount_value || '',
            payment_method: payload.payment_method || s.payment_method || 'cash',
            held_at: s.created_at || payload.held_at || new Date().toISOString(),
          };
        });
      }
    } catch {
      // offline
    }
    const merged = [...local, ...serverBills.filter((s) => !local.some((l) => l.uuid === s.uuid))];
    setHeldBills(merged);
  };

  useEffect(() => {
    setSelectedCategory('all');
    loadProducts();
    loadCustomers();
    loadCategories();
    refreshHeldBills();
    api.get('/lookup/addons').then(({ data }) => setAddons(data.filter((a) => a.is_active))).catch(() => {});
    searchRef.current?.focus();

    // Keyboard shortcut listeners for F2, F4, F6, F8
    const handleKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        // focus cart top item
      } else if (e.key === 'F6') {
        e.preventDefault();
        // focus discount input
        document.getElementById('pos-discount-input')?.focus();
      } else if (e.key === 'F8') {
        e.preventDefault();
        completeSale();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settings?.business_type]);

  // Prefill the cart from a customer order ("Convert to Bill in POS").
  useEffect(() => {
    const orderId = new URLSearchParams(window.location.search).get('order_id');
    if (!orderId) return;
    api
      .get(`/orders/${orderId}`)
      .then(({ data }) => {
        if (data.invoice_id) return; // already billed
        setSourceOrderId(orderId);
        setSelectedCustomerId(data.customer_id || '');
        setCart(
          (data.items || []).map((it) => ({
            key: `order-${it.id}`,
            product_id: it.product_id,
            barcode: it.barcode || it.sku || '—',
            product_name: it.product_name,
            weight_label: '',
            qty: Number(it.qty),
            mrp: Number(it.rate),
            unit_price: Number(it.rate),
            discount_percent: 0,
            discount_amount: 0,
            tax_percent: Number(it.tax_percent || 0),
            tax_amount: Math.round(((Number(it.rate) * Number(it.tax_percent || 0)) / 100) * 100) / 100,
            addons: [],
          }))
        );
      })
      .catch(() => {});
    window.history.replaceState(null, '', window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Selected customer object
  const activeCustomer = useMemo(() => {
    if (!selectedCustomerId) return null;
    return customers.find((c) => String(c.id) === String(selectedCustomerId)) || null;
  }, [customers, selectedCustomerId]);

  // Safe image helper
  const getProductImage = (p) => {
    if (!p) return null;
    if (Array.isArray(p.images) && p.images.length > 0 && p.images[0]) return p.images[0];
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

  const getProductPrice = (product) => {
    if (!product) return 0;
    return Number(product.selling_price || product.retail_price || product.mrp || 0);
  };

  // Category items with matching icons (Only Top-Level Parent Categories, No Subcategories)
  const categoriesWithIcons = useMemo(() => {
    // Collect subcategory IDs/names that have a parent_id to exclude them
    const subcategoryNames = new Set(
      dbCategories
        .filter((c) => Boolean(c.parent_id))
        .map((c) => c.name.toLowerCase().trim())
    );

    // Filter dbCategories to only parent categories (parent_id is null / 0 / empty)
    const parentDbCategories = dbCategories
      .filter((c) => !c.parent_id)
      .map((c) => c.name)
      .filter(Boolean);

    // From products, also only include category_name if it is not a known subcategory
    const productParentCategories = products
      .map((p) => p.category_name)
      .filter((name) => Boolean(name) && !subcategoryNames.has(name.toLowerCase().trim()));

    const rawList = Array.from(
      new Set([...parentDbCategories, ...productParentCategories])
    );

    const iconMap = {
      all: Layers,
      'fruits & veg': Apple,
      fruits: Apple,
      vegetables: Apple,
      dairy: Milk,
      grocery: ShoppingBag,
      bakery: Croissant,
      beverages: Coffee,
      drinks: Coffee,
      household: Home,
    };

    return [
      { id: 'all', name: 'All', icon: Layers },
      ...rawList.map((cat) => {
        const key = cat.toLowerCase();
        let Icon = Package;
        for (const [k, ic] of Object.entries(iconMap)) {
          if (key.includes(k)) {
            Icon = ic;
            break;
          }
        }
        return { id: cat, name: cat, icon: Icon };
      }),
    ];
  }, [dbCategories, products]);

  // Filter products by search and category
  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    const bt = settings?.business_type;

    // Build a map of category names (and subcategories under them)
    const activeCatObj = dbCategories.find(
      (c) => c.name.toLowerCase() === selectedCategory.toLowerCase() && !c.parent_id
    );
    const childCategoryNames = activeCatObj
      ? dbCategories
          .filter((c) => c.parent_id === activeCatObj.id)
          .map((c) => c.name.toLowerCase())
      : [];

    return products.filter((p) => {
      if (bt && p.business_type && p.business_type !== bt) return false;
      const pName = (p.name || '').toLowerCase();
      const pBarcode = (p.barcode || '').toLowerCase();
      const pSku = (p.sku || '').toLowerCase();
      const matchesSearch = !term || pName.includes(term) || pBarcode.includes(term) || pSku.includes(term);

      const pCat = (p.category_name || '').toLowerCase();
      const matchesCategory =
        selectedCategory === 'all' ||
        pCat === selectedCategory.toLowerCase() ||
        childCategoryNames.includes(pCat);

      return matchesSearch && matchesCategory;
    });
  }, [products, search, selectedCategory, dbCategories, settings?.business_type]);

  // Filter customers for dropdown search
  const filteredCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(term) ||
        (c.phone || '').toLowerCase().includes(term)
    );
  }, [customers, customerSearch]);

  // Line calculations
  const lineAddonsTotal = (line) => (line.addons || []).reduce((s, a) => s + Number(a.price), 0);
  const lineUnitWithAddons = (line) => Number(line.unit_price) + lineAddonsTotal(line);

  const recalcLine = (line) => {
    const base = line.qty * lineUnitWithAddons(line);
    const taxAmount = Math.round(((base * (line.tax_percent || 0)) / 100) * 100) / 100;
    return { ...line, tax_amount: taxAmount };
  };

  const addToCart = (product, serial = null, variant = null, selectedAddons = [], qtyToAdd = 1) => {
    let unitPrice = getProductPrice(product);
    const mrp = Number(product.mrp || 0);
    if (variant) {
      if (variant.selling_price && Number(variant.selling_price) > 0) {
        unitPrice = Number(variant.selling_price);
      } else {
        unitPrice = unitPrice + Number(variant.price_adjustment || 0);
      }
    }
    const taxPercent = Number(product.tax_percent || 0);
    const discountPercent = mrp > unitPrice ? Math.round(((mrp - unitPrice) / mrp) * 100) : 0;
    const discountAmount = mrp > unitPrice ? (mrp - unitPrice) : 0;

    if (serial) {
      setCart((c) => [
        ...c,
        {
          key: `${product.id}-${serial.id}`,
          product_id: product.id,
          serial_id: serial.id,
          barcode: serial.imei1 || serial.serial_no || product.barcode || product.sku || '—',
          product_name: `${product.name} (IMEI: ${serial.imei1 || serial.serial_no})`,
          weight_label: product.unit_code || product.attributes?.net_weight || '',
          qty: 1,
          mrp: mrp > 0 ? mrp : unitPrice,
          unit_price: unitPrice,
          discount_percent: discountPercent,
          discount_amount: discountAmount,
          tax_percent: taxPercent,
          tax_amount: Math.round(((unitPrice * taxPercent) / 100) * 100) / 100,
        },
      ]);
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id
            ? { ...p, available_serials: (p.available_serials || []).filter((s) => s.id !== serial.id) }
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
          barcode: product.barcode || product.sku || '—',
          product_name: variant ? `${product.name} - ${variant.variant_name}` : product.name,
          weight_label: product.unit_code || product.attributes?.net_weight || (product.category_name === 'Fruits & Veg' ? '1kg' : ''),
          image: getProductImage(product),
          qty: qtyToAdd,
          mrp: mrp > 0 ? mrp : unitPrice,
          unit_price: unitPrice,
          discount_percent: discountPercent,
          discount_amount: discountAmount,
          tax_percent: taxPercent,
          tax_amount: taxAmount,
          addons: selectedAddons,
        },
      ];
    });
  };

  const handleProductClick = (product) => {
    const stock = Number(product.stock_qty || 0);
    if (stock <= 0) {
      setMessage(`"${product.name}" is out of stock! Cannot be added.`);
      return;
    }

    if (product.track_serial) {
      if (product.available_serials && product.available_serials.length > 0) {
        setSerialPicker(product);
        return;
      }
      // If no serials in stock or tracked, but stock exists, allow adding directly
      if (stock <= 0) {
        setMessage('Serial / IMEI devices are out of stock');
        return;
      }
      addToCart(product, null, null, [], 1);
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

    addToCart(product, null, null, [], 1);
  };

  const confirmCustomizer = () => {
    if (!customizer) return;
    const { product, variantId, addonIds } = customizer;
    const variant = product.variants?.find((v) => v.id === variantId) || null;
    const selectedAddons = addons.filter((a) => addonIds.includes(a.id));
    addToCart(product, null, variant, selectedAddons, 1);
    setCustomizer(null);
  };

  const updateLineQty = (key, delta) => {
    setCart((c) =>
      c
        .map((l) => {
          if (l.key !== key) return l;
          const newQty = Math.max(0, l.qty + delta);
          if (newQty === 0) return null;
          if (delta > 0) {
            const product = products.find((p) => p.id === l.product_id);
            const stock = Number(product?.stock_qty || 0);
            if (stock > 0 && newQty > stock) {
              setMessage(`Only ${stock} items available in stock for "${l.product_name}"`);
              return l;
            }
          }
          return recalcLine({ ...l, qty: newQty });
        })
        .filter(Boolean)
    );
  };

  const setLineQtyDirect = (key, val) => {
    if (val === '' || val === null) {
      setCart((c) =>
        c.map((l) => (l.key === key ? { ...l, qty: '' } : l))
      );
      return;
    }
    const parsed = parseFloat(val);
    if (isNaN(parsed) || parsed < 0) return;
    setCart((c) =>
      c
        .map((l) => {
          if (l.key !== key) return l;
          if (parsed === 0) return null;
          const product = products.find((p) => p.id === l.product_id);
          const stock = Number(product?.stock_qty || 0);
          if (stock > 0 && parsed > stock) {
            setMessage(`Only ${stock} items available in stock for "${l.product_name}"`);
            return recalcLine({ ...l, qty: stock });
          }
          return recalcLine({ ...l, qty: parsed });
        })
        .filter(Boolean)
    );
  };

  const removeLine = (key) => {
    setCart((c) => c.filter((l) => l.key !== key));
  };

  const clearCart = () => setCart([]);

  // Totals calculations
  const totals = useMemo(() => {
    const totalItems = cart.reduce((s, l) => s + l.qty, 0);
    const subtotal = cart.reduce((s, l) => s + l.qty * lineUnitWithAddons(l), 0);
    const itemDiscount = cart.reduce((s, l) => s + (l.discount_amount || 0) * l.qty, 0);

    let couponDiscount = 0;
    const dv = Number(discountValue || 0);
    if (dv > 0) {
      couponDiscount = discountType === 'percent' ? Math.round(((subtotal * dv) / 100) * 100) / 100 : dv;
    }
    couponDiscount = Math.min(couponDiscount, subtotal);

    const tax = cart.reduce((s, l) => s + (l.tax_amount || 0) * (l.qty || 1), 0);
    const grandTotal = Math.max(0, Math.round((subtotal - itemDiscount - couponDiscount + tax) * 100) / 100);

    return { totalItems, subtotal, itemDiscount, couponDiscount, tax, grandTotal };
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
    const billUuid = newUuid();
    const entry = {
      uuid: billUuid,
      customer_id: selectedCustomerId || null,
      customer_name: activeCustomer?.name || 'Walk-in Customer',
      cart,
      totals,
      discount_type: discountType,
      discount_value: discountValue,
      payment_method: paymentMethod,
      held_at: new Date().toISOString(),
    };

    // Save locally
    await saveLocalHeldBill(entry);

    // Save to server
    try {
      await api.post('/held-bills', {
        uuid: billUuid,
        label: `Hold ${new Date().toLocaleTimeString()} (${cart.length} items)`,
        customer_id: selectedCustomerId || null,
        payload: entry,
      });
    } catch {
      // offline fallback
      enqueueOutboxItem({
        client_id: billUuid,
        type: 'held_bill',
        payload: entry,
      }).catch(() => {});
    }

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

    // Remove locally
    await removeLocalHeldBill(held.uuid);

    // Delete on server
    try {
      await api.delete(`/held-bills/${held.uuid}`);
    } catch {
      enqueueOutboxItem({
        client_id: newUuid(),
        type: 'delete_held_bill',
        payload: { uuid: held.uuid },
      }).catch(() => {});
    }

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

  // Add Quick Sale Line Item to Cart
  const handleAddQuickSale = (e) => {
    e?.preventDefault();
    const qty = Math.max(1, Number(quickSaleForm.qty) || 1);
    const unitPrice = Math.max(0, Number(quickSaleForm.price) || 0);
    const customCount = cart.filter((l) => l.is_custom).length + 1;
    const itemName = quickSaleForm.name.trim() || `Item ${customCount}`;

    const customLine = {
      key: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      product_id: null,
      is_custom: true,
      barcode: 'QUICK',
      product_name: itemName,
      weight_label: '',
      qty,
      mrp: unitPrice,
      unit_price: unitPrice,
      discount_percent: 0,
      discount_amount: 0,
      tax_percent: 0,
      tax_amount: 0,
      addons: [],
    };

    setCart((prev) => [...prev, customLine]);
    setQuickSaleForm({ name: '', qty: '1', price: '' });
    setShowQuickSale(false);
  };

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
      setCustomerSearch(data.name);
    } catch {
      await addLocalCustomer(custData);
      enqueueOutboxItem('post', '/customers', custData);
      refreshPendingCount();
      setCustomers((prev) => [custData, ...prev]);
      setSelectedCustomerId(custData.id);
      setCustomerSearch(custData.name);
    }
    setShowNewCustomer(false);
    setNewCustomerForm({ name: '', phone: '', email: '', opening_balance: '' });
  };

  const completeSale = async () => {
    if (cart.length === 0) return;

    // Validation: If Credit payment method, customer selection is mandatory!
    if (paymentMethod === 'credit' && !selectedCustomerId) {
      alert('Please select a customer for Credit sale! Walk-in Customer cannot be given Credit.');
      setMessage('Error: Please select a customer to give Credit.');
      return;
    }

    const createdAt = new Date().toISOString();
    const uuid = newUuid();

    const salePayload = {
      uuid,
      customer_id: selectedCustomerId || null,
      customer_name: activeCustomer?.name || 'Walk-in Customer',
      payment_method: paymentMethod,
      paid_amount: Number(paidAmount || totals.grandTotal),
      subtotal: totals.subtotal,
      discount_amount: totals.couponDiscount + totals.itemDiscount,
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

    for (const l of cart) {
      applyLocalStockDelta(l.product_id, -l.qty).catch(() => {});
    }

    try {
      const { data } = await api.post('/invoices', salePayload);
      if (sourceOrderId) {
        api.post(`/orders/${sourceOrderId}/link-invoice`, { invoice_id: data.id }).catch(() => {});
        setSourceOrderId(null);
      }
      setCompletedInvoicePreview(data);
      resetSale();
      loadProducts();
      return;
    } catch {
      await enqueueOutboxItem('post', '/invoices', salePayload);
      refreshPendingCount();
    }

    setCompletedInvoicePreview({
      invoice_no: `OFFLINE-${uuid.slice(0, 8)}`,
      created_at: createdAt,
      customer_name: activeCustomer?.name || 'Walk-in Customer',
      items: cart.map((l) => ({
        product_name_snapshot: l.product_name,
        qty: l.qty,
        unit_price: l.unit_price,
        line_total: l.qty * lineUnitWithAddons(l),
      })),
      subtotal: totals.subtotal,
      discount_amount: totals.couponDiscount + totals.itemDiscount,
      tax_amount: totals.tax,
      grand_total: totals.grandTotal,
      source: 'offline',
    });
    resetSale();
  };

  const scrollCategories = (dir) => {
    if (!categoriesWithIcons || categoriesWithIcons.length === 0) return;
    const currentIndex = categoriesWithIcons.findIndex((c) => c.id === selectedCategory);
    let nextIndex = currentIndex;
    if (currentIndex === -1) {
      nextIndex = dir > 0 ? 0 : categoriesWithIcons.length - 1;
    } else {
      nextIndex = dir > 0
        ? Math.min(categoriesWithIcons.length - 1, currentIndex + 1)
        : Math.max(0, currentIndex - 1);
    }
    const nextCat = categoriesWithIcons[nextIndex];
    if (nextCat) {
      setSelectedCategory(nextCat.id);
      // Also scroll into view
      if (categoryScrollRef.current) {
        const catButtons = categoryScrollRef.current.querySelectorAll('button');
        if (catButtons && catButtons[nextIndex]) {
          catButtons[nextIndex].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
      }
    }
  };

  // Stock alert count
  const lowStockCount = useMemo(() => {
    return products.filter((p) => Number(p.stock_qty || 0) <= 5).length;
  }, [products]);

  return (
    <div className="h-[calc(100vh-6.25rem)] w-full flex flex-col lg:flex-row gap-3.5 overflow-hidden font-sans select-none">
      {/* ======================================================== */}
      {/* LEFT COLUMN: Catalog / Product Grid / Scanner / Hardware */}
      {/* ======================================================== */}
      <div className="flex-1 flex flex-col min-w-0 water-glass-card rounded-2xl overflow-hidden shadow-sm">
        {/* Sub-Header: Search bar with shortcut tags */}
        <div className="p-3 border-b border-[#DCE5EF] dark:border-[#22354B] bg-white/40 dark:bg-[#121E2C]/40 flex items-center gap-3">
          {/* Barcode Search Input with prefix icon & search icon */}
          <div className="relative flex-1">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-[#5A6B82] dark:text-[#94A3B8]">
              <Barcode className="w-4 h-4 text-[#0A4174] dark:text-[#4A8CD2]" />
            </div>
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
              placeholder="Scan barcode or search product name / SKU..."
              className="w-full pl-10 pr-9 py-2 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white/80 dark:bg-[#121E2C]/80 backdrop-blur-md text-xs font-medium text-[#1C2736] dark:text-[#F1F5F9] focus:outline-none focus:ring-2 focus:ring-[#0A4174] dark:focus:ring-[#4A8CD2] shadow-xs placeholder-[#94A3B8]"
            />
            <button
              type="button"
              onClick={() => {
                if (filteredProducts[0]) {
                  handleProductClick(filteredProducts[0]);
                  setSearch('');
                }
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5A6B82] hover:text-[#0A4174] dark:hover:text-[#4A8CD2]"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>

          {/* Shortcut Badges matching reference screenshot */}
          <div className="hidden sm:flex items-center gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => searchRef.current?.focus()}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl water-glass-pill text-[#5A6B82] dark:text-[#94A3B8] hover:border-[#0A4174] dark:hover:border-[#4A8CD2] hover:text-[#0A4174] dark:hover:text-[#4A8CD2] transition-colors cursor-pointer"
            >
              <span className="font-extrabold text-[#0A4174] dark:text-[#4A8CD2]">F2</span>
              <span>Search</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const firstQty = document.querySelector('.pos-qty-input');
                if (firstQty) firstQty.focus();
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl water-glass-pill text-[#5A6B82] dark:text-[#94A3B8] hover:border-[#0A4174] dark:hover:border-[#4A8CD2] hover:text-[#0A4174] dark:hover:text-[#4A8CD2] transition-colors cursor-pointer"
            >
              <span className="font-extrabold text-[#0A4174] dark:text-[#4A8CD2]">F4</span>
              <span>Quantity</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const discInput = document.getElementById('pos-discount-input');
                if (discInput) {
                  discInput.focus();
                  discInput.select();
                }
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl water-glass-pill text-[#5A6B82] dark:text-[#94A3B8] hover:border-[#0A4174] dark:hover:border-[#4A8CD2] hover:text-[#0A4174] dark:hover:text-[#4A8CD2] transition-colors cursor-pointer"
            >
              <span className="font-extrabold text-[#0A4174] dark:text-[#4A8CD2]">F6</span>
              <span>Discount</span>
            </button>
            <button
              type="button"
              onClick={completeSale}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl water-glass-pill text-[#5A6B82] dark:text-[#94A3B8] hover:border-[#0A4174] dark:hover:border-[#4A8CD2] hover:text-[#0A4174] dark:hover:text-[#4A8CD2] transition-colors cursor-pointer"
            >
              <span className="font-extrabold text-[#0A4174] dark:text-[#4A8CD2]">F8</span>
              <span>Payment</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const customCount = cart.filter((l) => l.is_custom).length + 1;
                setQuickSaleForm({ name: `Item ${customCount}`, qty: '1', price: '' });
                setShowQuickSale(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold transition-all shadow-md shadow-amber-500/20 cursor-pointer"
              title="Add Quick Sale Item"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>+ Quick Sale</span>
            </button>
          </div>
        </div>

        {/* Categories Carousel / Navigation Row */}
        <div className="px-3 py-2 border-b border-[#DCE5EF] dark:border-[#22354B] bg-white/60 dark:bg-[#121E2C]/60 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => scrollCategories(-1)}
            className="w-7 h-7 flex-shrink-0 rounded-lg water-glass-pill text-[#5A6B82] dark:text-[#94A3B8] flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div
            ref={categoryScrollRef}
            className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-none scroll-smooth py-0.5"
          >
            {categoriesWithIcons.map((cat) => {
              const Icon = cat.icon;
              const active = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all text-xs font-semibold ${
                    active
                      ? 'bg-[#0A4174] text-white dark:bg-[#4A8CD2] dark:text-[#0B131E] shadow-sm font-bold'
                      : 'water-glass-pill text-[#5A6B82] dark:text-[#94A3B8] hover:bg-[#E2EDF8]'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="whitespace-nowrap">{cat.name}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => scrollCategories(1)}
            className="w-7 h-7 flex-shrink-0 rounded-lg water-glass-pill text-[#5A6B82] dark:text-[#94A3B8] flex items-center justify-center transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Product Catalog Grid (Compact 4-column cards matching Nova Retail with Water Glass Cards) */}
        <div className="flex-1 overflow-y-auto p-3 scrollbar-thin bg-transparent">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filteredProducts.map((p) => {
              const price = getProductPrice(p);
              const stock = Number(p.stock_qty || 0);
              const isOutOfStock = stock <= 0;
              const imgUrl = getProductImage(p);
              const weightOrUnit = p.unit_code || p.attributes?.net_weight || (p.category_name === 'Dairy' ? '500ml' : p.category_name === 'Bakery' ? '400g' : '1kg');

              return (
                <div
                  key={p.id}
                  onClick={() => !isOutOfStock && handleProductClick(p)}
                  className={`rounded-2xl water-glass-card p-2.5 flex flex-col justify-between transition-all relative ${
                    isOutOfStock
                      ? 'opacity-60 grayscale-[40%] cursor-not-allowed select-none bg-slate-100/50 dark:bg-slate-900/40 border-dashed border-red-300 dark:border-red-900/40'
                      : 'hover:border-[#0A4174] dark:hover:border-[#4A8CD2] hover:shadow-lg cursor-pointer group'
                  }`}
                >
                  {/* Top: Fresh / Discount badge or Out of stock badge */}
                  <div className="absolute top-2 right-2 z-10">
                    {isOutOfStock ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-black bg-red-600 text-white shadow-xs">
                        Unavailable
                      </span>
                    ) : p.is_featured ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-black bg-emerald-500 text-white shadow-xs">
                        Fresh
                      </span>
                    ) : null}
                  </div>

                  {/* Image area with smooth glassy finish */}
                  <div className="w-full h-24 mb-2 rounded-xl bg-white/60 dark:bg-[#0B131E]/60 flex items-center justify-center overflow-hidden border border-[#DCE5EF]/60 dark:border-[#22354B]/60">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={p.name}
                        className={`w-full h-full object-contain p-1 transition-transform duration-200 ${
                          isOutOfStock ? 'opacity-40' : 'group-hover:scale-105'
                        }`}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <ShoppingBag className="w-8 h-8 text-[#5A6B82] stroke-[1.5]" />
                    )}
                  </div>

                  {/* Product Details */}
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-[#1C2736] dark:text-[#F1F5F9] line-clamp-1 group-hover:text-[#0A4174] dark:group-hover:text-[#4A8CD2] transition-colors">
                      {p.name}
                    </h4>
                    <p className="text-[10px] text-[#5A6B82] dark:text-[#94A3B8]">
                      {weightOrUnit}
                    </p>
                    <div className="pt-0.5">
                      {isOutOfStock ? (
                        <span className="text-[9px] font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/60 px-1.5 py-0.5 rounded inline-block">
                          Out of Stock
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded inline-block">
                          In Stock ({stock})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom: Price + Circular (+) Button */}
                  <div className="mt-2 pt-2 border-t border-[#DCE5EF]/60 dark:border-[#22354B]/60 flex items-center justify-between">
                    <span className={`text-sm font-extrabold ${isOutOfStock ? 'text-slate-400' : 'text-[#0A4174] dark:text-[#4A8CD2]'}`}>
                      {formatCurrency(price, currency)}
                    </span>
                    <button
                      type="button"
                      disabled={isOutOfStock}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isOutOfStock) handleProductClick(p);
                      }}
                      className={`w-6 h-6 rounded-full flex items-center justify-center shadow-xs transition-all ${
                        isOutOfStock
                          ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed opacity-50'
                          : 'bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E] active:scale-90 cursor-pointer'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredProducts.length === 0 && (
              <div className="col-span-full py-16 text-center text-[#5A6B82] dark:text-[#94A3B8] text-xs space-y-2">
                <Package className="w-8 h-8 mx-auto text-[#0A4174] dark:text-[#4A8CD2]" />
                <p className="font-bold text-[#1C2736] dark:text-[#F1F5F9]">No products match your search or filter</p>
                <button
                  onClick={() => {
                    setSearch('');
                    setSelectedCategory('all');
                  }}
                  className="px-3 py-1 rounded-lg bg-[#0A4174] text-white text-xs font-bold"
                >
                  Reset
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Hardware Status / Telemetry Footer matching Reference */}
        <div className="p-2.5 border-t border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB]/80 dark:bg-[#0B131E]/60 text-[11px] grid grid-cols-2 md:grid-cols-4 gap-2">
          {/* AI Suggestion */}
          <div className="flex items-center gap-2 p-1.5 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] shadow-2xs">
            <div className="w-6 h-6 rounded-md bg-[#E2EDF8] dark:bg-[#1A2A3D] text-[#0A4174] dark:text-[#4A8CD2] flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-[#1C2736] dark:text-[#F1F5F9] truncate text-[10px]">AI Suggestion</div>
              <div className="text-[9px] text-[#5A6B82] dark:text-[#94A3B8] truncate">Bread + Milk + Eggs</div>
            </div>
          </div>

          {/* Low Stock Alert */}
          <div className="flex items-center gap-2 p-1.5 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] shadow-2xs">
            <div className="w-6 h-6 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-[#1C2736] dark:text-[#F1F5F9] truncate text-[10px]">Low Stock Alert</div>
              <div className="text-[9px] text-amber-600 font-semibold truncate">{lowStockCount} items below min</div>
            </div>
          </div>

          {/* Weighing Scale Status */}
          <div
            onClick={() => setScaleStatus((s) => ({ ...s, connected: !s.connected }))}
            className="flex items-center gap-2 p-1.5 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] shadow-2xs cursor-pointer"
          >
            <div className="w-6 h-6 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <Scale className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-[#1C2736] dark:text-[#F1F5F9] truncate text-[10px]">Weighing Scale</div>
              <div className="text-[9px] text-emerald-600 font-bold truncate">Connected • Tare 0.00</div>
            </div>
          </div>

          {/* Barcode & Wireless Printer Status */}
          <div
            onClick={() => setPrinterModal(true)}
            className="flex items-center gap-2 p-1.5 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] shadow-2xs cursor-pointer"
          >
            <div className="w-6 h-6 rounded-md bg-[#E2EDF8] dark:bg-[#1A2A3D] text-[#0A4174] dark:text-[#4A8CD2] flex items-center justify-center flex-shrink-0">
              <Printer className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-[#1C2736] dark:text-[#F1F5F9] truncate text-[10px]">Receipt Printer</div>
              <div className="text-[9px] text-emerald-600 font-bold truncate">ESC/POS Active</div>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* RIGHT COLUMN: Cart / Customer / Totals / Payments         */}
      {/* ======================================================== */}
      <div className="w-full lg:w-[460px] xl:w-[480px] flex-shrink-0 flex flex-col water-glass-card rounded-2xl overflow-hidden shadow-sm">
        {/* Cart Top Header: Current Bill #POS-XXXX + + New Customer */}
        <div className="px-3 py-2 border-b border-[#DCE5EF] dark:border-[#22354B] flex items-center justify-between bg-white/40 dark:bg-[#121E2C]/40">
          <div className="flex items-center gap-2">
            <span className="font-black text-xs text-[#1C2736] dark:text-[#F1F5F9]">
              Current Bill
            </span>
            <span className="px-1.5 py-0.5 rounded-lg font-mono text-[11px] font-bold text-[#0A4174] dark:text-[#4A8CD2] bg-[#E2EDF8] dark:bg-[#1A2A3D]">
              {currentInvoiceNo}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowHeldModal(true)}
              title="Held Bills"
              className="p-1 rounded-lg water-glass-pill text-[#5A6B82] hover:text-[#0A4174] dark:hover:text-[#4A8CD2] relative"
            >
              <Clock className="w-3.5 h-3.5" />
              {heldBills.length > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-500 text-white text-[8px] font-black flex items-center justify-center shadow-xs">
                  {heldBills.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowNewCustomer(true)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E] text-[11px] font-bold shadow-xs transition-colors"
            >
              <UserPlus className="w-3 h-3" />
              <span>+ New Customer</span>
            </button>
          </div>
        </div>

        {/* Customer Info Card matching Nova Retail */}
        <div className="px-3 py-1.5 border-b border-[#DCE5EF] dark:border-[#22354B] bg-white/20 dark:bg-[#0B131E]/20">
          <div className="relative">
            <div className="flex items-center justify-between p-1.5 rounded-xl water-glass-pill">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-[#E2EDF8] dark:bg-[#1A2A3D] text-[#0A4174] dark:text-[#4A8CD2] flex items-center justify-center flex-shrink-0 font-bold">
                  <User className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] text-[#5A6B82] dark:text-[#94A3B8] font-semibold leading-none">
                    Customer
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomerDropdownOpen((p) => !p)}
                    className="font-bold text-xs text-[#1C2736] dark:text-[#F1F5F9] truncate flex items-center gap-1 hover:text-[#0A4174] dark:hover:text-[#4A8CD2]"
                  >
                    <span>{activeCustomer?.name || 'Walk-in Customer'}</span>
                    <ChevronDown className="w-3 h-3 text-[#5A6B82]" />
                  </button>
                  <div className="text-[9px] text-[#5A6B82] dark:text-[#94A3B8] font-mono leading-none">
                    {activeCustomer?.phone || '+91 98765 43210'}
                  </div>
                </div>
              </div>

              {/* Loyalty Points Badge */}
              <div className="text-right flex-shrink-0">
                <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#E2EDF8] dark:bg-[#1A2A3D] text-[9px] font-bold text-[#0A4174] dark:text-[#4A8CD2]">
                  <Crown className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                  <span>125 pts</span>
                </div>
                <div className="text-[8px] text-[#5A6B82] dark:text-[#94A3B8] font-semibold">
                  Silver Member
                </div>
              </div>
            </div>

            {/* Customer Dropdown Selection */}
            {customerDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto bg-white dark:bg-[#121E2C] border border-[#DCE5EF] dark:border-[#22354B] rounded-xl shadow-xl z-30 text-xs divide-y divide-[#DCE5EF] dark:divide-[#22354B]">
                <div className="p-2 bg-[#F4F7FB] dark:bg-[#0B131E]">
                  <input
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Search by name or mobile..."
                    className="w-full px-2.5 py-1 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] text-xs focus:outline-none"
                  />
                </div>
                <div
                  onClick={() => {
                    setSelectedCustomerId('');
                    setCustomerDropdownOpen(false);
                  }}
                  className="p-2 hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] cursor-pointer font-medium text-[#5A6B82]"
                >
                  Walk-in Customer (Default)
                </div>
                {filteredCustomers.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      setSelectedCustomerId(c.id);
                      setCustomerDropdownOpen(false);
                    }}
                    className="p-2 hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] cursor-pointer flex justify-between items-center"
                  >
                    <div>
                      <div className="font-semibold text-[#1C2736] dark:text-[#F1F5F9]">{c.name}</div>
                      <div className="text-[10px] text-[#5A6B82]">{c.phone || 'No phone'}</div>
                    </div>
                    {Number(c.balance || 0) > 0 && (
                      <span className="text-[10px] text-red-500 font-bold">
                        Due: {formatCurrency(c.balance, currency)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cart Items Table Header - Clean layout with full product name space */}
        <div className="px-2.5 py-1.5 border-b border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB]/50 dark:bg-[#0B131E]/40 flex items-center text-[10px] font-bold text-[#5A6B82] dark:text-[#94A3B8]">
          <div className="w-5 text-center flex-shrink-0">#</div>
          <div className="flex-1 min-w-0 pr-1">Product</div>
          <div className="w-18 text-center flex-shrink-0">Qty</div>
          <div className="w-16 text-right flex-shrink-0">Price</div>
          <div className="w-9 text-center flex-shrink-0">Disc</div>
          <div className="w-18 text-right flex-shrink-0">Total</div>
          <div className="w-6 text-center flex-shrink-0">
            {cart.length > 0 && (
              <button onClick={clearCart} title="Clear All" className="hover:text-red-500 inline-flex items-center justify-center">
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Cart Items Scrollable List - Full product name visible, wrapped if needed */}
        <div className="flex-1 min-h-[160px] max-h-[40vh] lg:max-h-none overflow-y-auto px-2.5 py-1 space-y-1 scrollbar-thin divide-y divide-[#DCE5EF]/40 dark:divide-[#22354B]/40">
          {cart.map((line, idx) => (
            <div key={line.key} className="pt-1.5 first:pt-0 flex items-center text-[11px] group">
              {/* No. */}
              <div className="w-5 text-center font-bold text-[#5A6B82] text-[10px] flex-shrink-0">
                {idx + 1}
              </div>

              {/* Product Info - Full name displayed clearly without cut-off */}
              <div className="flex-1 min-w-0 pr-2">
                <div className="font-bold text-[#1C2736] dark:text-[#F1F5F9] text-[11px] leading-snug break-words">
                  {line.product_name}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {line.barcode && line.barcode !== '—' && (
                    <span className="font-mono text-[9px] text-[#5A6B82] dark:text-[#94A3B8]">
                      {line.barcode}
                    </span>
                  )}
                  {line.weight_label && (
                    <span className="text-[9px] text-[#5A6B82] dark:text-[#94A3B8] font-medium">
                      • {line.weight_label}
                    </span>
                  )}
                </div>
              </div>

              {/* Quantity Stepper [-] [editable input] [+] */}
              <div className="w-18 flex items-center justify-center gap-0.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => updateLineQty(line.key, -1)}
                  className="w-4 h-4 rounded border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] text-[#5A6B82] flex items-center justify-center hover:bg-[#E2EDF8]"
                >
                  <Minus className="w-2 h-2" />
                </button>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={line.qty}
                  onFocus={(e) => e.target.select()}
                  onBlur={() => {
                    if (!line.qty || Number(line.qty) <= 0) {
                      setCart((c) =>
                        c.map((l) => (l.key === line.key ? recalcLine({ ...l, qty: 1 }) : l))
                      );
                    }
                  }}
                  onChange={(e) => setLineQtyDirect(line.key, e.target.value)}
                  className="pos-qty-input w-7 py-0.5 rounded border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] text-center font-bold text-[10px] text-[#1C2736] dark:text-[#F1F5F9] focus:outline-none focus:ring-1 focus:ring-[#0A4174]"
                />
                <button
                  type="button"
                  onClick={() => updateLineQty(line.key, 1)}
                  className="w-4 h-4 rounded border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] text-[#5A6B82] flex items-center justify-center hover:bg-[#E2EDF8]"
                >
                  <Plus className="w-2 h-2" />
                </button>
              </div>

              {/* Unit Selling Price */}
              <div className="w-16 text-right font-medium text-[#1C2736] dark:text-[#F1F5F9] text-[10.5px] truncate flex-shrink-0">
                {formatCurrency(lineUnitWithAddons(line), currency)}
              </div>

              {/* Discount % */}
              <div className="w-9 text-center flex-shrink-0">
                {line.discount_percent > 0 ? (
                  <span className="inline-block px-1 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold text-[9px]">
                    {line.discount_percent}%
                  </span>
                ) : (
                  <span className="text-[9px] text-[#5A6B82] dark:text-[#94A3B8]">0%</span>
                )}
              </div>

              {/* Line Total */}
              <div className="w-18 text-right font-bold text-[#0A4174] dark:text-[#4A8CD2] text-[11px] truncate flex-shrink-0">
                {formatCurrency(line.qty * lineUnitWithAddons(line), currency)}
              </div>

              {/* Remove Action - Fixed always visible, never clipped */}
              <div className="w-6 text-center flex-shrink-0">
                <button
                  type="button"
                  onClick={() => removeLine(line.key)}
                  className="p-1 text-[#5A6B82] hover:text-red-500 rounded transition-colors inline-flex items-center justify-center"
                  title="Remove item"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}

          {cart.length === 0 && (
            <div className="py-8 text-center text-[#5A6B82] dark:text-[#94A3B8] text-xs space-y-1">
              <ShoppingCart className="w-7 h-7 mx-auto text-[#DCE5EF] dark:text-[#22354B]" />
              <p className="font-semibold text-[11px]">Cart is currently empty</p>
              <p className="text-[9px]">Click or scan items to add to bill</p>
            </div>
          )}
        </div>


        {/* Price Breakdown Summary */}
        <div className="p-3 border-t border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] space-y-1.5 text-xs">
          <div className="flex justify-between text-[#5A6B82] dark:text-[#94A3B8]">
            <span>Subtotal ({totals.totalItems} items)</span>
            <span className="font-semibold text-[#1C2736] dark:text-[#F1F5F9]">
              {formatCurrency(totals.subtotal, currency)}
            </span>
          </div>

          {totals.itemDiscount > 0 && (
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
              <span>Item Discount</span>
              <span>-{formatCurrency(totals.itemDiscount, currency)}</span>
            </div>
          )}

          {/* Optional Bill Discount Input */}
          <div className="flex justify-between items-center text-[#5A6B82] dark:text-[#94A3B8]">
            <div className="flex items-center gap-1.5">
              <span>Discount</span>
              <div className="inline-flex rounded border border-[#DCE5EF] dark:border-[#22354B] p-0.5 bg-[#F4F7FB] dark:bg-[#0B131E]">
                <button
                  type="button"
                  onClick={() => setDiscountType('fixed')}
                  className={`px-1 py-0.2 rounded text-[9px] font-bold ${
                    discountType === 'fixed' ? 'bg-[#0A4174] text-white dark:bg-[#4A8CD2] dark:text-[#0B131E]' : ''
                  }`}
                >
                  ₹
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType('percent')}
                  className={`px-1 py-0.2 rounded text-[9px] font-bold ${
                    discountType === 'percent' ? 'bg-[#0A4174] text-white dark:bg-[#4A8CD2] dark:text-[#0B131E]' : ''
                  }`}
                >
                  %
                </button>
              </div>
            </div>
            <input
              id="pos-discount-input"
              type="number"
              min="0"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              placeholder="0"
              className="w-16 px-1.5 py-0.5 rounded border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB] dark:bg-[#0B131E] text-right text-xs font-semibold focus:outline-none"
            />
          </div>

          <div className="flex justify-between text-[#5A6B82] dark:text-[#94A3B8]">
            <span>GST / Tax</span>
            <span className="font-semibold text-[#1C2736] dark:text-[#F1F5F9]">
              {formatCurrency(totals.tax, currency)}
            </span>
          </div>

          {/* Grand Total Row */}
          <div className="pt-2 border-t border-[#DCE5EF] dark:border-[#22354B] flex justify-between items-baseline">
            <span className="text-sm font-black text-[#1C2736] dark:text-[#F1F5F9]">Grand Total</span>
            <span className="text-2xl font-black text-[#0A4174] dark:text-[#4A8CD2]">
              {formatCurrency(totals.grandTotal, currency)}
            </span>
          </div>

          {/* Big Action Button: PAY NOW > */}
          <div className="pt-1 flex gap-2">
            <button
              type="button"
              onClick={holdBill}
              disabled={cart.length === 0}
              title="Hold Bill"
              className="px-3 py-2.5 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] text-[#5A6B82] disabled:opacity-40 transition-colors flex items-center justify-center font-bold text-xs"
            >
              <Pause className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={completeSale}
              disabled={cart.length === 0}
              className="flex-1 py-3 rounded-xl bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E] font-black text-sm tracking-wide shadow-md transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
            >
              <CreditCard className="w-5 h-5" />
              <span>PAY NOW</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>

          {/* Payment Method Selector Pills Row matching Reference Screenshot */}
          <div className="grid grid-cols-6 gap-1 pt-1.5">
            {[
              { id: 'cash', label: 'Cash', icon: Banknote },
              { id: 'upi', label: 'UPI QR', icon: Smartphone },
              { id: 'card', label: 'Card', icon: CreditCard },
              { id: 'wallet', label: 'Wallet', icon: ShoppingBag },
              { id: 'split', label: 'Split', icon: Layers },
              { id: 'credit', label: 'Credit', icon: RotateCcw },
            ].map((m) => {
              const Icon = m.icon;
              const active = paymentMethod === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPaymentMethod(m.id)}
                  className={`py-1.5 rounded-lg text-[10px] font-bold flex flex-col items-center gap-0.5 transition-all ${
                    active
                      ? 'bg-[#0A4174] text-white dark:bg-[#4A8CD2] dark:text-[#0B131E] shadow-xs'
                      : 'border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] text-[#5A6B82] hover:bg-[#E2EDF8]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="truncate">{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODALS: Held Bills, Customizer, Serial, Customer, Printer */}
      {/* ======================================================== */}
      {/* Held Bills Modal */}
      {showHeldModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg rounded-3xl water-glass-card p-6 shadow-2xl border border-white/80 dark:border-[#22354B] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE5EF] dark:border-[#22354B]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#E2EDF8] dark:bg-[#1A2A3D] text-[#0A4174] dark:text-[#4A8CD2] flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-base text-[#1C2736] dark:text-[#F1F5F9]">
                    Held Bills
                  </h3>
                  <p className="text-[10px] text-[#5A6B82] dark:text-[#94A3B8]">
                    {heldBills.length} {heldBills.length === 1 ? 'bill' : 'bills'} currently parked
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHeldModal(false)}
                className="w-7 h-7 rounded-lg water-glass-pill text-[#5A6B82] hover:text-[#1C2736] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2.5 text-xs pr-1 scrollbar-thin">
              {heldBills.map((b) => (
                <div
                  key={b.uuid}
                  className="p-3.5 rounded-2xl water-glass-pill flex items-center justify-between hover:border-[#0A4174] dark:hover:border-[#4A8CD2] transition-all group"
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-extrabold text-[#1C2736] dark:text-[#F1F5F9] truncate text-xs">
                      {b.customer_name || 'Walk-in Customer'}
                    </div>
                    <div className="text-[10px] text-[#5A6B82] dark:text-[#94A3B8] flex items-center gap-2 pt-0.5">
                      <span className="font-bold text-[#0A4174] dark:text-[#4A8CD2]">
                        {b.cart?.length || 0} {b.cart?.length === 1 ? 'item' : 'items'}
                      </span>
                      <span>•</span>
                      <span>{new Date(b.held_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="font-black text-sm text-[#0A4174] dark:text-[#4A8CD2]">
                      {formatCurrency(b.totals?.grandTotal || 0, currency)}
                    </span>
                    <button
                      type="button"
                      onClick={() => recallBill(b)}
                      className="px-3.5 py-1.5 rounded-xl bg-[#0A4174] hover:bg-[#062E52] text-white dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] dark:text-[#0B131E] text-xs font-bold shadow-xs active:scale-95 transition-all"
                    >
                      Recall Bill
                    </button>
                    <button
                      type="button"
                      title="Discard Held Bill"
                      onClick={async () => {
                        await removeLocalHeldBill(b.uuid);
                        try {
                          await api.delete(`/held-bills/${b.uuid}`);
                        } catch {}
                        refreshHeldBills();
                      }}
                      className="p-1.5 rounded-lg text-[#5A6B82] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {heldBills.length === 0 && (
                <div className="py-10 text-center text-[#5A6B82] dark:text-[#94A3B8] space-y-1">
                  <Clock className="w-8 h-8 mx-auto text-[#DCE5EF] dark:text-[#22354B]" />
                  <p className="font-bold">No bills currently on hold</p>
                  <p className="text-[10px]">Use the pause icon in the cart to hold an active bill.</p>
                </div>
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
                <span className="font-semibold text-[#5A6B82] block">Select Variant / Size:</span>
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
                  placeholder="e.g. Priya S"
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

      {/* Quick Sale Modal */}
      {showQuickSale && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#121E2C] p-5 shadow-2xl border border-[#DCE5EF] dark:border-[#22354B] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#DCE5EF] dark:border-[#22354B]">
              <h3 className="font-bold text-sm text-[#1C2736] dark:text-[#F1F5F9] flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500 fill-current" />
                Quick Sale / Manual Item
              </h3>
              <button
                type="button"
                onClick={() => setShowQuickSale(false)}
                className="text-[#5A6B82] hover:text-[#1C2736]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddQuickSale} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#1C2736] dark:text-[#94A3B8] mb-1">
                  Item Name
                </label>
                <input
                  type="text"
                  value={quickSaleForm.name}
                  onChange={(e) => setQuickSaleForm({ ...quickSaleForm, name: e.target.value })}
                  placeholder="e.g. Item 1"
                  className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] px-3 py-2 text-[#1C2736] dark:text-[#F1F5F9] font-medium focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-[#1C2736] dark:text-[#94A3B8] mb-1">
                    Quantity *
                  </label>
                  <input
                    required
                    type="number"
                    min="1"
                    step="any"
                    value={quickSaleForm.qty}
                    onChange={(e) => setQuickSaleForm({ ...quickSaleForm, qty: e.target.value })}
                    placeholder="1"
                    className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] px-3 py-2 text-[#1C2736] dark:text-[#F1F5F9] font-bold text-center focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#1C2736] dark:text-[#94A3B8] mb-1">
                    Unit Price ({currency}) *
                  </label>
                  <input
                    required
                    autoFocus
                    type="number"
                    min="0"
                    step="any"
                    value={quickSaleForm.price}
                    onChange={(e) => setQuickSaleForm({ ...quickSaleForm, price: e.target.value })}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] px-3 py-2 font-bold text-[#0A4174] dark:text-[#4A8CD2] focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                  />
                </div>
              </div>

              {/* Total preview calculation (e.g. 2 * 30 = 60) */}
              <div className="p-2.5 rounded-xl bg-[#E2EDF8] dark:bg-[#1A2A3D] flex items-center justify-between text-xs">
                <span className="text-[#5A6B82] dark:text-[#94A3B8] font-medium">
                  {Number(quickSaleForm.qty || 1)} × {formatCurrency(quickSaleForm.price || 0, currency)}
                </span>
                <span className="text-sm font-extrabold text-[#0A4174] dark:text-[#4A8CD2]">
                  Total: {formatCurrency((Number(quickSaleForm.qty) || 1) * (Number(quickSaleForm.price) || 0), currency)}
                </span>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuickSale(false)}
                  className="flex-1 py-2 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] text-[#5A6B82]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold"
                >
                  Add to Cart
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

      {/* Invoice Preview Modal (Thermal Template with Print, Share, Close) */}
      {completedInvoicePreview && (
        <InvoicePreviewModal
          invoice={completedInvoicePreview}
          settings={settings}
          onClose={() => setCompletedInvoicePreview(null)}
        />
      )}
    </div>
  );
}
