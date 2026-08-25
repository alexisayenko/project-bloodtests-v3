import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceArea, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useLang } from '../../i18n/LangContext';
import { useData } from '../../data/DataContext';
import { getAnalysisName } from '../../utils/analysis';
import type { Result } from '../../types';

interface DataPoint {
  date: string;
  dateLabel: string;
  value: number | null;
  refMin: number | null;
  refMax: number | null;
}

interface Props {
  loinc: string;
  results: { date: string; result: Result }[];
}

export function BiomarkerChart({ loinc, results }: Props) {
  const { lang } = useLang();
  const { analysesCatalog } = useData();
  const name = getAnalysisName(loinc, analysesCatalog, lang);
  const unit = results.find(r => r.result.unit)?.result.unit || '';

  const data = useMemo(() => {
    return results
      .filter(r => r.result.value != null)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(r => ({
        date: r.date,
        dateLabel: r.date.slice(0, 7), // YYYY-MM
        value: r.result.value,
        refMin: r.result.refMin,
        refMax: r.result.refMax,
      }));
  }, [results]);

  if (data.length === 0) return null;

  // Get reference range (use first non-null)
  const refMin = data.find(d => d.refMin != null)?.refMin ?? null;
  const refMax = data.find(d => d.refMax != null)?.refMax ?? null;

  // Calculate Y domain with some padding
  const allValues = data.map(d => d.value!);
  const minVal = Math.min(...allValues, refMin ?? Infinity);
  const maxVal = Math.max(...allValues, refMax ?? -Infinity);
  const padding = (maxVal - minVal) * 0.15 || 1;
  const yMin = Math.max(0, minVal - padding);
  const yMax = maxVal + padding;

  return (
    <div className="biomarker-chart">
      <div className="biomarker-chart-title">
        {name}
        {unit && <span className="biomarker-chart-unit">{unit}</span>}
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          {refMin != null && refMax != null && (
            <ReferenceArea
              y1={refMin}
              y2={refMax}
              fill="#dcfce7"
              fillOpacity={0.6}
              strokeOpacity={0}
            />
          )}
          {refMin != null && (
            <ReferenceLine y={refMin} stroke="#86efac" strokeDasharray="4 4" strokeWidth={1} />
          )}
          {refMax != null && (
            <ReferenceLine y={refMax} stroke="#86efac" strokeDasharray="4 4" strokeWidth={1} />
          )}
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            width={45}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
            labelFormatter={(label) => label}
            formatter={(value) => [String(value), name]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#2563eb"
            strokeWidth={2}
            dot={(props: Record<string, unknown>) => {
              const { cx, cy, payload } = props as { cx: number; cy: number; payload: DataPoint };
              if (!payload || payload.value == null) return <circle key="empty" r={0} />;
              const isOOR = (payload.refMin != null && payload.value < payload.refMin) ||
                            (payload.refMax != null && payload.value > payload.refMax);
              return (
                <circle
                  key={`${cx}-${cy}`}
                  cx={cx}
                  cy={cy}
                  r={isOOR ? 5 : 3.5}
                  fill={isOOR ? '#dc2626' : '#2563eb'}
                  stroke="white"
                  strokeWidth={2}
                />
              );
            }}
            activeDot={{ r: 5, fill: '#2563eb', stroke: 'white', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
