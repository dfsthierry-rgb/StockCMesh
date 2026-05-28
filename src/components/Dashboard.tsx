import React, { useEffect, useState, useMemo } from 'react';
import { InventoryItem } from '../types';
import { fetchAndParseData } from '../data/parser';
import { StatCard } from './StatCard';
import { InventoryCharts } from './Charts';
import { InventoryTable } from './InventoryTable';
import { AggregatedTable } from './AggregatedTable';
import { Box, PackageX, Activity, AlertCircle, RefreshCcw, Layers, List } from 'lucide-react';

export function Dashboard() {
  const [data, setData] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [viewMode, setViewMode] = useState<'detailed' | 'aggregated'>('detailed');

  // Filters
  const [selectedMaterial, setSelectedMaterial] = useState<string>('Todos');
  const [selectedMalha, setSelectedMalha] = useState<string>('Todos');
  const [selectedFio, setSelectedFio] = useState<string>('Todos');
  const [selectedClasseABC, setSelectedClasseABC] = useState<string>('Todos');
  const [selectedSubClasseABC, setSelectedSubClasseABC] = useState<string>('Todos');
  const [selectedGrupoDias, setSelectedGrupoDias] = useState<string>('Todos');

  useEffect(() => {
    const loadData = async () => {
      try {
        const parsed = await fetchAndParseData();
        setData(parsed);
      } catch (err) {
        console.error(err);
        setError('Ocorreu um erro ao carregar os dados.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const getDistinct = (field: keyof InventoryItem) => {
    const vals = new Set(data.map(d => String(d[field] || '')).filter(v => v.trim() !== ''));
    return ['Todos', ...Array.from(vals).sort()];
  };

  const materials = useMemo(() => getDistinct('material'), [data]);
  const malhas = useMemo(() => getDistinct('malha'), [data]);
  const fios = useMemo(() => getDistinct('fio'), [data]);
  const classesABC = useMemo(() => getDistinct('classeABC'), [data]);
  const subClassesABC = useMemo(() => getDistinct('subClasseABC'), [data]);
  const gruposDias = useMemo(() => ['Todos', '0-30 d', '31-90 d', '91-180 d', '> 180 d'], []);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const m1 = selectedMaterial === 'Todos' || item.material === selectedMaterial;
      const m2 = selectedMalha === 'Todos' || item.malha === selectedMalha;
      const m3 = selectedFio === 'Todos' || item.fio === selectedFio;
      const m4 = selectedClasseABC === 'Todos' || item.classeABC === selectedClasseABC;
      const m5 = selectedSubClasseABC === 'Todos' || item.subClasseABC === selectedSubClasseABC;
      const m6 = selectedGrupoDias === 'Todos' || item.grupoDiasParados === selectedGrupoDias;
      
      return m1 && m2 && m3 && m4 && m5 && m6;
    });
  }, [data, selectedMaterial, selectedMalha, selectedFio, selectedClasseABC, selectedSubClasseABC, selectedGrupoDias]);

  const kpis = useMemo(() => {
    let val = 0;
    let qty = 0;
    let itemsCount = 0;
    let valorParadoCritico = 0;
    let diasCoberturaSum = 0;
    let countComCobertura = 0;

    filteredData.forEach(item => {
      val += item.estoqueValorizado || 0;
      qty += item.estoque || 0;
      
      if (item.estoque > 0 || (item.estoqueValorizado && item.estoqueValorizado > 0)) {
        itemsCount++;
      }

      if (item.grupoDiasParados === '> 180 d') {
        valorParadoCritico += item.estoqueValorizado || 0;
      }

      if (item.diasCobertura > 0) {
        diasCoberturaSum += item.diasCobertura;
        countComCobertura++;
      }
    });

    const avgCobertura = countComCobertura > 0 ? Math.round(diasCoberturaSum / countComCobertura) : 0;

    return {
      valorTotal: val,
      qtyTotal: qty,
      items: itemsCount,
      valorCritico: valorParadoCritico,
      avgCobertura
    };
  }, [filteredData]);

  const currencyFormatter = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(value);
  const numberFormatter = (value: number) => 
    new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="animate-spin text-indigo-500">
          <RefreshCcw className="w-8 h-8" />
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-red-500 font-medium">{error}</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      
      {/* Header & Filters */}
      <div className="flex flex-col gap-4 bg-[#0F1116] border border-slate-800 rounded-lg p-4 print:hidden">
        <div>
          <h2 className="text-xs font-bold text-indigo-400 uppercase tracking-widest pb-1 border-b border-slate-800 inline-block">Filtros Estratégicos</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 w-full">
          {/* Fio */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-500 uppercase block">Material</label>
            <select 
              className="bg-[#1A1F26] border border-slate-700 text-xs text-white rounded p-2 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-full"
              value={selectedMaterial}
              onChange={e => setSelectedMaterial(e.target.value)}
            >
              {materials.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-500 uppercase block">Malha</label>
            <select 
              className="bg-[#1A1F26] border border-slate-700 text-xs text-white rounded p-2 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-full"
              value={selectedMalha}
              onChange={e => setSelectedMalha(e.target.value)}
            >
              {malhas.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-500 uppercase block">Fio</label>
            <select 
              className="bg-[#1A1F26] border border-slate-700 text-xs text-white rounded p-2 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-full"
              value={selectedFio}
              onChange={e => setSelectedFio(e.target.value)}
            >
              {fios.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-500 uppercase block">Curva ABC</label>
            <select 
              className="bg-[#1A1F26] border border-slate-700 text-xs text-white rounded p-2 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-full"
              value={selectedClasseABC}
              onChange={e => setSelectedClasseABC(e.target.value)}
            >
              {classesABC.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-500 uppercase block">Subgrupo ABC</label>
            <select 
              className="bg-[#1A1F26] border border-slate-700 text-xs text-white rounded p-2 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-full"
              value={selectedSubClasseABC}
              onChange={e => setSelectedSubClasseABC(e.target.value)}
            >
              {subClassesABC.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-500 uppercase block">Status (Dias Parados)</label>
            <select 
              className="bg-[#1A1F26] border border-slate-700 text-xs text-white rounded p-2 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-full"
              value={selectedGrupoDias}
              onChange={e => setSelectedGrupoDias(e.target.value)}
            >
              {gruposDias.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard 
          title="Valor Total em Estoque" 
          value={currencyFormatter(kpis.valorTotal)}
          icon={Box}
          subtitle="Capital imobilizado"
        />
        <StatCard 
          title="Quantidade Total" 
          value={numberFormatter(kpis.qtyTotal)}
          icon={PackageX}
          subtitle="Em todas as unidades"
        />
        <StatCard 
          title="Itens com Estoque" 
          value={Intl.NumberFormat('pt-BR').format(kpis.items)}
          icon={PackageX}
          subtitle="SKUs distintos ativos"
        />
        <StatCard 
          title="Capital Parado (>180d)" 
          value={currencyFormatter(kpis.valorCritico)}
          icon={AlertCircle}
          subtitle="Ação sugerida urgente"
          className="border-red-500/50 bg-[#1A1116]"
        />
        <StatCard 
          title="Cobertura Média" 
          value={`${kpis.avgCobertura} dias`}
          icon={Activity}
          subtitle="Baseada no consumo anual"
        />
      </div>

      {/* Charts */}
      <InventoryCharts data={filteredData} />

      {/* Table Section */}
      <div className="flex flex-col gap-2 mt-4">
        <div className="flex items-center gap-2 mb-2 print:hidden">
          <button 
            onClick={() => setViewMode('detailed')}
            className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold uppercase tracking-widest transition-colors ${viewMode === 'detailed' ? 'bg-indigo-600 text-white' : 'bg-[#1A1F26] text-slate-400 hover:text-white'}`}
          >
            <List className="w-4 h-4" /> Detalhado
          </button>
          <button 
            onClick={() => setViewMode('aggregated')}
            className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold uppercase tracking-widest transition-colors ${viewMode === 'aggregated' ? 'bg-indigo-600 text-white' : 'bg-[#1A1F26] text-slate-400 hover:text-white'}`}
          >
            <Layers className="w-4 h-4" /> Agrupado
          </button>
        </div>
        
        {viewMode === 'detailed' ? (
          <InventoryTable data={filteredData} />
        ) : (
          <AggregatedTable data={filteredData} />
        )}
      </div>

    </div>
  );
}
