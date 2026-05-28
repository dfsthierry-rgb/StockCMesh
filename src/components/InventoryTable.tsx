import React, { useState, useMemo } from 'react';
import { InventoryItem } from '../types';
import { cn } from '../lib/utils';
import { ChevronDown, ChevronUp, Search, AlertTriangle, ArrowRight } from 'lucide-react';

interface InventoryTableProps {
  data: InventoryItem[];
}

export function InventoryTable({ data }: InventoryTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof InventoryItem>('estoqueValorizado');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const filteredAndSortedData = useMemo(() => {
    let result = [...data];
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(item => 
        item.descricao.toLowerCase().includes(term) ||
        item.codigo.toLowerCase().includes(term) ||
        item.material.toLowerCase().includes(term)
      );
    }

    result.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      return 0;
    });

    return result;
  }, [data, searchTerm, sortField, sortDirection]);

  const handleSort = (field: keyof InventoryItem) => {
    if (field === sortField) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const currencyFormatter = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const SortIcon = ({ field }: { field: keyof InventoryItem }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };

  return (
    <div className="bg-[#0F1116] rounded-lg border border-slate-800 overflow-hidden flex flex-col">
      <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#151921]">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-widest">Inventário Detalhado</h3>
          <p className="text-[10px] text-slate-500 uppercase mt-1">Foco em Excesso e Ociosidade</p>
        </div>
        
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-500" />
          </div>
          <input
            type="text"
            placeholder="Buscar item, código, material..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 w-full sm:w-72 bg-[#1A1F26] border border-slate-700 rounded text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-sans"
          />
        </div>
      </div>

      <div className="overflow-x-auto print:overflow-x-visible">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#0A0C10] text-slate-500 uppercase text-[10px] font-bold">
              <th className="p-3 border-b border-slate-800 cursor-pointer hover:text-slate-300 transition-colors" onClick={() => handleSort('codigo')}>
                <div className="flex items-center gap-2">Código <SortIcon field="codigo" /></div>
              </th>
              <th className="p-3 border-b border-slate-800 cursor-pointer hover:text-slate-300 transition-colors w-[300px]" onClick={() => handleSort('descricao')}>
                <div className="flex items-center gap-2">Descrição <SortIcon field="descricao" /></div>
              </th>
              <th className="p-3 border-b border-slate-800 cursor-pointer hover:text-slate-300 transition-colors text-center" onClick={() => handleSort('unidade')}>
                <div className="flex items-center justify-center gap-2">Un <SortIcon field="unidade" /></div>
              </th>
              <th className="p-3 border-b border-slate-800 cursor-pointer hover:text-slate-300 transition-colors" onClick={() => handleSort('grupoDiasParados')}>
                <div className="flex items-center gap-2">Status <SortIcon field="grupoDiasParados" /></div>
              </th>
              <th className="p-3 border-b border-slate-800 cursor-pointer hover:text-slate-300 transition-colors" onClick={() => handleSort('classeABC')}>
                <div className="flex items-center gap-2">ABC <SortIcon field="classeABC" /></div>
              </th>
              <th className="p-3 border-b border-slate-800 cursor-pointer hover:text-slate-300 transition-colors text-right" onClick={() => handleSort('estoque')}>
                <div className="flex items-center justify-end gap-2">Qtd. Estoque <SortIcon field="estoque" /></div>
              </th>
              <th className="p-3 border-b border-slate-800 cursor-pointer hover:text-slate-300 transition-colors text-right" onClick={() => handleSort('estoqueValorizado')}>
                <div className="flex items-center justify-end gap-2">Valor Total <SortIcon field="estoqueValorizado" /></div>
              </th>
              <th className="p-3 border-b border-slate-800 cursor-pointer hover:text-slate-300 transition-colors text-right" onClick={() => handleSort('diasParado')}>
                <div className="flex items-center justify-end gap-2">Dias Parado <SortIcon field="diasParado" /></div>
              </th>
            </tr>
          </thead>
          <tbody className="text-slate-300">
            {filteredAndSortedData.slice(0, 1500).map((item, idx) => (
              <tr 
                key={item.id + idx} 
                className={cn(
                  "border-b border-slate-800/50 transition-colors hover:bg-white/5",
                  item.status === 'Crítico' ? 'bg-red-500/5 print:bg-red-50' : 
                  item.status === 'Alerta' ? 'bg-amber-500/5 print:bg-yellow-50' : ''
                )}
              >
                <td className="p-3 font-mono text-slate-400">{item.codigo}</td>
                <td className="p-3 font-medium text-white truncate max-w-[300px]" title={item.descricao}>
                  {item.descricao}
                  <div className="text-[10px] font-normal text-slate-500 mt-0.5">{item.material}</div>
                </td>
                <td className="p-3 text-center text-slate-400 font-mono text-[10px]">{item.unidade}</td>
                <td className="p-3">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[9px] font-bold border",
                    item.grupoDiasParados === '> 180 d' ? "bg-red-500/20 text-red-400 border-red-500/20" :
                    item.grupoDiasParados === '91-180 d' ? "bg-amber-500/20 text-amber-400 border-amber-500/20" :
                    item.grupoDiasParados === '31-90 d' ? "bg-blue-500/20 text-blue-400 border-blue-500/20" :
                    "bg-indigo-500/20 text-indigo-400 border-indigo-500/20"
                  )}>
                    {item.grupoDiasParados}
                  </span>
                </td>
                <td className="p-3 font-mono text-slate-400">{item.classeABC || '-'}</td>
                <td className={cn("p-3 text-right font-mono font-bold", item.status === 'Crítico' ? 'text-red-400' : item.status === 'Alerta' ? 'text-amber-400' : 'text-slate-300')}>
                  {new Intl.NumberFormat('pt-BR').format(item.estoque)}
                </td>
                <td className="p-3 text-right font-mono text-white">
                  {currencyFormatter(item.estoqueValorizado)}
                </td>
                <td className="p-3 text-right">
                  <span className={cn(
                    "font-bold text-center block w-full",
                    item.diasParado > 180 ? 'text-red-500' : 
                    item.diasParado > 90 ? 'text-amber-500' : 'text-slate-400'
                  )}>
                    {item.diasParado} d
                  </span>
                  <div className="text-[10px] text-slate-500 mt-0.5 text-center">{item.dtUltMovto}</div>
                </td>
              </tr>
            ))}
            {filteredAndSortedData.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-500 text-xs">
                  Nenhum item encontrado.
                </td>
              </tr>
            )}
            {filteredAndSortedData.length > 1500 && (
              <tr className="print:hidden">
                <td colSpan={7} className="p-4 text-center text-[10px] uppercase tracking-widest text-slate-500 bg-[#0A0C10]">
                  Exibindo os primeiros 1500 itens de {filteredAndSortedData.length} resultados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
