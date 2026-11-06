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
  History,
  Printer,
  ChevronRight,
} from 'lucide-react';

export default function Collection() {
  const { settings } = useSettings();
  const currency = settings?.currency_symbol || '₹';

  // Active top tab: 'new' for Record Collection, 'history' for Collection History
  const [activeTab, setActiveTab] = useState('new');

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

  // Collection History states
  const [paymentsHistory, setPaymentsHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [printPayment, setPrintPayment] = useState(null);

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

  // Load completed collection history
  const loadPaymentsHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data } = await api.get('/customer-payments');
      setPaymentsHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
    loadPaymentsHistory();
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

  // Filtered History
  const filteredHistory = useMemo(() => {
    const term = historySearch.trim().toLowerCase();
    if (!term) return paymentsHistory;
    return paymentsHistory.filter((p) => {
      const cust = (p.customer_name || '').toLowerCase();
      const phone = (p.customer_phone || '').toLowerCase();
      const inv = (p.invoice_no || '').toLowerCase();
      const notes = (p.notes || '').toLowerCase();
      const id = String(p.id);
      return cust.includes(term) || phone.includes(term) || inv.includes(term) || notes.includes(term) || id.includes(term);
    });
  }, [paymentsHistory, historySearch]);

  const totalCollectedHistory = useMemo(() => {
    return paymentsHistory.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }, [paymentsHistory]);

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
      // Reload customers and history
      await loadCustomers();
      await loadPaymentsHistory();
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
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#DCE5EF] dark:border-[#22354B]">
        <div className="flex items-center gap-2">
          <Link
            to="/customers"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#5A6B82] dark:text-[#94A3B8] hover:text-[#0A4174] dark:hover:text-[#4A8CD2] hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] transition-colors"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Customers</span>
          </Link>
          <div className="inline-flex p-1 rounded-2xl bg-[#E2EDF8]/60 dark:bg-[#1A2A3D]/60 border border-white/60">
            <button
              type="button"
              onClick={() => setActiveTab('new')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'new'
                  ? 'bg-[#0A4174] text-white dark:bg-[#4A8CD2] dark:text-[#0B131E] shadow-sm'
                  : 'text-[#5A6B82] dark:text-[#94A3B8] hover:text-[#0A4174] dark:hover:text-[#4A8CD2]'
              }`}
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Credit Collection</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('history');
                loadPaymentsHistory();
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'history'
                  ? 'bg-[#0A4174] text-white dark:bg-[#4A8CD2] dark:text-[#0B131E] shadow-sm'
                  : 'text-[#5A6B82] dark:text-[#94A3B8] hover:text-[#0A4174] dark:hover:text-[#4A8CD2]'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Collection History</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
                {paymentsHistory.length}
              </span>
            </button>
          </div>
        </div>

        {/* Quick Summary Pill */}
        <div className="flex items-center gap-2">
          <div className="water-glass-pill px-3 py-1.5 rounded-xl text-xs font-semibold text-[#5A6B82] dark:text-[#94A3B8]">
            <span>Total Debtor Balance: </span>
            <span className="font-black text-rose-600 dark:text-rose-400">
              {formatCurrency(totalReceivable, currency)}
            </span>
          </div>
          <div className="water-glass-pill px-3 py-1.5 rounded-xl text-xs font-semibold text-[#5A6B82] dark:text-[#94A3B8]">
            <span>Total Collected: </span>
            <span className="font-black text-emerald-600 dark:text-emerald-400">
              {formatCurrency(totalCollectedHistory, currency)}
            </span>
          </div>
        </div>
      </div>

      {activeTab === 'new' ? (
        /* TAB 1: RECORD NEW COLLECTION */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT 5 COLS: CUSTOMER DEBTOR DIRECTORY */}
          <div className="lg:col-span-5 space-y-4">
            <div className="water-glass-card p-4 rounded-3xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-black text-[#1C2736] dark:text-[#F1F5F9]">
                    Select Debtor Customer
                  </h2>
                  <p className="text-[11px] text-[#5A6B82] dark:text-[#94A3B8]">
                    {debtorCount} customers currently owe credit balance
                  </p>
                </div>
                <span className="text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-full border border-rose-200/50">
                  {formatCurrency(totalReceivable, currency)} Due
                </span>
              </div>

              {/* Search Box */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-[#5A6B82]" />
                <input
                  type="text"
                  placeholder="Search customer by name or phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB] dark:bg-[#0B131E] focus:outline-none focus:ring-1 focus:ring-[#0A4174]"
                />
              </div>

              {/* Customer List */}
              <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
                {loading ? (
                  <div className="p-6 text-center text-xs text-[#5A6B82]">Loading customers...</div>
                ) : filteredCustomers.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#5A6B82]">
                    No matching customers found.
                  </div>
                ) : (
                  filteredCustomers.map((cust) => {
                    const isSelected = selectedCustomer?.id === cust.id;
                    const bal = Number(cust.balance || 0);
                    return (
                      <button
                        key={cust.id}
                        type="button"
                        onClick={() => handleSelectCustomer(cust)}
                        className={`w-full p-3 rounded-2xl text-left transition-all flex items-center justify-between border ${
                          isSelected
                            ? 'bg-[#0A4174] text-white border-[#0A4174] shadow-md'
                            : 'bg-white/60 dark:bg-[#121E2C]/60 hover:bg-white dark:hover:bg-[#1A2A3D] border-white/80 dark:border-white/10'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className={`font-bold text-xs truncate ${isSelected ? 'text-white' : 'text-[#1C2736] dark:text-[#F1F5F9]'}`}>
                            {cust.name}
                          </div>
                          <div className={`text-[11px] truncate ${isSelected ? 'text-blue-100' : 'text-[#5A6B82] dark:text-[#94A3B8]'}`}>
                            {cust.phone || 'No phone'} • {cust.city || 'Local'}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className={`text-xs font-black ${
                            isSelected
                              ? 'text-white'
                              : bal > 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}>
                            {formatCurrency(bal, currency)}
                          </div>
                          <div className={`text-[9px] uppercase font-bold tracking-wider ${
                            isSelected ? 'text-blue-200' : bal > 0 ? 'text-rose-500' : 'text-emerald-500'
                          }`}>
                            {bal > 0 ? 'Due' : 'Cleared'}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* RIGHT 7 COLS: COLLECTION FORM */}
          <div className="lg:col-span-7 space-y-4">
            <div className="water-glass-card p-6 rounded-3xl space-y-5">
              {selectedCustomer ? (
                <>
                  {/* Selected Customer Header Info */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-50 to-blue-50 dark:from-sky-950/30 dark:to-blue-950/30 border border-sky-100 dark:border-sky-900/30 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#0A4174] dark:text-[#4A8CD2]">
                        Receiving Payment From
                      </div>
                      <div className="text-base font-black text-[#1C2736] dark:text-[#F1F5F9]">
                        {selectedCustomer.name}
                      </div>
                      <div className="text-xs text-[#5A6B82] dark:text-[#94A3B8]">
                        Phone: {selectedCustomer.phone || '—'} | Address: {selectedCustomer.address || '—'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold text-[#5A6B82] dark:text-[#94A3B8] uppercase">
                        Current Outstanding Due
                      </div>
                      <div className="text-xl font-black text-rose-600 dark:text-rose-400">
                        {formatCurrency(selectedCustomer.balance, currency)}
                      </div>
                    </div>
                  </div>

                  {/* Feedback Notifications */}
                  {success && (
                    <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>{success}</span>
                    </div>
                  )}

                  {error && (
                    <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Payment Allocation Mode Switcher */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-[#1C2736] dark:text-[#F1F5F9]">
                      Payment Allocation Mode
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCollectionType('total');
                          setSelectedInvoiceId('');
                        }}
                        className={`p-3 rounded-2xl text-left border transition-all ${
                          collectionType === 'total'
                            ? 'bg-[#0A4174] text-white border-[#0A4174] shadow-sm'
                            : 'bg-white/70 dark:bg-[#121E2C]/70 border-[#DCE5EF] text-[#1C2736] dark:text-[#F1F5F9]'
                        }`}
                      >
                        <div className="font-bold text-xs flex items-center gap-1.5">
                          <Wallet className="w-3.5 h-3.5" />
                          <span>Against Total Customer Balance</span>
                        </div>
                        <div className={`text-[10px] mt-0.5 ${collectionType === 'total' ? 'text-blue-100' : 'text-[#5A6B82]'}`}>
                          Applies collection directly to reduce ledger balance
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCollectionType('invoice')}
                        className={`p-3 rounded-2xl text-left border transition-all ${
                          collectionType === 'invoice'
                            ? 'bg-[#0A4174] text-white border-[#0A4174] shadow-sm'
                            : 'bg-white/70 dark:bg-[#121E2C]/70 border-[#DCE5EF] text-[#1C2736] dark:text-[#F1F5F9]'
                        }`}
                      >
                        <div className="font-bold text-xs flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5" />
                          <span>Specific Invoice Bill</span>
                        </div>
                        <div className={`text-[10px] mt-0.5 ${collectionType === 'invoice' ? 'text-blue-100' : 'text-[#5A6B82]'}`}>
                          Apply to one specific credit invoice ({customerInvoices.length} open)
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* If Invoice specific, show invoice picker */}
                  {collectionType === 'invoice' && (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-[#1C2736] dark:text-[#F1F5F9]">
                        Select Unpaid Invoice ({customerInvoices.length} Available)
                      </label>
                      {customerInvoices.length === 0 ? (
                        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs border border-amber-200">
                          No specific unpaid invoice records found for this customer. You can record against Total Balance.
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {customerInvoices.map((inv) => (
                            <button
                              key={inv.id}
                              type="button"
                              onClick={() => {
                                setSelectedInvoiceId(String(inv.id));
                                setAmount(String(inv.balance_amount));
                              }}
                              className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between text-xs transition-all ${
                                selectedInvoiceId === String(inv.id)
                                  ? 'border-[#0A4174] bg-[#E2EDF8] dark:bg-[#1A2A3D] font-bold text-[#0A4174]'
                                  : 'border-[#DCE5EF] bg-white/50 hover:bg-white text-[#1C2736]'
                              }`}
                            >
                              <div>
                                <span className="font-mono font-bold">{inv.invoice_no}</span>
                                <span className="text-[10px] text-[#5A6B82] ml-2">
                                  {new Date(inv.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-rose-600 font-bold">
                                  Due: {formatCurrency(inv.balance_amount, currency)}
                                </span>
                                <span className="text-[10px] text-[#5A6B82] ml-1.5">
                                  (Total: {formatCurrency(inv.grand_total, currency)})
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Payment Details Form */}
                  <form onSubmit={handleRecordCollection} className="space-y-4 pt-1">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-[#1C2736] dark:text-[#F1F5F9]">
                          Amount Collected ({currency}) *
                        </label>
                        {Number(selectedCustomer.balance || 0) > 0 && (
                          <button
                            type="button"
                            onClick={() => setAmount(String(selectedCustomer.balance))}
                            className="text-[11px] text-[#0284C7] dark:text-[#38BDF8] hover:underline font-bold"
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
                        placeholder="Enter collection amount (e.g. 500)"
                        className="w-full rounded-2xl border border-[#DCE5EF] dark:border-[#22354B] bg-white/80 dark:bg-[#0B131E] px-4 py-3 text-base font-black text-[#0284C7] dark:text-[#38BDF8] focus:ring-2 focus:ring-[#0284C7] focus:outline-none"
                      />
                      {Number(amount || 0) > Number(selectedCustomer.balance || 0) && (
                        <div className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5" />
                          Extra amount of {formatCurrency(Number(amount) - Number(selectedCustomer.balance), currency)} will automatically be credited to Profit & Other Income!
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#1C2736] dark:text-[#F1F5F9] mb-1">
                        Notes / Reference / Payment Mode
                      </label>
                      <input
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="e.g. Cash received, GPay Ref #123456, Paid by relative..."
                        className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white/80 dark:bg-[#0B131E] px-3.5 py-2.5 text-xs focus:ring-1 focus:ring-[#0A4174]"
                      />
                    </div>

                    <div className="pt-2 flex gap-3">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="btn-luminous-blue flex-1 py-3.5 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-[1.01] active:scale-95"
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
                        className="px-5 py-3.5 rounded-2xl border border-[#DCE5EF] dark:border-[#22354B] text-xs font-semibold text-[#5A6B82] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="py-24 text-center text-[#5A6B82] space-y-3">
                  <Wallet className="w-14 h-14 mx-auto text-[#0284C7] dark:text-[#38BDF8] stroke-[1.5]" />
                  <h3 className="font-bold text-base text-[#1C2736] dark:text-[#F1F5F9]">No Customer Selected</h3>
                  <p className="text-xs max-w-sm mx-auto">
                    Select any debtor customer from the left list to record a partial or full credit settlement.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* TAB 2: COLLECTION HISTORY VIEW */
        <div className="space-y-4">
          <div className="water-glass-card p-6 rounded-3xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-[#1C2736] dark:text-[#F1F5F9] flex items-center gap-2">
                  <History className="w-4 h-4 text-[#0284C7]" />
                  <span>Settled Credit Collections History</span>
                </h2>
                <p className="text-xs text-[#5A6B82] dark:text-[#94A3B8]">
                  Complete ledger of all past credit collections, receipts, and income allocations.
                </p>
              </div>

              {/* Search Filter */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#5A6B82]" />
                <input
                  type="text"
                  placeholder="Search receipt, customer, notes..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB] dark:bg-[#0B131E] focus:outline-none focus:ring-1 focus:ring-[#0A4174]"
                />
              </div>
            </div>

            {/* History Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-[#DCE5EF] dark:border-[#22354B] text-[#5A6B82] dark:text-[#94A3B8] font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3">Receipt #</th>
                    <th className="py-3 px-3">Date & Time</th>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">Payment Mode</th>
                    <th className="py-3 px-3">Allocated Bill</th>
                    <th className="py-3 px-3">Notes</th>
                    <th className="py-3 px-3 text-right">Amount Collected</th>
                    <th className="py-3 px-3 text-center">Receipt Print</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE5EF]/60 dark:divide-[#22354B]/60">
                  {historyLoading ? (
                    <tr>
                      <td colSpan="8" className="py-8 text-center text-[#5A6B82]">
                        Loading collection history...
                      </td>
                    </tr>
                  ) : filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-8 text-center text-[#5A6B82]">
                        No completed collection records found.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-sky-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-[#0A4174] dark:text-[#4A8CD2]">
                          #{item.id}
                        </td>
                        <td className="py-3 px-3 text-[#5A6B82] dark:text-[#94A3B8]">
                          {item.created_at ? new Date(item.created_at).toLocaleString() : '—'}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-[#1C2736] dark:text-[#F1F5F9]">
                            {item.customer_name}
                          </div>
                          {item.customer_phone && (
                            <div className="text-[10px] text-[#5A6B82]">{item.customer_phone}</div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E2EDF8] dark:bg-[#1A2A3D] text-[#0A4174] dark:text-[#4A8CD2]">
                            {item.payment_method_name || 'Cash'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono">
                          {item.invoice_no ? (
                            <span className="text-blue-600 dark:text-blue-400 font-semibold">
                              {item.invoice_no}
                            </span>
                          ) : (
                            <span className="text-[#5A6B82] text-[11px] italic">General Balance</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-[#5A6B82] max-w-xs truncate">
                          {item.notes || '—'}
                        </td>
                        <td className="py-3 px-3 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm">
                          {formatCurrency(item.amount, currency)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => setPrintPayment(item)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#1A2A3D] border border-[#DCE5EF] dark:border-[#22354B] text-[#0A4174] dark:text-[#4A8CD2] hover:bg-[#0A4174] hover:text-white dark:hover:bg-[#4A8CD2] dark:hover:text-[#0B131E] font-bold text-xs shadow-xs transition-all"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Print Receipt</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PRINT RECEIPT MODAL */}
      {printPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="water-glass-card max-w-md w-full p-6 rounded-3xl relative shadow-2xl space-y-4">
            <button
              onClick={() => setPrintPayment(null)}
              className="absolute top-4 right-4 p-1 rounded-full text-[#5A6B82] hover:text-black dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Printable Area with id="collection-printable-receipt" */}
            <div id="collection-printable-receipt" className="bg-white text-slate-800 p-6 rounded-2xl border border-slate-200 font-mono text-xs space-y-3">
              <div className="text-center space-y-1">
                <h3 className="font-black text-base uppercase tracking-wider">{settings.company_name || 'UNIVERSAL POS'}</h3>
                <div className="text-[10px] text-slate-500">{settings.company_address || 'Store Location'}</div>
                <div className="text-[11px] font-bold text-[#0A4174] border-y border-dashed border-slate-300 py-1 my-2">
                  CREDIT COLLECTION PAYMENT RECEIPT
                </div>
              </div>

              <div className="space-y-1 pt-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Receipt Ref:</span>
                  <span className="font-bold">RCP-COL-{printPayment.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date & Time:</span>
                  <span>{new Date(printPayment.created_at).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer:</span>
                  <span className="font-bold">{printPayment.customer_name}</span>
                </div>
                {printPayment.customer_phone && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Phone:</span>
                    <span>{printPayment.customer_phone}</span>
                  </div>
                )}
                {printPayment.invoice_no && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Allocated Invoice:</span>
                    <span className="font-bold">{printPayment.invoice_no}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Mode:</span>
                  <span>{printPayment.payment_method_name || 'Cash'}</span>
                </div>
              </div>

              <div className="border-t border-dashed border-slate-300 pt-3">
                <div className="flex justify-between items-center text-sm font-black">
                  <span>TOTAL AMOUNT PAID:</span>
                  <span className="text-base text-emerald-700">{formatCurrency(printPayment.amount, currency)}</span>
                </div>
              </div>

              {printPayment.notes && (
                <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                  <span className="font-bold">Notes: </span>{printPayment.notes}
                </div>
              )}

              <div className="text-center pt-3 text-[10px] text-slate-400">
                Thank you for your payment! • Universal POS
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="btn-luminous-blue flex-1 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md"
              >
                <Printer className="w-4 h-4" />
                <span>Print Document</span>
              </button>
              <button
                type="button"
                onClick={() => setPrintPayment(null)}
                className="px-4 py-3 rounded-xl border border-[#DCE5EF] text-xs font-semibold text-[#5A6B82]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}