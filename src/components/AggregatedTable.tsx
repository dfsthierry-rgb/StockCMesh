import React, { useMemo, useState } from 'react';
import { InventoryItem } from '../types';
import { cn } from '../lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface AggregatedTableProps {
  data: InventoryItem[];
}

interface GroupedItem {
  id: string;
  material: string;
  malha: string;
  fio: string;
  concatenated: string;
  qtyTotal: number;
  valorTotal: number;
  qtdSkus: number;
  unidades: Set<string>;
}

export function AggregatedTable({ data }: AggregatedTableProps) {
  const [sortField, setSortField] = useState<keyof GroupedItem>('valorTotal');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const groupedData = useMemo(() => {
    const map = new Map<string, GroupedItem>();
    
    data.forEach(item => {
      const material = item.material?.trim() || 'N/A';
      const malha = item.malha?.trim() || 'N/A';
      const fio = item.fio?.trim() || 'N/A';
      
      const key = `${material}-${malha}-${fio}`;

      if (!map.has(key)) {
        map.set(key, {
          id: key,
          material,
          malha,
          fio,
          concatenated: `${material} • ${malha} • ${fio}`,
          qtyTotal: 0,
          valorTotal: 0,
          qtdSkus: 0,
          unidades: new Set<string>()
        });
      }

      const entry = map.get(key)!;
      entry.qtyTotal += item.estoque;
      entry.valorTotal += item.estoqueValorizado;
      entry.qtdSkus += 1;
      if (item.unidade) {
        entry.unidades.add(item.unidade);
      }
    });

    const result = Array.from(map.values());

    result.sort((a, b) => {
      const aVal = a[sortField] as any;
      const bVal = b[sortField] as any;
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });

    return result;
  }, [data, sortField, sortDirection]);

  // Reset page when data or sort changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [data.length, sortField, sortDirection]);

  const totalPages = Math.ceil(groupedData.length / itemsPerPage);
  const paginatedData = groupedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSort = (field: keyof GroupedItem) => {
    if (field === sortField) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const currencyFormatter = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const SortIcon = ({ field }: { field: keyof GroupedItem }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };

  return (
    <div className="bg-[#0F1116] border border-slate-800 rounded-lg shadow-xl overflow-hidden flex flex-col mt-4">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h2 className="text-white font-medium text-sm flex items-center gap-2">Visão Agrupada</h2>
          <p className="text-slate-500 text-xs mt-1">Material, Malha e Fio concatenados</p>
        </div>
      </div>

      <div className="overflow-x-auto print:overflow-x-visible">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#0A0C10] text-slate-500 uppercase text-[10px] font-bold">
              <th className="p-3 border-b border-slate-800 cursor-pointer hover:text-slate-300 transition-colors w-[400px]" onClick={() => handleSort('concatenated')}>
                <div className="flex items-center gap-2">Material • Malha • Fio <SortIcon field="concatenated" /></div>
              </th>
              <th className="p-3 border-b border-slate-800 text-center">
                Unidades
              </th>
              <th className="p-3 border-b border-slate-800 cursor-pointer hover:text-slate-300 transition-colors text-right" onClick={() => handleSort('qtdSkus')}>
                <div className="flex items-center justify-end gap-2">Skus (<span className="text-indigo-400">Total</span>) <SortIcon field="qtdSkus" /></div>
              </th>
              <th className="p-3 border-b border-slate-800 cursor-pointer hover:text-slate-300 transition-colors text-right" onClick={() => handleSort('qtyTotal')}>
                <div className="flex items-center justify-end gap-2">Qtd. Estoque <SortIcon field="qtyTotal" /></div>
              </th>
              <th className="p-3 border-b border-slate-800 cursor-pointer hover:text-slate-300 transition-colors text-right" onClick={() => handleSort('valorTotal')}>
                <div className="flex items-center justify-end gap-2">Valor Total <SortIcon field="valorTotal" /></div>
              </th>
            </tr>
          </thead>
          <tbody className="text-slate-300">
            {paginatedData.map((item, idx) => (
              <tr 
                key={item.id + idx} 
                className="border-b border-slate-800/50 transition-colors hover:bg-white/5"
              >
                <td className="p-3 font-medium text-white truncate max-w-[400px]" title={item.concatenated}>
                  {item.concatenated}
                </td>
                <td className="p-3 text-center text-slate-400 text-[10px]">
                  {Array.from(item.unidades).join(', ')}
                </td>
                <td className="p-3 text-right text-slate-400 font-mono">
                  {new Intl.NumberFormat('pt-BR').format(item.qtdSkus)}
                </td>
                <td className="p-3 text-right font-mono font-bold text-slate-300">
                  {new Intl.NumberFormat('pt-BR').format(Math.round(item.qtyTotal * 100) / 100)}
                </td>
                <td className="p-3 text-right font-mono text-white">
                  {currencyFormatter(item.valorTotal)}
                </td>
              </tr>
            ))}
            {groupedData.length > 0 && (
              <tr className="bg-[#131721] font-bold text-sm border-t border-slate-700/80">
                <td colSpan={2} className="p-3 text-left text-white uppercase tracking-wider text-[11px] font-bold">
                  Soma Total do Relatório ({groupedData.length} Grupos)
                </td>
                <td className="p-3 text-right font-mono text-slate-400">
                  {new Intl.NumberFormat('pt-BR').format(
                    groupedData.reduce((acc, curr) => acc + curr.qtdSkus, 0)
                  )}
                </td>
                <td className="p-3 text-right font-mono text-indigo-300">
                  {new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(
                    groupedData.reduce((acc, curr) => acc + curr.qtyTotal, 0)
                  )}
                </td>
                <td className="p-3 text-right font-mono text-emerald-400">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    groupedData.reduce((acc, curr) => acc + curr.valorTotal, 0)
                  )}
                </td>
              </tr>
            )}
            
            {totalPages > 1 && (
              <tr className="print:hidden">
                <td colSpan={5} className="p-4 bg-[#0A0C10] border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-mono">
                      Página {currentPage} de {totalPages} ({groupedData.length} grupos)
                    </span>
                    <div className="flex gap-2">
                       <button 
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 bg-[#1A1F26] text-white text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2D3748] rounded"
                      >
                        Anterior
                      </button>
                      <button 
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 bg-[#1A1F26] text-white text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2D3748] rounded"
                      >
                        Próxima
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
