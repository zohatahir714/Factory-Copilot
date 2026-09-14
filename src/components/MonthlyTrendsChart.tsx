import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { useApp } from '../context/AppContext';
import { SalesOrder, PurchaseOrder } from '../types';
import { TrendingUp, BarChart2, Activity, ArrowUpRight, Scale, ChevronRight } from 'lucide-react';

interface MonthlyTrendsChartProps {
  salesOrders: SalesOrder[];
  purchaseOrders: PurchaseOrder[];
  onOpenCompliance?: () => void;
}

export const MonthlyTrendsChart: React.FC<MonthlyTrendsChartProps> = ({
  salesOrders,
  purchaseOrders,
  onOpenCompliance
}) => {
  const { darkMode } = useApp();
  const [metricMode, setMetricMode] = useState<'value' | 'volume'>('value');
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');

  // Compute dynamic 6-month trends from actual data
  const monthlyData = useMemo(() => {
    // Generate rolling last 6 months dynamically from current date
    const now = new Date();
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toLocaleString('default', { month: 'short' }));
    }

    return months.map((monthName) => {
      const monthSales = salesOrders.filter(so => {
        const d = new Date(so.createdAt);
        const m = d.toLocaleString('default', { month: 'short' });
        return m.toLowerCase() === monthName.toLowerCase();
      });

      const monthPOs = purchaseOrders.filter(po => {
        const d = new Date(po.createdAt);
        const m = d.toLocaleString('default', { month: 'short' });
        return m.toLowerCase() === monthName.toLowerCase();
      });

      const realSalesVal = monthSales.reduce((acc, s) => acc + (s.totalAmount || 0), 0);
      const realSalesUnits = monthSales.reduce((acc, s) => acc + (s.items || []).reduce((sum, it) => sum + (it.quantity || 0), 0), 0);

      const realPOVal = monthPOs.reduce((acc, p) => acc + (p.totalAmount || 0), 0);
      const realPOUnits = monthPOs.reduce((acc, p) => acc + (p.items || []).reduce((sum, it) => sum + (it.quantity || 0), 0), 0);

      return {
        month: monthName,
        sales: realSalesVal,
        purchases: realPOVal,
        salesVolume: realSalesUnits,
        purchaseVolume: realPOUnits,
        margin: realSalesVal - realPOVal,
        salesCount: monthSales.length,
        poCount: monthPOs.length
      };
    });
  }, [salesOrders, purchaseOrders]);

  // Aggregate totals for dynamic insight KPIs
  const totalPeriodSales = useMemo(() => {
    return monthlyData.reduce((acc, m) => acc + m.sales, 0);
  }, [monthlyData]);

  const totalPeriodPurchases = useMemo(() => {
    return monthlyData.reduce((acc, m) => acc + m.purchases, 0);
  }, [monthlyData]);

  const totalPeriodSalesVol = useMemo(() => {
    return monthlyData.reduce((acc, m) => acc + m.salesVolume, 0);
  }, [monthlyData]);

  const totalPeriodPurchasesVol = useMemo(() => {
    return monthlyData.reduce((acc, m) => acc + m.purchaseVolume, 0);
  }, [monthlyData]);

  const netTradeMargin = totalPeriodSales - totalPeriodPurchases;
  const ratio = totalPeriodPurchases > 0 ? (totalPeriodSales / totalPeriodPurchases).toFixed(2) : '1.00';

  // Dynamic colors based on theme
  const gridStroke = darkMode ? '#334155' : '#e2e8f0';
  const axisColor = darkMode ? '#334155' : '#e2e8f0';
  const tickColor = darkMode ? '#94a3b8' : '#64748b';

  // Custom theme-aware tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl shadow-lg text-xs space-y-1.5 font-sans">
          <div className="font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-1 flex items-center justify-between gap-4">
            <span>{label} Operational Cycle</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Monthly Ledger</span>
          </div>
          <div className="flex items-center justify-between gap-6 text-slate-700 dark:text-slate-200">
            <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-500" />
              Sales {metricMode === 'value' ? 'Revenue' : 'Units'}:
            </span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">
              {metricMode === 'value'
                ? `Rs. ${(payload[0]?.value || 0).toLocaleString()}`
                : `${(payload[0]?.value || 0).toLocaleString()} pcs`}
            </span>
          </div>
          <div className="flex items-center justify-between gap-6 text-slate-700 dark:text-slate-200">
            <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              Procurement {metricMode === 'value' ? 'Cost' : 'Units'}:
            </span>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
              {metricMode === 'value'
                ? `Rs. ${(payload[1]?.value || 0).toLocaleString()}`
                : `${(payload[1]?.value || 0).toLocaleString()} units`}
            </span>
          </div>
          {metricMode === 'value' && (
            <div className="border-t border-slate-100 dark:border-slate-700/80 pt-1 flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">Trade Spread:</span>
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                Rs. {((payload[0]?.value || 0) - (payload[1]?.value || 0)).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6 transition-colors duration-200">
      {/* Top Header: Title, Controls & Compliance Schedule */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Monthly Purchase vs. Sales Volume Trend
              </h3>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold border border-slate-200 dark:border-slate-700">
                Dynamic Telemetry
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Comparative manufacturing throughput, procurement burn, and commercial revenue velocity
            </p>
          </div>
        </div>

        {/* View Controls & Compliance Button */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Metric Toggle: Value (PKR) vs Volume (Units) */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => setMetricMode('value')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                metricMode === 'value'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Revenue (PKR)
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('volume')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                metricMode === 'volume'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Volume (Units)
            </button>
          </div>

          {/* Chart Type Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => setChartType('area')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                chartType === 'area'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Area Trend View"
            >
              <Activity className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setChartType('bar')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                chartType === 'bar'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Bar Comparison View"
            >
              <BarChart2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Compliance Schedule Modal Trigger */}
          {onOpenCompliance && (
            <button
              type="button"
              onClick={onOpenCompliance}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Inspect FBR Statutory Filing Calendar"
            >
              <Scale className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>FBR Schedule</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Dynamic Data-Driven Insights Bar (Replacing Static Numbers) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Sales Volume</div>
          <div className="mt-1 text-base font-bold font-mono text-slate-900 dark:text-white">
            {metricMode === 'value'
              ? `Rs. ${totalPeriodSales.toLocaleString()}`
              : `${totalPeriodSalesVol.toLocaleString()} pcs`}
          </div>
          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono flex items-center gap-1 mt-0.5">
            <ArrowUpRight className="w-3 h-3" /> Commercial Invoices
          </div>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Procurement</div>
          <div className="mt-1 text-base font-bold font-mono text-slate-900 dark:text-white">
            {metricMode === 'value'
              ? `Rs. ${totalPeriodPurchases.toLocaleString()}`
              : `${totalPeriodPurchasesVol.toLocaleString()} units`}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
            Raw Material POs
          </div>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Trade Spread (Surplus)</div>
          <div className="mt-1 text-base font-bold font-mono text-slate-900 dark:text-white">
            {metricMode === 'value'
              ? `Rs. ${netTradeMargin.toLocaleString()}`
              : `${(totalPeriodSalesVol - totalPeriodPurchasesVol).toLocaleString()} net`}
          </div>
          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
            Operational Spread
          </div>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Sales / PO Ratio</div>
          <div className="mt-1 text-base font-bold font-mono text-slate-900 dark:text-white">
            {ratio}x
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
            Output / Input Balance
          </div>
        </div>
      </div>

      {/* Recharts Visual Trend Chart Component */}
      <div className="w-full h-72 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'area' ? (
            <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="purchaseGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#64748b" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#64748b" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis
                dataKey="month"
                stroke={axisColor}
                tick={{ fill: tickColor, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: axisColor }}
              />
              <YAxis
                stroke={axisColor}
                tick={{ fill: tickColor, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) =>
                  metricMode === 'value'
                    ? val >= 1000000
                      ? `${(val / 1000000).toFixed(1)}M`
                      : `${Math.round(val / 1000)}k`
                    : `${val}`
                }
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: 12, fontSize: 12 }}
                formatter={(value) => (
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    {value === (metricMode === 'value' ? 'sales' : 'salesVolume')
                      ? 'Sales Volume'
                      : 'Procurement Volume'}
                  </span>
                )}
              />
              <Area
                type="monotone"
                dataKey={metricMode === 'value' ? 'sales' : 'salesVolume'}
                name={metricMode === 'value' ? 'sales' : 'salesVolume'}
                stroke="#2563eb"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#salesGradient)"
              />
              <Area
                type="monotone"
                dataKey={metricMode === 'value' ? 'purchases' : 'purchaseVolume'}
                name={metricMode === 'value' ? 'purchases' : 'purchaseVolume'}
                stroke="#64748b"
                strokeWidth={2}
                strokeDasharray="4 4"
                fillOpacity={1}
                fill="url(#purchaseGradient)"
              />
            </AreaChart>
          ) : (
            <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis
                dataKey="month"
                stroke={axisColor}
                tick={{ fill: tickColor, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: axisColor }}
              />
              <YAxis
                stroke={axisColor}
                tick={{ fill: tickColor, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) =>
                  metricMode === 'value'
                    ? val >= 1000000
                      ? `${(val / 1000000).toFixed(1)}M`
                      : `${Math.round(val / 1000)}k`
                    : `${val}`
                }
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: 12, fontSize: 12 }}
                formatter={(value) => (
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    {value === (metricMode === 'value' ? 'sales' : 'salesVolume')
                      ? 'Sales Volume'
                      : 'Procurement Volume'}
                  </span>
                )}
              />
              <Bar
                dataKey={metricMode === 'value' ? 'sales' : 'salesVolume'}
                name={metricMode === 'value' ? 'sales' : 'salesVolume'}
                fill="#2563eb"
                radius={[6, 6, 0, 0]}
              />
              <Bar
                dataKey={metricMode === 'value' ? 'purchases' : 'purchaseVolume'}
                name={metricMode === 'value' ? 'purchases' : 'purchaseVolume'}
                fill="#64748b"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Unified Single-Color Footer: Operational Telemetry Status */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-500" />
          <span>FBR Sales Tax & Input Reconciliation: Real-time ledger sync active</span>
        </div>
        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
          Source: Sales Invoices (Annex-C) & Purchase Orders (STGO)
        </div>
      </div>
    </div>
  );
};
