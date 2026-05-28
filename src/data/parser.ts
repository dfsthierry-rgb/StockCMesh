import Papa from 'papaparse';
import { differenceInDays, parse, isValid } from 'date-fns';
import { InventoryItem } from '../types';

export const parseNumber = (val: string): number => {
  if (!val || val.trim() === '-' || val.trim() === '') return 0;
  // Handle Brazilian formatting: 6.098,90 -> 6098.90
  const cleaned = val.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

export const fetchAndParseData = async (): Promise<InventoryItem[]> => {
  return new Promise((resolve, reject) => {
    // Current date from simulation environment
    const currentDate = new Date('2026-05-28T18:09:49Z');

    Papa.parse('/data.csv', {
      download: true,
      header: true,
      delimiter: ';',
      skipEmptyLines: true,
      complete: (results) => {
        const rawData = results.data as any[];
        const parsedData: InventoryItem[] = rawData.map((row, index) => {
          
          const dtString = row['Dt_Ult_Movto']?.trim();
          let diasParado = 0;
          
          if (dtString) {
            const parsedDate = parse(dtString, 'dd/MM/yyyy', new Date());
            if (isValid(parsedDate)) {
              diasParado = differenceInDays(currentDate, parsedDate);
              if (diasParado < 0) diasParado = 0; // fallback
            }
          }

          const estoque = parseNumber(row['Estoque']);
          const estoqueValorizado = parseNumber(row['Estoque Valorizado']);
          const consumoMedio = parseNumber(row['Consumo Mdio/dia (Ano Atual)'] || row['Consumo M\u00e9dio/dia (Ano Atual)'] || row['Consumo Medio/dia (Ano Atual)']);
          
          // Determine status based on logistics/operational rules
          let status: 'Crítico' | 'Alerta' | 'Saudável' = 'Saudável';
          if (estoque > 0 && diasParado > 180) {
            status = 'Crítico';
          } else if (estoque > 0 && diasParado > 90) {
            status = 'Alerta';
          }

          let grupoDiasParados = '0-30 d';
          if (diasParado > 180) grupoDiasParados = '> 180 d';
          else if (diasParado > 90) grupoDiasParados = '91-180 d';
          else if (diasParado > 30) grupoDiasParados = '31-90 d';

          return {
            id: `${row['Cdigo'] || row['C\u00f3digo'] || row['Codigo'] || index}-${index}`,
            codigo: row['Cdigo'] || row['C\u00f3digo'] || row['Codigo'] || '',
            descricao: row['Descrio'] || row['Descri\u00e7\u00e3o'] || row['Descricao'] || '',
            material: row['Material'] || '',
            malha: row['Malha'] || '',
            fio: row['Fio'] || '',
            largura: row['Largura'] || '',
            unidade: row['Unidade'] || '',
            formaFisica: row['Forma Fsica'] || row['Forma F\u00edsica'] || row['Forma Fisica'] || '',
            classeABC: row['Classe ABC'] || '',
            subClasseABC: row['Sub-classe ABC'] || '',
            estoque,
            estoqueValorizado,
            consumoMedio,
            diasCobertura: parseNumber(row['Dias de Cobertura']),
            precoMedio: parseNumber(row['Preo Mdio'] || row['Pre\u00e7o M\u00e9dio'] || row['Preco Medio'] || '0'),
            critico: row['Crtico'] || row['Cr\u00edtico'] || row['Critico'] || 'Não',
            dtUltMovto: dtString || 'Sem Movimento',
            diasParado,
            grupoDiasParados,
            status,
          };
        });

        // Only drop completely empty rows
        resolve(parsedData.filter(item => item.codigo || item.descricao || item.estoque > 0 || item.estoqueValorizado > 0));
      },
      error: (err) => {
        reject(err);
      }
    });
  });
};
