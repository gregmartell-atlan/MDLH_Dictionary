import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import type { PlanTrend } from '../../../stores/planMetricsStore';

interface TrendChartProps {
  trend: PlanTrend;
}

export function TrendChart({ trend }: TrendChartProps) {
  const data = trend.timestamps.map((timestamp, index) => ({
    date: new Date(timestamp).toLocaleDateString(),
    completion: trend.completionTrend[index],
    quality: trend.qualityTrend[index],
    assets: trend.assetsAnalyzed[index],
  }));

  return (
    <div className="w-full h-[300px] bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
      <h3 className="text-lg font-bold text-slate-800 mb-4">Progress Over Time</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis 
            dataKey="date" 
            tick={{ fill: '#64748b', fontSize: 12 }} 
            tickLine={false}
          />
          <YAxis 
            domain={[0, 100]} 
            tick={{ fill: '#64748b', fontSize: 12 }} 
            tickLine={false}
            label={{ value: 'Score (%)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
          />
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="completion" 
            name="Completeness" 
            stroke="#3b82f6" 
            strokeWidth={2} 
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line 
            type="monotone" 
            dataKey="quality" 
            name="Quality Score" 
            stroke="#10b981" 
            strokeWidth={2} 
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
