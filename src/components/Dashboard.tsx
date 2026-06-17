import React, { useState, useMemo, useRef, useEffect } from 'react';
import { InventoryItem } from '../types';
import { exportToExcel, exportToCSV } from '../utils/export';
import { saveDataset, getDataset } from '../lib/firestoreService';
import { useReactToPrint } from 'react-to-print';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { StatCard } from './StatCard';
import { InventoryTable } from './InventoryTable';
import { AggregatedTable } from './AggregatedTable';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, ComposedChart, Line, AreaChart, Area
} from 'recharts';
import { 
  Box, Package, Activity, AlertCircle, RefreshCcw, Layers, List, 
  Upload, Download, FileSpreadsheet, Sparkles, TrendingUp, Filter, 
  Eye, Printer, Calendar, ShieldAlert, CheckCircle2, ChevronRight, Settings
} from 'lucide-react';
import Papa from 'papaparse';

const COLORS = ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff', '#4f46e5', '#4338ca', '#3730a3'];
const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#cbd5e1']; // A, B, C, Outros
const AGING_COLORS = ['#3b82f6', '#10b981', '#fbbf24', '#f59e0b', '#ea580c', '#ef4444', '#991b1b']; // 0-30, 31-90, 91-180, 181-360, 361-540, 541-720, > 720

export function Dashboard() {
  // Data States loading synchronously from localStorage for instant, offline-friendly access
  const [data, setData] = useState<InventoryItem[]>(() => {
    try {
      const cached = localStorage.getItem('last_dataset_items');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Could not load last offline data", e);
    }
    return [];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Default tab is 'resumo' if we already have offline analysis data loaded
  const [activeTab, setActiveTab] = useState<'config' | 'resumo' | 'valor' | 'quantidade' | 'abc' | 'aging' | 'tabela'>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('datasetId')) return 'resumo';
    try {
      const cached = localStorage.getItem('last_dataset_items');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return 'resumo';
        }
      }
    } catch (e) {}
    return 'config';
  });
  const [viewMode, setViewMode] = useState<'detailed' | 'aggregated'>('detailed');
  const [analysisMode, setAnalysisMode] = useState<'valor' | 'quantidade'>('valor');
  const [hideZeroes, setHideZeroes] = useState<boolean>(true);
  const componentRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: 'Relatorio_CentralMesh',
  });

  // Filters
  const [selectedMaterial, setSelectedMaterial] = useState<string>('Todos');
  const [selectedMalha, setSelectedMalha] = useState<string>('Todos');
  const [selectedFio, setSelectedFio] = useState<string>('Todos');
  const [selectedClasseABC, setSelectedClasseABC] = useState<string>('Todos');
  const [selectedSubClasseABC, setSelectedSubClasseABC] = useState<string>('Todos');
  const [selectedGrupoDias, setSelectedGrupoDias] = useState<string>('Todos');
  const [shareUrl, setShareUrl] = useState<string>('');
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const datasetId = urlParams.get('datasetId');
    
    if (datasetId) {
      setShareUrl(window.location.href);
      setLoading(true);
      getDataset(datasetId)
        .then(savedData => {
          if (savedData && Array.isArray(savedData) && savedData.length > 0) {
            setData(savedData);
            setActiveTab('resumo');
            try {
              localStorage.setItem('last_dataset_id', datasetId);
              localStorage.setItem('last_dataset_items', JSON.stringify(savedData));
            } catch (err) {
              console.warn("localStorage quota exceeded caching loaded dataset", err);
            }
          } else {
            // Backup fallback to local express api
            fetch(`/api/dataset/${datasetId}`)
              .then(res => res.json())
              .then(apiData => {
                if (Array.isArray(apiData) && apiData.length > 0) {
                  setData(apiData);
                  setActiveTab('resumo');
                  try {
                    localStorage.setItem('last_dataset_id', datasetId);
                    localStorage.setItem('last_dataset_items', JSON.stringify(apiData));
                  } catch (err) {
                    console.warn("localStorage quota exceeded caching fallback dataset", err);
                  }
                } else {
                  throw new Error('Dataset vazio ou não encontrado');
                }
              })
              .catch(err => {
                console.error("API backup failed too, loading default dataset", err);
                fetch('./default_dataset.json')
                  .then(res => res.json())
                  .then(defaultData => {
                    if (Array.isArray(defaultData)) {
                       setData(defaultData);
                       setActiveTab('resumo');
                       alert("Aviso: O link compartilhado não pôde ser carregado (possivelmente expirou devido a limitações de hospedagem temporária). Carregando o relatório executivo padrão para demonstração.");
                       // Remove from URL so they don't get confused
                       const newUrl = new URL(window.location.href);
                       newUrl.searchParams.delete('datasetId');
                       window.history.replaceState({ path: newUrl.href }, '', newUrl.href);
                    }
                  }).catch(e => setError("Falha ao carregar os dados. O link compartilhado pode ter expirado."));
              });
          }
        })
        .catch(err => {
           console.error("Failed to load Firebase dataset, trying default", err);
           fetch('./default_dataset.json')
             .then(res => res.json())
             .then(defaultData => {
               if (Array.isArray(defaultData)) {
                  setData(defaultData);
                  setActiveTab('resumo');
               }
             }).catch(e => setError("Falha ao carregar os dados."));
        })
        .finally(() => setLoading(false));
    } else {
      // Automatic startup loader with no datasetId in URL
      const lastId = localStorage.getItem('last_dataset_id');
      const lastItemsStr = localStorage.getItem('last_dataset_items');
      
      if (lastItemsStr) {
        try {
          const lastItems = JSON.parse(lastItemsStr);
          if (Array.isArray(lastItems) && lastItems.length > 0) {
            setData(lastItems);
            setActiveTab('resumo');
            if (lastId) {
              const newUrl = new URL(window.location.href);
              newUrl.searchParams.set('datasetId', lastId);
              window.history.replaceState({ path: newUrl.href }, '', newUrl.href);
              setShareUrl(newUrl.href);
            }
          }
        } catch (e) {
          console.error("Could not parse cached last items", e);
        }
      } else {
        // Try to load default dataset bundled with the app
        setLoading(true);
        fetch('./default_dataset.json')
          .then(res => {
             if (res.ok) return res.json();
             throw new Error('No default dataset');
          })
          .then(defaultData => {
             if (Array.isArray(defaultData) && defaultData.length > 0) {
                setData(defaultData);
                setActiveTab('resumo');
             }
          })
          .catch(e => console.log('Starting empty, waiting for upload.'))
          .finally(() => setLoading(false));
      }
    }
  }, []);

  // Handle Custom CSV Import
  const handleCSVImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      worker: true,
      complete: (results) => {
          try {
            const rawData = results.data as any[];
            const currentDate = new Date('2026-05-29T18:00:00Z');

            const parseNumber = (val: string | number): number => {
              if (typeof val === 'number') return isNaN(val) ? 0 : val;
              if (!val || val.trim() === '-' || val.trim() === '') return 0;
              const cleaned = val.replace(/\./g, '').replace(',', '.');
              const num = parseFloat(cleaned);
              return isNaN(num) ? 0 : num;
            };

            const parsedItems: InventoryItem[] = rawData.map((row, index) => {
              // Function to find a value by loosely matching the key
              const findValue = (keys: string[]) => {
                const rowKeys = Object.keys(row);
                for (const rk of rowKeys) {
                  const normalized = rk.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
                  for (const expected of keys) {
                    const expectedNorm = expected.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
                    // We also check "includes" to catch weirdly formatted headers
                    if (normalized === expectedNorm || normalized.includes(expectedNorm)) {
                      return row[rk];
                    }
                  }
                }
                return undefined;
              };

              const dtString = String(findValue(['Dt_Ult_Movto', 'Ult Movimento', 'Data Movimento', 'Ult_Movto']) || '').trim();
              let diasParado = 0;

              if (dtString) {
                const parts = dtString.split('/');
                if (parts.length === 3) {
                  const day = parseInt(parts[0], 10);
                  const month = parseInt(parts[1], 10) - 1;
                  const year = parseInt(parts[2], 10);
                  const parsedDate = new Date(year, month, day);
                  if (!isNaN(parsedDate.getTime())) {
                    const diffTime = Math.abs(currentDate.getTime() - parsedDate.getTime());
                    diasParado = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  }
                }
              }

              const estoque = parseNumber(findValue(['Estoque', 'Saldo', 'Quantidade', 'Qtd']) || '');
              const estoqueValorizado = parseNumber(findValue(['Estoque Valorizado', 'Valor Total', 'Valor', 'Custo Total']) || '');
              const consumoMedio = parseNumber(findValue(['Consumo Mdio/dia (Ano Atual)', 'Consumo Medio', 'Consumo']) || '');
              const diasCobertura = parseNumber(findValue(['Dias de Cobertura', 'Cobertura Dias', 'Dias Cobertura']) || '');

              let status: 'Crítico' | 'Alerta' | 'Saudável' = 'Saudável';
              if (estoque > 0 && diasParado > 180) status = 'Crítico';
              else if (estoque > 0 && diasParado > 90) status = 'Alerta';

              let grupoDiasParados = '0-30 d';
              if (diasParado > 720) grupoDiasParados = '> 720 d';
              else if (diasParado > 540) grupoDiasParados = '541-720 d';
              else if (diasParado > 360) grupoDiasParados = '361-540 d';
              else if (diasParado > 180) grupoDiasParados = '181-360 d';
              else if (diasParado > 90) grupoDiasParados = '91-180 d';
              else if (diasParado > 30) grupoDiasParados = '31-90 d';
              
              const rawCodigo = findValue(['Código', 'Codigo', 'Cdigo', 'SKU', 'Cod']);
              const rawDescricao = findValue(['Descrição', 'Descricao', 'Descrio', 'Nome', 'Produto', 'Item']);

              return {
                id: `${rawCodigo || index}-${index}-custom`,
                codigo: String(rawCodigo || `SKU-${index}`),
                descricao: String(rawDescricao || 'Item sem Descrição'),
                material: String(findValue(['Material', 'Grupo', 'Categoria']) || ''),
                malha: String(findValue(['Malha', 'Tipo', 'Familia']) || ''),
                fio: String(findValue(['Fio']) || ''),
                largura: String(findValue(['Largura', 'Tamanho']) || ''),
                unidade: String(findValue(['Unidade', 'Un', 'UN', 'Medida']) || 'PC'),
                formaFisica: String(findValue(['Forma Física', 'Forma Fsica', 'Formato']) || ''),
                classeABC: String(findValue(['Classe ABC', 'Curva ABC', 'Curva']) || 'C'),
                subClasseABC: String(findValue(['Sub-classe ABC', 'Subclasse']) || 'C1'),
                estoque,
                estoqueValorizado,
                consumoMedio,
                diasCobertura,
                precoMedio: parseNumber(findValue(['Preço Médio', 'Preo Mdio', 'Custo Unitario', 'Preco']) || '0'),
                critico: String(findValue(['Crítico', 'Crtico', 'Critico']) || 'Não'),
                dtUltMovto: dtString || 'Sem Movimento',
                diasParado,
                grupoDiasParados,
                status
              };
            });

          // Drop fully empty items
          const validItems = parsedItems.filter(item => item.codigo || item.descricao || item.estoque > 0 || item.estoqueValorizado > 0);
          
          if (validItems.length > 0) {
            setData(validItems);
            setActiveTab('resumo');

            // Save to offline storage immediately for instantaneous startup reload
            try {
              localStorage.setItem('last_dataset_items', JSON.stringify(validItems));
            } catch (err) {
              console.warn("Storage quota exceeded saving copy", err);
            }

            // Save to Firebase first, fallback to API
            saveDataset(validItems)
              .then(id => {
                if (id) {
                  const newUrl = new URL(window.location.href);
                  newUrl.searchParams.set('datasetId', id);
                  window.history.pushState({ path: newUrl.href }, '', newUrl.href);
                  setShareUrl(newUrl.href);
                  try {
                    localStorage.setItem('last_dataset_id', id);
                    localStorage.setItem('last_dataset_items', JSON.stringify(validItems));
                  } catch (err) {
                    console.warn("Storage quota exceeded caching imported items with ID", err);
                  }
                }
                
                // Keep local api back-compatibility
                fetch('/api/dataset', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(validItems)
                }).catch(err => console.warn("Backup save to local api failed", err));
              })
              .catch(err => {
                console.error("Could not save dataset to Firebase", err);
                // Fallback to local server api
                fetch('/api/dataset', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(validItems)
                })
                .then(res => res.json())
                .then(resData => {
                   if (resData.id) {
                     const newUrl = new URL(window.location.href);
                     newUrl.searchParams.set('datasetId', resData.id);
                     window.history.pushState({ path: newUrl.href }, '', newUrl.href);
                     setShareUrl(newUrl.href);
                     try {
                       localStorage.setItem('last_dataset_id', resData.id);
                       localStorage.setItem('last_dataset_items', JSON.stringify(validItems));
                     } catch (err) {
                       console.warn("Storage quota exceeded caching fallback", err);
                     }
                   }
                })
                .catch(err2 => console.error("Backup save also failed", err2));
              });
          } else {
            alert('Não foi possível identificar colunas compatíveis no seu arquivo.');
          }
        } catch (ex: any) {
          console.error(ex);
          alert('Erro ao interpretar as colunas do CSV: ' + ex.message);
        } finally {
          setLoading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      error: (error: any) => {
        setLoading(false);
        alert('Erro ao processar arquivo: ' + error.message);
      }
    });
  };

  // Extract Dropdown distinct values
  const getDistinct = (field: keyof InventoryItem) => {
    const vals = new Set(data.map(d => String(d[field] || '')).filter(v => v.trim() !== ''));
    return ['Todos', ...Array.from(vals).sort()];
  };

  const materials = useMemo(() => getDistinct('material'), [data]);
  const malhas = useMemo(() => getDistinct('malha'), [data]);
  const fios = useMemo(() => getDistinct('fio'), [data]);
  const classesABC = useMemo(() => getDistinct('classeABC'), [data]);
  const subClassesABC = useMemo(() => getDistinct('subClasseABC'), [data]);
  const gruposDias = useMemo(() => ['Todos', '0-30 d', '31-90 d', '91-180 d', '181-360 d', '361-540 d', '541-720 d', '> 720 d'], []);

  // Filtered dataset
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const isZero = analysisMode === 'valor' ? item.estoqueValorizado === 0 : item.estoque === 0;
      if (hideZeroes && isZero) return false;

      const m1 = selectedMaterial === 'Todos' || item.material === selectedMaterial;
      const m2 = selectedMalha === 'Todos' || item.malha === selectedMalha;
      const m3 = selectedFio === 'Todos' || item.fio === selectedFio;
      const m4 = selectedClasseABC === 'Todos' || item.classeABC === selectedClasseABC;
      const m5 = selectedSubClasseABC === 'Todos' || item.subClasseABC === selectedSubClasseABC;
      const m6 = selectedGrupoDias === 'Todos' || item.grupoDiasParados === selectedGrupoDias;
      
      return m1 && m2 && m3 && m4 && m5 && m6;
    });
  }, [data, selectedMaterial, selectedMalha, selectedFio, selectedClasseABC, selectedSubClasseABC, selectedGrupoDias, hideZeroes, analysisMode]);

  // RESET All filters helper
  const handleResetFilters = () => {
    setSelectedMaterial('Todos');
    setSelectedMalha('Todos');
    setSelectedFio('Todos');
    setSelectedClasseABC('Todos');
    setSelectedSubClasseABC('Todos');
    setSelectedGrupoDias('Todos');
  };

  const exportCurrentTabToPDF = async () => {
    const element = document.getElementById('dashboard-pdf-content');
    if (!element) {
      alert('Não foi possível encontrar a área de visualização para exportar.');
      return;
    }
    setPdfLoading(true);
    try {
      // Add temporary styling directly instead of using onclone
      // to avoid weird iframe cloning issues with some CSS/charts.
      
      const originalPadding = element.style.padding;
      const originalBackground = element.style.backgroundColor;
      const originalColor = element.style.color;
      
      element.style.padding = '24px';
      element.style.background = '#0A0C10';
      element.style.color = '#e2e8f0';

      const excludes = document.querySelectorAll('.pdf-exclude');
      const originalDisplays: string[] = [];
      excludes.forEach((el, index) => {
        originalDisplays[index] = (el as HTMLElement).style.display;
        (el as HTMLElement).style.setProperty('display', 'none', 'important');
      });

      // Insert PDF header
      const pdfHeader = document.createElement('div');
      pdfHeader.id = 'temp-pdf-header';
      pdfHeader.style.marginBottom = '20px';
      pdfHeader.style.border = '1px solid #1e293b';
      pdfHeader.style.borderRadius = '8px';
      pdfHeader.style.padding = '20px';
      pdfHeader.style.backgroundColor = '#0F1116';
      
      const formatter = analysisMode === 'valor' ? currencyFormatter : numberFormatter;
      pdfHeader.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; font-family: system-ui, -apple-system, sans-serif;">
          <div>
            <h1 style="color: #ffffff; font-size: 18px; font-weight: 850; margin: 0; letter-spacing: -0.025em; text-transform: uppercase;">
              CENTRAL MESH <span style="color: #6366f1;">| ${analysisMode === 'valor' ? 'DASHBOARD FINANCEIRO' : 'DASHBOARD OPERACIONAL'}</span>
            </h1>
            <p style="color: #94a3b8; font-size: 10px; margin: 4px 0 0 0; letter-spacing: 0.1em; text-transform: uppercase; font-family: monospace;">
              Relatório de Auditoria e Otimização de Ativos — Visão Diretoria
            </p>
          </div>
          <div style="text-align: right; font-family: monospace; font-size: 10px; color: #64748b; line-height: 1.4;">
            <div>DATA DE EMISSÃO: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
            <div>ABA SELECIONADA: ${activeTab.toUpperCase()}</div>
            <div>ITENS ATIVOS EXPORTADOS: ${numberFormatter(kpis.items)} FILTRADOS</div>
          </div>
        </div>
        <div style="height: 3px; background: linear-gradient(90deg, #6366f1 0%, #a855f7 50%, #10b981 100%); border-radius: 4px; margin-top: 12px;"></div>
      `;
      element.insertBefore(pdfHeader, element.firstChild);

      // Create high resolution image from the DOM element
      const canvas = await html2canvas(element, {
        scale: 1.5, // Reduced from 2 to avoid memory issues on large tables
        useCORS: true,
        logging: false,
        backgroundColor: '#0A0C10',
      });

      // Cleanup DOM changes
      element.removeChild(pdfHeader);
      element.style.padding = originalPadding;
      element.style.backgroundColor = originalBackground;
      element.style.color = originalColor;
      
      excludes.forEach((el, index) => {
        if (originalDisplays[index]) {
          (el as HTMLElement).style.display = originalDisplays[index];
        } else {
          (el as HTMLElement).style.removeProperty('display');
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; // A4 standard width
      const pageHeight = 297; // A4 standard height
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      // First page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      // Multiple pages handler
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }

      pdf.save(`Central_Mesh_Relatorio_${analysisMode}_${activeTab}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err: any) {
      console.error('Error in PDF generation:', err);
      alert(`Erro ao exportar PDF: ${err.message || String(err)}`);
    } finally {
      setPdfLoading(false);
    }
  };

  // KPIs
  const kpis = useMemo(() => {
    let val = 0;
    let qty = 0;
    let itemsCount = 0;
    let valorParadoCritico = 0;
    let qtyParadoCritico = 0;
    let diasCoberturaSum = 0;
    let countComCobertura = 0;

    filteredData.forEach(item => {
      val += item.estoqueValorizado || 0;
      qty += item.estoque || 0;
      
      if (item.estoque > 0 || (item.estoqueValorizado && item.estoqueValorizado > 0)) {
        itemsCount++;
      }

      if (item.diasParado > 180) {
        valorParadoCritico += item.estoqueValorizado || 0;
        qtyParadoCritico += item.estoque || 0;
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
      qtyCritico: qtyParadoCritico,
      avgCobertura
    };
  }, [filteredData]);

  // Unit Summary calculation
  const unitSummary = useMemo(() => {
    const units = ['KG', 'M', 'M2', 'PC', 'RL', 'UN'];
    const summaryMap: Record<string, { qty: number; val: number; count: number }> = {};
    
    units.forEach(u => {
      summaryMap[u] = { qty: 0, val: 0, count: 0 };
    });

    filteredData.forEach(item => {
      const u = item.unidade || 'Outros';
      if (!summaryMap[u]) {
        summaryMap[u] = { qty: 0, val: 0, count: 0 };
      }
      summaryMap[u].qty += item.estoque;
      summaryMap[u].val += item.estoqueValorizado;
      summaryMap[u].count += 1;
    });

    return Object.entries(summaryMap).map(([unit, metrics]) => ({
      unit,
      skus: metrics.count,
      qty: metrics.qty,
      value: metrics.val,
      pct: kpis.valorTotal > 0 ? (metrics.val / kpis.valorTotal) * 100 : 0
    })).sort((a, b) => b.value - a.value);
  }, [filteredData, kpis.valorTotal]);

  // Charts data: Valor por Material
  const valueByMaterial = useMemo(() => {
    const reduced = filteredData.reduce((acc, current) => {
      const mat = current.material || 'Outros/N/A';
      acc[mat] = (acc[mat] || 0) + (analysisMode === 'valor' ? current.estoqueValorizado : current.estoque);
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(reduced)
      .map(([name, value]) => ({ name, value: Number(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filteredData, analysisMode]);

  // Charts data: Curva ABC
  const valueByClass = useMemo(() => {
    const reduced = filteredData.reduce((acc, current) => {
      const cls = current.classeABC ? `Classe ${current.classeABC}` : 'Sem Classe';
      acc[cls] = (acc[cls] || 0) + (analysisMode === 'valor' ? current.estoqueValorizado : current.estoque);
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(reduced)
      .map(([name, value]) => ({ name, value: Number(value) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredData, analysisMode]);

  // Charts data: Aging Buckets
  const valueByAging = useMemo(() => {
    const buckets = [
      { name: '0-30 d', value: 0 },
      { name: '31-90 d', value: 0 },
      { name: '91-180 d', value: 0 },
      { name: '181-360 d', value: 0 },
      { name: '361-540 d', value: 0 },
      { name: '541-720 d', value: 0 },
      { name: '> 720 d', value: 0 }
    ];
    filteredData.forEach(item => {
      const val = analysisMode === 'valor' ? item.estoqueValorizado : item.estoque;
      if (item.diasParado <= 30) buckets[0].value += val;
      else if (item.diasParado <= 90) buckets[1].value += val;
      else if (item.diasParado <= 180) buckets[2].value += val;
      else if (item.diasParado <= 360) buckets[3].value += val;
      else if (item.diasParado <= 540) buckets[4].value += val;
      else if (item.diasParado <= 720) buckets[5].value += val;
      else buckets[6].value += val;
    });
    return buckets;
  }, [filteredData, analysisMode]);

  // Charts data: Top Valor vs Qtd
  const valueAndQtyTop = useMemo(() => {
    return [...filteredData]
      .filter(i => (analysisMode === 'valor' ? i.estoqueValorizado : i.estoque) > 0)
      .sort((a, b) => (analysisMode === 'valor' ? b.estoqueValorizado - a.estoqueValorizado : b.estoque - a.estoque))
      .slice(0, 10)
      .map(item => ({
        name: item.codigo.slice(0, 15) + (item.codigo.length > 15 ? '...' : ''),
        fullname: item.descricao,
        valor: item.estoqueValorizado,
        quantidade: item.estoque,
        unidade: item.unidade
      }));
  }, [filteredData, analysisMode]);

      // Charts data: Subgrupo ABC
  const valueBySubclass = useMemo(() => {
    const reduced = filteredData.reduce((acc, current) => {
      const sub = current.subClasseABC || 'N/A';
      acc[sub] = (acc[sub] || 0) + (analysisMode === 'valor' ? current.estoqueValorizado : current.estoque);
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(reduced)
      .map(([name, value]) => ({ name, value: Number(value) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredData, analysisMode]);

  // Transform data specifically for a Pareto Dynamic Chart
  const paretoData = useMemo(() => {
    const isValor = analysisMode === 'valor';
    // Sort items descending based on the mode
    const sorted = [...filteredData]
      .filter(i => (isValor ? i.estoqueValorizado : i.estoque) > 0)
      .sort((a, b) => (isValor ? b.estoqueValorizado - a.estoqueValorizado : b.estoque - a.estoque));
      
    // To show a smooth Pareto curve, let's take the Top 50 Items, and group the remaining.
    const topItems = sorted.slice(0, 50);
    const otherItems = sorted.slice(50);
    
    let totalMetric = sorted.reduce((sum, item) => sum + (isValor ? item.estoqueValorizado : item.estoque), 0);
    let cumulative = 0;
    
    const pareto = topItems.map((item, index) => {
      const metricVal = isValor ? item.estoqueValorizado : item.estoque;
      cumulative += metricVal;
      return {
        name: `Top ${index + 1}`,
        desc: item.descricao,
        sku: item.codigo,
        valor: metricVal,
        accumulatedPct: totalMetric > 0 ? (cumulative / totalMetric) * 100 : 0
      };
    });

    if (otherItems.length > 0) {
      const otherVal = otherItems.reduce((acc, item) => acc + (isValor ? item.estoqueValorizado : item.estoque), 0);
      cumulative += otherVal;
      pareto.push({
        name: 'Demais SKUs',
        desc: 'Agrupamento de itens de curva C e D',
        sku: 'Vários',
        valor: otherVal,
        accumulatedPct: 100
      });
    }

    return pareto;
  }, [filteredData, analysisMode]);

  // Business Action Insights
  const businessInsights = useMemo(() => {
    const totalImob = kpis.valorTotal;
    const totalDead = kpis.valorCritico;
    const deadPct = totalImob > 0 ? (totalDead / totalImob) * 100 : 0;
    
    // Class A values
    const classAData = filteredData.filter(i => i.classeABC === 'A');
    const classAVal = classAData.reduce((acc, curr) => acc + curr.estoqueValorizado, 0);
    const classAPct = totalImob > 0 ? (classAVal / totalImob) * 100 : 0;

    return {
      totalImob,
      totalDead,
      deadPct,
      classAPct,
      classACount: classAData.length,
      recommendations: [
        {
          type: 'danger',
          title: 'Liquidação de Capital Ocioso (>180 dias)',
          desc: `Há ${currencyFormatter(totalDead)} (${deadPct.toFixed(1)}% do estoque) sem nenhuma movimentação há mais de 180 dias. Sugere-se criar um comitê para liquidação industrial ou descontos direcionados para liberar capital de giro imediato.`
        },
        {
          type: 'warning',
          title: 'Monitoramento de Classe A',
          desc: `Apenas ${classAData.length} SKUs da Classe A concentram ${currencyFormatter(classAVal)} (${classAPct.toFixed(1)}% do valor de estoque). Exige renegociação de prazos Just-In-Time com fornecedores e contratos de fornecimento flexíveis.`
        },
        {
          type: 'info',
          title: 'Otimização por Unidade (M)',
          desc: `Materiais medidos em Metros (M) representam disparadamente a maior parcela financeira (${currencyFormatter(unitSummary.find(u => u.unit === 'M')?.value || 0)} ou ${unitSummary.find(u => u.unit === 'M')?.pct.toFixed(1)}% do total), sugerindo prioridade máxima no controle de sobras de pontas e cortes.`
        }
      ]
    };
  }, [filteredData, kpis, unitSummary]);

  // Formatters
  function currencyFormatter(value: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(value);
  }
  function numberFormatter(value: number) {
    return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value);
  }
  
  const activeFormatter = analysisMode === 'valor' ? currencyFormatter : numberFormatter;
  
  function formatMetric(value: number) {
    return analysisMode === 'valor' ? currencyFormatter(value) : numberFormatter(value) + ' UN';
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px]">
        <div className="animate-spin text-indigo-500 mb-4">
          <RefreshCcw className="w-10 h-10" />
        </div>
        <p className="text-slate-400 text-xs font-mono uppercase tracking-widest">Processando base de dados estratégica...</p>
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-red-500 font-medium">{error}</div>;
  }

  return (
    <div className="flex flex-col gap-4 max-w-full">
      
      {/* GLOBAL MOOD/DASHBOARD TOGGLE */}
      {data.length > 0 && activeTab !== 'config' && (
        <div className="flex w-full mb-2 print:hidden pdf-exclude">
          <div className="bg-[#0A0C10] border-2 border-slate-700/50 rounded-xl p-1.5 flex w-full max-w-2xl mx-auto shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-emerald-500/10 opacity-30 pointer-events-none"></div>
            <button 
              onClick={() => setAnalysisMode('valor')}
              className={`flex-1 relative flex items-center justify-center gap-3 py-3 px-6 rounded-lg transition-all duration-300 ${analysisMode === 'valor' ? 'bg-indigo-600 shadow-[0_0_20px_rgba(79,70,229,0.4)] text-white scale-[1.02]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              <div className="flex flex-col items-center">
                <span className="text-sm font-black uppercase tracking-widest leading-none">Dashboard Financeiro</span>
                <span className="text-[9px] text-indigo-200 mt-1 uppercase opacity-80">Análise Focada em Capital (R$)</span>
              </div>
            </button>
            <button 
              onClick={() => setAnalysisMode('quantidade')}
              className={`flex-1 relative flex items-center justify-center gap-3 py-3 px-6 rounded-lg transition-all duration-300 ${analysisMode === 'quantidade' ? 'bg-emerald-600 shadow-[0_0_20px_rgba(16,185,129,0.4)] text-white scale-[1.02]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              <div className="flex flex-col items-center">
                <span className="text-sm font-black uppercase tracking-widest leading-none">Dashboard Operacional</span>
                <span className="text-[9px] text-emerald-200 mt-1 uppercase opacity-80">Análise Focada em Quantidade (UN)</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Control Tabs inside App */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 gap-2 print:hidden pdf-exclude">
        <div className="flex overflow-x-auto pb-0.5 whitespace-nowrap gap-1">
          <button 
            onClick={() => setActiveTab('config')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all border-b-2 hover:text-white ${activeTab === 'config' ? 'border-emerald-500 text-white bg-emerald-500/5' : 'border-transparent text-slate-400'}`}
          >
            <Settings className="w-3.5 h-3.5" /> Configurações
          </button>
          
          {data.length > 0 && (
            <>
              <button 
                onClick={() => setActiveTab('resumo')}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all border-b-2 hover:text-white ${activeTab === 'resumo' ? 'border-indigo-500 text-white bg-indigo-500/5' : 'border-transparent text-slate-400'}`}
              >
                📋 Resumo Executivo (Board)
              </button>
              <button 
                onClick={() => setActiveTab('valor')}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all border-b-2 hover:text-white ${activeTab === 'valor' ? 'border-indigo-500 text-white bg-indigo-500/5' : 'border-transparent text-slate-400'}`}
              >
                📊 Visão Categorias
              </button>
              <button 
                onClick={() => setActiveTab('quantidade')}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all border-b-2 hover:text-white ${activeTab === 'quantidade' ? 'border-indigo-500 text-white bg-indigo-500/5' : 'border-transparent text-slate-400'}`}
              >
                📈 Composto Top SKUs
              </button>
              <button 
                onClick={() => setActiveTab('abc')}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all border-b-2 hover:text-white ${activeTab === 'abc' ? 'border-indigo-500 text-white bg-indigo-500/5' : 'border-transparent text-slate-400'}`}
              >
                📈 Curva ABC & Subs
              </button>
              <button 
                onClick={() => setActiveTab('aging')}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all border-b-2 hover:text-white ${activeTab === 'aging' ? 'border-indigo-500 text-white bg-indigo-500/5' : 'border-transparent text-slate-400'}`}
              >
                ⏳ Dias Sem Mvto (Aging)
              </button>
            </>
          )}
        </div>

        {/* Action Button: XLSX / CSV Exports */}
        {data.length > 0 && activeTab !== 'config' && (
          <div className="flex items-center gap-2 pb-1">
            <button 
              onClick={exportCurrentTabToPDF}
              disabled={pdfLoading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] uppercase font-bold tracking-widest transition-all shadow-sm ${pdfLoading ? 'bg-indigo-900 text-indigo-300 cursor-not-allowed opacity-70' : 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer'}`}
              title="Gerar e salvar um relatório PDF executivo com gráficos em formato A4"
            >
              <Printer className="w-3.5 h-3.5" />
              {pdfLoading ? 'Gerando...' : 'Exportar PDF'}
            </button>
            <button 
              onClick={() => handlePrint()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1F2937] hover:bg-[#2E3B4E] text-slate-300 rounded text-[10px] uppercase font-bold tracking-widest transition-all border border-slate-750 shadow-sm"
              title="Abre a caixa de diálogo nativa de impressão (Pode ser salvo como PDF)"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir (Físico)
            </button>
            <button 
              onClick={() => exportToExcel(filteredData, activeTab)}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] uppercase font-bold tracking-widest transition-all shadow-sm"
              title="Exportar planilha Excel com várias abas completas para apresentação"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Exportar (.xlsx)
            </button>
            <button 
              onClick={() => exportToCSV(filteredData)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#111827] hover:bg-[#1C2536] text-white rounded text-[10px] uppercase font-bold tracking-widest transition-all border border-slate-800"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
          </div>
        )}
      </div>

      {activeTab === 'config' && (
        <div className="flex flex-col gap-6 bg-[#0F1116] border border-slate-800 rounded-lg p-8 items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center max-w-xl text-center space-y-4">
            <div className="w-16 h-16 bg-[#1A1F26] rounded-full flex items-center justify-center border border-slate-700 shadow-inner mb-2">
              <Upload className="w-8 h-8 text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-wide">Importe sua Fonte de Dados de Estoque</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Carregue a sua planilha (formato <strong className="text-slate-300">.CSV</strong> delimitado por ponto-e-vírgula) para utilizar o sistema. 
              Neste modelo, todas as análises e dashboards são baseados de forma exclusiva nos seus dados reais. Nenhuma base de teste será carregada.
            </p>
            
            <div className="mt-6 w-full max-w-sm">
              <input 
                type="file" 
                accept=".csv" 
                ref={fileInputRef} 
                onChange={handleCSVImport} 
                className="hidden" 
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm uppercase font-bold tracking-widest transition-colors shadow-lg shadow-emerald-500/20"
              >
                <FileSpreadsheet className="w-5 h-5" />
                Carregar Arquivo CSV
              </button>
              {data.length > 0 && (
                <div className="mt-6 flex flex-col items-center gap-3 w-full">
                  <p className="text-xs text-slate-500">
                    {numberFormatter(data.length)} registros atualmente carregados. Importar um novo arquivo substituirá a carga atual.
                  </p>
                  
                  {shareUrl && (
                    <div className="flex flex-col gap-2 w-full mt-4 p-4 bg-[#1A1F26] rounded border border-slate-700">
                      <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest text-left">Link Compartilhável (Acesso Público):</span>
                      <div className="flex gap-2">
                        <input 
                          readOnly
                          value={shareUrl}
                          className="flex-1 bg-[#0A0C10] border border-slate-600 rounded px-3 py-2 text-xs text-slate-300 outline-none"
                        />
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(shareUrl);
                            alert('Link copiado para a área de transferência!');
                          }}
                          className="px-4 py-2 bg-[#2D3748] hover:bg-[#4A5568] text-white rounded text-xs font-bold uppercase transition-colors"
                        >
                          Copiar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Show Content only if data is loaded and not in config tab */}
      {data.length > 0 && activeTab !== 'config' && (
        <>
      {/* Capture Viewport for high fidelity PDF exports */}
      <div id="dashboard-pdf-content" ref={componentRef} className="flex flex-col gap-4">
      
      {/* KPI Cards section (Shared or displayed dynamically) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard 
          title={analysisMode === 'valor' ? "Valor Total em Estoque" : "Quantidade em Estoque"}
          value={analysisMode === 'valor' ? currencyFormatter(kpis.valorTotal) : numberFormatter(kpis.qtyTotal)}
          icon={analysisMode === 'valor' ? Box : Package}
          subtitle={analysisMode === 'valor' ? "Capital imobilizado total" : "Todas as unidades de medida"}
          className={`lg:col-span-1 shadow-md ${analysisMode === 'quantidade' ? 'text-indigo-400' : ''}`}
        />
        <StatCard 
          title={analysisMode === 'valor' ? "Quantidade em Estoque" : "Valor Total em Estoque"}
          value={analysisMode === 'valor' ? numberFormatter(kpis.qtyTotal) : currencyFormatter(kpis.valorTotal)}
          icon={analysisMode === 'valor' ? Package : Box}
          subtitle={analysisMode === 'valor' ? "Todas as unidades de medida" : "Capital imobilizado total"}
          className={`lg:col-span-1 shadow-md ${analysisMode === 'valor' ? 'text-indigo-400' : ''}`}
        />
        <StatCard 
          title="SKUs Ativos" 
          value={`${numberFormatter(kpis.items)} de ${numberFormatter(data.length)}`}
          icon={Layers}
          subtitle="Itens com saldo físico"
          className="lg:col-span-1 shadow-md"
        />
        <StatCard 
          title={analysisMode === 'valor' ? "Capital Parado (>180d)" : "Qtd Parada (>180d)"}
          value={analysisMode === 'valor' ? currencyFormatter(kpis.valorCritico) : numberFormatter(kpis.qtyCritico)}
          icon={AlertCircle}
          subtitle="Risco de perda / obsolescência"
          className="lg:col-span-1 border-red-500/50 bg-[#1A1116]"
        />
        <StatCard 
          title="Giro Médio Cobertura" 
          value={`${kpis.avgCobertura} Dias`}
          icon={Activity}
          subtitle="Tempo médio de consumo"
          className="lg:col-span-1 shadow-md"
        />
      </div>

      {/* Header & Filters Card - Dynamic Filter */}
      <div className="flex flex-col gap-4 bg-[#0F1116] border border-slate-800 rounded-lg p-4 print:hidden pdf-exclude">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <h2 className="text-xs font-bold text-indigo-400 uppercase tracking-widest pb-1 border-b border-slate-800 inline-block">Filtros Avançados Integrados</h2>
            <label className="flex items-center gap-2 cursor-pointer border border-slate-700 bg-[#1A1F26] px-2 py-1 rounded">
              <input 
                type="checkbox" 
                checked={hideZeroes} 
                onChange={(e) => setHideZeroes(e.target.checked)}
                className="w-3 h-3 accent-indigo-500"
              />
              <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Ocultar Saldos Zerados</span>
            </label>
          </div>
          {(selectedMaterial !== 'Todos' || selectedMalha !== 'Todos' || selectedFio !== 'Todos' || selectedClasseABC !== 'Todos' || selectedSubClasseABC !== 'Todos' || selectedGrupoDias !== 'Todos') && (
            <button 
              onClick={handleResetFilters}
              className="text-[9px] uppercase tracking-wider text-red-400 font-bold hover:text-red-300"
            >
              Limpar Filtros [X]
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 w-full">
          {/* Material selection */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-500 uppercase block font-bold">Material</label>
            <select 
              className="bg-[#1A1F26] border border-slate-700 text-xs text-white rounded p-1.5 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-full"
              value={selectedMaterial}
              onChange={e => setSelectedMaterial(e.target.value)}
            >
              {materials.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Malha selection */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-500 uppercase block font-bold font-sans">Malha</label>
            <select 
              className="bg-[#1A1F26] border border-slate-700 text-xs text-white rounded p-1.5 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-full"
              value={selectedMalha}
              onChange={e => setSelectedMalha(e.target.value)}
            >
              {malhas.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Fio Selection */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-500 uppercase block font-bold font-sans">Fio</label>
            <select 
              className="bg-[#1A1F26] border border-slate-700 text-xs text-white rounded p-1.5 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-full"
              value={selectedFio}
              onChange={e => setSelectedFio(e.target.value)}
            >
              {fios.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Curva ABC Selection */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-500 uppercase block font-bold font-sans">Classe ABC</label>
            <select 
              className="bg-[#1A1F26] border border-slate-700 text-xs text-white rounded p-1.5 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-full"
              value={selectedClasseABC}
              onChange={e => setSelectedClasseABC(e.target.value)}
            >
              {classesABC.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Subgrupo ABC */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-500 uppercase block font-bold font-sans">Subgrupo ABC</label>
            <select 
              className="bg-[#1A1F26] border border-slate-700 text-xs text-white rounded p-1.5 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-full"
              value={selectedSubClasseABC}
              onChange={e => setSelectedSubClasseABC(e.target.value)}
            >
              {subClassesABC.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Inatividade (Status de Dias Parados) */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-500 uppercase block font-bold font-sans">Status (Dias Parados)</label>
            <select 
              className="bg-[#1A1F26] border border-slate-700 text-xs text-white rounded p-1.5 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-full"
              value={selectedGrupoDias}
              onChange={e => setSelectedGrupoDias(e.target.value)}
            >
              {gruposDias.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ==================== TAB 1: RESUMO EXECUTIVO (ONE PAGE BOARD SLIDE) ==================== */}
      {activeTab === 'resumo' && (
        <div className="flex flex-col gap-4 print:p-0">
          
          {/* Executive Insights Box */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            <div className="lg:col-span-7 bg-[#0F1116] border border-indigo-900/40 rounded-lg p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Metas & Diretrizes Gerais do Board</h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  A auditoria de estoque identificou a imobilização financeira exata de <strong className="text-indigo-400">{currencyFormatter(kpis.valorTotal)}</strong> distribuída em <strong className="text-indigo-400">{numberFormatter(kpis.qtyTotal)} unidades físicas</strong>. O maior ofensor financeiro recai sobre o estoque ocioso acumulado há mais de 180 dias, somando <strong className="text-red-400">{currencyFormatter(kpis.valorCritico)}</strong> do capital imobilizado.
                </p>

                <div className="mt-4 space-y-2">
                  <div className="flex items-start gap-2 text-xs text-slate-400">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Foco Curva ABC:</strong> Priorizar otimização de compras de classe A que representam {businessInsights.classAPct.toFixed(1)}% do orçamento.</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-slate-400">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Minimização de Inatividade:</strong> Criar feirões industriais de obsolescência para recuperar liquidez das classes C e D paradas há mais de 6 meses.</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800 flex justify-between items-center text-[11px] font-mono text-slate-500">
                <span>Relatório Executivo One-Page</span>
                <span>Data de Emissão: 29/05/2026</span>
              </div>
            </div>

            {/* Excel exact table matching screenshot */}
            <div className="lg:col-span-5 bg-[#0F1116] border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-800 pb-2">Posição por Unidade (Conciliação Exata)</h3>
                
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 text-[10px] uppercase font-bold">
                      <th className="py-2">Unidade</th>
                      <th className="py-2 text-right">SKUs</th>
                      <th className="py-2 text-right">Saldo Estoque</th>
                      <th className="py-2 text-right">Soma de Valorizado</th>
                      <th className="py-2 text-right">% Fin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unitSummary.map((item, idx) => (
                      <tr key={item.unit} className="border-b border-slate-800/40 hover:bg-white/5 transition-colors">
                        <td className="py-2 font-bold text-indigo-300">{item.unit}</td>
                        <td className="py-2 text-right font-mono text-slate-400">{numberFormatter(item.skus)}</td>
                        <td className="py-2 text-right font-mono text-slate-300">{numberFormatter(item.qty)}</td>
                        <td className="py-2 text-right font-mono text-slate-200">{currencyFormatter(item.value)}</td>
                        <td className="py-2 text-right font-mono text-indigo-400 font-bold">{item.pct.toFixed(1)}%</td>
                      </tr>
                    ))}
                    <tr className="bg-[#1A1F26]/30 font-bold border-t border-slate-700">
                      <td className="py-2 text-white">TOTAL GERAL</td>
                      <td className="py-2 text-right font-mono text-slate-200">{numberFormatter(kpis.items)}</td>
                      <td className="py-2 text-right font-mono text-indigo-300">{numberFormatter(kpis.qtyTotal)}</td>
                      <td className="py-2 text-right font-mono text-emerald-400">{currencyFormatter(kpis.valorTotal)}</td>
                      <td className="py-2 text-right font-mono text-white">100.0%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Quick core charts of the executive board */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* Aging cohort layout */}
            <div className="bg-[#0F1116] rounded-lg border border-slate-800 p-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">Imobilização Financeira por Faixa de Inatividade</h3>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={valueByAging}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={activeFormatter} stroke="#64748b" tick={{ fontSize: 10 }} />
                    <Tooltip formatter={activeFormatter} contentStyle={{ backgroundColor: '#1A1F26', border: '1px solid #334155' }} />
                    <Bar isAnimationActive={false} dataKey="value" radius={[4, 4, 0, 0]}>
                      {valueByAging.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={AGING_COLORS[index % AGING_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Curva ABC distribution */}
            <div className="bg-[#0F1116] rounded-lg border border-slate-800 p-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">Distribuição Estratégica por Classe (Curva ABC)</h3>
              <div className="h-[220px] flex items-center justify-between">
                <div className="w-[60%] h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie isAnimationActive={false}
                        data={valueByClass}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {valueByClass.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={activeFormatter} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-[40%] flex flex-col gap-2 bg-[#08090C] border border-slate-800 p-3 rounded">
                  {valueByClass.map((cls, idx) => (
                    <div key={cls.name} className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}></span>
                        <span className="text-[10px] font-bold text-white uppercase">{cls.name}</span>
                      </div>
                      <span className="text-xs font-mono text-slate-300 ml-4">{formatMetric(cls.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Core insights rows */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {businessInsights.recommendations.map((rec) => (
              <div key={rec.title} className="bg-[#0F1116] border border-slate-800 rounded-lg p-4 flex gap-3">
                <div className="mt-0.5">
                  {rec.type === 'danger' && <ShieldAlert className="w-5 h-5 text-red-500" />}
                  {rec.type === 'warning' && <AlertCircle className="w-5 h-5 text-amber-500" />}
                  {rec.type === 'info' && <TrendingUp className="w-5 h-5 text-indigo-400" />}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1">{rec.title}</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{rec.desc}</p>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* ==================== TAB 2: VISÃO FINANCEIRA (VALOR DO ESTOQUE) ==================== */}
      {activeTab === 'valor' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            {/* Value by Material Chart */}
            <div className="lg:col-span-8 bg-[#0F1116] rounded-lg border border-slate-800 p-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">{analysisMode === 'valor' ? 'Distribuição de Faturamento por Material (Top 8 Ofensores)' : 'Distribuição de Quantidades por Material (Top 8 Ofensores)'}</h3>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={valueByMaterial} layout="vertical" margin={{ top: 0, right: 30, left: 30, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#1e293b" />
                    <XAxis type="number" tickFormatter={activeFormatter} stroke="#64748b" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" stroke="#64748b" tick={{ fontSize: 10 }} width={120} />
                    <Tooltip formatter={activeFormatter} contentStyle={{ backgroundColor: '#1A1F26', border: '1px solid #334155' }} />
                    <Bar isAnimationActive={false} dataKey="value" radius={[0, 4, 4, 0]}>
                      {valueByMaterial.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Capital Allocator Breakdown widgets */}
            <div className="lg:col-span-4 bg-[#0F1116] rounded-lg border border-slate-800 p-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">Alocação Financeira de Ativos</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                  Distribuição proporcional do valor monetário mantido em estoque para cada formato físico catalogado. Identifique onde os custos de aquisição pesam mais.
                </p>

                <div className="space-y-4">
                  {valueByMaterial.slice(0, 4).map((item, idx) => {
                    const pct = kpis.valorTotal > 0 ? (item.value / kpis.valorTotal) * 100 : 0;
                    return (
                      <div key={item.name} className="flex flex-col gap-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-white uppercase">{item.name}</span>
                          <span className="font-mono text-indigo-400 font-semibold">{formatMetric(item.value)} ({pct.toFixed(1)}%)</span>
                        </div>
                        <div className="w-full bg-[#1A1F26] rounded-full h-2">
                          <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[idx % COLORS.length] }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-[#1A1116] border border-red-900/30 rounded p-3 mt-4">
                <span className="text-[10px] text-red-400 uppercase font-bold block mb-1">Atenção Crítica do CPO:</span>
                <span className="text-[11px] text-slate-300">Os top 3 materiais catalogados concentram mais de 70% de toda a imobilização financeira operacional.</span>
              </div>
            </div>

          </div>

          {/* Top 5 highest-valued items in table */}
          <div className="bg-[#0F1116] border border-slate-800 rounded-lg p-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">Top 5 SKU de Maior Pegada Financeira</h3>
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 uppercase text-[10px] font-bold">
                  <th className="py-2">Código Sku</th>
                  <th className="py-2">Descrição Completa</th>
                  <th className="py-2 text-center">Unidade</th>
                  <th className="py-2 text-right">Saldo Físico</th>
                  <th className="py-2 text-right">Preço Médio Unitário (R$)</th>
                  <th className="py-2 text-right">Valor em Estoque</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.slice(0, 5).map((item) => (
                  <tr key={item.id} className="border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors">
                    <td className="py-2 font-mono text-slate-400 font-bold">{item.codigo}</td>
                    <td className="py-2 font-medium text-white">{item.descricao}</td>
                    <td className="py-2 text-center font-mono text-slate-400 font-semibold">{item.unidade}</td>
                    <td className="py-2 text-right font-mono text-slate-300">{numberFormatter(item.estoque)}</td>
                    <td className="py-2 text-right font-mono text-slate-400">{currencyFormatter(item.precoMedio)}</td>
                    <td className="py-2 text-right font-mono text-indigo-400 font-bold">{currencyFormatter(item.estoqueValorizado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== TAB 3: VISÃO QUANTIDADE & OPERACIONAL ==================== */}
      {activeTab === 'quantidade' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            {/* Chart: Value vs Quantity Top 10 */}
            <div className="lg:col-span-8 bg-[#0F1116] rounded-lg border border-slate-800 p-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2 font-sans">Composto Comercial: Top 10 SKUs - Faturamento vs Volume</h3>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={valueAndQtyTop} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 9 }} angle={-15} textAnchor="end" />
                    <YAxis yAxisId="left" tickFormatter={currencyFormatter} stroke="#6366f1" tick={{ fontSize: 9 }} />
                    <YAxis yAxisId="right" orientation="right" stroke="#10b981" tick={{ fontSize: 9 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1A1F26', border: '1px solid #334155' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar isAnimationActive={false} yAxisId="left" dataKey="valor" fill="#6366f1" radius={[3, 3, 0, 0]} name="Faturamento (R$)" />
                    <Line isAnimationActive={false} yAxisId="right" type="monotone" dataKey="quantidade" stroke="#10b981" strokeWidth={2.5} name="Qtd de Itens" dot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Physical volume insight widgets */}
            <div className="lg:col-span-4 bg-[#0F1116] rounded-lg border border-slate-800 p-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">Divergência Volume x Valor</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                  Muitas vezes, materiais de altíssimo volume físico (exemplo: toneladas de sucata em bobinas) possuem um valor de custo unitário inferior a uma única peça calibrada e usinada (exemplo: engrenagens ou fios especiais).
                </p>

                <div className="bg-[#08090C] border border-slate-800 p-3 rounded space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Volume Total Balanceado:</span>
                    <span className="text-xs font-mono font-bold text-indigo-400">{numberFormatter(kpis.qtyTotal)} unidades</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Ticket Médio por SKU:</span>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      {currencyFormatter(kpis.items > 0 ? kpis.valorTotal / kpis.items : 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Preço Unitário Geral:</span>
                    <span className="text-xs font-mono font-bold text-slate-300">
                      {currencyFormatter(kpis.qtyTotal > 0 ? kpis.valorTotal / kpis.qtyTotal : 0)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">Status da Auditoria</span>
                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">FÍSICO CONCILIADO</span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ==================== TAB 4: CURVA ABC & SUBGRUPOS ==================== */}
      {activeTab === 'abc' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            {/* Cumulative Pareto Chart */}
            <div className="lg:col-span-8 bg-[#0F1116] rounded-lg border border-slate-800 p-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2 font-sans">Curva de Pareto de Imobilização Financeira (Top SKUs)</h3>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={paretoData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" />
                    <YAxis yAxisId="left" tickFormatter={activeFormatter} stroke="#818cf8" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${Math.round(v)}%`} stroke="#10b981" tick={{ fontSize: 10 }} domain={[0, 100]} />
                    <Tooltip 
                      formatter={(val, name, props) => name === '% Acumulado' ? `${Number(val).toFixed(2)}%` : formatMetric(Number(val))} 
                      contentStyle={{ backgroundColor: '#1A1F26', border: '1px solid #334155' }} 
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar isAnimationActive={false} yAxisId="left" dataKey="valor" fill="#818cf8" radius={[2, 2, 0, 0]} name={analysisMode === 'valor' ? 'Valor SKU (R$)' : 'Quantid. SKU (UN)'} />
                    <Line isAnimationActive={false} yAxisId="right" type="step" dataKey="accumulatedPct" stroke="#10b981" strokeWidth={2} name="% Acumulado" dot={false} activeDot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Strategic rules for curve ABC */}
            <div className="lg:col-span-4 bg-[#0F1116] rounded-lg border border-slate-800 p-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">Regras de Armazenagem ABC</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                  Use as classificações para direcionar esforços de controle de perdas e negociação comercial:
                </p>

                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] mt-1.5 shrink-0"></span>
                    <p className="text-slate-300">
                      <strong className="text-white uppercase font-semibold block">Classe A (A1 / A2):</strong>
                      Prazos curtos e contratos anuais dinâmicos. Monitoramento de estoque semanal.
                    </p>
                  </div>
                  <div className="flex items-start gap-2 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] mt-1.5 shrink-0"></span>
                    <p className="text-slate-300">
                      <strong className="text-white uppercase font-semibold block">Classe B (B1 / B2):</strong>
                      Prazos médios e lotes fixados. Acompanhamento quinzenal dos giros ocorridos.
                    </p>
                  </div>
                  <div className="flex items-start gap-2 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] mt-1.5 shrink-0"></span>
                    <p className="text-slate-300">
                      <strong className="text-white uppercase font-semibold block">Classe C (C1 / C2):</strong>
                      Prazos de compra amplos com foco em descontos por volume. Revisão de excessos a cada trimestre.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[#1A1F26] border border-slate-800 p-3 rounded mt-4">
                <span className="text-[10px] text-indigo-400 uppercase font-bold block mb-1">Ações Recomendadas:</span>
                <span className="text-[11px] text-slate-300">Intensificar auditorias cíclicas de inventário sobre subgrupo A1 para erradicar rupturas operacionais.</span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ==================== TAB 5: DIAS SEM MOVIMENTAÇÃO (AGING OF STOCKS) ==================== */}
      {activeTab === 'aging' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            <div className="lg:col-span-8 bg-[#0F1116] rounded-lg border border-slate-800 p-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2 font-sans">Análise do Passivo Circulante Imobilizado (Dias sem Movimentação)</h3>
              
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={valueByAging} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={activeFormatter} stroke="#64748b" tick={{ fontSize: 10 }} />
                    <Tooltip formatter={activeFormatter} contentStyle={{ backgroundColor: '#1A1F26', border: '1px solid #334155' }} />
                    <Area isAnimationActive={false} type="monotone" dataKey="value" stroke="#f59e0b" fillOpacity={1} fill="url(#colorVal)" strokeWidth={2} name={analysisMode === 'valor' ? 'Capital Retido (R$)' : 'Qtd Retida (UN)'} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Strategic Liquidation Widget */}
            <div className="lg:col-span-4 bg-[#0F1116] rounded-lg border border-slate-800 p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ShieldAlert className="w-5 h-5 text-red-500" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Metas de Liquidação</h3>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                  Estoque sem movimentações acima de 180 dias representa custo financeiro duplo: o capital de giro preso e a ocupação do espaço físico no centro de distribuição.
                </p>

                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Taxa de Ociosidade Geral:</span>
                    <span className="text-xs font-mono font-bold text-red-400">{businessInsights.deadPct.toFixed(1)}% do estoque</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Custo Mensal de Carregamento (3%):</span>
                    <span className="text-xs font-mono font-bold text-indigo-300">{currencyFormatter(kpis.valorCritico * 0.03)} / mês</span>
                  </div>
                </div>
              </div>

              <div className="bg-[#1C1711] border border-amber-900/40 p-3 rounded">
                <span className="text-[10px] text-amber-500 uppercase font-bold block mb-1">Ação de Caixa Proposta:</span>
                <span className="text-[11px] text-slate-300">Iniciar leilão industrial eletrônico imediatamente para queimar os ativos inativos mais pesados.</span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ==================== TAB 6: EXPLORADOR DE DADOS GERAL ==================== */}
      <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-slate-800">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest pl-2 mb-2">Detalhes dos Registros Filtrados ({numberFormatter(filteredData.length)})</h3>
        
        {/* Detailed vs Aggregated Toggles */}
        <div className="flex items-center justify-between bg-[#0F1116] px-4 py-2 border border-slate-800 rounded-lg">
          <span className="text-[10px] uppercase font-bold text-slate-500">Visualização de Linhas:</span>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setViewMode('detailed')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest transition-colors ${viewMode === 'detailed' ? 'bg-indigo-600 text-white' : 'bg-[#1A1F26] text-slate-400 hover:text-white'}`}
            >
              <List className="w-4 h-4" /> Detalhado
            </button>
            <button 
              onClick={() => setViewMode('aggregated')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest transition-colors ${viewMode === 'aggregated' ? 'bg-indigo-600 text-white' : 'bg-[#1A1F26] text-slate-400 hover:text-white'}`}
            >
              <Layers className="w-4 h-4" /> Agrupado
            </button>
          </div>
        </div>

        {/* Primary tables based on toggle viewMode */}
        {viewMode === 'detailed' ? (
          <InventoryTable data={filteredData} />
        ) : (
          <AggregatedTable data={filteredData} />
        )}
      </div>

      </div>

      </>
      )}

    </div>
  );
}
