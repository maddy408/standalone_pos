import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import api from '../config/api';
import { useSettings } from '../hooks/useSettings';
import { useAuth } from '../hooks/useAuth';
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
  Crown,
  Check,
  Plus,
  ClipboardList,
} from 'lucide-react';

export default function Dashboard() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { user, can } = useAuth();
  const currency = settings?.currency_symbol || '₹';

  const [summary, setSummary] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [income, setIncome] = useState([]);
  const [customerPayments, setCustomerPayments] = useState([]);
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
    api.get('/customer-payments').then(({ data }) => setCustomerPayments(Array.isArray(data) ? data : [])).catch(() => {});
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

  const filteredCustomerPayments = useMemo(() => {
    return customerPayments.filter((cp) => isDateInFilter(cp.created_at, dateFilter));
  }, [customerPayments, dateFilter]);

  // Compute metrics from dynamically filtered data:
  // Revenue reflects actual cash collected:
  // 1. Direct invoice paid amounts (excludes unpaid credit balance)
  // 2. Customer credit collection payments received
  const totalSalesRevenue = useMemo(() => {
    const directInvoicePaid = filteredInvoices
      .filter((i) => i.status === 'completed')
      .reduce((sum, i) => sum + Number(i.paid_amount ?? i.grand_total ?? 0), 0);
    const collectionsPaid = filteredCustomerPayments
      .reduce((sum, cp) => sum + Number(cp.amount || 0), 0);
    return directInvoicePaid + collectionsPaid;
  }, [filteredInvoices, filteredCustomerPayments]);

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

  const [revenueExpenseFilter, setRevenueExpenseFilter] = useState('this_month');
  const [animProgress, setAnimProgress] = useState(0);

  // Smooth 0 to target animation on mount / render
  useEffect(() => {
    setAnimProgress(0);
    const duration = 1200; // 1.2s
    const startTime = performance.now();
    let animationFrame;

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const ease = 1 - Math.pow(1 - progress, 3);
      setAnimProgress(ease);
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [dateFilter, revenueExpenseFilter]);

  // Compute 6-point dynamic curve for Revenue & Expense Wave based on selected filter
  const revExpChartData = useMemo(() => {
    // Generate 6 time buckets
    const points = [];
    const now = new Date();
    const isYear = revenueExpenseFilter === 'this_year';
    const isMonth = revenueExpenseFilter === 'this_month';
    const count = 6;

    for (let i = count - 1; i >= 0; i--) {
      let label = '';
      let startD, endD;
      if (isYear) {
        // Last 6 months
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        startD = d;
        endD = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
        label = d.toLocaleDateString('en-US', { month: 'short' });
      } else if (isMonth) {
        // 5-day intervals in month
        const d = new Date(now.getFullYear(), now.getMonth(), 1 + (count - 1 - i) * 5);
        startD = d;
        endD = new Date(now.getFullYear(), now.getMonth(), 1 + (count - 1 - i) * 5 + 4, 23, 59, 59);
        label = `Day ${(count - 1 - i) * 5 + 1}-${Math.min((count - 1 - i) * 5 + 5, 30)}`;
      } else {
        // Last 6 days
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        startD = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
        endD = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
        label = d.toLocaleDateString('en-US', { weekday: 'short' });
      }
      points.push({ label, startD, endD, rev: 0, exp: 0 });
    }

    invoices.forEach((inv) => {
      if (inv.status !== 'completed' || !inv.created_at) return;
      const d = new Date(inv.created_at);
      const amt = Number(inv.paid_amount ?? inv.grand_total ?? 0);
      points.forEach((p) => {
        if (d >= p.startD && d <= p.endD) {
          p.rev += amt;
        }
      });
    });

    customerPayments.forEach((cp) => {
      if (!cp.created_at) return;
      const d = new Date(cp.created_at);
      const amt = Number(cp.amount || 0);
      points.forEach((p) => {
        if (d >= p.startD && d <= p.endD) {
          p.rev += amt;
        }
      });
    });

    expenses.forEach((e) => {
      const dStr = e.expense_date || e.date || e.created_at;
      if (!dStr) return;
      const d = new Date(dStr);
      const amt = Number(e.amount || 0);
      points.forEach((p) => {
        if (d >= p.startD && d <= p.endD) {
          p.exp += amt;
        }
      });
    });

    const maxVal = Math.max(
      ...points.map((p) => p.rev),
      ...points.map((p) => p.exp),
      100
    );

    // Build SVG paths (width: 350, height: 110)
    const stepX = 350 / (count - 1);
    const revCoords = points.map((p, idx) => {
      const x = idx * stepX;
      const y = 95 - (p.rev / maxVal) * 75 * animProgress;
      return { x, y };
    });
    const expCoords = points.map((p, idx) => {
      const x = idx * stepX;
      const y = 95 - (p.exp / maxVal) * 75 * animProgress;
      return { x, y };
    });

    // Helper to create smooth bezier line
    const createSpline = (coords) => {
      if (coords.length === 0) return '';
      let path = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
      for (let i = 0; i < coords.length - 1; i++) {
        const p0 = coords[i];
        const p1 = coords[i + 1];
        const cp1x = p0.x + (p1.x - p0.x) / 2;
        const cp1y = p0.y;
        const cp2x = p0.x + (p1.x - p0.x) / 2;
        const cp2y = p1.y;
        path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
      }
      return path;
    };

    const revLine = createSpline(revCoords);
    const revFill = `${revLine} L 350 110 L 0 110 Z`;
    const expLine = createSpline(expCoords);
    const expFill = `${expLine} L 350 110 L 0 110 Z`;

    const totalRev = points.reduce((s, p) => s + p.rev, 0);
    const totalExp = points.reduce((s, p) => s + p.exp, 0);

    return {
      points,
      maxVal,
      revLine,
      revFill,
      expLine,
      expFill,
      revCoords,
      expCoords,
      totalRev,
      totalExp,
    };
  }, [invoices, customerPayments, expenses, revenueExpenseFilter, animProgress]);
  const orderStats = useMemo(() => {
    const total = filteredInvoices.length;
    const completed = filteredInvoices.filter((i) => i.status === 'completed').length;
    const cancelled = filteredInvoices.filter((i) => i.status === 'cancelled').length;
    const processing = filteredInvoices.filter((i) => i.status === 'processing' || i.status === 'held').length;
    const pending = Math.max(0, total - completed - cancelled - processing);

    // Compute Donut SVG parameters (r = 45 -> circumference ~ 282.74)
    const C = 2 * Math.PI * 45; // ~ 282.74
    const compPct = total > 0 ? (completed / total) * animProgress : 0;
    const procPct = total > 0 ? (processing / total) * animProgress : 0;
    const pendPct = total > 0 ? (pending / total) * animProgress : 0;
    const cancPct = total > 0 ? (cancelled / total) * animProgress : 0;

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
  }, [filteredInvoices, animProgress]);

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
        // Handle ISO string or MySQL 'YYYY-MM-DD HH:MM:SS'
        let key = '';
        try {
          const invDate = new Date(inv.created_at);
          if (!isNaN(invDate.getTime())) {
            const year = invDate.getFullYear();
            const month = String(invDate.getMonth() + 1).padStart(2, '0');
            const day = String(invDate.getDate()).padStart(2, '0');
            key = `${year}-${month}-${day}`;
          }
        } catch {}
        if (!key) {
          key = inv.created_at.split('T')[0] || inv.created_at.split(' ')[0];
        }
        const match = days.find((d) => d.dateKey === key);
        if (match) {
          match.total += Number(inv.paid_amount ?? inv.grand_total ?? 0);
          match.orderCount += 1;
        }
      }
    });

    customerPayments.forEach((cp) => {
      if (cp.created_at) {
        let key = '';
        try {
          const cpDate = new Date(cp.created_at);
          if (!isNaN(cpDate.getTime())) {
            const year = cpDate.getFullYear();
            const month = String(cpDate.getMonth() + 1).padStart(2, '0');
            const day = String(cpDate.getDate()).padStart(2, '0');
            key = `${year}-${month}-${day}`;
          }
        } catch {}
        if (!key) {
          key = cp.created_at.split('T')[0] || cp.created_at.split(' ')[0];
        }
        const match = days.find((d) => d.dateKey === key);
        if (match) {
          match.total += Number(cp.amount || 0);
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
      {/* 3D Modern Glass Hero Banner (Matches Reference Image) */}
      <div className="relative rounded-3xl overflow-hidden shadow-xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border border-white/40 bg-gradient-to-r from-[#2A3B90] via-[#3851B5] via-[#4868D8] to-[#6080EE] text-white">
        {/* Abstract 3D floating orb lights in background */}
        <div className="absolute top-0 right-1/4 w-72 h-72 rounded-full bg-white/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-1/3 w-64 h-64 rounded-full bg-indigo-400/20 blur-2xl pointer-events-none" />

        {/* Left Welcome Content */}
        <div className="relative z-10 max-w-lg space-y-2">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight drop-shadow-sm">
              Welcome back, {user?.full_name || 'Administrator'}!
            </h1>
            <span className="text-2xl animate-bounce">👋</span>
          </div>
          <p className="text-blue-100 text-sm font-medium">
            Here's your store performance overview.
          </p>
          <div className="pt-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-xs font-semibold text-white shadow-xs">
              <Calendar className="w-3.5 h-3.5" />
              <span>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' })}</span>
            </div>
          </div>
        </div>

        {/* Right 3D POS Terminal & Plant & Bags Banner Illustration */}
        <div className="relative z-10 flex-shrink-0 flex items-center justify-end">
          <img
            src="/hero_pos_3d.png"
            alt="3D Store Terminal"
            className="h-28 sm:h-32 object-contain drop-shadow-2xl rounded-xl"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
      </div>

      {/* Row 1: 4 Large 3D Glass KPI Cards (Exact match to reference) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Revenue */}
        <div className="water-glass-card p-5 rounded-3xl relative overflow-hidden group hover:scale-[1.01] transition-all flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] text-white flex items-center justify-center shadow-md shadow-indigo-500/25">
                <TrendingUp className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Total Revenue
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight pt-1">
              {formatCurrency(totalSalesRevenue, currency)}
            </div>
            <div className={`flex items-center gap-1.5 text-xs font-bold ${revenueGrowth.isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
              <span>{revenueGrowth.isPositive ? '↑' : '↓'} {revenueGrowth.percent}%</span>
              <span className="text-[10px] text-slate-400 font-normal">vs previous period</span>
            </div>
          </div>
          <div className="flex-shrink-0 pl-2">
            <img
              src="/kpi_coins_3d.png"
              alt="3D Coins"
              className="w-16 h-16 object-contain drop-shadow-md group-hover:scale-110 transition-transform"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
        </div>

        {/* KPI 2: Total Invoices */}
        <div className="water-glass-card p-5 rounded-3xl relative overflow-hidden group hover:scale-[1.01] transition-all flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#0284C7] to-[#38BDF8] text-white flex items-center justify-center shadow-md shadow-sky-500/25">
                <FileText className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Total Invoices
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight pt-1">
              {filteredInvoices.length}
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-emerald-600">
              <span>↑ {orderStats.completed} Completed</span>
            </div>
          </div>
          <div className="flex-shrink-0 pl-2">
            <img
              src="/kpi_invoice_3d.png"
              alt="3D Invoice"
              className="w-16 h-16 object-contain drop-shadow-md group-hover:scale-110 transition-transform"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
        </div>

        {/* KPI 3: Customers */}
        <div className="water-glass-card p-5 rounded-3xl relative overflow-hidden group hover:scale-[1.01] transition-all flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#10B981] to-[#34D399] text-white flex items-center justify-center shadow-md shadow-emerald-500/25">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Customers
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight pt-1">
              {customers.length}
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-emerald-600">
              <span>↑ Active</span>
            </div>
          </div>
          <div className="flex-shrink-0 pl-2">
            <img
              src="/kpi_customers_3d.png"
              alt="3D Customers"
              className="w-16 h-16 object-contain drop-shadow-md group-hover:scale-110 transition-transform"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
        </div>

        {/* KPI 4: Active Products */}
        <div className="water-glass-card p-5 rounded-3xl relative overflow-hidden group hover:scale-[1.01] transition-all flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#F97316] to-[#FBBF24] text-white flex items-center justify-center shadow-md shadow-orange-500/25">
                <Package className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Active Products
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight pt-1">
              {products.length}
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-amber-600">
              <span>↑ {outOfStockCount} Out of Stock</span>
            </div>
          </div>
          <div className="flex-shrink-0 pl-2">
            <img
              src="/kpi_boxes_3d.png"
              alt="3D Boxes"
              className="w-16 h-16 object-contain drop-shadow-md group-hover:scale-110 transition-transform"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
        </div>
      </div>

      {/* Row 2: Secondary Quick KPI Metrics (Today, Profit, Low stock) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="water-glass-card p-3.5 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-[#5A6B82] dark:text-[#94A3B8] uppercase">Today Sales</div>
            <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
              {formatCurrency(summary?.today_sales_total ?? 0, currency)}
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200/50">
            Daily POS
          </span>
        </div>

        <div className="water-glass-card p-3.5 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-[#5A6B82] dark:text-[#94A3B8] uppercase">Net Profit</div>
            <div className="text-lg font-black text-[#0284C7] dark:text-[#38BDF8] mt-0.5">
              {formatCurrency(netProfit, currency)}
            </div>
          </div>
          <span className="text-xs font-bold text-[#0284C7] dark:text-[#38BDF8] bg-sky-50 dark:bg-sky-950/40 px-2.5 py-1 rounded-full border border-sky-200/50">
            Income - Exp
          </span>
        </div>

        <div className="water-glass-card p-3.5 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-[#5A6B82] dark:text-[#94A3B8] uppercase">Total Expense</div>
            <div className="text-lg font-black text-rose-500 mt-0.5">
              {formatCurrency(totalExpenseAmount, currency)}
            </div>
          </div>
          <span className="text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-full border border-rose-200/50">
            Expenses
          </span>
        </div>

        <div className="water-glass-card p-3.5 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-[#5A6B82] dark:text-[#94A3B8] uppercase">Low Stock Alert</div>
            <div className="text-lg font-black text-amber-500 mt-0.5">
              {summary?.low_stock_count ?? 0} Items
            </div>
          </div>
          <span className="text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full border border-amber-200/50">
            Reorder
          </span>
        </div>
      </div>

      {/* Row 3: Sales Overview (50%) + Order Status (25%) + Quick Actions (25%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Sales Overview Line Chart (50% -> 6 cols) */}
        <div className="lg:col-span-6 water-glass-card p-5 rounded-3xl flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-[#DCE5EF] dark:border-[#22354B]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/40 text-[#7C3AED] flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#1C2736] dark:text-[#F1F5F9]">Sales Overview</h2>
              </div>
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
                      <line x1="35" y1={y} x2="425" y2={y} stroke="rgba(220, 229, 239, 0.5)" strokeDasharray="3 3" />
                      <text x="5" y={y + 3} fill="#94A3B8" fontSize="9" fontWeight="600">
                        {val >= 1000 ? `₹${(val / 1000).toFixed(1)}k` : `₹${val}`}
                      </text>
                    </g>
                  );
                })}

                {/* Area Gradient & Line */}
                <defs>
                  <linearGradient id="purpleAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.25" />
                    <stop offset="80%" stopColor="#A855F7" stopOpacity="0.05" />
                    <stop offset="100%" stopColor="#C084FC" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="purpleCurveStroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#6366F1" />
                    <stop offset="50%" stopColor="#7C3AED" />
                    <stop offset="100%" stopColor="#8B5CF6" />
                  </linearGradient>
                </defs>

                {/* Shaded Area under curve */}
                {salesChartData.days.length > 0 && (
                  <path
                    d={`M 50 130 ${salesChartData.days
                      .map((d, i) => {
                        const x = 50 + i * 55;
                        const y = 130 - (d.total / salesChartData.maxVal) * 100;
                        return `L ${x} ${Math.max(15, y)}`;
                      })
                      .join(' ')} L ${50 + (salesChartData.days.length - 1) * 55} 130 Z`}
                    fill="url(#purpleAreaGradient)"
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
                  stroke="url(#purpleCurveStroke)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />

                {/* Data point dots */}
                {salesChartData.days.map((d, i) => {
                  const x = 50 + i * 55;
                  const y = 130 - (d.total / salesChartData.maxVal) * 100;
                  return (
                    <g key={d.dateKey} className="group/dot cursor-pointer">
                      <circle
                        cx={x}
                        cy={Math.max(15, y)}
                        r="5"
                        fill="#7C3AED"
                        stroke="#FFFFFF"
                        strokeWidth="2.5"
                        className="transition-transform group-hover/dot:scale-150"
                      />
                      {d.total > 0 && (
                        <text
                          x={x}
                          y={Math.max(15, y) - 8}
                          textAnchor="middle"
                          fill="#7C3AED"
                          fontSize="9"
                          fontWeight="700"
                        >
                          ₹{d.total}
                        </text>
                      )}
                    </g>
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
          <div className="pb-2 border-b border-[#DCE5EF] dark:border-[#22354B] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/40 text-[#2563EB] flex items-center justify-center">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-[#1C2736] dark:text-[#F1F5F9]">Order Status</h2>
            </div>
          </div>

          {/* Donut Graphic */}
          <div className="flex items-center justify-center py-4 relative">
            <svg viewBox="0 0 120 120" className="w-32 h-32 transform -rotate-90">
              <circle cx="60" cy="60" r="45" fill="none" stroke="rgba(220, 229, 239, 0.4)" strokeWidth="14" />
              
              {/* Completed slice (Vibrant Royal Blue) */}
              {orderStats.completed > 0 && (
                <circle
                  cx="60"
                  cy="60"
                  r="45"
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="14"
                  strokeDasharray={orderStats.compDash}
                  strokeDashoffset="0"
                  strokeLinecap="round"
                />
              )}
              {/* Processing slice (Amber) */}
              {orderStats.processing > 0 && (
                <circle
                  cx="60"
                  cy="60"
                  r="45"
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="14"
                  strokeDasharray={orderStats.procDash}
                  strokeDashoffset={orderStats.procOffset}
                  strokeLinecap="round"
                />
              )}
              {/* Pending slice (Emerald) */}
              {orderStats.pending > 0 && (
                <circle
                  cx="60"
                  cy="60"
                  r="45"
                  fill="none"
                  stroke="#10B981"
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
                <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
                <span className="text-[#5A6B82] dark:text-[#94A3B8]">Completed</span>
              </span>
              <span className="font-bold text-[#1C2736] dark:text-[#F1F5F9]">{orderStats.completed}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-[#5A6B82] dark:text-[#94A3B8]">Processing</span>
              </span>
              <span className="font-bold text-[#1C2736] dark:text-[#F1F5F9]">{orderStats.processing}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
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

        {/* Quick Actions (25% -> 3 cols) - 2x2 Grid exactly like reference */}
        <div className="lg:col-span-3 water-glass-card p-5 rounded-3xl flex flex-col justify-between">
          <div className="pb-2 border-b border-[#DCE5EF] dark:border-[#22354B] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/40 text-[#7C3AED] flex items-center justify-center">
                <Zap className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-[#1C2736] dark:text-[#F1F5F9]">Quick Navigation</h2>
            </div>
            <Link to="/products" className="text-[11px] font-bold text-[#4F46E5] hover:underline flex items-center gap-0.5">
              <span>View All</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-2.5 py-2">
            {/* 1. Add New Product (Vibrant Blue Card) */}
            <Link
              to="/products"
              className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#2563EB] text-white shadow-md shadow-blue-500/25 transition-all hover:scale-[1.03] active:scale-95 text-center group"
            >
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center mb-1.5">
                <PlusCircle className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-extrabold leading-tight">Add New Product</span>
            </Link>

            {/* 2. Manage Invoices (Vibrant Purple Card) */}
            <Link
              to="/invoices"
              className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] text-white shadow-md shadow-purple-500/25 transition-all hover:scale-[1.03] active:scale-95 text-center group"
            >
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center mb-1.5">
                <FileText className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-extrabold leading-tight">Manage Invoices</span>
            </Link>

            {/* 3. Store Reports (Vibrant Green Card) */}
            <Link
              to="/reports"
              className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-gradient-to-br from-[#10B981] to-[#059669] text-white shadow-md shadow-emerald-500/25 transition-all hover:scale-[1.03] active:scale-95 text-center group"
            >
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center mb-1.5">
                <BarChart3 className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-extrabold leading-tight">Store Reports</span>
            </Link>

            {/* 4. Customer Ledgers (Vibrant Orange Card) */}
            <Link
              to="/customers"
              className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-gradient-to-br from-[#F97316] to-[#EA580C] text-white shadow-md shadow-orange-500/25 transition-all hover:scale-[1.03] active:scale-95 text-center group"
            >
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center mb-1.5">
                <Users className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-extrabold leading-tight">Customer Ledgers</span>
            </Link>

            {/* 5. New Order (Vibrant Teal Card) */}
            {can('orders.view') && (
              <Link
                to="/orders"
                className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-gradient-to-br from-[#14B8A6] to-[#0D9488] text-white shadow-md shadow-teal-500/25 transition-all hover:scale-[1.03] active:scale-95 text-center group"
              >
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center mb-1.5">
                  <ClipboardList className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-extrabold leading-tight">New Order</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Row 4: Top Products (4 cols) + Revenue & Expense Graph (5 cols) + Recent Activity (3 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 1. Top Products (4 cols) */}
        <div className="lg:col-span-4 water-glass-card p-5 rounded-3xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#DCE5EF] dark:border-[#22354B]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/40 text-[#F59E0B] flex items-center justify-center">
                <Crown className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-[#1C2736] dark:text-[#F1F5F9]">Top Products</h2>
            </div>
            <Link to="/products" className="text-xs font-bold text-[#0A4174] dark:text-[#4A8CD2] hover:underline flex items-center gap-0.5">
              <span>View All</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-2.5 pt-1">
            {topProducts.length > 0 ? (
              topProducts.slice(0, 3).map((p, idx) => (
                <div
                  key={p.id}
                  className="p-2.5 rounded-2xl bg-white/70 dark:bg-[#121E2C]/70 border border-[#DCE5EF]/60 flex items-center justify-between hover:bg-white transition-all shadow-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-400 to-orange-500 text-white flex items-center justify-center font-black text-sm flex-shrink-0 shadow-md shadow-orange-500/20">
                      {idx === 0 ? '🍗' : idx === 1 ? '📱' : '🧃'}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-[#1C2736] dark:text-[#F1F5F9] truncate">
                        {p.name}
                      </div>
                      <div className="text-[10px] text-[#5A6B82] dark:text-[#94A3B8]">
                        Stock: {p.stock_qty} {p.unit_code || 'pcs'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-black text-xs text-[#059669]">
                      {formatCurrency(p.price || 0, currency)}
                    </div>
                    <span className="inline-block text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded-full">
                      In Stock
                    </span>
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

        {/* 2. Revenue & Expense Analytics (5 cols) - Fully Dynamic */}
        <div className="lg:col-span-5 water-glass-card p-5 rounded-3xl flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-[#DCE5EF] dark:border-[#22354B]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950/40 text-[#4F46E5] flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#1C2736] dark:text-[#F1F5F9]">Revenue & Expense</h2>
                <div className="text-[10px] text-[#5A6B82] dark:text-[#94A3B8]">
                  Real-time income vs expense trend
                </div>
              </div>
            </div>
            <select
              value={revenueExpenseFilter}
              onChange={(e) => setRevenueExpenseFilter(e.target.value)}
              className="text-[11px] text-[#0A4174] dark:text-[#4A8CD2] bg-white/80 dark:bg-[#121E2C]/80 border border-[#DCE5EF] dark:border-[#22354B] rounded-xl px-2.5 py-1 font-bold focus:outline-none cursor-pointer shadow-2xs"
            >
              <option value="this_week">Last 6 Days</option>
              <option value="this_month">This Month</option>
              <option value="this_year">Last 6 Months</option>
            </select>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0284C7] shadow-sm" />
                <span className="text-[#5A6B82] dark:text-[#94A3B8]">
                  Revenue: <strong className="text-[#0284C7] font-bold">{formatCurrency(revExpChartData.totalRev, currency)}</strong>
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] shadow-sm" />
                <span className="text-[#5A6B82] dark:text-[#94A3B8]">
                  Expense: <strong className="text-amber-600 font-bold">{formatCurrency(revExpChartData.totalExp, currency)}</strong>
                </span>
              </span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-200">
              {Math.round(animProgress * 100)}%
            </span>
          </div>

          {/* Dual Smooth Area Waves SVG - Fully Dynamic with 0 to 100% Anim */}
          <div className="py-2">
            <div className="w-full h-32 relative">
              <svg viewBox="0 0 350 110" className="w-full h-full overflow-visible">
                <defs>
                  <linearGradient id="revGradWave" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0284C7" stopOpacity="0.40" />
                    <stop offset="100%" stopColor="#0284C7" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="expGradWave" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Guide Lines */}
                <line x1="0" y1="20" x2="350" y2="20" stroke="rgba(220, 229, 239, 0.4)" strokeDasharray="3 3" />
                <line x1="0" y1="60" x2="350" y2="60" stroke="rgba(220, 229, 239, 0.4)" strokeDasharray="3 3" />
                <line x1="0" y1="95" x2="350" y2="95" stroke="rgba(220, 229, 239, 0.6)" />

                {/* Revenue Wave Fill & Stroke */}
                {revExpChartData.revFill && (
                  <path d={revExpChartData.revFill} fill="url(#revGradWave)" />
                )}
                {revExpChartData.revLine && (
                  <path
                    d={revExpChartData.revLine}
                    fill="none"
                    stroke="#0284C7"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                )}

                {/* Expense Wave Fill & Stroke */}
                {revExpChartData.expFill && (
                  <path d={revExpChartData.expFill} fill="url(#expGradWave)" />
                )}
                {revExpChartData.expLine && (
                  <path
                    d={revExpChartData.expLine}
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                )}

                {/* Dots on Curves */}
                {revExpChartData.revCoords.map((c, i) => (
                  <circle
                    key={`r-${i}`}
                    cx={c.x}
                    cy={c.y}
                    r="3.5"
                    fill="#0284C7"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                  />
                ))}
                {revExpChartData.expCoords.map((c, i) => (
                  <circle
                    key={`e-${i}`}
                    cx={c.x}
                    cy={c.y}
                    r="3"
                    fill="#F59E0B"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                  />
                ))}
              </svg>
            </div>

            {/* X-axis date labels */}
            <div className="flex justify-between text-[10px] text-[#5A6B82] dark:text-[#94A3B8] font-semibold mt-1 px-1">
              {revExpChartData.points.map((p, idx) => (
                <span key={idx} className="truncate max-w-[50px] text-center">
                  {p.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 3. Recent Activity (3 cols) */}
        <div className="lg:col-span-3 water-glass-card p-5 rounded-3xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#DCE5EF] dark:border-[#22354B]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/40 text-[#7C3AED] flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-[#1C2736] dark:text-[#F1F5F9]">Recent Activity</h2>
            </div>
            <Link to="/invoices" className="text-xs font-bold text-[#0A4174] dark:text-[#4A8CD2] hover:underline flex items-center gap-0.5">
              <span>View All</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-3 pt-1 text-xs">
            {filteredInvoices.length > 0 ? (
              filteredInvoices.slice(0, 3).map((inv, idx) => (
                <div key={inv.id || inv.uuid} className="flex items-start gap-2.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-white ${idx === 0 ? 'bg-emerald-500' : 'bg-blue-500'}`}>
                    {idx === 0 ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[#1C2736] dark:text-[#F1F5F9] leading-tight truncate">
                      {idx === 0 ? 'Invoice generated' : 'New invoice billed'}
                    </div>
                    <div className="text-[10px] text-[#5A6B82] dark:text-[#94A3B8] truncate">
                      #{inv.invoice_no || inv.uuid?.slice(0, 8)}
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 flex-shrink-0">
                    {idx === 0 ? '2 mins ago' : `${(idx + 1) * 6} mins ago`}
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
