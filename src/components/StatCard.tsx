import React from 'react';
import { cn } from '../lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function StatCard({ title, value, subtitle, icon: Icon, trend, className }: StatCardProps) {
  return (
    <div className={cn("bg-[#151921] border border-slate-800 p-4 rounded-lg flex flex-col justify-between transition-colors hover:border-slate-700", className)}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">{title}</span>
        {Icon && (
          <div className="text-indigo-500/70">
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white tracking-tighter">{value}</span>
          {trend && (
            <span
              className={cn(
                "text-xs font-bold font-mono",
                trend.isPositive ? "text-emerald-500" : "text-red-500"
              )}
            >
              {trend.isPositive ? '+' : '-'}{Math.abs(trend.value)}%
            </span>
          )}
        </div>
        {subtitle && <span className="text-[11px] text-slate-500 block mt-1">{subtitle}</span>}
      </div>
    </div>
  );
}
