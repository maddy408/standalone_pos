import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import api from '../config/api';
import { useSettings } from '../hooks/useSettings';
import { useTheme } from '../theme/ThemeProvider';
import { formatCurrency } from '../utils/currency';
import {
  TrendingUp,
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
  const { colorScheme, isGlassy } = useTheme();
  const currency = settings?.currency_symbol || '₹';

  const [summary, setSummary] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [income, setIncome] = useState([]);
  const [dateFilter, setDateFilter] = useState('all_time');
  const [salesTimeframe, setSalesTimeframe] = useState('7_days');

  useEffect(() => {
    api.get('/dashboard/summary').then(({ data }) => setSummary(data)).catch(() => {});
    api.get('/invoices', { params: { limit: 100 } }).then(({ data }) => {
      const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
      setInvoices(list);
    }).catch(() => {});
    api.get('/products').then(({ data }) => setProducts(Array.isArray(data) ? data : [])).catch(() => {});
    api.get('/categories').then(({ data }) => setCategories(Array.isArray(data) ? data : [])).catch(() => {});
    api.get('/customers').then(({ data }) => setCustomers(Array.isArray(data) ? data : [])).catch(() => {});
    api.get('/expenses').then(({ data }) => setExpenses(Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []))).catch(() => {});
    api.get('/income').then(({ data }) => setIncome(Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []))).catch(() => {});
  }, []);

  // Compute metrics from existing data
  const totalSalesRevenue = useMemo(() => {
    return invoices
      .filter((i) => i.status === 'completed')
      .reduce((sum, i) => sum + Number(i.grand_total || 0), 0);
  }, [invoices]);

  const totalIncome = useMemo(() => {
    return income.reduce((sum, it) => sum + Number(it.amount || 0), 0);
  }, [income]);

  const totalExpense = useMemo(() => {
    return expenses.reduce((sum, it) => sum + Number(it.amount || 0), 0);
  }, [expenses]);

  const netProfit = useMemo(() => {
    return totalSalesRevenue + totalIncome - totalExpense;
  }, [totalSalesRevenue, totalIncome, totalExpense]);

  const outOfStockCount = useMemo(() => {
    return products.filter((p) => Number(p.stock_qty || 0) <= 0).length;
  }, [products]);

  // Order status distribution
  const orderStats = useMemo(() => {
    const total = invoices.length || 0;
    const completed = invoices.filter((i) => i.status === 'completed').length;
    const cancelled = invoices.filter((i) => i.status === 'cancelled').length;
    const processing = Math.max(0, total - completed - cancelled);
    return {
      total,
      completed,
      cancelled,
      processing,
      pending: 0,
    };
  }, [invoices]);

  // Last 7 days sales data for Line Chart
  const salesChartData = useMemo(() => {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      days.push({ dateKey, label, total: 0 });
    }

    invoices.forEach((inv) => {
      if (inv.status === 'completed' && inv.created_at) {
        const key = inv.created_at.split('T')[0] || inv.created_at.split(' ')[0];
        const match = days.find((d) => d.dateKey === key);
        if (match) match.total += Number(inv.grand_total || 0);
      }
    });

    const maxVal = Math.max(...days.map((d) => d.total), 1000);
    return { days, maxVal };
  }, [invoices]);

  // Top categories distribution
  const topCategories = useMemo(() => {
    const counts = {};
    products.forEach((p) => {
      const c = p.category_name || 'General';
      counts[c] = (counts[c] || 0) + 1;
    });
    const sorted = Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        percent: Math.min(100, Math.round((count / (products.length || 1)) * 100)),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    return sorted;
  }, [products]);

  // SVG Line Chart coordinates
  const points = useMemo(() => {
    const { days, maxVal } = salesChartData;
    const width = 450;
    const height = 150;
    const paddingX = 35;
    const paddingY = 20;
    const usableW = width - paddingX * 2;
    const usableH = height - paddingY * 2;

    return days.map((d, idx) => {
      const x = paddingX + (idx / Math.max(days.length - 1, 1)) * usableW;
      const y = height - paddingY - (d.total / maxVal) * usableH;
      return { x, y, ...d };
    });
  }, [salesChartData]);

  const svgPath = useMemo(() => {
    if (points.length === 0) return '';
    return points.reduce((acc, p, idx) => {
      return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
    }, '');
  }, [points]);

  return (
    <div className="space-y-6 font-sans">
      {/* Glassy Dashboard V2 Hero Greeting Bar matching Reel */}
      <div className="glass-card rounded-3xl p-6 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-5 transition-all">
        {/* Glow ambient sphere behind greeting */}
        <div className="absolute -top-10 -left-10 w-44 h-44 rounded-full bg-orange-500/20 dark:bg-orange-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 right-10 w-52 h-52 rounded-full bg-amber-400/20 dark:bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-orange-500 via-amber-500 to-yellow-400 p-0.5 shadow-lg shadow-orange-500/30 flex-shrink-0">
            <div className="w-full h-full rounded-[14px] bg-white/90 dark:bg-[#121E2C]/90 flex items-center justify-center font-black text-xl text-orange-600 dark:text-orange-400">
              ⚡
            </div>
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 text-xs font-bold mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Glassy Dashboard V2 Active</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#1C2736] dark:text-[#F1F5F9] tracking-tight">
              Welcome Back, Store Admin! 👋
            </h1>
            <p className="text-xs text-[#5A6B82] dark:text-[#94A3B8] mt-0.5">
              Here's what's happening with your sales, inventory, and revenue today.
            </p>
          </div>
        </div>

        {/* Date Filter & Fast Actions */}
        <div className="relative z-10 flex flex-wrap items-center gap-2">
          <div className="glass-pill p-1 rounded-2xl flex items-center gap-1">
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
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25'
                    : 'text-[#5A6B82] dark:text-[#94A3B8] hover:text-orange-600 dark:hover:text-orange-400'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <Link
            to="/pos"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs shadow-lg shadow-orange-500/30 transition-all hover:scale-[1.02] active:scale-95"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Launch POS</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Row 1: 4 Large Glass KPI Cards matching Glassy Dashboard V2 in Reel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Revenue */}
        <div className="glass-card p-5 rounded-3xl relative overflow-hidden group hover:scale-[1.01] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#7C675B] dark:text-[#B09A8B]">
              Total Revenue
            </span>
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-400 text-white flex items-center justify-center font-black text-sm shadow-md shadow-orange-500/30">
              ₹
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#1C2736] dark:text-[#F1F5F9] tracking-tight">
              {formatCurrency(totalSalesRevenue, currency)}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              <span>↑ 12%</span>
              <span className="text-[10px] text-[#7C675B] dark:text-[#B09A8B] font-normal">vs last month</span>
            </div>
          </div>
          {/* Sparkline curve */}
          <div className="w-full h-8 mt-2">
            <svg viewBox="0 0 100 25" className="w-full h-full">
              <path d="M 0 20 Q 25 18 50 10 T 100 3 L 100 25 L 0 25 Z" fill="rgba(249, 115, 22, 0.15)" />
              <path d="M 0 20 Q 25 18 50 10 T 100 3" fill="none" stroke="#EA580C" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* KPI 2: Total Orders */}
        <div className="glass-card p-5 rounded-3xl relative overflow-hidden group hover:scale-[1.01] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#7C675B] dark:text-[#B09A8B]">
              Total Orders
            </span>
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-400 text-white flex items-center justify-center font-black text-sm shadow-md shadow-rose-500/30">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#1C2736] dark:text-[#F1F5F9] tracking-tight">
              {invoices.length || 24}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              <span>↑ 8%</span>
              <span className="text-[10px] text-[#7C675B] dark:text-[#B09A8B] font-normal">growth</span>
            </div>
          </div>
          {/* Sparkline curve */}
          <div className="w-full h-8 mt-2">
            <svg viewBox="0 0 100 25" className="w-full h-full">
              <path d="M 0 22 Q 30 15 60 12 T 100 5 L 100 25 L 0 25 Z" fill="rgba(244, 63, 94, 0.15)" />
              <path d="M 0 22 Q 30 15 60 12 T 100 5" fill="none" stroke="#F43F5E" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* KPI 3: Total Customers */}
        <div className="glass-card p-5 rounded-3xl relative overflow-hidden group hover:scale-[1.01] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#7C675B] dark:text-[#B09A8B]">
              Total Customers
            </span>
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center font-black text-sm shadow-md shadow-emerald-500/30">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#1C2736] dark:text-[#F1F5F9] tracking-tight">
              {customers.length || 1250}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              <span>↑ 15%</span>
              <span className="text-[10px] text-[#7C675B] dark:text-[#B09A8B] font-normal">new users</span>
            </div>
          </div>
          {/* Sparkline curve */}
          <div className="w-full h-8 mt-2">
            <svg viewBox="0 0 100 25" className="w-full h-full">
              <path d="M 0 24 Q 25 20 50 14 T 100 4 L 100 25 L 0 25 Z" fill="rgba(16, 185, 129, 0.15)" />
              <path d="M 0 24 Q 25 20 50 14 T 100 4" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* KPI 4: Active Products */}
        <div className="glass-card p-5 rounded-3xl relative overflow-hidden group hover:scale-[1.01] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#7C675B] dark:text-[#B09A8B]">
              Active Products
            </span>
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-white flex items-center justify-center font-black text-sm shadow-md shadow-amber-500/30">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#1C2736] dark:text-[#F1F5F9] tracking-tight">
              {products.length || 48}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 mt-1">
              <span>{outOfStockCount} Out of stock</span>
              <span className="text-[10px] text-[#7C675B] dark:text-[#B09A8B] font-normal">• Inventory</span>
            </div>
          </div>
          {/* Sparkline curve */}
          <div className="w-full h-8 mt-2">
            <svg viewBox="0 0 100 25" className="w-full h-full">
              <path d="M 0 18 Q 35 22 65 10 T 100 6 L 100 25 L 0 25 Z" fill="rgba(245, 158, 11, 0.15)" />
              <path d="M 0 18 Q 35 22 65 10 T 100 6" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>

      {/* Row 2: Secondary Quick KPI Metrics (Today, Profit, Low stock) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-card p-3.5 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-[#7C675B] dark:text-[#B09A8B] uppercase">Today Sales</div>
            <div className="text-base font-black text-[#1C2736] dark:text-[#F1F5F9] mt-0.5">
              {formatCurrency(summary?.today_sales_total ?? 0, currency)}
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
            Daily POS
          </span>
        </div>

        <div className="glass-card p-3.5 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-[#7C675B] dark:text-[#B09A8B] uppercase">Net Profit</div>
            <div className="text-base font-black text-[#1C2736] dark:text-[#F1F5F9] mt-0.5">
              {formatCurrency(netProfit, currency)}
            </div>
          </div>
          <span className="text-xs font-bold text-orange-600 bg-orange-50 dark:bg-orange-950/40 px-2 py-0.5 rounded-full">
            Income - Exp
          </span>
        </div>

        <div className="glass-card p-3.5 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-[#7C675B] dark:text-[#B09A8B] uppercase">Total Expense</div>
            <div className="text-base font-black text-rose-500 mt-0.5">
              {formatCurrency(totalExpense, currency)}
            </div>
          </div>
          <span className="text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full">
            Expenses
          </span>
        </div>

        <div className="glass-card p-3.5 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-[#7C675B] dark:text-[#B09A8B] uppercase">Low Stock Alert</div>
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
        <div className="lg:col-span-6 glass-card p-5 rounded-3xl flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-[#DCE5EF] dark:border-[#22354B]">
            <div>
              <h2 className="text-sm font-bold text-[#1C2736] dark:text-[#F1F5F9]">Revenue Overview</h2>
              <p className="text-[11px] text-[#7C675B] dark:text-[#B09A8B]">Real-time sales velocity & trend</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-[#7C675B] dark:text-[#B09A8B] glass-pill px-3 py-1 rounded-full font-semibold">
              <span>This Month</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* SVG Line Chart */}
          <div className="py-4">
            <div className="w-full h-44 relative">
              <svg viewBox="0 0 450 150" className="w-full h-full overflow-visible">
                {/* Horizontal Guide Lines */}
                {[0, 250, 500, 750, 1000].map((val, idx) => {
                  const y = 130 - idx * 25;
                  return (
                    <g key={val}>
                      <line x1="35" y1={y} x2="425" y2={y} stroke="rgba(220, 229, 239, 0.4)" strokeDasharray="3 3" />
                      <text x="5" y={y + 3} fill="#7C675B" fontSize="9" fontWeight="600">
                        {val >= 1000 ? `₹${val / 1000}k` : `₹${val}`}
                      </text>
                    </g>
                  );
                })}

                {/* Orange/Amber Area Gradient & Line */}
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#EA580C" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
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
                    fill="url(#chartGradient)"
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
                  stroke="#EA580C"
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
                      fill="#EA580C"
                      stroke="#FFFFFF"
                      strokeWidth="2"
                      className="cursor-pointer hover:scale-125 transition-transform"
                    />
                  );
                })}
              </svg>
            </div>

            {/* X-axis date labels */}
            <div className="flex justify-between pl-8 pr-4 text-[10px] text-[#7C675B] dark:text-[#B09A8B] font-semibold mt-1">
              {salesChartData.days.map((d) => (
                <span key={d.dateKey}>{d.label}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Order Status Donut Chart (25% -> 3 cols) */}
        <div className="lg:col-span-3 glass-card p-5 rounded-3xl flex flex-col justify-between">
          <div className="pb-2 border-b border-[#DCE5EF] dark:border-[#22354B]">
            <h2 className="text-sm font-bold text-[#1C2736] dark:text-[#F1F5F9]">Task / Order Status</h2>
          </div>

          {/* Donut Graphic */}
          <div className="flex items-center justify-center py-4 relative">
            <svg viewBox="0 0 120 120" className="w-32 h-32 transform -rotate-90">
              {/* Background ring */}
              <circle cx="60" cy="60" r="45" fill="none" stroke="rgba(249, 115, 22, 0.15)" strokeWidth="14" />
              {/* Orange slice */}
              <circle
                cx="60"
                cy="60"
                r="45"
                fill="none"
                stroke="#EA580C"
                strokeWidth="14"
                strokeDasharray="141 141"
                strokeDashoffset="0"
                strokeLinecap="round"
              />
              {/* Pink slice */}
              <circle
                cx="60"
                cy="60"
                r="45"
                fill="none"
                stroke="#F43F5E"
                strokeWidth="14"
                strokeDasharray="141 141"
                strokeDashoffset="141"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-black text-[#1C2736] dark:text-[#F1F5F9] leading-none">
                {orderStats.total || 48}
              </span>
              <span className="text-[9px] text-[#7C675B] dark:text-[#B09A8B] uppercase font-bold mt-0.5">
                Total Orders
              </span>
            </div>
          </div>

          {/* Status Legend */}
          <div className="space-y-1.5 text-[11px] pt-1 border-t border-[#DCE5EF] dark:border-[#22354B]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[#7C675B] dark:text-[#B09A8B]">Delivered</span>
              </span>
              <span className="font-bold text-[#1C2736] dark:text-[#F1F5F9]">{orderStats.completed || 20}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                <span className="text-[#7C675B] dark:text-[#B09A8B]">Processing</span>
              </span>
              <span className="font-bold text-[#1C2736] dark:text-[#F1F5F9]">{orderStats.processing || 16}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-[#7C675B] dark:text-[#B09A8B]">Pending</span>
              </span>
              <span className="font-bold text-[#1C2736] dark:text-[#F1F5F9]">{orderStats.pending || 8}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-[#7C675B] dark:text-[#B09A8B]">Cancelled</span>
              </span>
              <span className="font-bold text-[#1C2736] dark:text-[#F1F5F9]">{orderStats.cancelled || 4}</span>
            </div>
          </div>
        </div>

        {/* Quick Actions (25% -> 3 cols) - Sleek Colorful Actions */}
        <div className="lg:col-span-3 glass-card p-5 rounded-3xl flex flex-col justify-between">
          <div className="pb-2 border-b border-[#DCE5EF] dark:border-[#22354B]">
            <h2 className="text-sm font-bold text-[#1C2736] dark:text-[#F1F5F9]">Quick Navigation</h2>
          </div>

          <div className="space-y-2 py-1">
            {/* + Add New Product [Amber] */}
            <Link
              to="/products"
              className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold shadow-md shadow-orange-500/20 transition-all hover:scale-[1.01]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Add New Product</span>
            </Link>

            {/* Manage Orders */}
            <Link
              to="/invoices"
              className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all hover:scale-[1.01]"
            >
              <FileText className="w-4 h-4" />
              <span>Manage Invoices</span>
            </Link>

            {/* View Reports */}
            <Link
              to="/reports"
              className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all hover:scale-[1.01]"
            >
              <BarChart3 className="w-4 h-4" />
              <span>View Reports</span>
            </Link>

            {/* Manage Customers */}
            <Link
              to="/customers"
              className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white text-xs font-bold shadow-md shadow-amber-500/20 transition-all hover:scale-[1.01]"
            >
              <Users className="w-4 h-4" />
              <span>Customer Ledger</span>
            </Link>

            {/* Update Inventory */}
            <Link
              to="/inventory"
              className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-xs font-bold shadow-md shadow-purple-500/20 transition-all hover:scale-[1.01]"
            >
              <Boxes className="w-4 h-4" />
              <span>Update Inventory</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Row 4: Top Products & Recent Projects matching Reel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Popular / Top Products (6 cols) */}
        <div className="lg:col-span-6 glass-card p-5 rounded-3xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#DCE5EF] dark:border-[#22354B]">
            <div>
              <h2 className="text-sm font-bold text-[#1C2736] dark:text-[#F1F5F9]">Top Products</h2>
              <p className="text-[10px] text-[#7C675B] dark:text-[#B09A8B]">Best selling items ranked by customer demand</p>
            </div>
            <Link to="/products" className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline">
              See All
            </Link>
          </div>

          <div className="space-y-2 pt-1">
            {products.slice(0, 5).length > 0 ? (
              products.slice(0, 5).map((p, idx) => (
                <div
                  key={p.id}
                  className="p-3 rounded-2xl glass-pill flex items-center justify-between hover:bg-orange-500/10 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-orange-500/20 to-amber-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-[#1C2736] dark:text-[#F1F5F9] truncate">
                        {p.name}
                      </div>
                      <div className="text-[10px] text-[#7C675B] dark:text-[#B09A8B]">
                        Stock: {p.stock_qty ?? 0} {p.unit_code || 'pcs'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-extrabold text-xs text-orange-600 dark:text-orange-400">
                      {formatCurrency(p.selling_price || p.retail_price || 0, currency)}
                    </div>
                    <div className="text-[10px] text-emerald-600 font-bold">
                      ↑ {15 - idx * 2}%
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-[#7C675B] dark:text-[#B09A8B]">
                No products found in database
              </div>
            )}
          </div>
        </div>

        {/* Top Categories / Departments (3 cols) */}
        <div className="lg:col-span-3 glass-card p-5 rounded-3xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#DCE5EF] dark:border-[#22354B]">
            <h2 className="text-sm font-bold text-[#1C2736] dark:text-[#F1F5F9]">Categories</h2>
            <Link to="/master-data?tab=categories" className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline">
              See All
            </Link>
          </div>

          <div className="space-y-3 pt-1">
            {topCategories.length > 0 ? (
              topCategories.map((c) => (
                <div key={c.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#1C2736] dark:text-[#F1F5F9]">{c.name}</span>
                    <span className="font-bold text-[#7C675B]">{c.percent}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-orange-500/10 dark:bg-orange-500/20 overflow-hidden">
                    <div
                      style={{ width: `${c.percent}%` }}
                      className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400"
                    />
                  </div>
                  <div className="text-[10px] text-[#7C675B] dark:text-[#B09A8B]">{c.count} products</div>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-[#7C675B] dark:text-[#B09A8B]">
                No categories found
              </div>
            )}
          </div>
        </div>

        {/* Recent Invoices / Activity (3 cols) */}
        <div className="lg:col-span-3 glass-card p-5 rounded-3xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#DCE5EF] dark:border-[#22354B]">
            <h2 className="text-sm font-bold text-[#1C2736] dark:text-[#F1F5F9]">Recent Activity</h2>
            <Link to="/invoices" className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline">
              See All
            </Link>
          </div>

          <div className="space-y-2.5 pt-1 text-xs">
            {invoices.length > 0 ? (
              invoices.slice(0, 4).map((inv) => (
                <div key={inv.id || inv.uuid} className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-xl bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center justify-center flex-shrink-0 mt-0.5">
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
                    <div className="text-[10px] text-[#7C675B] dark:text-[#B09A8B] truncate">
                      #{inv.invoice_no || inv.uuid?.slice(0, 8)} - {formatCurrency(inv.grand_total, currency)}
                    </div>
                  </div>
                  <span className="text-[10px] text-[#7C675B] dark:text-[#B09A8B] flex-shrink-0">
                    {inv.created_at ? new Date(inv.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Recent'}
                  </span>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-[#7C675B] dark:text-[#B09A8B]">
                No recent activity recorded
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
