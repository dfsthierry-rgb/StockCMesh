import * as XLSX from 'xlsx';
import { InventoryItem } from '../types';

/**
 * Exports inventory data to a beautifully formatted Excel workbook (.xlsx)
 * with separate sheets for Detailed, Grouped, and Unit Summary views.
 */
export function exportToExcel(data: InventoryItem[], activeFilters: string) {
  const wb = XLSX.utils.book_new();

  // 1. Sheet: Resumo por Unidade Medida
  const unitSummary = calculateUnitSummary(data);
  const wsUnits = XLSX.utils.json_to_sheet(unitSummary);
  XLSX.utils.book_append_sheet(wb, wsUnits, "Resumo por Unidade");

  // 2. Sheet: Visão Agrupada (Material, Malha, Fio)
  const aggregatedData = calculateGroupedData(data);
  const wsGrouped = XLSX.utils.json_to_sheet(aggregatedData);
  XLSX.utils.book_append_sheet(wb, wsGrouped, "Grupos Agrupados");

  // 3. Sheet: Detalhado (Todas as Linhas)
  const detailedData = data.map(item => ({
    'Código': item.codigo,
    'Descrição': item.descricao,
    'Material': item.material || 'N/A',
    'Malha': item.malha || '-',
    'Fio': item.fio || '-',
    'Largura': item.largura || '-',
    'Unidade': item.unidade,
    'Forma Física': item.formaFisica || '-',
    'Classe ABC': item.classeABC || 'C',
    'Sub-classe ABC': item.subClasseABC || '-',
    'Qtd Estoque': item.estoque,
    'Estoque Valorizado (R$)': item.estoqueValorizado,
    'Consumo Médio/Dia': item.consumoMedio,
    'Dias Cobertura': item.diasCobertura,
    'Preço Médio (R$)': item.precoMedio,
    'Última Movimentação': item.dtUltMovto,
    'Dias Parado': item.diasParado,
    'Grupo Dias Parado': item.grupoDiasParados
  }));
  const wsDetailed = XLSX.utils.json_to_sheet(detailedData);
  XLSX.utils.book_append_sheet(wb, wsDetailed, "Itens Detalhados");

  // Save the workbook
  const timestamp = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `relatorio_estoque_board_${timestamp}.xlsx`);
}

/**
 * Exports inventory data to standard CSV
 */
export function exportToCSV(data: InventoryItem[]) {
  const headers = [
    'Codigo', 'Descricao', 'Material', 'Malha', 'Fio', 'Unidade', 
    'ClasseABC', 'SubClasseABC', 'Estoque', 'EstoqueValorizado', 
    'DiasParado', 'GrupoDiasParados', 'DtUltMovto'
  ];

  const rows = data.map(item => [
    item.codigo,
    `"${item.descricao.replace(/"/g, '""')}"`,
    item.material,
    item.malha || '-',
    item.fio || '-',
    item.unidade,
    item.classeABC,
    item.subClasseABC || '-',
    item.estoque.toFixed(2),
    item.estoqueValorizado.toFixed(2),
    item.diasParado,
    item.grupoDiasParados,
    item.dtUltMovto
  ]);

  // Use semicolon separator to make it Brazilian/European compatible by default
  const csvContent = "sep=;\n" + 
    [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');

  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const timestamp = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `relatorio_estoque_board_${timestamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function calculateUnitSummary(data: InventoryItem[]) {
  const units = ['KG', 'M', 'M2', 'PC', 'RL', 'UN'];
  const summaryMap: Record<string, { qty: number; val: number; count: number }> = {};
  
  units.forEach(u => {
    summaryMap[u] = { qty: 0, val: 0, count: 0 };
  });

  data.forEach(item => {
    const u = item.unidade || 'Outros';
    if (!summaryMap[u]) {
      summaryMap[u] = { qty: 0, val: 0, count: 0 };
    }
    summaryMap[u].qty += item.estoque;
    summaryMap[u].val += item.estoqueValorizado;
    summaryMap[u].count += 1;
  });

  let totalQty = 0;
  let totalVal = 0;
  let totalSkus = 0;

  const result = Object.entries(summaryMap).map(([unit, metrics]) => {
    totalQty += metrics.qty;
    totalVal += metrics.val;
    totalSkus += metrics.count;
    
    return {
      'Unidade': unit,
      'Soma de SKUs': metrics.count,
      'Soma de Estoque': parseFloat(metrics.qty.toFixed(2)),
      'Soma de Estoque Valorizado (R$)': parseFloat(metrics.val.toFixed(2)),
      'Participação Financeira (%)': data.length > 0 ? parseFloat(((metrics.val / data.reduce((acc, curr) => acc + curr.estoqueValorizado, 0)) * 100).toFixed(2)) : 0
    };
  });

  // Sort by financial value desc
  result.sort((a, b) => b['Soma de Estoque Valorizado (R$)'] - a['Soma de Estoque Valorizado (R$)']);

  // Add General Total Row
  result.push({
    'Unidade': 'TOTAL GERAL',
    'Soma de SKUs': totalSkus,
    'Soma de Estoque': parseFloat(totalQty.toFixed(2)),
    'Soma de Estoque Valorizado (R$)': parseFloat(totalVal.toFixed(2)),
    'Participação Financeira (%)': 100.00
  });

  return result;
}

function calculateGroupedData(data: InventoryItem[]) {
  const map = new Map<string, { material: string; malha: string; fio: string; skus: number; qty: number; val: number }>();
  
  data.forEach(item => {
    const mat = item.material || 'Outros';
    const malha = item.malha || '-';
    const fio = item.fio || '-';
    const key = `${mat}•${malha}•${fio}`;

    if (!map.has(key)) {
      map.set(key, { material: mat, malha, fio, skus: 0, qty: 0, val: 0 });
    }
    
    const entry = map.get(key)!;
    entry.skus += 1;
    entry.qty += item.estoque;
    entry.val += item.estoqueValorizado;
  });

  const result = Array.from(map.values()).map(e => ({
    'Material': e.material,
    'Malha': e.malha,
    'Fio': e.fio,
    'Descrição': `${e.material} • Malha ${e.malha} • Fio ${e.fio}`,
    'Quantidade SKUs': e.skus,
    'Quantidade de Estoque': parseFloat(e.qty.toFixed(2)),
    'Valor Total Acumulado (R$)': parseFloat(e.val.toFixed(2))
  }));

  result.sort((a, b) => b['Valor Total Acumulado (R$)'] - a['Valor Total Acumulado (R$)']);
  return result;
}
