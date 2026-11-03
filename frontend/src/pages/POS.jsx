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

const PAYMENT_METHODS = ['cash', 'upi', 'card', 'credit'];

export default function POS() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { can } = useAuth();
  const canDiscount = can('pos.apply_discount');
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [serialPicker, setSerialPicker] = useState(null);
  const [customizer, setCustomizer] = useState(null);
  const [addons, setAddons] = useState([]);
  const [heldBills, setHeldBills] = useState([]);
  const [showHeldModal, setShowHeldModal] = useState(false);
  const [message, setMessage] = useState('');
  const searchRef = useRef(null);

  const currency = settings?.currency_symbol || '₹';

  const loadProducts = async () => {
    try {
      const { data } = await api.get('/products', { params: { business_type: settings?.business_type } });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.business_type]);

  const refreshHeldBills = async () => {
    const local = await getLocalHeldBills();
    let serverBills = [];
    try {
      const { data } = await api.get('/held-bills');
      serverBills = data;
    } catch {
      // offline — only show local held bills
    }
    const merged = [...local, ...serverBills.filter((s) => !local.some((l) => l.uuid === s.uuid))];
    setHeldBills(merged);
  };

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products.slice(0, 40);
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          (p.barcode || '').toLowerCase() === term ||
          (p.sku || '').toLowerCase().includes(term)
      )
      .slice(0, 40);
  }, [products, search]);

  const addToCart = (product, serial, variant, selectedAddons) => {
    const taxPercent = Number(product.tax_percent || 0);

    if (variant || (selectedAddons && selectedAddons.length > 0)) {
      const unitPrice = Number(product.selling_price) + Number(variant?.price_adjustment || 0);
      const addonsTotal = (selectedAddons || []).reduce((s, a) => s + Number(a.price), 0);
      const lineBase = unitPrice + addonsTotal;
      const taxAmount = Math.round(((lineBase * taxPercent) / 100) * 100) / 100;
      setCart((c) => [
        ...c,
        {
          key: `${product.id}-${variant?.id || 'base'}-${Date.now()}`,
          product_id: product.id,
          variant_id: variant?.id || null,
          variant_label: variant?.variant_name,
          addons: selectedAddons || [],
          product_name: product.name,
          qty: 1,
          unit_price: unitPrice,
          discount_amount: 0,
          tax_percent: taxPercent,
          tax_amount: taxAmount,
        },
      ]);
      return;
    }

    if (product.track_serial) {
      if (!serial) return; // caller must resolve a serial first
      const unitPrice = Number(product.selling_price);
      const taxAmount = Math.round(((unitPrice * taxPercent) / 100) * 100) / 100;
      setCart((c) => [
        ...c,
        {
          key: `${product.id}-${serial.id}`,
          product_id: product.id,
          serial_id: serial.id,
          serial_label: serial.imei1 || serial.serial_no,
          product_name: product.name,
          qty: 1,
          unit_price: unitPrice,
          discount_amount: 0,
          tax_percent: taxPercent,
          tax_amount: taxAmount,
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
      const existing = c.find((l) => l.product_id === product.id && !l.serial_id);
      if (existing) {
        return c.map((l) => (l.key === existing.key ? { ...l, qty: l.qty + 1 } : l));
      }
      const unitPrice = Number(product.selling_price);
      const taxAmount = Math.round(((unitPrice * taxPercent) / 100) * 100) / 100;
      return [
        ...c,
        {
          key: `${product.id}`,
          product_id: product.id,
          product_name: product.name,
          qty: 1,
          unit_price: unitPrice,
          discount_amount: 0,
          tax_percent: taxPercent,
          tax_amount: taxAmount,
        },
      ];
    });
  };

  const handleProductClick = (product) => {
    if (product.track_serial) {
      if (!product.available_serials?.length) {
        setMessage(t('pos.out_of_stock'));
        return;
      }
      setSerialPicker(product);
      return;
    }
    if (Number(product.stock_qty) <= 0) {
      setMessage(t('pos.out_of_stock'));
    }
    const hasVariants = product.variants?.length > 0;
    const canAddon = settings?.business_type === 'food' && addons.length > 0;
    if (hasVariants || canAddon) {
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

  const updateLine = (key, patch) =>
    setCart((c) => c.map((l) => (l.key === key ? recalcLine({ ...l, ...patch }) : l)));

  const lineAddonsTotal = (line) => (line.addons || []).reduce((s, a) => s + Number(a.price), 0);
  const lineUnitWithAddons = (line) => Number(line.unit_price) + lineAddonsTotal(line);

  const recalcLine = (line) => {
    const base = line.qty * lineUnitWithAddons(line);
    const taxAmount = Math.round(((base - line.discount_amount) * (line.tax_percent || 0)) / 100 * 100) / 100;
    return { ...line, tax_amount: taxAmount };
  };

  const removeLine = (key) => setCart((c) => c.filter((l) => l.key !== key));

  const totals = useMemo(() => {
    const subtotal = cart.reduce((s, l) => s + l.qty * lineUnitWithAddons(l), 0);
    const discount = cart.reduce((s, l) => s + Number(l.discount_amount || 0), 0);
    const tax = cart.reduce((s, l) => s + Number(l.tax_amount || 0), 0);
    const grandTotal = Math.round((subtotal - discount + tax) * 100) / 100;
    return { subtotal, discount, tax, grandTotal };
  }, [cart]);

  useEffect(() => {
    if (paymentMethod !== 'credit') setPaidAmount(totals.grandTotal.toFixed(2));
    else setPaidAmount('0');
  }, [totals.grandTotal, paymentMethod]);

  const resetSale = () => {
    setCart([]);
    setCustomerId('');
    setPaymentMethod('cash');
    searchRef.current?.focus();
  };

  const createNewCustomer = async () => {
    if (!newCustomerName.trim()) return;
    const uuid = newUuid();
    const payload = { uuid, name: newCustomerName.trim() };
    try {
      const { data } = await api.post('/customers', payload);
      setCustomers((c) => [...c, data]);
      setCustomerId(data.id);
    } catch {
      const localCustomer = { id: `local-${uuid}`, uuid, name: payload.name, balance: 0 };
      await addLocalCustomer(localCustomer);
      await enqueueOutboxItem({ client_id: uuid, type: 'customer', payload });
      refreshPendingCount();
      setCustomers((c) => [...c, localCustomer]);
      setCustomerId(localCustomer.id);
    }
    setNewCustomerName('');
    setShowNewCustomer(false);
  };

  const holdBill = async () => {
    if (cart.length === 0) return;
    const uuid = newUuid();
    const bill = {
      uuid,
      label: `Hold ${new Date().toLocaleTimeString()}`,
      customer_id: typeof customerId === 'number' ? customerId : null,
      payload: { cart, customer_id: customerId },
      created_at: new Date().toISOString(),
    };
    await saveLocalHeldBill(bill);
    try {
      await api.post('/held-bills', bill);
    } catch {
      // stays local-only until the next sync; fine since it's per-device scratch state
    }
    resetSale();
    refreshHeldBills();
  };

  const resumeBill = async (bill) => {
    const payload = typeof bill.payload === 'string' ? JSON.parse(bill.payload) : bill.payload;
    setCart(payload.cart || []);
    setCustomerId(payload.customer_id || '');
    await removeLocalHeldBill(bill.uuid);
    try {
      if (bill.id) await api.delete(`/held-bills/${bill.id}`);
    } catch {
      /* ignore */
    }
    setShowHeldModal(false);
    refreshHeldBills();
  };

  const finalizeSale = async () => {
    if (cart.length === 0) return;
    const uuid = newUuid();
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
    const customerIdNumeric = typeof customerId === 'number' ? customerId : null;
    const payments = [{ payment_method: paymentMethod, amount: Number(paidAmount) || 0 }];

    const basePayload = { uuid, customer_id: customerIdNumeric, items, payments };

    if (navigator.onLine) {
      try {
        const { data } = await api.post('/invoices', { ...basePayload, source: 'online' });
        loadProducts();
        setMessage(t('pos.invoice_created', { no: data.invoice_no }));
        openReceiptWindow(data, settings);
        resetSale();
        return;
      } catch (err) {
        if (err.response) {
          setMessage(err.response.data?.error || 'Failed to save invoice');
          return;
        }
        // network error even though navigator says online — fall through to offline path
      }
    }

    // Offline path: queue for sync, apply optimistic local stock + receipt.
    const createdAt = new Date().toISOString();
    await enqueueOutboxItem({ client_id: uuid, type: 'invoice', payload: { ...basePayload, source: 'offline', created_at: createdAt } });
    for (const line of cart) {
      await applyLocalStockDelta(line.product_id, -line.qty);
    }
    refreshPendingCount();

    const customerName = customers.find((c) => c.id === customerId)?.name;
    const localInvoice = {
      invoice_no: `OFFLINE-${uuid.slice(0, 8).toUpperCase()}`,
      created_at: createdAt,
      source: 'offline',
      customer_name: customerName,
      items: items.map((i) => ({ ...i, product_name_snapshot: i.product_name, line_total: i.qty * i.unit_price - i.discount_amount + i.tax_amount })),
      subtotal: totals.subtotal,
      discount_amount: totals.discount,
      tax_amount: totals.tax,
      grand_total: totals.grandTotal,
    };
    openReceiptWindow(localInvoice, settings);
    setMessage(t('pos.invoice_created', { no: localInvoice.invoice_no }));
    resetSale();
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        holdBill();
      } else if (e.key === 'F9') {
        e.preventDefault();
        finalizeSale();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, customerId, paymentMethod, paidAmount]);

  const onSearchKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    const term = search.trim().toLowerCase();
    const exact = products.find((p) => (p.barcode || '').toLowerCase() === term);
    if (exact) {
      handleProductClick(exact);
      setSearch('');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
      <div className="lg:col-span-2 flex flex-col">
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={onSearchKeyDown}
          placeholder={t('pos.search_placeholder')}
          className="mb-3 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2"
        />
        <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2">
          {filteredProducts.map((p) => (
            <button
              key={p.id}
              onClick={() => handleProductClick(p)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-left hover:border-brand-500"
            >
              <div className="text-sm font-medium truncate">{p.name}</div>
              <div className="text-xs text-slate-400">{currency}{Number(p.selling_price).toFixed(2)}</div>
              <div className={`text-xs ${Number(p.stock_qty) <= (p.low_stock_threshold || 0) ? 'text-amber-600' : 'text-slate-400'}`}>
                {p.track_serial ? `${p.available_serials?.length || 0} ${t('pos.qty')}` : `${t('pos.qty')}: ${Number(p.stock_qty)}`}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
        {message && (
          <div className="mb-2 rounded-md bg-brand-50 dark:bg-brand-900/30 px-2 py-1 text-xs text-brand-700 dark:text-brand-300 flex justify-between">
            <span>{message}</span>
            <button onClick={() => setMessage('')}>✕</button>
          </div>
        )}

        <div className="mb-2 flex gap-2">
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) || e.target.value : '')}
            className="flex-1 rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1.5 text-sm"
          >
            <option value="">{t('pos.walk_in_customer')}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
            ))}
          </select>
          <button onClick={() => setShowNewCustomer((s) => !s)} className="text-xs text-brand-600 whitespace-nowrap">
            {t('pos.new_customer')}
          </button>
        </div>
        {showNewCustomer && (
          <div className="mb-2 flex gap-1">
            <input
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              placeholder={t('common.name')}
              className="flex-1 rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1 text-sm"
            />
            <button onClick={createNewCustomer} className="rounded-md bg-brand-600 px-2 text-white text-sm">
              {t('common.add')}
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto border-y border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
          {cart.length === 0 && <div className="py-6 text-center text-sm text-slate-400">{t('pos.empty_cart')}</div>}
          {cart.map((l) => (
            <div key={l.key} className="py-2 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">{l.product_name}</span>
                <button onClick={() => removeLine(l.key)} className="text-red-500 text-xs">{t('pos.remove')}</button>
              </div>
              {l.serial_label && <div className="text-xs text-slate-400">IMEI: {l.serial_label}</div>}
              {l.variant_label && <div className="text-xs text-slate-400">{l.variant_label}</div>}
              {l.addons?.length > 0 && (
                <div className="text-xs text-slate-400">+ {l.addons.map((a) => a.name).join(', ')}</div>
              )}
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={l.qty}
                  disabled={!!l.serial_id}
                  onChange={(e) => updateLine(l.key, { qty: Number(e.target.value) || 0 })}
                  className="w-16 rounded border border-slate-300 dark:border-slate-600 bg-transparent px-1 py-0.5 text-xs"
                />
                <span className="text-xs text-slate-400">x {currency}{lineUnitWithAddons(l)}</span>
                {canDiscount && (
                  <input
                    type="number"
                    value={l.discount_amount}
                    onChange={(e) => updateLine(l.key, { discount_amount: Number(e.target.value) || 0 })}
                    placeholder={t('pos.discount')}
                    className="w-16 rounded border border-slate-300 dark:border-slate-600 bg-transparent px-1 py-0.5 text-xs"
                  />
                )}
                <span className="ml-auto font-medium">{currency}{(l.qty * lineUnitWithAddons(l) - l.discount_amount + l.tax_amount).toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between"><span>{t('pos.subtotal')}</span><span>{currency}{totals.subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>{t('pos.discount')}</span><span>-{currency}{totals.discount.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>{t('pos.tax')}</span><span>{currency}{totals.tax.toFixed(2)}</span></div>
          <div className="flex justify-between text-base font-bold"><span>{t('pos.grand_total')}</span><span>{currency}{totals.grandTotal.toFixed(2)}</span></div>
        </div>

        <div className="mt-2 grid grid-cols-4 gap-1">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m}
              onClick={() => setPaymentMethod(m)}
              className={`rounded-md border px-2 py-1 text-xs font-medium ${paymentMethod === m ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' : 'border-slate-300 dark:border-slate-600'}`}
            >
              {t(`pos.${m}`)}
            </button>
          ))}
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs">
          <span>{t('pos.paid_amount')}</span>
          <input
            type="number"
            value={paidAmount}
            onChange={(e) => setPaidAmount(e.target.value)}
            disabled={paymentMethod === 'credit'}
            className="w-24 rounded border border-slate-300 dark:border-slate-600 bg-transparent px-1 py-0.5"
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={holdBill} className="rounded-md border border-slate-300 dark:border-slate-600 py-2 text-sm font-medium">
            {t('pos.hold_bill')}
          </button>
          <button onClick={() => setShowHeldModal(true)} className="rounded-md border border-slate-300 dark:border-slate-600 py-2 text-sm font-medium">
            {t('pos.held_bills')} ({heldBills.length})
          </button>
        </div>
        <button onClick={finalizeSale} className="mt-2 w-full rounded-md bg-brand-600 py-2.5 font-semibold text-white">
          {t('pos.pay_print')}
        </button>
      </div>

      {serialPicker && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="w-80 rounded-xl bg-white dark:bg-slate-900 p-4">
            <h3 className="mb-2 font-semibold">{t('pos.select_imei')}</h3>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {serialPicker.available_serials.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    addToCart(serialPicker, s);
                    setSerialPicker(null);
                  }}
                  className="w-full rounded-md border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-sm hover:border-brand-500"
                >
                  {s.imei1 || s.serial_no}
                </button>
              ))}
            </div>
            <button onClick={() => setSerialPicker(null)} className="mt-3 w-full rounded-md border py-1.5 text-sm">
              {t('common.close')}
            </button>
          </div>
        </div>
      )}

      {customizer && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="w-80 rounded-xl bg-white dark:bg-slate-900 p-4">
            <h3 className="mb-2 font-semibold">{customizer.product.name}</h3>

            {customizer.product.variants?.length > 0 && (
              <div className="mb-3">
                <div className="mb-1 text-xs font-medium text-slate-500">{t('pos.options')}</div>
                <div className="space-y-1">
                  {customizer.product.variants.map((v) => (
                    <label key={v.id} className="flex items-center gap-2 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-sm">
                      <input
                        type="radio"
                        name="variant"
                        checked={customizer.variantId === v.id}
                        onChange={() => setCustomizer((c) => ({ ...c, variantId: v.id }))}
                      />
                      <span className="flex-1">{v.variant_name}</span>
                      {Number(v.price_adjustment) !== 0 && (
                        <span className="text-xs text-slate-400">
                          {Number(v.price_adjustment) > 0 ? '+' : ''}{currency}{Number(v.price_adjustment).toFixed(2)}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {settings?.business_type === 'food' && addons.length > 0 && (
              <div className="mb-3">
                <div className="mb-1 text-xs font-medium text-slate-500">{t('pos.addons')}</div>
                <div className="space-y-1">
                  {addons.map((a) => (
                    <label key={a.id} className="flex items-center gap-2 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={customizer.addonIds.includes(a.id)}
                        onChange={(e) =>
                          setCustomizer((c) => ({
                            ...c,
                            addonIds: e.target.checked ? [...c.addonIds, a.id] : c.addonIds.filter((id) => id !== a.id),
                          }))
                        }
                      />
                      <span className="flex-1">{a.name}</span>
                      <span className="text-xs text-slate-400">+{currency}{Number(a.price).toFixed(2)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={confirmCustomizer} className="flex-1 rounded-md bg-brand-600 py-2 text-white text-sm">
                {t('common.add')}
              </button>
              <button onClick={() => setCustomizer(null)} className="flex-1 rounded-md border py-2 text-sm">
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showHeldModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="w-96 rounded-xl bg-white dark:bg-slate-900 p-4">
            <h3 className="mb-2 font-semibold">{t('pos.held_bills')}</h3>
            <div className="max-h-72 overflow-y-auto space-y-1">
              {heldBills.length === 0 && <div className="text-sm text-slate-400">{t('common.no_data')}</div>}
              {heldBills.map((b) => (
                <button
                  key={b.uuid}
                  onClick={() => resumeBill(b)}
                  className="w-full rounded-md border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-sm hover:border-brand-500"
                >
                  {b.label || b.uuid}
                </button>
              ))}
            </div>
            <button onClick={() => setShowHeldModal(false)} className="mt-3 w-full rounded-md border py-1.5 text-sm">
              {t('common.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
