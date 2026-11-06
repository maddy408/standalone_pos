import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../config/api';
import { useSettings } from '../hooks/useSettings';
import { formatCurrency } from '../utils/currency';
import {
  Users,
  Wallet,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  ArrowRight,
  TrendingUp,
  Receipt,
  UserCheck,
  Calendar,
  X,
  PlusCircle,
} from 'lucide-react';

export default function Collection() {
  const { settings } = useSettings();
  const currency = settings?.currency_symbol || '₹';

  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [collectionType, setCollectionType] = useState('total'); // 'total' (against total balance) or 'invoice' (against specific bill)
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Load customers with balance
  const loadCustomers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/customers');
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  // When customer is selected, load their open unpaid/credit invoices
  const handleSelectCustomer = async (cust) => {
    setSelectedCustomer(cust);
    setSelectedInvoiceId('');
    setAmount('');
    setError('');
    setSuccess('');
    try {
      const { data } = await api.get('/invoices', {
        params: { customer_id: cust.id, limit: 100 },
      });
      const list = Array.isArray(data) ? data : data.list || data.data || [];
      // Filter invoices that have an outstanding balance
      const creditInvoices = list.filter((inv) => Number(inv.balance_amount || 0) > 0 && inv.status === 'completed');
      setCustomerInvoices(creditInvoices);
    } catch (err) {
      setCustomerInvoices([]);
    }
  };

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return customers.filter((c) => {
      const name = (c.name || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      const hasBalance = Number(c.balance || 0) > 0;
      const matchesSearch = !term || name.includes(term) || phone.includes(term);
      return matchesSearch && (hasBalance || term);
    });
  }, [customers, search]);

  // Overall totals
  const totalReceivable = useMemo(() => {
    return customers.reduce((sum, c) => sum + Math.max(0, Number(c.balance || 0)), 0);
  }, [customers]);

  const debtorCount = useMemo(() => {
    return customers.filter((c) => Number(c.balance || 0) > 0).length;
  }, [customers]);

  // Handle Collection Submit
  const handleRecordCollection = async (e) => {
    e.preventDefault();
    if (!selectedCustomer) {
      setError('Please select a customer first');
      return;
    }
    const payAmt = Number(amount);
    if (!payAmt || payAmt <= 0) {
      setError('Please enter a valid payment amount greater than zero');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        amount: payAmt,
        invoice_id: collectionType === 'invoice' && selectedInvoiceId ? Number(selectedInvoiceId) : null,
        payment_method_id: 1, // Cash by default
        notes: notes.trim() || `Credit Collection (${collectionType === 'invoice' ? 'Invoice-specific' : 'Total Balance'})`,
      };

      const res = await api.post(`/customers/${selectedCustomer.id}/payments`, payload);
      
      const extraCredited = res.data?.extra_income_credited || 0;
      if (extraCredited > 0) {
        setSuccess(`Payment of ${formatCurrency(payAmt, currency)} recorded successfully! Extra amount ${formatCurrency(extraCredited, currency)} automatically credited to Profit/Other Income.`);
      } else {
        setSuccess(`Payment of ${formatCurrency(payAmt, currency)} collected and deducted from customer debt!`);
      }

      setAmount('');
      setNotes('');
      // Reload customer & customer invoices
      await loadCustomers();
      // Re-fetch selected customer's updated data
      const updatedCustRes = await api.get(`/customers/${selectedCustomer.id}`);
      if (updatedCustRes.data) {
        setSelectedCustomer(updatedCustRes.data);
      }
      handleSelectCustomer(updatedCustRes.data || selectedCustomer);
    } catch (err) {
      setError(err.response?.data?.error || 'Payment recording failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header Navigation Tabs */}
      <div className="flex items-center gap-2 pb-3 border-b border-[#DCE5EF] dark:border-[#22354B]">
        <Link
          to="/customers"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#5A6B82] dark:text-[#94A3B8] hover:text-[#0A4174] dark:hover:text-[#4A8CD2] hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] transition-colors"
        >
          <Users className="w-3.5 h-3.5" />
          <span>Customers</span>
        </Link>
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#0A4174] text-white dark:bg-[#4A8CD2] dark:text-[#0B131E] shadow-xs">
          <Wallet className="w-3.5 h-3.5" />
          <span>Credit Collection & Management</span>
        </span>
      </div>

      {/* Top Stats Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-[#5A6B82] dark:text-[#94A3B8]">Total Outstanding Debt (கடன்)</div>
            <div className="text-xl font-black text-red-600 dark:text-red-400 mt-1">
              {formatCurrency(totalReceivable, currency)}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-[#5A6B82] dark:text-[#94A3B8]">Customers with Due Balance</div>
            <div className="text-xl font-black text-[#0A4174] dark:text-[#4A8CD2] mt-1">
              {debtorCount} Customers
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#E2EDF8] dark:bg-[#1A2A3D] text-[#0A4174] dark:text-[#4A8CD2] flex items-center justify-center">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-[#5A6B82] dark:text-[#94A3B8]">Auto Extra Payment to Income</div>
            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
              <TrendingUp className="w-4 h-4" /> Enabled (Auto-credits Profit)
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Grid: Left = Debtors List, Right = Collection Processing Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ======================================================== */}
        {/* LEFT COLUMN: CUSTOMERS WITH CREDIT BALANCE (5 cols)     */}
        {/* ======================================================== */}
        <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#121E2C] p-4 shadow-sm border border-[#DCE5EF] dark:border-[#22354B] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#DCE5EF] dark:border-[#22354B]">
            <h3 className="font-bold text-xs uppercase tracking-wider text-[#5A6B82] dark:text-[#94A3B8]">
              Select Debtor Customer
            </h3>
            <span className="text-[11px] font-mono text-[#0A4174] dark:text-[#4A8CD2] font-bold">
              {filteredCustomers.length} Found
            </span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#5A6B82] absolute left-3 top-2.5" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search debtor name or phone..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB] dark:bg-[#0B131E] text-xs focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
            />
          </div>

          <div className="max-h-[500px] overflow-y-auto space-y-1.5 scrollbar-thin divide-y divide-[#DCE5EF]/40 dark:divide-[#22354B]/40">
            {filteredCustomers.map((c) => {
              const bal = Number(c.balance || 0);
              const isSelected = selectedCustomer?.id === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => handleSelectCustomer(c)}
                  className={`pt-2 first:pt-0 p-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-[#0A4174] text-white shadow-sm dark:bg-[#4A8CD2] dark:text-[#0B131E]'
                      : 'hover:bg-[#E2EDF8]/50 dark:hover:bg-[#1A2A3D]'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-bold text-xs truncate">{c.name}</div>
                    <div className={`text-[10px] ${isSelected ? 'text-white/80 dark:text-[#0B131E]/80' : 'text-[#5A6B82] dark:text-[#94A3B8]'}`}>
                      {c.phone || 'No phone'} • Limit: {formatCurrency(c.credit_limit || 0, currency)}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`text-xs font-black ${isSelected ? 'text-white dark:text-[#0B131E]' : bal > 0 ? 'text-red-600 dark:text-red-400' : 'text-[#5A6B82]'}`}>
                      {formatCurrency(bal, currency)}
                    </div>
                    <div className={`text-[9px] ${isSelected ? 'text-white/80 dark:text-[#0B131E]/80' : 'text-[#5A6B82]'}`}>
                      Due Balance
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredCustomers.length === 0 && (
              <div className="py-12 text-center text-xs text-[#5A6B82]">
                No debtor customers found.
              </div>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN: PAYMENT COLLECTION FORM (7 cols)          */}
        {/* ======================================================== */}
        <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#121E2C] p-6 shadow-sm border border-[#DCE5EF] dark:border-[#22354B] space-y-5">
          {selectedCustomer ? (
            <>
              {/* Selected Customer Header Banner */}
              <div className="p-4 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB]/70 dark:bg-[#0B131E]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase font-bold text-[#5A6B82]">Customer Selected</div>
                  <h3 className="text-base font-extrabold text-[#1C2736] dark:text-[#F1F5F9]">{selectedCustomer.name}</h3>
                  <p className="text-xs text-[#5A6B82]">{selectedCustomer.phone || 'No phone'} {selectedCustomer.address ? `• ${selectedCustomer.address}` : ''}</p>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-[10px] uppercase font-bold text-[#5A6B82]">Current Total Debt (கடன்)</div>
                  <div className="text-2xl font-black text-red-600 dark:text-red-400">
                    {formatCurrency(selectedCustomer.balance || 0, currency)}
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-600 border border-red-200 dark:border-red-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-3 text-xs text-emerald-600 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              {/* Form to collect payment */}
              <form onSubmit={handleRecordCollection} className="space-y-4 text-xs">
                {/* Collection Method: Total vs Invoice Based */}
                <div>
                  <label className="block font-bold text-[#1C2736] dark:text-[#F1F5F9] mb-1.5">
                    Collection Type:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label
                      onClick={() => setCollectionType('total')}
                      className={`p-3 rounded-xl border cursor-pointer flex items-center gap-2 transition-all ${
                        collectionType === 'total'
                          ? 'border-[#0A4174] bg-[#E2EDF8]/60 dark:bg-[#1A2A3D] text-[#0A4174] dark:text-[#4A8CD2] font-bold'
                          : 'border-[#DCE5EF] dark:border-[#22354B] text-[#5A6B82]'
                      }`}
                    >
                      <input
                        type="radio"
                        checked={collectionType === 'total'}
                        onChange={() => setCollectionType('total')}
                        className="accent-[#0A4174]"
                      />
                      <div>
                        <div>Total Balance Payment</div>
                        <div className="text-[10px] font-normal text-[#5A6B82]">e.g. 2500 கடனில் 200 செலுத்துதல் (FIFO)</div>
                      </div>
                    </label>

                    <label
                      onClick={() => setCollectionType('invoice')}
                      className={`p-3 rounded-xl border cursor-pointer flex items-center gap-2 transition-all ${
                        collectionType === 'invoice'
                          ? 'border-[#0A4174] bg-[#E2EDF8]/60 dark:bg-[#1A2A3D] text-[#0A4174] dark:text-[#4A8CD2] font-bold'
                          : 'border-[#DCE5EF] dark:border-[#22354B] text-[#5A6B82]'
                      }`}
                    >
                      <input
                        type="radio"
                        checked={collectionType === 'invoice'}
                        onChange={() => setCollectionType('invoice')}
                        className="accent-[#0A4174]"
                      />
                      <div>
                        <div>Bill / Invoice Based Collection</div>
                        <div className="text-[10px] font-normal text-[#5A6B82]">Specific Invoice-க்கு மட்டும் அடைத்தல்</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* If Invoice based collection, show unpaid invoice dropdown */}
                {collectionType === 'invoice' && (
                  <div>
                    <label className="block font-bold text-[#1C2736] dark:text-[#F1F5F9] mb-1">
                      Select Specific Pending Bill *
                    </label>
                    <select
                      required={collectionType === 'invoice'}
                      value={selectedInvoiceId}
                      onChange={(e) => {
                        setSelectedInvoiceId(e.target.value);
                        const match = customerInvoices.find((inv) => String(inv.id) === e.target.value);
                        if (match) setAmount(String(match.balance_amount));
                      }}
                      className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB] dark:bg-[#0B131E] px-3.5 py-2.5 text-xs focus:ring-1 focus:ring-[#0A4174] font-medium"
                    >
                      <option value="">-- Select Credit Invoice ({customerInvoices.length} available) --</option>
                      {customerInvoices.map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.invoice_no} • Total: {formatCurrency(inv.grand_total, currency)} • Due: {formatCurrency(inv.balance_amount, currency)} ({new Date(inv.created_at).toLocaleDateString()})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Payment Amount Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-[#1C2736] dark:text-[#F1F5F9]">
                      Amount Collected ({currency}) *
                    </label>
                    {Number(selectedCustomer.balance || 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => setAmount(String(selectedCustomer.balance))}
                        className="text-[10px] text-[#0A4174] dark:text-[#4A8CD2] hover:underline font-bold"
                      >
                        Pay Full Due ({formatCurrency(selectedCustomer.balance, currency)})
                      </button>
                    )}
                  </div>
                  <input
                    required
                    type="number"
                    min="1"
                    step="any"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter amount (e.g. 200)"
                    className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB] dark:bg-[#0B131E] px-3.5 py-2.5 text-sm font-black text-[#0A4174] dark:text-[#4A8CD2] focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                  />
                  {Number(amount || 0) > Number(selectedCustomer.balance || 0) && (
                    <div className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5" />
                      Extra amount of {formatCurrency(Number(amount) - Number(selectedCustomer.balance), currency)} will automatically be credited to Profit & Other Income!
                    </div>
                  )}
                </div>

                {/* Optional Notes */}
                <div>
                  <label className="block font-semibold text-[#1C2736] dark:text-[#F1F5F9] mb-1">
                    Notes / Remarks (Optional)
                  </label>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Paid in cash by brother, GPay reference..."
                    className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB] dark:bg-[#0B131E] px-3.5 py-2 text-xs focus:ring-1 focus:ring-[#0A4174]"
                  />
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex gap-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-3 rounded-xl bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E] font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{submitting ? 'Recording...' : `Record Payment (${formatCurrency(Number(amount || 0), currency)})`}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(null);
                      setAmount('');
                    }}
                    className="px-4 py-3 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] text-xs font-semibold text-[#5A6B82]"
                  >
                    Clear
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="py-20 text-center text-[#5A6B82] space-y-2">
              <Wallet className="w-12 h-12 mx-auto text-[#0A4174] dark:text-[#4A8CD2] stroke-[1.5]" />
              <h3 className="font-bold text-sm text-[#1C2736] dark:text-[#F1F5F9]">No Customer Selected</h3>
              <p className="text-xs max-w-sm mx-auto">
                Select any debtor customer from the left list to record a partial or full credit settlement.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
