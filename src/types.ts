export interface InventoryItem {
  id: string;
  codigo: string;
  descricao: string;
  material: string;
  malha: string;
  fio: string;
  largura: string;
  unidade: string;
  formaFisica: string;
  classeABC: string;
  subClasseABC: string;
  estoque: number;
  estoqueValorizado: number;
  consumoMedio: number;
  diasCobertura: number;
  precoMedio: number;
  critico: string;
  dtUltMovto: string;
  
  // Custom calculated fields
  diasParado: number;
  grupoDiasParados: string;
  status: 'Crítico' | 'Alerta' | 'Saudável';
}
