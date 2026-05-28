import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, ComposedChart, Line } from 'recharts';
import { InventoryItem } from '../types';

interface InventoryChartsProps {
  data: InventoryItem[];
}

const COLORS = ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff', '#4f46e5', '#4338ca', '#3730a3'];
const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#cbd5e1']; // A, B, C

export function InventoryCharts({ data }: InventoryChartsProps) {
  
  const valueByMaterial = useMemo(() => {
    const reduced = data.reduce((acc, current) => {
      const mat = current.material || 'Outros/N/A';
      acc[mat] = (acc[mat] || 0) + current.estoqueValorizado;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(reduced)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 resources
  }, [data]);

  const valueByClass = useMemo(() => {
    const reduced = data.reduce((acc, current) => {
      const cls = current.classeABC ? `Classe ${current.classeABC}` : 'Sem Classe';
      acc[cls] = (acc[cls] || 0) + current.estoqueValorizado;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(reduced)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const valueByAging = useMemo(() => {
    const buckets = [
      { name: '0-30 d', value: 0 },
      { name: '31-90 d', value: 0 },
      { name: '91-180 d', value: 0 },
      { name: '> 180 d', value: 0 }
    ];
    data.forEach(item => {
      if (item.diasParado <= 30) buckets[0].value += item.estoqueValorizado;
      else if (item.diasParado <= 90) buckets[1].value += item.estoqueValorizado;
      else if (item.diasParado <= 180) buckets[2].value += item.estoqueValorizado;
      else buckets[3].value += item.estoqueValorizado;
    });
    return buckets;
  }, [data]);

  const valueAndQtyTop = useMemo(() => {
    return [...data]
      .filter(i => i.estoqueValorizado > 0)
      .sort((a, b) => b.estoqueValorizado - a.estoqueValorizado)
      .slice(0, 10)
      .map(item => ({
        name: item.codigo.slice(0, 15) + (item.codigo.length > 15 ? '...' : ''),
        fullname: item.descricao,
        valor: item.estoqueValorizado,
        quantidade: item.estoque
      }));
  }, [data]);

  const currencyFormatter = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(value);

  const customTooltipStyle = { backgroundColor: '#1A1F26', borderRadius: '8px', border: '1px solid #334155', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', color: '#f8fafc' };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      
      {/* Chart: Valor por Tempo (Aging) */}
      <div className="bg-[#0F1116] rounded-lg border border-slate-800 p-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-800 pb-2 inline-block">Valor por Dias Parados</h3>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={valueByAging} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tickFormatter={currencyFormatter}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
              />
              <Tooltip 
                cursor={{ fill: '#1e293b' }}
                contentStyle={customTooltipStyle}
                formatter={(value: number) => currencyFormatter(value)}
              />
              <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]}>
                {valueByAging.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 3 ? '#ef4444' : index === 2 ? '#f59e0b' : '#3b82f6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart: Curva ABC */}
      <div className="bg-[#0F1116] rounded-lg border border-slate-800 p-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-800 pb-2 inline-block">Valor por Curva ABC</h3>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={valueByClass}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {valueByClass.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length] || '#475569'} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => currencyFormatter(value)}
                contentStyle={customTooltipStyle}
              />
              <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart: Valor vs Quantidade (Top 10) */}
      <div className="bg-[#0F1116] rounded-lg border border-slate-800 p-4 lg:col-span-2 print:break-inside-avoid">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-800 pb-2 inline-block">Top 10 Valor vs Quantidade</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={valueAndQtyTop} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} angle={-15} textAnchor="end" height={60} />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tickFormatter={currencyFormatter} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip cursor={{ fill: '#1e293b' }} contentStyle={customTooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '10px', color: '#94a3b8', paddingTop: '10px' }} />
              <Bar yAxisId="left" dataKey="valor" fill="#6366f1" radius={[4, 4, 0, 0]} name="Valor Total (R$)" />
              <Line yAxisId="right" type="monotone" dataKey="quantidade" stroke="#10b981" strokeWidth={2} name="Quantidade (Estoque)" dot={{ r: 4, strokeWidth: 2, fill: '#10b981' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}
