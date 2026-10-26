import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  BarChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  Calendar,
  DollarSign,
  ShoppingBag,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  BarChart3,
  Table as TableIcon,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Order } from '../types';

interface SalesAnalyticsChartProps {
  orders: Order[];
  className?: string;
  defaultMode?: 'daily' | 'weekly';
}

type Granularity = 'daily' | 'weekly';
type MetricView = 'both' | 'revenue' | 'orders';

export interface ChartDataPoint {
  key: string;
  label: string;
  fullLabel: string;
  revenue: number;
  orderCount: number;
  completedCount: number;
  deliveryFees: number;
  avgOrderValue: number;
  growthVsPrevWeek?: number;
}

const THAI_DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const THAI_FULL_DAYS = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export const SalesAnalyticsChart: React.FC<SalesAnalyticsChartProps> = ({
  orders,
  className = '',
  defaultMode = 'daily',
}) => {
  const [granularity, setGranularity] = useState<Granularity>(defaultMode);
  const [metricView, setMetricView] = useState<MetricView>('both');
  const [dailyDaysRange, setDailyDaysRange] = useState<7 | 14 | 30>(7);
  const [weeklyRange, setWeeklyRange] = useState<4 | 8 | 12>(4);
  const [showDataTable, setShowDataTable] = useState(false);

  // Filter out cancelled orders for sales statistics
  const validOrders = useMemo(() => {
    return orders.filter((o) => o.status !== 'cancelled');
  }, [orders]);

  // 1. Process Daily Data
  const dailyData = useMemo(() => {
    const data: ChartDataPoint[] = [];

    const now = new Date();

    for (let i = dailyDaysRange - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const date = String(d.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${date}`;

      const dayOrders = validOrders.filter((o) => o.createdAt && o.createdAt.startsWith(dateKey));
      const revenue = dayOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
      const deliveryFees = dayOrders.reduce((sum, o) => sum + (Number(o.deliveryFee) || 0), 0);
      const completedCount = dayOrders.filter((o) => o.status === 'completed').length;
      const orderCount = dayOrders.length;
      const avgOrderValue = orderCount > 0 ? Math.round(revenue / orderCount) : 0;

      const dayName = THAI_DAYS[d.getDay()];
      const fullDayName = THAI_FULL_DAYS[d.getDay()];
      const formattedDate = `${d.getDate()} ${THAI_MONTHS[d.getMonth()]}`;

      data.push({
        key: dateKey,
        label: `${dayName} ${d.getDate()}/${d.getMonth() + 1}`,
        fullLabel: `${fullDayName} ที่ ${formattedDate}`,
        revenue,
        orderCount,
        completedCount,
        deliveryFees,
        avgOrderValue,
      });
    }

    // Calculate Day-over-Day growth
    for (let i = 1; i < data.length; i++) {
      const prevRev = data[i - 1].revenue;
      const currRev = data[i].revenue;
      if (prevRev > 0) {
        data[i].growthVsPrevWeek = Math.round(((currRev - prevRev) / prevRev) * 100);
      } else if (currRev > 0) {
        data[i].growthVsPrevWeek = 100;
      } else {
        data[i].growthVsPrevWeek = 0;
      }
    }

    return data;
  }, [validOrders, dailyDaysRange]);

  // 2. Process Weekly Data (Aggregated in 7-day increments backwards)
  const weeklyData = useMemo(() => {
    const data: ChartDataPoint[] = [];

    const now = new Date();
    // Normalize to end of today
    now.setHours(23, 59, 59, 999);

    const weekBuckets: { start: Date; end: Date; label: string; fullLabel: string }[] = [];

    for (let i = 0; i < weeklyRange; i++) {
      const end = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);

      const startLabel = `${start.getDate()} ${THAI_MONTHS[start.getMonth()]}`;
      const endLabel = `${end.getDate()} ${THAI_MONTHS[end.getMonth()]}`;

      const label = i === 0 ? `สัปดาห์นี้ (${start.getDate()}-${end.getDate()})` : `${start.getDate()}-${end.getDate()} ${THAI_MONTHS[end.getMonth()]}`;
      const fullLabel = `ช่วง ${startLabel} - ${endLabel}`;

      weekBuckets.unshift({ start, end, label, fullLabel });
    }

    weekBuckets.forEach((bucket, idx) => {
      const bucketOrders = validOrders.filter((o) => {
        if (!o.createdAt) return false;
        const oTime = new Date(o.createdAt).getTime();
        return oTime >= bucket.start.getTime() && oTime <= bucket.end.getTime();
      });

      const revenue = bucketOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
      const deliveryFees = bucketOrders.reduce((sum, o) => sum + (Number(o.deliveryFee) || 0), 0);
      const completedCount = bucketOrders.filter((o) => o.status === 'completed').length;
      const orderCount = bucketOrders.length;
      const avgOrderValue = orderCount > 0 ? Math.round(revenue / orderCount) : 0;

      data.push({
        key: `week-${idx}`,
        label: bucket.label,
        fullLabel: bucket.fullLabel,
        revenue,
        orderCount,
        completedCount,
        deliveryFees,
        avgOrderValue,
      });
    });

    // Calculate Week-over-Week (WoW) growth
    for (let i = 1; i < data.length; i++) {
      const prevRev = data[i - 1].revenue;
      const currRev = data[i].revenue;
      if (prevRev > 0) {
        data[i].growthVsPrevWeek = Math.round(((currRev - prevRev) / prevRev) * 100);
      } else if (currRev > 0) {
        data[i].growthVsPrevWeek = 100;
      } else {
        data[i].growthVsPrevWeek = 0;
      }
    }

    return data;
  }, [validOrders, weeklyRange]);

  const activeChartData = granularity === 'daily' ? dailyData : weeklyData;

  // Key KPI metrics calculations
  const totalRevenue = useMemo(
    () => activeChartData.reduce((sum, d) => sum + d.revenue, 0),
    [activeChartData]
  );

  const totalOrders = useMemo(
    () => activeChartData.reduce((sum, d) => sum + d.orderCount, 0),
    [activeChartData]
  );

  const avgOrderValueOverall = useMemo(
    () => (totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0),
    [totalRevenue, totalOrders]
  );

  // Peak Day / Week
  const peakItem = useMemo(() => {
    if (activeChartData.length === 0) return null;
    return activeChartData.reduce((prev, curr) => (curr.revenue > prev.revenue ? curr : prev), activeChartData[0]);
  }, [activeChartData]);

  // Daily average for daily view
  const avgDailyRevenue = useMemo(() => {
    return Math.round(totalRevenue / (granularity === 'daily' ? dailyDaysRange : weeklyRange * 7));
  }, [totalRevenue, granularity, dailyDaysRange, weeklyRange]);

  // Overall growth comparison between the first half and second half of the period
  const trendComparison = useMemo(() => {
    if (activeChartData.length < 2) return null;
    const mid = Math.floor(activeChartData.length / 2);
    const firstHalf = activeChartData.slice(0, mid).reduce((sum, d) => sum + d.revenue, 0);
    const secondHalf = activeChartData.slice(mid).reduce((sum, d) => sum + d.revenue, 0);
    if (firstHalf === 0) return secondHalf > 0 ? 100 : 0;
    return Math.round(((secondHalf - firstHalf) / firstHalf) * 100);
  }, [activeChartData]);

  // Custom Recharts Tooltip
  const renderCustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div className="bg-stone-900/95 text-white p-3 rounded-2xl shadow-xl border border-stone-700 text-xs space-y-2 backdrop-blur-md min-w-[200px]">
          <div className="font-bold border-b border-stone-800 pb-1 text-yellow-400 flex items-center justify-between">
            <span>{dataPoint.fullLabel || label}</span>
            {dataPoint.growthVsPrevWeek !== undefined && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                  dataPoint.growthVsPrevWeek >= 0
                    ? 'bg-emerald-900/80 text-emerald-300'
                    : 'bg-rose-900/80 text-rose-300'
                }`}
              >
                {dataPoint.growthVsPrevWeek >= 0 ? '+' : ''}
                {dataPoint.growthVsPrevWeek}% WoW
              </span>
            )}
          </div>
          <div className="space-y-1.5 pt-0.5">
            <div className="flex items-center justify-between">
              <span className="text-stone-400 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                <span>ยอดขายรวม:</span>
              </span>
              <span className="font-extrabold text-amber-300">฿{dataPoint.revenue.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-400 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                <span>จำนวนออเดอร์:</span>
              </span>
              <span className="font-bold text-white">{dataPoint.orderCount} รายการ</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-stone-400">
              <span>ยอดเฉลี่ยต่อบิล:</span>
              <span className="font-semibold text-stone-200">฿{dataPoint.avgOrderValue.toLocaleString()}</span>
            </div>
            {dataPoint.deliveryFees > 0 && (
              <div className="flex items-center justify-between text-[11px] text-stone-400">
                <span>ค่าจัดส่งรวม:</span>
                <span className="font-semibold text-stone-200">฿{dataPoint.deliveryFees.toLocaleString()}</span>
              </div>
            )}
            {dataPoint.completedCount > 0 && (
              <div className="flex items-center justify-between text-[11px] text-emerald-400">
                <span>ส่งสำเร็จแล้ว:</span>
                <span className="font-bold">{dataPoint.completedCount} รายการ</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`bg-white rounded-3xl border border-amber-200/90 shadow-xs p-4 sm:p-6 space-y-4 ${className}`}>
      
      {/* 1. Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-stone-100 pb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-red-600 to-amber-500 text-white flex items-center justify-center shadow-xs">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-base text-stone-900">
              วิเคราะห์แนวโน้มยอดขาย {granularity === 'daily' ? 'รายวัน' : 'รายสัปดาห์'}
            </h3>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            {granularity === 'daily'
              ? `สถิติรายวันย้อนหลัง ${dailyDaysRange} วัน • เฉลี่ย ฿${avgDailyRevenue.toLocaleString()}/วัน`
              : `สถิติรวมรายสัปดาห์ย้อนหลัง ${weeklyRange} สัปดาห์ (${weeklyRange * 7} วัน)`}
          </p>
        </div>

        {/* View Mode Selectors */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Daily vs Weekly Toggle */}
          <div className="bg-stone-100 p-1 rounded-2xl flex items-center shadow-2xs">
            <button
              type="button"
              onClick={() => setGranularity('daily')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                granularity === 'daily'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              📅 กราฟรายวัน
            </button>
            <button
              type="button"
              onClick={() => setGranularity('weekly')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                granularity === 'weekly'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              📊 กราฟรายสัปดาห์
            </button>
          </div>

          {/* Time range selector */}
          <div className="flex items-center gap-1 bg-stone-50 border border-stone-200 px-2 py-1 rounded-xl">
            <Calendar className="w-3.5 h-3.5 text-stone-500" />
            {granularity === 'daily' ? (
              <select
                value={dailyDaysRange}
                onChange={(e) => setDailyDaysRange(Number(e.target.value) as any)}
                className="bg-transparent font-bold text-stone-700 text-xs focus:outline-hidden cursor-pointer"
              >
                <option value={7}>7 วันล่าสุด</option>
                <option value={14}>14 วันล่าสุด</option>
                <option value={30}>30 วันล่าสุด</option>
              </select>
            ) : (
              <select
                value={weeklyRange}
                onChange={(e) => setWeeklyRange(Number(e.target.value) as any)}
                className="bg-transparent font-bold text-stone-700 text-xs focus:outline-hidden cursor-pointer"
              >
                <option value={4}>4 สัปดาห์ล่าสุด (1 เดือน)</option>
                <option value={8}>8 สัปดาห์ล่าสุด (2 เดือน)</option>
                <option value={12}>12 สัปดาห์ล่าสุด (3 เดือน)</option>
              </select>
            )}
          </div>

          {/* Metric View Toggle */}
          <div className="bg-stone-100 p-1 rounded-xl flex items-center text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setMetricView('both')}
              className={`px-2 py-1 rounded-lg transition-all ${
                metricView === 'both' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              กราฟคู่
            </button>
            <button
              type="button"
              onClick={() => setMetricView('revenue')}
              className={`px-2 py-1 rounded-lg transition-all ${
                metricView === 'revenue' ? 'bg-amber-500 text-white shadow-2xs' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              ยอดขาย
            </button>
            <button
              type="button"
              onClick={() => setMetricView('orders')}
              className={`px-2 py-1 rounded-lg transition-all ${
                metricView === 'orders' ? 'bg-red-600 text-white shadow-2xs' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              ออเดอร์
            </button>
          </div>
        </div>
      </div>

      {/* 2. Key Metrics Bar (4 Highlights) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 bg-gradient-to-br from-red-50 to-orange-50/60 rounded-2xl border border-red-100 space-y-0.5">
          <div className="text-[11px] font-bold text-stone-500 flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5 text-red-600" />
            <span>ยอดขายรวมช่วงนี้</span>
          </div>
          <div className="text-lg sm:text-xl font-black text-red-600">
            ฿{totalRevenue.toLocaleString()}
          </div>
          <div className="text-[10px] text-stone-400">
            {granularity === 'daily' ? `${dailyDaysRange} วัน` : `${weeklyRange} สัปดาห์`}
          </div>
        </div>

        <div className="p-3 bg-gradient-to-br from-amber-50 to-yellow-50/60 rounded-2xl border border-amber-100 space-y-0.5">
          <div className="text-[11px] font-bold text-stone-500 flex items-center gap-1">
            <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
            <span>ออเดอร์ทั้งหมด</span>
          </div>
          <div className="text-lg sm:text-xl font-black text-stone-900">
            {totalOrders} <span className="text-xs font-normal text-stone-500">บิล</span>
          </div>
          <div className="text-[10px] text-stone-400">
            เฉลี่ย {(totalOrders / (granularity === 'daily' ? dailyDaysRange : weeklyRange)).toFixed(1)} บิล/{granularity === 'daily' ? 'วัน' : 'สัปดาห์'}
          </div>
        </div>

        <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50/60 rounded-2xl border border-blue-100 space-y-0.5">
          <div className="text-[11px] font-bold text-stone-500 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span>ยอดเฉลี่ยต่อบิล</span>
          </div>
          <div className="text-lg sm:text-xl font-black text-blue-700">
            ฿{avgOrderValueOverall.toLocaleString()}
          </div>
          <div className="text-[10px] text-stone-400">Average Order Value</div>
        </div>

        <div className="p-3 bg-gradient-to-br from-emerald-50 to-teal-50/60 rounded-2xl border border-emerald-100 space-y-0.5">
          <div className="text-[11px] font-bold text-stone-500 flex items-center gap-1">
            <Award className="w-3.5 h-3.5 text-emerald-600" />
            <span>{granularity === 'daily' ? 'วันที่ขายดีที่สุด' : 'สัปดาห์ที่ขายดีสุด'}</span>
          </div>
          <div className="text-sm sm:text-base font-black text-emerald-700 truncate" title={peakItem?.fullLabel}>
            {peakItem && peakItem.revenue > 0 ? (
              <>฿{peakItem.revenue.toLocaleString()}</>
            ) : (
              <span className="text-stone-400 font-normal">ยังไม่มียอดขาย</span>
            )}
          </div>
          <div className="text-[10px] text-stone-500 truncate">
            {peakItem && peakItem.revenue > 0 ? peakItem.label : '-'}
          </div>
        </div>
      </div>

      {/* 3. Recharts Main Graph Container */}
      <div className="w-full h-72 sm:h-80 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={activeChartData}
            margin={{ top: 15, right: 15, left: -10, bottom: 0 }}
          >
            <defs>
              <linearGradient id="revenueFillGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#d97706" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#d97706" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="orderBarGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#dc2626" stopOpacity={0.65} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

            <XAxis
              dataKey="label"
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={false}
            />

            {/* Left Y-Axis for Revenue */}
            {(metricView === 'both' || metricView === 'revenue') && (
              <YAxis
                yAxisId="left"
                orientation="left"
                tick={{ fill: '#d97706', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => `฿${Number(val).toLocaleString()}`}
              />
            )}

            {/* Right Y-Axis for Orders count */}
            {(metricView === 'both' || metricView === 'orders') && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: '#ef4444', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                tickFormatter={(val) => `${val} ออเดอร์`}
              />
            )}

            <Tooltip content={renderCustomTooltip} />

            <Legend
              wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }}
              formatter={(value) => {
                if (value === 'revenue') return 'ยอดขาย (บาท)';
                if (value === 'orderCount') return 'จำนวนออเดอร์ (รายการ)';
                return value;
              }}
            />

            {/* Render Bars for Orders */}
            {(metricView === 'both' || metricView === 'orders') && (
              <Bar
                yAxisId="right"
                dataKey="orderCount"
                fill="url(#orderBarGradient)"
                radius={[6, 6, 0, 0]}
                maxBarSize={40}
                name="orderCount"
              />
            )}

            {/* Render Area/Line for Revenue */}
            {(metricView === 'both' || metricView === 'revenue') && (
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="revenue"
                stroke="#d97706"
                strokeWidth={3}
                fill="url(#revenueFillGradient)"
                dot={{ r: 4, fill: '#d97706', strokeWidth: 2, stroke: '#ffffff' }}
                activeDot={{ r: 6, fill: '#b45309' }}
                name="revenue"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 4. Trend Banner & Table Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100 text-xs text-stone-600">
        <div className="flex items-center gap-2">
          {trendComparison !== null && (
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-bold text-[11px] ${
                trendComparison >= 0
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {trendComparison >= 0 ? (
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" />
              )}
              <span>
                แนวโน้มยอดขาย {trendComparison >= 0 ? 'เพิ่มขึ้น' : 'ลดลง'} {Math.abs(trendComparison)}%
              </span>
            </span>
          )}
          <span className="text-[11px] text-stone-400">
            *คำนวณจากออเดอร์ที่สั่งซื้อสำเร็จ (ไม่รวมรายการที่ยกเลิก)
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowDataTable(!showDataTable)}
          className="text-stone-700 hover:text-red-600 font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-50 hover:bg-stone-100 transition-colors cursor-pointer"
        >
          <TableIcon className="w-3.5 h-3.5" />
          <span>{showDataTable ? 'ซ่อนตารางข้อมูลสรุป' : 'ดูตารางแจกแจงตัวเลข'}</span>
          {showDataTable ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* 5. Detailed Breakdown Data Table (Collapsible) */}
      {showDataTable && (
        <div className="mt-3 overflow-x-auto rounded-2xl border border-stone-200 animate-fadeIn">
          <table className="w-full text-xs text-left">
            <thead className="bg-stone-100 text-stone-700 font-bold border-b border-stone-200">
              <tr>
                <th className="p-2.5">ช่วงเวลา</th>
                <th className="p-2.5 text-right">ยอดขายรวม</th>
                <th className="p-2.5 text-center">จำนวนออเดอร์</th>
                <th className="p-2.5 text-right">เฉลี่ยต่อบิล</th>
                <th className="p-2.5 text-right">ค่าส่งรวม</th>
                <th className="p-2.5 text-center">ส่งสำเร็จ</th>
                {granularity === 'weekly' && <th className="p-2.5 text-right">การเติบโต (WoW)</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-800">
              {activeChartData.map((row, idx) => (
                <tr key={idx} className="hover:bg-amber-50/40 transition-colors">
                  <td className="p-2.5 font-bold text-stone-900">{row.fullLabel || row.label}</td>
                  <td className="p-2.5 text-right font-black text-amber-700">
                    ฿{row.revenue.toLocaleString()}
                  </td>
                  <td className="p-2.5 text-center font-bold text-red-600">
                    {row.orderCount} บิล
                  </td>
                  <td className="p-2.5 text-right font-medium text-stone-600">
                    ฿{row.avgOrderValue.toLocaleString()}
                  </td>
                  <td className="p-2.5 text-right font-medium text-stone-500">
                    ฿{row.deliveryFees.toLocaleString()}
                  </td>
                  <td className="p-2.5 text-center font-bold text-emerald-600">
                    {row.completedCount}
                  </td>
                  {granularity === 'weekly' && (
                    <td className="p-2.5 text-right font-bold">
                      {row.growthVsPrevWeek !== undefined ? (
                        <span
                          className={
                            row.growthVsPrevWeek >= 0 ? 'text-emerald-600' : 'text-rose-600'
                          }
                        >
                          {row.growthVsPrevWeek >= 0 ? '+' : ''}
                          {row.growthVsPrevWeek}%
                        </span>
                      ) : (
                        <span className="text-stone-300">-</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-stone-50 font-bold border-t border-stone-200 text-stone-900">
              <tr>
                <td className="p-2.5">รวมทั้งสิ้น</td>
                <td className="p-2.5 text-right text-amber-700 font-black">
                  ฿{totalRevenue.toLocaleString()}
                </td>
                <td className="p-2.5 text-center text-red-600 font-black">
                  {totalOrders} บิล
                </td>
                <td className="p-2.5 text-right">
                  ฿{avgOrderValueOverall.toLocaleString()}
                </td>
                <td className="p-2.5 text-right">
                  ฿{activeChartData.reduce((s, r) => s + r.deliveryFees, 0).toLocaleString()}
                </td>
                <td className="p-2.5 text-center text-emerald-600">
                  {activeChartData.reduce((s, r) => s + r.completedCount, 0)}
                </td>
                {granularity === 'weekly' && <td className="p-2.5 text-right">-</td>}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

    </div>
  );
};
