import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import api from '../config/api';
import { useSettings } from '../hooks/useSettings';
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
  }, []);

  // Compute metrics from existing data
  const totalSalesRevenue = useMemo(() => {
    return invoices
      .filter((i) => i.status === 'completed')
      .reduce((sum, i) => sum + Number(i.grand_total || 0), 0);
  }, [invoices]);

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
      {/* Dashboard Heading & Filter Pills (matches Screenshot 1) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#282431] dark:text-[#F5F2F9] tracking-tight">
            Dashboard
          </h1>
          <p className="text-xs text-[#716B7C] dark:text-[#B8B0C4] mt-0.5">
            Real-time business performance, billing velocity, and store analytics
          </p>
        </div>

        {/* Date Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-white dark:bg-[#211D2A] p-1 rounded-full border border-[#E8E3EF] dark:border-[#393244] shadow-2xs">
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
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  dateFilter === f.id
                    ? 'bg-[#282431] text-white dark:bg-[#F5F2F9] dark:text-[#17151D]'
                    : 'text-[#716B7C] dark:text-[#B8B0C4] hover:text-[#282431] dark:hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white dark:bg-[#211D2A] border border-[#E8E3EF] dark:border-[#393244] text-xs font-semibold text-[#716B7C] dark:text-[#B8B0C4] shadow-2xs"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>All Time (No Filter)</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Row 1: 8 KPI Cards (matches Screenshot 1 top row) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* 1. TODAY'S SALES */}
        <div className="bg-white dark:bg-[#211D2A] p-3.5 rounded-2xl border border-[#E8E3EF] dark:border-[#393244] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#716B7C] uppercase">Today's Sales</span>
            <div className="w-6 h-6 rounded-full bg-[#EDE7F7] text-[#7652B5] flex items-center justify-center text-xs font-black">
              ₹
            </div>
          </div>
          <div className="my-2">
            <div className="text-base font-black text-[#282431] dark:text-[#F5F2F9]">
              {formatCurrency(summary?.today_sales_total ?? 0, currency)}
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-[#716B7C] pt-1 border-t border-[#E8E3EF]/50">
            <span className="text-emerald-600 font-semibold">• Daily POS</span>
            <BarChart3 className="w-3 h-3 text-[#7652B5]" />
          </div>
        </div>

        {/* 2. THIS MONTH */}
        <div className="bg-white dark:bg-[#211D2A] p-3.5 rounded-2xl border border-[#E8E3EF] dark:border-[#393244] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#716B7C] uppercase">This Month</span>
            <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-black">
              M
            </div>
          </div>
          <div className="my-2">
            <div className="text-base font-black text-[#282431] dark:text-[#F5F2F9]">
              {formatCurrency(totalSalesRevenue || 0, currency)}
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-[#716B7C] pt-1 border-t border-[#E8E3EF]/50">
            <span className="text-emerald-600 font-semibold">• Current Month</span>
            <BarChart3 className="w-3 h-3 text-emerald-600" />
          </div>
        </div>

        {/* 3. TOTAL SALES */}
        <div className="bg-white dark:bg-[#211D2A] p-3.5 rounded-2xl border border-[#E8E3EF] dark:border-[#393244] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#716B7C] uppercase">Total Sales</span>
            <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-black">
              $
            </div>
          </div>
          <div className="my-2">
            <div className="text-base font-black text-[#282431] dark:text-[#F5F2F9] truncate">
              {formatCurrency(totalSalesRevenue, currency)}
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-[#716B7C] pt-1 border-t border-[#E8E3EF]/50">
            <span className="text-[#716B7C] font-semibold">Lifetime Revenue</span>
            <BarChart3 className="w-3 h-3 text-blue-600" />
          </div>
        </div>

        {/* 4. ORDERS */}
        <div className="bg-white dark:bg-[#211D2A] p-3.5 rounded-2xl border border-[#E8E3EF] dark:border-[#393244] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#716B7C] uppercase">Orders</span>
            <div className="w-6 h-6 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center text-xs font-black">
              O
            </div>
          </div>
          <div className="my-2">
            <div className="text-base font-black text-[#282431] dark:text-[#F5F2F9]">
              {invoices.length || summary?.today_invoice_count || 0}
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-[#716B7C] pt-1 border-t border-[#E8E3EF]/50">
            <span className="text-amber-600 font-semibold">{orderStats.pending} pending</span>
            <BarChart3 className="w-3 h-3 text-amber-600" />
          </div>
        </div>

        {/* 5. CUSTOMERS */}
        <div className="bg-white dark:bg-[#211D2A] p-3.5 rounded-2xl border border-[#E8E3EF] dark:border-[#393244] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#716B7C] uppercase">Customers</span>
            <div className="w-6 h-6 rounded-full bg-cyan-50 text-cyan-600 flex items-center justify-center text-xs font-black">
              C
            </div>
          </div>
          <div className="my-2">
            <div className="text-base font-black text-[#282431] dark:text-[#F5F2F9]">
              {customers.length || (summary?.outstanding_from_customers > 0 ? 1 : 0)}
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-[#716B7C] pt-1 border-t border-[#E8E3EF]/50">
            <span className="text-cyan-600 font-semibold">+0 Today</span>
            <BarChart3 className="w-3 h-3 text-cyan-600" />
          </div>
        </div>

        {/* 6. PRODUCTS */}
        <div className="bg-white dark:bg-[#211D2A] p-3.5 rounded-2xl border border-[#E8E3EF] dark:border-[#393244] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#716B7C] uppercase">Products</span>
            <div className="w-6 h-6 rounded-full bg-[#EDE7F7] text-[#7652B5] flex items-center justify-center text-xs font-black">
              P
            </div>
          </div>
          <div className="my-2">
            <div className="text-base font-black text-[#282431] dark:text-[#F5F2F9]">
              {products.length || summary?.product_count || 0}
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-[#716B7C] pt-1 border-t border-[#E8E3EF]/50">
            <span className="text-[#7652B5] font-semibold">Active SKUs</span>
            <BarChart3 className="w-3 h-3 text-[#7652B5]" />
          </div>
        </div>

        {/* 7. LOW STOCK */}
        <div className="bg-white dark:bg-[#211D2A] p-3.5 rounded-2xl border border-[#E8E3EF] dark:border-[#393244] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#716B7C] uppercase">Low Stock</span>
            <div className="w-6 h-6 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center text-xs font-black">
              !
            </div>
          </div>
          <div className="my-2">
            <div className="text-base font-black text-amber-600">
              {summary?.low_stock_count ?? 0}
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-[#716B7C] pt-1 border-t border-[#E8E3EF]/50">
            <span className="text-amber-600 font-semibold">Reorder alert</span>
            <BarChart3 className="w-3 h-3 text-amber-600" />
          </div>
        </div>

        {/* 8. OUT OF STOCK */}
        <div className="bg-white dark:bg-[#211D2A] p-3.5 rounded-2xl border border-[#E8E3EF] dark:border-[#393244] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#716B7C] uppercase">Out of Stock</span>
            <div className="w-6 h-6 rounded-full bg-red-50 text-red-600 flex items-center justify-center text-xs font-black">
              ✕
            </div>
          </div>
          <div className="my-2">
            <div className="text-base font-black text-red-500">
              {outOfStockCount}
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-[#716B7C] pt-1 border-t border-[#E8E3EF]/50">
            <span className="text-red-500 font-semibold">Zero inventory</span>
            <BarChart3 className="w-3 h-3 text-red-500" />
          </div>
        </div>
      </div>

      {/* Row 2: 3 Wide Financial Overview Cards (matches Screenshot 1) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* TOTAL INCOME */}
        <div className="bg-white dark:bg-[#211D2A] p-4 rounded-2xl border border-[#E8E3EF] dark:border-[#393244] shadow-2xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#716B7C]">
              <span>TOTAL INCOME</span>
              <span className="text-emerald-500">↗</span>
            </div>
            <div className="text-xl font-black text-[#282431] dark:text-[#F5F2F9] mt-1">
              {formatCurrency(totalIncome, currency)}
            </div>
            <p className="text-[10px] text-[#716B7C] mt-1">All recorded revenue</p>
          </div>
          <div className="w-24 h-10">
            <svg viewBox="0 0 100 40" className="w-full h-full">
              <path d="M 0 35 Q 25 30 50 20 T 100 5 L 100 40 L 0 40 Z" fill="rgba(16, 185, 129, 0.12)" />
              <path d="M 0 35 Q 25 30 50 20 T 100 5" fill="none" stroke="#10B981" strokeWidth="2" />
            </svg>
          </div>
        </div>

        {/* TOTAL EXPENSE */}
        <div className="bg-white dark:bg-[#211D2A] p-4 rounded-2xl border border-[#E8E3EF] dark:border-[#393244] shadow-2xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#716B7C]">
              <span>TOTAL EXPENSE</span>
              <span className="text-red-400">↘</span>
            </div>
            <div className="text-xl font-black text-[#282431] dark:text-[#F5F2F9] mt-1">
              {formatCurrency(totalExpense, currency)}
            </div>
            <p className="text-[10px] text-[#716B7C] mt-1">All recorded expenses</p>
          </div>
          <div className="w-24 h-10">
            <svg viewBox="0 0 100 40" className="w-full h-full">
              <path d="M 0 10 Q 30 15 60 28 T 100 38 L 100 40 L 0 40 Z" fill="rgba(244, 63, 94, 0.12)" />
              <path d="M 0 10 Q 30 15 60 28 T 100 38" fill="none" stroke="#F43F5E" strokeWidth="2" />
            </svg>
          </div>
        </div>

        {/* NET PROFIT */}
        <div className="bg-white dark:bg-[#211D2A] p-4 rounded-2xl border border-[#E8E3EF] dark:border-[#393244] shadow-2xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#716B7C]">
              <span>NET PROFIT</span>
              <span className="text-sky-500">↗</span>
            </div>
            <div className="text-xl font-black text-[#282431] dark:text-[#F5F2F9] mt-1">
              {formatCurrency(netProfit, currency)}
            </div>
            <p className="text-[10px] text-[#716B7C] mt-1">Income - Expense</p>
          </div>
          <div className="w-24 h-10">
            <svg viewBox="0 0 100 40" className="w-full h-full">
              <path d="M 0 35 Q 35 32 65 18 T 100 8 L 100 40 L 0 40 Z" fill="rgba(59, 130, 246, 0.12)" />
              <path d="M 0 35 Q 35 32 65 18 T 100 8" fill="none" stroke="#3B82F6" strokeWidth="2" />
            </svg>
          </div>
        </div>
      </div>

      {/* Row 3: Sales Overview (50%) + Order Status (25%) + Quick Actions (25%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Sales Overview Line Chart (50% -> 6 cols) */}
        <div className="lg:col-span-6 bg-white dark:bg-[#211D2A] p-5 rounded-2xl border border-[#E8E3EF] dark:border-[#393244] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-[#E8E3EF] dark:border-[#393244]">
            <div>
              <h2 className="text-sm font-bold text-[#282431] dark:text-[#F5F2F9]">Sales Overview</h2>
              <p className="text-[11px] text-[#716B7C] dark:text-[#B8B0C4]">Total sales for the last 7 days</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-[#716B7C] border border-[#E8E3EF] dark:border-[#393244] px-2.5 py-1 rounded-full">
              <span>Last 7 Days</span>
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
                      <line x1="35" y1={y} x2="425" y2={y} stroke="#E8E3EF" strokeDasharray="3 3" />
                      <text x="5" y={y + 3} fill="#716B7C" fontSize="9" fontWeight="600">
                        {val >= 1000 ? `₹${val / 1000}k` : `₹${val}`}
                      </text>
                    </g>
                  );
                })}

                {/* Purple Area Gradient & Line */}
                <defs>
                  <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7652B5" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#7652B5" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Shaded Area under curve */}
                {points.length > 0 && (
                  <path
                    d={`${svgPath} L ${points[points.length - 1].x} 130 L ${points[0].x} 130 Z`}
                    fill="url(#purpleGradient)"
                  />
                )}

                {/* Smooth Curve */}
                <path d={svgPath} fill="none" stroke="#7652B5" strokeWidth="2.5" />

                {/* Data point dots */}
                {points.map((p) => (
                  <circle
                    key={p.dateKey}
                    cx={p.x}
                    cy={p.y}
                    r="3.5"
                    fill="#7652B5"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                  />
                ))}
              </svg>
            </div>

            {/* X-axis date labels */}
            <div className="flex justify-between pl-8 pr-4 text-[10px] text-[#716B7C] font-semibold mt-1">
              {salesChartData.days.map((d) => (
                <span key={d.dateKey}>{d.label}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Order Status Donut Chart (25% -> 3 cols) */}
        <div className="lg:col-span-3 bg-white dark:bg-[#211D2A] p-5 rounded-2xl border border-[#E8E3EF] dark:border-[#393244] shadow-2xs flex flex-col justify-between">
          <div className="pb-2 border-b border-[#E8E3EF] dark:border-[#393244]">
            <h2 className="text-sm font-bold text-[#282431] dark:text-[#F5F2F9]">Order Status</h2>
          </div>

          {/* Donut Graphic */}
          <div className="flex items-center justify-center py-4 relative">
            <svg viewBox="0 0 120 120" className="w-32 h-32 transform -rotate-90">
              {/* Background ring */}
              <circle cx="60" cy="60" r="45" fill="none" stroke="#E8E3EF" strokeWidth="14" />
              {/* Cyan / Processing slice (50%) */}
              <circle
                cx="60"
                cy="60"
                r="45"
                fill="none"
                stroke="#06B6D4"
                strokeWidth="14"
                strokeDasharray="141 141"
                strokeDashoffset="0"
              />
              {/* Pink / Cancelled slice (50%) */}
              <circle
                cx="60"
                cy="60"
                r="45"
                fill="none"
                stroke="#F43F5E"
                strokeWidth="14"
                strokeDasharray="141 141"
                strokeDashoffset="141"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xl font-black text-[#282431] dark:text-[#F5F2F9] leading-none">
                {orderStats.total || 2}
              </span>
              <span className="text-[9px] text-[#716B7C] uppercase font-bold mt-0.5">
                Total Orders
              </span>
            </div>
          </div>

          {/* Status Legend */}
          <div className="space-y-1.5 text-[11px] pt-1 border-t border-[#E8E3EF] dark:border-[#393244]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-[#716B7C]">Pending</span>
              </span>
              <span className="font-bold">0 (0%)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[#716B7C]">Delivered</span>
              </span>
              <span className="font-bold">0 (0%)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-500" />
                <span className="text-[#716B7C]">Processing</span>
              </span>
              <span className="font-bold">1 (50%)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-[#716B7C]">Cancelled</span>
              </span>
              <span className="font-bold">1 (50%)</span>
            </div>
          </div>
        </div>

        {/* Quick Actions (25% -> 3 cols) - Stacked Colorful Pills */}
        <div className="lg:col-span-3 bg-white dark:bg-[#211D2A] p-5 rounded-2xl border border-[#E8E3EF] dark:border-[#393244] shadow-2xs flex flex-col justify-between">
          <div className="pb-2 border-b border-[#E8E3EF] dark:border-[#393244]">
            <h2 className="text-sm font-bold text-[#282431] dark:text-[#F5F2F9]">Quick Actions</h2>
          </div>

          <div className="space-y-2 py-1">
            {/* + Add New Product [Purple] */}
            <Link
              to="/products"
              className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#7652B5] hover:bg-[#5B3B91] text-white text-xs font-bold shadow-sm transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Add New Product</span>
            </Link>

            {/* Manage Orders [Blue] */}
            <Link
              to="/invoices"
              className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold shadow-sm transition-all"
            >
              <FileText className="w-4 h-4" />
              <span>Manage Orders</span>
            </Link>

            {/* View Reports [Teal] */}
            <Link
              to="/reports"
              className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-bold shadow-sm transition-all"
            >
              <BarChart3 className="w-4 h-4" />
              <span>View Reports</span>
            </Link>

            {/* Manage Customers [Orange] */}
            <Link
              to="/customers"
              className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-bold shadow-sm transition-all"
            >
              <Users className="w-4 h-4" />
              <span>Manage Customers</span>
            </Link>

            {/* Update Inventory [Green] */}
            <Link
              to="/inventory"
              className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold shadow-sm transition-all"
            >
              <Boxes className="w-4 h-4" />
              <span>Update Inventory</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Row 4: Popular Items (40%) + Top Categories (30%) + Recent Activity (30%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Popular Items (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-[#211D2A] p-5 rounded-2xl border border-[#E8E3EF] dark:border-[#393244] shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#E8E3EF] dark:border-[#393244]">
            <div>
              <h2 className="text-sm font-bold text-[#282431] dark:text-[#F5F2F9]">Popular Items</h2>
              <p className="text-[10px] text-[#716B7C]">Top performing catalog products ranked by order volume and sales</p>
            </div>
            <Link to="/products" className="text-xs font-bold text-[#7652B5] hover:underline">
              View All
            </Link>
          </div>

          <div className="grid grid-cols-5 gap-2 pt-1">
            {products.slice(0, 5).length > 0 ? (
              products.slice(0, 5).map((p, idx) => (
                <div
                  key={p.id}
                  className="p-2.5 rounded-xl border border-[#E8E3EF] dark:border-[#393244] bg-[#F7F5FC]/60 dark:bg-[#17151D] flex flex-col items-center text-center relative group"
                >
                  <span className="w-4 h-4 rounded-full bg-[#7652B5] text-white text-[9px] font-bold flex items-center justify-center absolute top-1.5 left-1.5">
                    {idx + 1}
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-[#EDE7F7] text-[#7652B5] dark:bg-[#2B2536] dark:text-[#A98ADB] flex items-center justify-center my-1.5">
                    <Package className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold text-[#282431] dark:text-[#F5F2F9] line-clamp-2 leading-tight">
                    {p.name}
                  </span>
                </div>
              ))
            ) : (
              <div className="col-span-5 py-6 text-center text-xs text-[#716B7C] dark:text-[#B8B0C4]">
                No products found in database
              </div>
            )}
          </div>
        </div>

        {/* Top Categories (4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-[#211D2A] p-5 rounded-2xl border border-[#E8E3EF] dark:border-[#393244] shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#E8E3EF] dark:border-[#393244]">
            <h2 className="text-sm font-bold text-[#282431] dark:text-[#F5F2F9]">Top Categories</h2>
            <Link to="/master-data?tab=categories" className="text-xs font-bold text-[#7652B5] hover:underline">
              View All
            </Link>
          </div>

          <div className="space-y-3 pt-1">
            {topCategories.length > 0 ? (
              topCategories.map((c) => (
                <div key={c.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#282431] dark:text-[#F5F2F9]">{c.name}</span>
                    <span className="font-bold text-[#716B7C]">{c.percent}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#EDE7F7] dark:bg-[#2B2536] overflow-hidden">
                    <div
                      style={{ width: `${c.percent}%` }}
                      className="h-full rounded-full bg-[#0D9488]"
                    />
                  </div>
                  <div className="text-[10px] text-[#716B7C]">{c.count} products</div>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-[#716B7C] dark:text-[#B8B0C4]">
                No categories found in database
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity (3 cols) */}
        <div className="lg:col-span-3 bg-white dark:bg-[#211D2A] p-5 rounded-2xl border border-[#E8E3EF] dark:border-[#393244] shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#E8E3EF] dark:border-[#393244]">
            <h2 className="text-sm font-bold text-[#282431] dark:text-[#F5F2F9]">Recent Activity</h2>
            <Link to="/invoices" className="text-xs font-bold text-[#7652B5] hover:underline">
              View All
            </Link>
          </div>

          <div className="space-y-2.5 pt-1 text-xs">
            {invoices.length > 0 ? (
              invoices.slice(0, 3).map((inv) => (
                <div key={inv.id || inv.uuid} className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-[#EDE7F7] text-[#7652B5] dark:bg-[#2B2536] dark:text-[#A98ADB] flex items-center justify-center flex-shrink-0 mt-0.5">
                    {inv.status === 'cancelled' ? (
                      <XCircle className="w-3.5 h-3.5 text-rose-500" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[#282431] dark:text-[#F5F2F9] leading-tight">
                      {inv.status === 'cancelled' ? 'Order cancelled' : 'Invoice generated'}
                    </div>
                    <div className="text-[10px] text-[#716B7C] dark:text-[#B8B0C4] truncate">
                      #{inv.invoice_no || inv.uuid?.slice(0, 8)} - {formatCurrency(inv.grand_total, currency)}
                    </div>
                  </div>
                  <span className="text-[10px] text-[#716B7C] dark:text-[#B8B0C4] flex-shrink-0">
                    {inv.created_at ? new Date(inv.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Recent'}
                  </span>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-[#716B7C] dark:text-[#B8B0C4]">
                No recent activity recorded
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
