import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import api from '../config/api';
import { useSettings } from '../hooks/useSettings';
import { formatCurrency } from '../utils/currency';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  FileText,
  AlertTriangle,
  Users,
  Package,
  PlusCircle,
  BarChart3,
  Boxes,
  Clock,
  ArrowUpRight,
  ShoppingCart,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
  ChevronDown,
  DollarSign,
  PieChart,
  ArrowRight,
  Zap,
} from 'lucide-react';

export default function Dashboard() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const currency = settings?.currency_symbol || '₹';

  const [summary, setSummary] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [income, setIncome] = useState([]);
  const [dateFilter, setDateFilter] = useState('all_time');

  useEffect(() => {
    api.get('/dashboard/summary').then(({ data }) => setSummary(data)).catch(() => {});
    api.get('/invoices', { params: { limit: 500 } }).then(({ data }) => {
      const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
      setInvoices(list);
    }).catch(() => {});
    api.get('/products').then(({ data }) => setProducts(Array.isArray(data) ? data : [])).catch(() => {});
    api.get('/categories').then(({ data }) => setCategories(Array.isArray(data) ? data : [])).catch(() => {});
    api.get('/customers').then(({ data }) => setCustomers(Array.isArray(data) ? data : [])).catch(() => {});
    api.get('/expenses').then(({ data }) => setExpenses(Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []))).catch(() => {});
    api.get('/income').then(({ data }) => setIncome(Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []))).catch(() => {});
  }, []);

  // Filter items by selected dateFilter
  const isDateInFilter = (dateStr, filter) => {
    if (!dateStr || filter === 'all_time') return true;
    const date = new Date(dateStr);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (filter === 'today') {
      return date >= todayStart;
    }
    if (filter === 'yesterday') {
      const yestStart = new Date(todayStart);
      yestStart.setDate(yestStart.getDate() - 1);
      return date >= yestStart && date < todayStart;
    }
    if (filter === '7_days') {
      const d7 = new Date(todayStart);
      d7.setDate(d7.getDate() - 7);
      return date >= d7;
    }
    if (filter === 'this_month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return date >= monthStart;
    }
    return true;
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter((i) => isDateInFilter(i.created_at, dateFilter));
  }, [invoices, dateFilter]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => isDateInFilter(e.expense_date || e.date, dateFilter));
  }, [expenses, dateFilter]);

  const filteredIncome = useMemo(() => {
    return income.filter((inc) => isDateInFilter(inc.income_date || inc.date, dateFilter));
  }, [income, dateFilter]);

  // Compute metrics from dynamically filtered data
  const totalSalesRevenue = useMemo(() => {
    return filteredInvoices
      .filter((i) => i.status === 'completed')
      .reduce((sum, i) => sum + Number(i.grand_total || 0), 0);
  }, [filteredInvoices]);

  const totalIncomeAmount = useMemo(() => {
    return filteredIncome.reduce((sum, it) => sum + Number(it.amount || 0), 0);
  }, [filteredIncome]);

  const totalExpenseAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, it) => sum + Number(it.amount || 0), 0);
  }, [filteredExpenses]);

  const netProfit = useMemo(() => {
    return totalSalesRevenue + totalIncomeAmount - totalExpenseAmount;
  }, [totalSalesRevenue, totalIncomeAmount, totalExpenseAmount]);

  const outOfStockCount = useMemo(() => {
    return products.filter((p) => Number(p.stock_qty || 0) <= 0).length;
  }, [products]);

  // Dynamic Growth / Trend vs Prior Period
  const revenueGrowth = useMemo(() => {
    if (invoices.length === 0) return { percent: 0, isPositive: true };
    const now = new Date();
    const periodDays = dateFilter === 'today' ? 1 : dateFilter === '7_days' ? 7 : 30;
    const currentPeriodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const priorPeriodStart = new Date(now.getTime() - 2 * periodDays * 24 * 60 * 60 * 1000);

    let currSum = 0;
    let priorSum = 0;

    invoices.forEach((inv) => {
      if (inv.status !== 'completed' || !inv.created_at) return;
      const invDate = new Date(inv.created_at);
      if (invDate >= currentPeriodStart) {
        currSum += Number(inv.grand_total || 0);
      } else if (invDate >= priorPeriodStart && invDate < currentPeriodStart) {
        priorSum += Number(inv.grand_total || 0);
      }
    });

    if (priorSum === 0) {
      return { percent: currSum > 0 ? 100 : 0, isPositive: true };
    }
    const diff = ((currSum - priorSum) / priorSum) * 100;
    return {
      percent: Math.min(Math.abs(Math.round(diff)), 999),
      isPositive: diff >= 0,
    };
  }, [invoices, dateFilter]);

  // Order status distribution dynamically calculated
  const orderStats = useMemo(() => {
    const total = filteredInvoices.length;
    const completed = filteredInvoices.filter((i) => i.status === 'completed').length;
    const cancelled = filteredInvoices.filter((i) => i.status === 'cancelled').length;
    const processing = filteredInvoices.filter((i) => i.status === 'processing' || i.status === 'held').length;
    const pending = Math.max(0, total - completed - cancelled - processing);

    // Compute Donut SVG parameters (r = 45 -> circumference ~ 282.74)
    const C = 2 * Math.PI * 45; // ~ 282.74
    const compPct = total > 0 ? completed / total : 0;
    const procPct = total > 0 ? processing / total : 0;
    const pendPct = total > 0 ? pending / total : 0;
    const cancPct = total > 0 ? cancelled / total : 0;

    const compDash = `${compPct * C} ${C}`;
    const procDash = `${procPct * C} ${C}`;
    const pendDash = `${pendPct * C} ${C}`;
    const cancDash = `${cancPct * C} ${C}`;

    const procOffset = -compPct * C;
    const pendOffset = -(compPct + procPct) * C;
    const cancOffset = -(compPct + procPct + pendPct) * C;

    return {
      total,
      completed,
      cancelled,
      processing,
      pending,
      compDash,
      procDash,
      pendDash,
      cancDash,
      procOffset,
      pendOffset,
      cancOffset,
    };
  }, [filteredInvoices]);

  // Dynamic 7-day velocity points for chart
  const salesChartData = useMemo(() => {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      days.push({ dateKey, label, total: 0, orderCount: 0 });
    }

    invoices.forEach((inv) => {
      if (inv.status === 'completed' && inv.created_at) {
        const key = inv.created_at.split('T')[0] || inv.created_at.split(' ')[0];
        const match = days.find((d) => d.dateKey === key);
        if (match) {
          match.total += Number(inv.grand_total || 0);
          match.orderCount += 1;
        }
      }
    });

    const maxVal = Math.max(...days.map((d) => d.total), 100);
    return { days, maxVal };
  }, [invoices]);

  // Dynamic Sparkline SVG path generator
  const generateSparklinePath = (points, maxVal) => {
    if (!points || points.length === 0) return { line: 'M 0 20 L 100 20', fill: 'M 0 20 L 100 20 L 100 25 L 0 25 Z' };
    const step = 100 / Math.max(points.length - 1, 1);
    const coords = points.map((val, idx) => {
      const x = idx * step;
      const y = 22 - (maxVal > 0 ? (val / maxVal) * 18 : 0);
      return `${x.toFixed(1)} ${y.toFixed(1)}`;
    });
    const line = `M ${coords.join(' L ')}`;
    const fill = `${line} L 100 25 L 0 25 Z`;
    return { line, fill };
  };

  const revenueSparkline = useMemo(() => {
    const totals = salesChartData.days.map((d) => d.total);
    return generateSparklinePath(totals, salesChartData.maxVal);
  }, [salesChartData]);

  const ordersSparkline = useMemo(() => {
    const counts = salesChartData.days.map((d) => d.orderCount);
    const maxOrders = Math.max(...counts, 1);
    return generateSparklinePath(counts, maxOrders);
  }, [salesChartData]);

  // Dynamic Top Selling Products from actual Invoices / Catalog
  const topProducts = useMemo(() => {
    const salesMap = {};
    invoices.forEach((inv) => {
      if (inv.status === 'completed' && Array.isArray(inv.items)) {
        inv.items.forEach((it) => {
          const pId = it.product_id;
          if (!pId) return;
          if (!salesMap[pId]) {
            salesMap[pId] = {
              qty: 0,
              total: 0,
              name: it.product_name,
            };
          }
          salesMap[pId].qty += Number(it.qty || 1);
          salesMap[pId].total += Number(it.line_total || it.price || 0);
        });
      }
    });

    const ranked = Object.entries(salesMap)
      .map(([id, info]) => {
        const prod = products.find((p) => String(p.id) === String(id));
        return {
          id,
          name: info.name || prod?.name || `Product #${id}`,
          stock_qty: prod?.stock_qty ?? 0,
          unit_code: prod?.unit_code || 'pcs',
          price: info.total > 0 && info.qty > 0 ? info.total / info.qty : (prod?.selling_price || 0),
          qty_sold: info.qty,
          total_revenue: info.total,
        };
      })
      .sort((a, b) => b.qty_sold - a.qty_sold)
      .slice(0, 5);

    if (ranked.length > 0) return ranked;

    // Fallback: rank products by inventory stock
    return products.slice(0, 5).map((p) => ({
      id: p.id,
      name: p.name,
      stock_qty: p.stock_qty ?? 0,
      unit_code: p.unit_code || 'pcs',
      price: p.selling_price || p.retail_price || 0,
      qty_sold: 0,
      total_revenue: 0,
    }));
  }, [invoices, products]);

  // Dynamic Categories distribution
  const topCategories = useMemo(() => {
    const counts = {};
    products.forEach((p) => {
      const cat = p.category_name || 'General';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    const total = products.length || 1;
    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        percent: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [products]);

  return (
    <div className="space-y-6 font-sans">
      {/* Water Glass Hero Bar with Royal Blue Ambient Glow */}
      <div className="water-glass-card rounded-3xl p-6 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-5 transition-all">
        {/* Soft Royal Blue Ambient Glow */}
        <div className="absolute -top-12 -left-12 w-48 h-48 rounded-full bg-[#0A4174]/15 dark:bg-[#4A8CD2]/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 right-10 w-56 h-56 rounded-full bg-[#2563EB]/10 dark:bg-[#0A4174]/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#0A4174] via-[#2563EB] to-[#4A8CD2] p-0.5 shadow-lg shadow-[#0A4174]/20 flex-shrink-0">
            <div className="w-full h-full rounded-[14px] bg-white/90 dark:bg-[#121E2C]/90 flex items-center justify-center font-black text-xl text-[#0A4174] dark:text-[#4A8CD2]">
              UP
            </div>
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E2EDF8] dark:bg-[#1A2A3D] text-[#0A4174] dark:text-[#4A8CD2] text-xs font-bold mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Universal POS • Water Glass Interface</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#1C2736] dark:text-[#F1F5F9] tracking-tight">
              Store Dashboard
            </h1>
            <p className="text-xs text-[#5A6B82] dark:text-[#94A3B8] mt-0.5">
              Live database metrics, real-time sales velocity, and inventory intelligence.
            </p>
          </div>
        </div>

        {/* Date Filter & Fast Actions */}
        <div className="relative z-10 flex flex-wrap items-center gap-2">
          <div className="water-glass-pill p-1 rounded-2xl flex items-center gap-1">
            {[
              { id: 'all_time', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: '7_days', label: '7 Days' },
              { id: 'this_month', label: 'This Month' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setDateFilter(f.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  dateFilter === f.id
                    ? 'bg-[#0A4174] dark:bg-[#4A8CD2] text-white dark:text-[#0B131E] shadow-sm'
                    : 'text-[#5A6B82] dark:text-[#94A3B8] hover:text-[#0A4174] dark:hover:text-[#4A8CD2]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <Link
            to="/pos"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E] font-bold text-xs shadow-md shadow-[#0A4174]/20 transition-all hover:scale-[1.02] active:scale-95"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Open POS Terminal</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Row 1: 4 Large Water Glass KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Revenue */}
        <div className="water-glass-card p-5 rounded-3xl relative overflow-hidden group hover:scale-[1.01] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5A6B82] dark:text-[#94A3B8]">
              Total Revenue
            </span>
            <div className="w-9 h-9 rounded-2xl bg-[#E2EDF8] dark:bg-[#1A2A3D] text-[#0A4174] dark:text-[#4A8CD2] flex items-center justify-center font-black text-sm shadow-xs">
              ₹
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#1C2736] dark:text-[#F1F5F9] tracking-tight">
              {formatCurrency(totalSalesRevenue, currency)}
            </div>
            <div className={`flex items-center gap-1.5 text-xs font-bold mt-1 ${revenueGrowth.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              <span>{revenueGrowth.isPositive ? '↑' : '↓'} {revenueGrowth.percent}%</span>
              <span className="text-[10px] text-[#5A6B82] dark:text-[#94A3B8] font-normal">vs previous period</span>
            </div>
          </div>
          {/* Dynamic Sparkline curve */}
          <div className="w-full h-8 mt-2">
            <svg viewBox="0 0 100 25" className="w-full h-full">
              <path d={revenueSparkline.fill} fill="rgba(10, 65, 116, 0.12)" />
              <path d={revenueSparkline.line} fill="none" stroke="#0A4174" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* KPI 2: Total Orders / Invoices */}
        <div className="water-glass-card p-5 rounded-3xl relative overflow-hidden group hover:scale-[1.01] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5A6B82] dark:text-[#94A3B8]">
              Total Invoices
            </span>
            <div className="w-9 h-9 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-sm shadow-xs">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#1C2736] dark:text-[#F1F5F9] tracking-tight">
              {filteredInvoices.length}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              <span>{orderStats.completed} Completed</span>
              <span className="text-[10px] text-[#5A6B82] dark:text-[#94A3B8] font-normal">live invoices</span>
            </div>
          </div>
          {/* Dynamic Sparkline curve */}
          <div className="w-full h-8 mt-2">
            <svg viewBox="0 0 100 25" className="w-full h-full">
              <path d={ordersSparkline.fill} fill="rgba(37, 99, 235, 0.12)" />
              <path d={ordersSparkline.line} fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* KPI 3: Total Customers */}
        <div className="water-glass-card p-5 rounded-3xl relative overflow-hidden group hover:scale-[1.01] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5A6B82] dark:text-[#94A3B8]">
              Customers
            </span>
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-sm shadow-xs">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#1C2736] dark:text-[#F1F5F9] tracking-tight">
              {customers.length}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              <span>Active</span>
              <span className="text-[10px] text-[#5A6B82] dark:text-[#94A3B8] font-normal">registered ledger</span>
            </div>
          </div>
          {/* Sparkline curve */}
          <div className="w-full h-8 mt-2">
            <svg viewBox="0 0 100 25" className="w-full h-full">
              <path d="M 0 24 Q 25 20 50 14 T 100 4 L 100 25 L 0 25 Z" fill="rgba(16, 185, 129, 0.12)" />
              <path d="M 0 24 Q 25 20 50 14 T 100 4" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* KPI 4: Active Products */}
        <div className="water-glass-card p-5 rounded-3xl relative overflow-hidden group hover:scale-[1.01] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5A6B82] dark:text-[#94A3B8]">
              Active Products
            </span>
            <div className="w-9 h-9 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black text-sm shadow-xs">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#1C2736] dark:text-[#F1F5F9] tracking-tight">
              {products.length}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 mt-1">
              <span>{outOfStockCount} Out of stock</span>
              <span className="text-[10px] text-[#5A6B82] dark:text-[#94A3B8] font-normal">• Inventory</span>
            </div>
          </div>
          {/* Sparkline curve */}
          <div className="w-full h-8 mt-2">
            <svg viewBox="0 0 100 25" className="w-full h-full">
              <path d="M 0 18 Q 35 22 65 10 T 100 6 L 100 25 L 0 25 Z" fill="rgba(245, 158, 11, 0.12)" />
              <path d="M 0 18 Q 35 22 65 10 T 100 6" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>

      {/* Row 2: Secondary Quick KPI Metrics (Today, Profit, Low stock) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="water-glass-card p-3.5 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-[#5A6B82] dark:text-[#94A3B8] uppercase">Today Sales</div>
            <div className="text-base font-black text-[#1C2736] dark:text-[#F1F5F9] mt-0.5">
              {formatCurrency(summary?.today_sales_total ?? 0, currency)}
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
            Daily POS
          </span>
        </div>

        <div className="water-glass-card p-3.5 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-[#5A6B82] dark:text-[#94A3B8] uppercase">Net Profit</div>
            <div className="text-base font-black text-[#0A4174] dark:text-[#4A8CD2] mt-0.5">
              {formatCurrency(netProfit, currency)}
            </div>
          </div>
          <span className="text-xs font-bold text-[#0A4174] dark:text-[#4A8CD2] bg-[#E2EDF8] dark:bg-[#1A2A3D] px-2 py-0.5 rounded-full">
            Income - Exp
          </span>
        </div>

        <div className="water-glass-card p-3.5 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-[#5A6B82] dark:text-[#94A3B8] uppercase">Total Expense</div>
            <div className="text-base font-black text-rose-500 mt-0.5">
              {formatCurrency(totalExpenseAmount, currency)}
            </div>
          </div>
          <span className="text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full">
            Expenses
          </span>
        </div>

        <div className="water-glass-card p-3.5 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-[#5A6B82] dark:text-[#94A3B8] uppercase">Low Stock Alert</div>
            <div className="text-base font-black text-amber-500 mt-0.5">
              {summary?.low_stock_count ?? 0} Items
            </div>
          </div>
          <span className="text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full">
            Reorder
          </span>
        </div>
      </div>

      {/* Row 3: Sales Overview (50%) + Order Status (25%) + Quick Actions (25%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Sales Overview Line Chart (50% -> 6 cols) */}
        <div className="lg:col-span-6 water-glass-card p-5 rounded-3xl flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-[#DCE5EF] dark:border-[#22354B]">
            <div>
              <h2 className="text-sm font-bold text-[#1C2736] dark:text-[#F1F5F9]">Revenue Velocity</h2>
              <p className="text-[11px] text-[#5A6B82] dark:text-[#94A3B8]">Sales for the last 7 days</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-[#5A6B82] dark:text-[#94A3B8] water-glass-pill px-3 py-1 rounded-full font-semibold">
              <span>Last 7 Days</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* SVG Line Chart */}
          <div className="py-4">
            <div className="w-full h-44 relative">
              <svg viewBox="0 0 450 150" className="w-full h-full overflow-visible">
                {/* Horizontal Guide Lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                  const val = Math.round(ratio * salesChartData.maxVal);
                  const y = 130 - idx * 25;
                  return (
                    <g key={idx}>
                      <line x1="35" y1={y} x2="425" y2={y} stroke="rgba(220, 229, 239, 0.6)" strokeDasharray="3 3" />
                      <text x="5" y={y + 3} fill="#5A6B82" fontSize="9" fontWeight="600">
                        {val >= 1000 ? `₹${(val / 1000).toFixed(1)}k` : `₹${val}`}
                      </text>
                    </g>
                  );
                })}

                {/* Area Gradient & Line */}
                <defs>
                  <linearGradient id="waterBlueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0A4174" stopOpacity="0.30" />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Shaded Area under curve */}
                {salesChartData.days.length > 0 && (
                  <path
                    d={`M 35 130 ${salesChartData.days
                      .map((d, i) => {
                        const x = 50 + i * 55;
                        const y = 130 - (d.total / salesChartData.maxVal) * 100;
                        return `L ${x} ${Math.max(15, y)}`;
                      })
                      .join(' ')} L ${50 + (salesChartData.days.length - 1) * 55} 130 Z`}
                    fill="url(#waterBlueGradient)"
                  />
                )}

                {/* Smooth Curve */}
                <path
                  d={`M ${salesChartData.days
                    .map((d, i) => {
                      const x = 50 + i * 55;
                      const y = 130 - (d.total / salesChartData.maxVal) * 100;
                      return `${i === 0 ? '' : 'L '}${x} ${Math.max(15, y)}`;
                    })
                    .join(' ')}`}
                  fill="none"
                  stroke="#0A4174"
                  strokeWidth="3"
                  strokeLinecap="round"
                />

                {/* Data point dots */}
                {salesChartData.days.map((d, i) => {
                  const x = 50 + i * 55;
                  const y = 130 - (d.total / salesChartData.maxVal) * 100;
                  return (
                    <circle
                      key={d.dateKey}
                      cx={x}
                      cy={Math.max(15, y)}
                      r="4"
                      fill="#0A4174"
                      stroke="#FFFFFF"
                      strokeWidth="2"
                      className="cursor-pointer hover:scale-125 transition-transform"
                    />
                  );
                })}
              </svg>
            </div>

            {/* X-axis date labels */}
            <div className="flex justify-between pl-8 pr-4 text-[10px] text-[#5A6B82] dark:text-[#94A3B8] font-semibold mt-1">
              {salesChartData.days.map((d) => (
                <span key={d.dateKey}>{d.label}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Order Status Donut Chart (25% -> 3 cols) - 100% Dynamic */}
        <div className="lg:col-span-3 water-glass-card p-5 rounded-3xl flex flex-col justify-between">
          <div className="pb-2 border-b border-[#DCE5EF] dark:border-[#22354B]">
            <h2 className="text-sm font-bold text-[#1C2736] dark:text-[#F1F5F9]">Order Status</h2>
          </div>

          {/* Donut Graphic */}
          <div className="flex items-center justify-center py-4 relative">
            <svg viewBox="0 0 120 120" className="w-32 h-32 transform -rotate-90">
              <circle cx="60" cy="60" r="45" fill="none" stroke="rgba(220, 229, 239, 0.4)" strokeWidth="14" />
              
              {/* Completed slice (Royal Blue) */}
              {orderStats.completed > 0 && (
                <circle
                  cx="60"
                  cy="60"
                  r="45"
                  fill="none"
                  stroke="#0A4174"
                  strokeWidth="14"
                  strokeDasharray={orderStats.compDash}
                  strokeDashoffset="0"
                  strokeLinecap="round"
                />
              )}
              {/* Processing slice (Cyan) */}
              {orderStats.processing > 0 && (
                <circle
                  cx="60"
                  cy="60"
                  r="45"
                  fill="none"
                  stroke="#06B6D4"
                  strokeWidth="14"
                  strokeDasharray={orderStats.procDash}
                  strokeDashoffset={orderStats.procOffset}
                  strokeLinecap="round"
                />
              )}
              {/* Pending slice (Amber) */}
              {orderStats.pending > 0 && (
                <circle
                  cx="60"
                  cy="60"
                  r="45"
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="14"
                  strokeDasharray={orderStats.pendDash}
                  strokeDashoffset={orderStats.pendOffset}
                  strokeLinecap="round"
                />
              )}
              {/* Cancelled slice (Rose) */}
              {orderStats.cancelled > 0 && (
                <circle
                  cx="60"
                  cy="60"
                  r="45"
                  fill="none"
                  stroke="#F43F5E"
                  strokeWidth="14"
                  strokeDasharray={orderStats.cancDash}
                  strokeDashoffset={orderStats.cancOffset}
                  strokeLinecap="round"
                />
              )}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-black text-[#1C2736] dark:text-[#F1F5F9] leading-none">
                {orderStats.total}
              </span>
              <span className="text-[9px] text-[#5A6B82] dark:text-[#94A3B8] uppercase font-bold mt-0.5">
                Total Orders
              </span>
            </div>
          </div>

          {/* Status Legend */}
          <div className="space-y-1.5 text-[11px] pt-1 border-t border-[#DCE5EF] dark:border-[#22354B]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0A4174]" />
                <span className="text-[#5A6B82] dark:text-[#94A3B8]">Completed</span>
              </span>
              <span className="font-bold text-[#1C2736] dark:text-[#F1F5F9]">{orderStats.completed}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                <span className="text-[#5A6B82] dark:text-[#94A3B8]">Processing</span>
              </span>
              <span className="font-bold text-[#1C2736] dark:text-[#F1F5F9]">{orderStats.processing}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="text-[#5A6B82] dark:text-[#94A3B8]">Pending</span>
              </span>
              <span className="font-bold text-[#1C2736] dark:text-[#F1F5F9]">{orderStats.pending}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-[#5A6B82] dark:text-[#94A3B8]">Cancelled</span>
              </span>
              <span className="font-bold text-[#1C2736] dark:text-[#F1F5F9]">{orderStats.cancelled}</span>
            </div>
          </div>
        </div>

        {/* Quick Actions (25% -> 3 cols) - Sleek Actions */}
        <div className="lg:col-span-3 water-glass-card p-5 rounded-3xl flex flex-col justify-between">
          <div className="pb-2 border-b border-[#DCE5EF] dark:border-[#22354B]">
            <h2 className="text-sm font-bold text-[#1C2736] dark:text-[#F1F5F9]">Quick Navigation</h2>
          </div>

          <div className="space-y-2 py-1">
            {/* + Add New Product */}
            <Link
              to="/products"
              className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E] text-xs font-bold shadow-md shadow-[#0A4174]/20 transition-all hover:scale-[1.01]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Add New Product</span>
            </Link>

            {/* Manage Orders */}
            <Link
              to="/invoices"
              className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all hover:scale-[1.01]"
            >
              <FileText className="w-4 h-4" />
              <span>Manage Invoices</span>
            </Link>

            {/* View Reports */}
            <Link
              to="/reports"
              className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-bold shadow-md shadow-teal-500/20 transition-all hover:scale-[1.01]"
            >
              <BarChart3 className="w-4 h-4" />
              <span>Store Reports</span>
            </Link>

            {/* Manage Customers */}
            <Link
              to="/customers"
              className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-bold shadow-md shadow-orange-500/20 transition-all hover:scale-[1.01]"
            >
              <Users className="w-4 h-4" />
              <span>Customer Ledgers</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Row 4: Top Products & Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Top Products (6 cols) */}
        <div className="lg:col-span-6 water-glass-card p-5 rounded-3xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#DCE5EF] dark:border-[#22354B]">
            <div>
              <h2 className="text-sm font-bold text-[#1C2736] dark:text-[#F1F5F9]">Top Products</h2>
              <p className="text-[10px] text-[#5A6B82] dark:text-[#94A3B8]">Ranked catalog & sales velocity</p>
            </div>
            <Link to="/products" className="text-xs font-bold text-[#0A4174] dark:text-[#4A8CD2] hover:underline">
              View All
            </Link>
          </div>

          <div className="space-y-2 pt-1">
            {topProducts.length > 0 ? (
              topProducts.map((p, idx) => (
                <div
                  key={p.id}
                  className="p-3 rounded-2xl water-glass-pill flex items-center justify-between hover:bg-[#E2EDF8]/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#E2EDF8] dark:bg-[#1A2A3D] text-[#0A4174] dark:text-[#4A8CD2] flex items-center justify-center font-bold text-xs flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-[#1C2736] dark:text-[#F1F5F9] truncate">
                        {p.name}
                      </div>
                      <div className="text-[10px] text-[#5A6B82] dark:text-[#94A3B8]">
                        Stock: {p.stock_qty} {p.unit_code || 'pcs'} {p.qty_sold > 0 ? `• ${p.qty_sold} sold` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-extrabold text-xs text-[#0A4174] dark:text-[#4A8CD2]">
                      {formatCurrency(p.price || 0, currency)}
                    </div>
                    <div className={`text-[10px] font-bold ${p.stock_qty > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'}`}>
                      {p.stock_qty > 0 ? 'In Stock' : 'Out of Stock'}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-[#5A6B82] dark:text-[#94A3B8]">
                No products found in database
              </div>
            )}
          </div>
        </div>

        {/* Top Categories (3 cols) */}
        <div className="lg:col-span-3 water-glass-card p-5 rounded-3xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#DCE5EF] dark:border-[#22354B]">
            <h2 className="text-sm font-bold text-[#1C2736] dark:text-[#F1F5F9]">Categories</h2>
            <Link to="/master-data?tab=categories" className="text-xs font-bold text-[#0A4174] dark:text-[#4A8CD2] hover:underline">
              View All
            </Link>
          </div>

          <div className="space-y-3 pt-1">
            {topCategories.length > 0 ? (
              topCategories.map((c) => (
                <div key={c.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#1C2736] dark:text-[#F1F5F9]">{c.name}</span>
                    <span className="font-bold text-[#5A6B82]">{c.percent}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#E2EDF8] dark:bg-[#1A2A3D] overflow-hidden">
                    <div
                      style={{ width: `${c.percent}%` }}
                      className="h-full rounded-full bg-[#0A4174] dark:bg-[#4A8CD2]"
                    />
                  </div>
                  <div className="text-[10px] text-[#5A6B82]">{c.count} products</div>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-[#5A6B82]">
                No categories found
              </div>
            )}
          </div>
        </div>

        {/* Recent Invoices / Activity (3 cols) */}
        <div className="lg:col-span-3 water-glass-card p-5 rounded-3xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#DCE5EF] dark:border-[#22354B]">
            <h2 className="text-sm font-bold text-[#1C2736] dark:text-[#F1F5F9]">Recent Activity</h2>
            <Link to="/invoices" className="text-xs font-bold text-[#0A4174] dark:text-[#4A8CD2] hover:underline">
              View All
            </Link>
          </div>

          <div className="space-y-2.5 pt-1 text-xs">
            {filteredInvoices.length > 0 ? (
              filteredInvoices.slice(0, 4).map((inv) => (
                <div key={inv.id || inv.uuid} className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-xl bg-[#E2EDF8] text-[#0A4174] dark:bg-[#1A2A3D] dark:text-[#4A8CD2] flex items-center justify-center flex-shrink-0 mt-0.5">
                    {inv.status === 'cancelled' ? (
                      <XCircle className="w-3.5 h-3.5 text-rose-500" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[#1C2736] dark:text-[#F1F5F9] leading-tight truncate">
                      {inv.status === 'cancelled' ? 'Order cancelled' : 'Invoice generated'}
                    </div>
                    <div className="text-[10px] text-[#5A6B82] dark:text-[#94A3B8] truncate">
                      #{inv.invoice_no || inv.uuid?.slice(0, 8)} - {formatCurrency(inv.grand_total, currency)}
                    </div>
                  </div>
                  <span className="text-[10px] text-[#5A6B82] dark:text-[#94A3B8] flex-shrink-0">
                    {inv.created_at ? new Date(inv.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Recent'}
                  </span>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-[#5A6B82]">
                No recent activity recorded
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
