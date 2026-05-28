import React from 'react';
import { Dashboard } from './components/Dashboard';
import { Printer } from 'lucide-react';

export default function App() {
  return (
    <div className="min-h-screen bg-[#0A0C10] text-slate-200 font-sans selection:bg-indigo-500/30 flex flex-col">
      <header className="h-16 border-b border-slate-800 flex items-center justify-between px-4 sm:px-8 bg-[#0F1116] shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded flex items-center justify-center font-bold text-white shadow-sm">
            <span className="text-sm">CM</span>
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-white uppercase">
              Central Mesh | <span className="text-indigo-400">Inventory Command Center</span>
            </h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">
              Relatório Executivo de Otimização de Ativos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 print:hidden">
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold text-[10px] uppercase tracking-widest transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Exportar Diretoria
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 w-full max-w-[1600px] mx-auto print:max-w-none print:p-0">
        <Dashboard />
      </main>
    </div>
  );
}
