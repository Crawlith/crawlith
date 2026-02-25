import { healthMetrics } from '../data.js';
import { Activity, Link, Ghost, Copy, Layers, TrendingUp } from 'lucide-react';

export const HealthSnapshot = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
      <StatCard label="Health Score" value={healthMetrics.score} unit="/100" icon={Activity} color="text-green-600 dark:text-green-500" />
      <StatCard label="Broken Links" value={healthMetrics.brokenLinks} icon={Link} color="text-red-500" />
      <StatCard label="Orphan Pages" value={healthMetrics.orphanPages} icon={Ghost} color="text-yellow-500" />
      <StatCard label="Dup. Clusters" value={healthMetrics.duplicateClusters} icon={Copy} color="text-orange-500" />
      <StatCard label="Pages Crawled" value={healthMetrics.pagesCrawled} icon={Layers} color="text-blue-500" />
      <StatCard label="Efficiency" value={healthMetrics.efficiency} unit="%" icon={TrendingUp} color="text-purple-500" />
    </div>
  );
};

const StatCard = ({ label, value, unit, icon: Icon, color }: any) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between h-32 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
    <div className="flex items-start justify-between">
      <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">{label}</span>
      <Icon size={18} className={`${color} opacity-80`} />
    </div>
    <div className="flex items-baseline gap-1">
      <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">{value}</span>
      {unit && <span className="text-sm text-slate-400 font-medium">{unit}</span>}
    </div>
  </div>
);
