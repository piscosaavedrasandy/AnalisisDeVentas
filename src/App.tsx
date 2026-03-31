import React, { useState, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area
} from 'recharts';
import { 
  Upload, Filter, Download, TrendingUp, Users, Package, 
  DollarSign, Calendar, ChevronDown, Search, X, BarChart3, PieChart as PieChartIcon,
  Globe
} from 'lucide-react';
import { motion } from 'motion/react';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn, formatCurrency, formatNumber } from './lib/utils';
import { SalesData, FilterState } from './types';

const COLORS = ['#8b5cf6', '#f43f5e', '#f59e0b', '#3b82f6', '#10b981', '#ec4899', '#06b6d4'];

const KPICard = ({ title, value, icon, color }: { title: string, value: string, icon: React.ReactNode, color: 'blue' | 'pink' | 'orange' | 'purple' }) => {
  const colorMap: Record<string, string> = {
    blue: 'text-accent-blue bg-accent-blue/10',
    pink: 'text-accent-pink bg-accent-pink/10',
    orange: 'text-accent-orange bg-accent-orange/10',
    purple: 'text-accent-purple bg-accent-purple/10',
  };

  return (
    <div className="bg-card-bg rounded-2xl p-6 border border-white/5 shadow-lg glass-card group hover:border-white/10 transition-all">
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-2.5 rounded-xl transition-transform group-hover:scale-110", colorMap[color] || colorMap.blue)}>
          {icon}
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-white/50">{title}</p>
        <h3 className="text-2xl font-bold text-white tracking-tight">{value}</h3>
      </div>
    </div>
  );
};

const ChartCard = ({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) => (
  <div className="bg-card-bg rounded-2xl p-6 border border-white/5 shadow-lg glass-card flex flex-col space-y-6">
    <div className="flex items-center justify-between">
      <h3 className="font-semibold text-white flex items-center gap-2">
        <span className="text-accent-purple">{icon}</span>
        {title}
      </h3>
    </div>
    <div className="flex-1 min-h-[300px]">
      {children}
    </div>
  </div>
);

export default function App() {
  const [data, setData] = useState<SalesData[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    dateRange: { start: '', end: '' },
    pais: [],
    canal: [],
    vendedor: [],
    producto: [],
    formaDePago: [],
  });

  const [filterSearch, setFilterSearch] = useState({
    pais: '', canal: '', vendedor: '', producto: '', formaDePago: ''
  });

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    const extension = file.name.split('.').pop()?.toLowerCase();

    reader.onload = (e) => {
      const bstr = e.target?.result;
      let rawData: any[] = [];

      if (extension === 'csv') {
        const result = Papa.parse(bstr as string, { header: true, skipEmptyLines: true });
        rawData = result.data;
      } else {
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
      }

      const processedData: SalesData[] = rawData.map((item: any) => {
        // Normalize keys for robust matching
        const normalizedItem: Record<string, any> = {};
        Object.keys(item).forEach(key => {
          const normalizedKey = key.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
            .replace(/[^a-z0-9]/g, ''); // Remove non-alphanumeric
          normalizedItem[normalizedKey] = item[key];
        });

        const getVal = (keys: string[]) => {
          for (const k of keys) {
            if (normalizedItem[k] !== undefined) return normalizedItem[k];
          }
          return '';
        };

        const parseNum = (val: any) => {
          if (typeof val === 'number') return val;
          if (!val) return 0;
          // Remove currency symbols, spaces, and handle comma as decimal separator
          const cleaned = String(val).replace(/[^\d,.-]/g, '').replace(',', '.');
          const num = parseFloat(cleaned);
          return isNaN(num) ? 0 : num;
        };

        const parseDate = (val: any) => {
          if (val instanceof Date) return val;
          if (typeof val === 'number') {
            // Handle Excel serial dates
            return new Date((val - 25569) * 86400 * 1000);
          }
          if (!val) return new Date();
          const d = new Date(val);
          return isNaN(d.getTime()) ? new Date() : d;
        };

        return {
          cliente: String(getVal(['cliente'])),
          pais: String(getVal(['pais', 'country'])),
          canal: String(getVal(['canal', 'channel'])),
          formaDePago: String(getVal(['formadepago', 'formapago', 'metodopago', 'paymentmethod'])),
          producto: String(getVal(['producto', 'product'])),
          vendedor: String(getVal(['vendedor', 'salesperson', 'seller'])),
          fecha: parseDate(getVal(['fecha', 'date'])),
          ventas: parseNum(getVal(['ventas', 'sales', 'monto', 'total'])),
          cantidad: parseNum(getVal(['cantidad', 'quantity', 'unidades'])),
        };
      });

      setData(processedData);
      
      // Initialize date range
      const dates = processedData.map(d => d.fecha.getTime());
      if (dates.length > 0) {
        const minDate = new Date(Math.min(...dates)).toISOString().split('T')[0];
        const maxDate = new Date(Math.max(...dates)).toISOString().split('T')[0];
        setFilters({
          dateRange: { start: minDate, end: maxDate },
          pais: [], canal: [], vendedor: [], producto: [], formaDePago: []
        });
      }
    };

    if (extension === 'csv') {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, []);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const dateMatch = !filters.dateRange.start || !filters.dateRange.end || 
        isWithinInterval(item.fecha, { 
          start: parseISO(filters.dateRange.start), 
          end: parseISO(filters.dateRange.end) 
        });
      
      const paisMatch = filters.pais.length === 0 || filters.pais.includes(item.pais);
      const canalMatch = filters.canal.length === 0 || filters.canal.includes(item.canal);
      const vendedorMatch = filters.vendedor.length === 0 || filters.vendedor.includes(item.vendedor);
      const productoMatch = filters.producto.length === 0 || filters.producto.includes(item.producto);
      const pagoMatch = filters.formaDePago.length === 0 || filters.formaDePago.includes(item.formaDePago);

      return dateMatch && paisMatch && canalMatch && vendedorMatch && productoMatch && pagoMatch;
    });
  }, [data, filters]);

  const stats = useMemo(() => {
    const totalSales = filteredData.reduce((acc, curr) => acc + curr.ventas, 0);
    const totalQuantity = filteredData.reduce((acc, curr) => acc + curr.cantidad, 0);
    const uniqueClients = new Set(filteredData.map(d => d.cliente)).size;
    const averageTicket = totalSales / (filteredData.length || 1);

    return { totalSales, totalQuantity, uniqueClients, averageTicket };
  }, [filteredData]);

  const chartData = useMemo(() => {
    // Sales by Date
    const salesByDate: Record<string, number> = {};
    filteredData.forEach(d => {
      const dateStr = format(d.fecha, 'MMM yyyy', { locale: es });
      salesByDate[dateStr] = (salesByDate[dateStr] || 0) + d.ventas;
    });
    const timeData = Object.entries(salesByDate).map(([name, value]) => ({ name, value }));

    // Sales by Country
    const salesByCountry: Record<string, number> = {};
    filteredData.forEach(d => {
      salesByCountry[d.pais] = (salesByCountry[d.pais] || 0) + d.ventas;
    });
    const countryData = Object.entries(salesByCountry)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Sales by Channel
    const salesByChannel: Record<string, number> = {};
    filteredData.forEach(d => {
      salesByChannel[d.canal] = (salesByChannel[d.canal] || 0) + d.ventas;
    });
    const channelData = Object.entries(salesByChannel).map(([name, value]) => ({ name, value }));

    // Top Products
    const salesByProduct: Record<string, number> = {};
    filteredData.forEach(d => {
      salesByProduct[d.producto] = (salesByProduct[d.producto] || 0) + d.ventas;
    });
    const productData = Object.entries(salesByProduct)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return { timeData, countryData, channelData, productData };
  }, [filteredData]);

  const uniqueValues = useMemo(() => {
    const getFilteredUnique = (key: keyof SalesData, excludeKey?: keyof FilterState) => {
      const tempFiltered = data.filter(item => {
        const dateMatch = !filters.dateRange.start || !filters.dateRange.end || 
          isWithinInterval(item.fecha, { 
            start: parseISO(filters.dateRange.start), 
            end: parseISO(filters.dateRange.end) 
          });
        
        const paisMatch = (excludeKey === 'pais' || filters.pais.length === 0 || filters.pais.includes(item.pais));
        const canalMatch = (excludeKey === 'canal' || filters.canal.length === 0 || filters.canal.includes(item.canal));
        const vendedorMatch = (excludeKey === 'vendedor' || filters.vendedor.length === 0 || filters.vendedor.includes(item.vendedor));
        const productoMatch = (excludeKey === 'producto' || filters.producto.length === 0 || filters.producto.includes(item.producto));
        const pagoMatch = (excludeKey === 'formaDePago' || filters.formaDePago.length === 0 || filters.formaDePago.includes(item.formaDePago));

        return dateMatch && paisMatch && canalMatch && vendedorMatch && productoMatch && pagoMatch;
      });
      
      const values: string[] = Array.from(new Set(tempFiltered.map(d => d[key] as string)))
        .filter((v): v is string => Boolean(v))
        .sort();
      const search: string = (filterSearch as Record<string, string>)[key as string]?.toLowerCase() || '';
      
      if (!search) return values;
      return values.filter((v: string) => v.toLowerCase().includes(search));
    };

    return {
      pais: getFilteredUnique('pais', 'pais'),
      canal: getFilteredUnique('canal', 'canal'),
      vendedor: getFilteredUnique('vendedor', 'vendedor'),
      producto: getFilteredUnique('producto', 'producto'),
      formaDePago: getFilteredUnique('formaDePago', 'formaDePago'),
    };
  }, [data, filters, filterSearch]);

  const toggleFilter = (key: keyof FilterState, value: string) => {
    setFilters(prev => {
      const current = prev[key] as string[];
      const next = current.includes(value) 
        ? current.filter(v => v !== value) 
        : [...current, value];
      return { ...prev, [key]: next };
    });
  };

  if (data.length === 0) {
    return (
      <div className="min-h-screen bg-dashboard-bg flex flex-col items-center justify-center p-6 text-white">
        <div className="max-w-xl w-full text-center space-y-8">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-white">Análisis de Venta</h1>
            <p className="text-white/60 text-lg">Carga tu archivo de ventas para comenzar el análisis.</p>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            className={cn(
              "relative border-2 border-dashed rounded-2xl p-12 transition-all duration-200 ease-in-out flex flex-col items-center justify-center space-y-4 cursor-pointer",
              isDragging ? "border-accent-purple bg-accent-purple/10" : "border-white/10 bg-card-bg hover:border-white/20"
            )}
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <input
              id="file-upload"
              type="file"
              className="hidden"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            />
            <div className="w-16 h-16 bg-accent-purple/20 rounded-full flex items-center justify-center text-accent-purple">
              <Upload className="w-8 h-8" />
            </div>
            <div className="text-center">
              <p className="text-lg font-medium text-white">Suelta tu archivo aquí o haz clic para buscar</p>
              <p className="text-sm text-white/40 mt-1">Soporta Excel (.xlsx, .xls) y CSV</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-left">
            <div className="p-4 bg-card-bg rounded-xl border border-white/5 shadow-sm">
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Columnas requeridas</p>
              <ul className="text-sm text-white/70 space-y-1">
                <li>• Cliente, País, Canal</li>
                <li>• Forma de Pago, Producto</li>
                <li>• Vendedor, Fecha</li>
                <li>• Ventas, Cantidad</li>
              </ul>
            </div>
            <div className="p-4 bg-card-bg rounded-xl border border-white/5 shadow-sm">
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Beneficios</p>
              <ul className="text-sm text-white/70 space-y-1">
                <li>• Dashboard interactivo</li>
                <li>• KPIs en tiempo real</li>
                <li>• Filtros dinámicos</li>
                <li>• Gráficos profesionales</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dashboard-bg flex flex-col text-white">
      {/* Header */}
      <header className="bg-sidebar-bg border-b border-white/5 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-accent-purple rounded-lg flex items-center justify-center text-white">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-white hidden sm:block">Análisis de Venta</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setData([])}
              className="text-sm font-medium text-white/50 hover:text-white flex items-center space-x-2 transition-colors"
            >
              <X className="w-4 h-4" />
              <span>Limpiar datos</span>
            </button>
            <div className="h-6 w-px bg-white/10" />
            <div className="flex items-center space-x-2 text-sm text-white/50">
              <Calendar className="w-4 h-4" />
              <span>{format(new Date(), 'dd MMMM, yyyy', { locale: es })}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row max-w-[1600px] mx-auto w-full p-4 sm:p-6 gap-6">
        {/* Sidebar Filters */}
        <aside className="w-full lg:w-72 space-y-6 shrink-0">
          <div className="bg-sidebar-bg rounded-2xl border border-white/5 p-5 shadow-xl space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <Filter className="w-4 h-4 text-accent-purple" />
                Filtros
              </h2>
              <button 
                onClick={() => setFilters({
                  dateRange: filters.dateRange,
                  pais: [], canal: [], vendedor: [], producto: [], formaDePago: []
                })}
                className="text-xs text-accent-purple hover:text-accent-purple/80 font-medium transition-colors"
              >
                Resetear
              </button>
            </div>

            {/* Date Range */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Rango de Fecha</label>
              <div className="grid grid-cols-1 gap-2">
                <input 
                  type="date" 
                  value={filters.dateRange.start}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateRange: { ...prev.dateRange, start: e.target.value } }))}
                  className="w-full text-sm bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-accent-purple outline-none transition-all"
                />
                <input 
                  type="date" 
                  value={filters.dateRange.end}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateRange: { ...prev.dateRange, end: e.target.value } }))}
                  className="w-full text-sm bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-accent-purple outline-none transition-all"
                />
              </div>
            </div>

            {/* Multi-select Filters */}
            {(['pais', 'canal', 'vendedor', 'producto', 'formaDePago'] as const).map((key) => (
              <div key={key} className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white/40 uppercase tracking-wider">
                    {key === 'pais' ? 'País' : key === 'formaDePago' ? 'Forma de Pago' : key.charAt(0).toUpperCase() + key.slice(1)}
                  </label>
                  {filters[key].length > 0 && (
                    <span className="text-[10px] bg-accent-purple/20 text-accent-purple px-1.5 py-0.5 rounded-full font-bold">
                      {filters[key].length}
                    </span>
                  )}
                </div>
                
                <div className="relative group">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 group-focus-within:text-accent-purple transition-colors" />
                  <input 
                    type="text"
                    placeholder={`Buscar ${key === 'pais' ? 'país' : key === 'formaDePago' ? 'forma de pago' : key}...`}
                    value={filterSearch[key as keyof typeof filterSearch]}
                    onChange={(e) => setFilterSearch(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full text-xs bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-white focus:ring-2 focus:ring-accent-purple outline-none transition-all"
                  />
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                  {uniqueValues[key].length === 0 ? (
                    <p className="text-[10px] text-white/30 italic py-2">No hay resultados</p>
                  ) : (
                    uniqueValues[key].map(val => (
                      <label key={val} className={cn(
                        "flex items-center space-x-2 p-1.5 rounded-lg cursor-pointer transition-all group",
                        filters[key].includes(val) ? "bg-accent-purple/10 text-accent-purple" : "hover:bg-white/5 text-white/60"
                      )}>
                        <input 
                          type="checkbox" 
                          checked={filters[key].includes(val)}
                          onChange={() => toggleFilter(key, val)}
                          className="rounded border-white/20 bg-transparent text-accent-purple focus:ring-accent-purple w-3.5 h-3.5"
                        />
                        <span className="text-xs truncate group-hover:translate-x-0.5 transition-transform">{val}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 space-y-6 min-w-0">
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KPICard 
              title="Ventas Totales" 
              value={formatCurrency(stats.totalSales)} 
              icon={<DollarSign className="w-5 h-5" />} 
              color="blue"
            />
            <KPICard 
              title="Cantidad Vendida" 
              value={formatNumber(stats.totalQuantity)} 
              icon={<Package className="w-5 h-5" />} 
              color="pink"
            />
            <KPICard 
              title="Clientes Únicos" 
              value={formatNumber(stats.uniqueClients)} 
              icon={<Users className="w-5 h-5" />} 
              color="orange"
            />
            <KPICard 
              title="Ticket Promedio" 
              value={formatCurrency(stats.averageTicket)} 
              icon={<TrendingUp className="w-5 h-5" />} 
              color="purple"
            />
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Sales Evolution */}
            <ChartCard title="Evolución de Ventas" icon={<TrendingUp className="w-4 h-4" />}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData.timeData}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-accent-blue)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--color-accent-blue)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} 
                    tickFormatter={(v) => `$${v >= 1000000 ? (v/1000000).toFixed(1) + 'M' : (v/1000).toFixed(0) + 'k'}`} 
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1c1f2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(v: number) => [formatCurrency(v), 'Ventas']}
                  />
                  <Area type="monotone" dataKey="value" stroke="var(--color-accent-blue)" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Sales by Country */}
            <ChartCard title="Ventas por País" icon={<BarChart3 className="w-4 h-4" />}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.countryData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} 
                    width={80} 
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ backgroundColor: '#1c1f2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(v: number) => [formatCurrency(v), 'Ventas']}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                    {chartData.countryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Sales by Channel */}
            <ChartCard title="Distribución por Canal" icon={<PieChartIcon className="w-4 h-4" />}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData.channelData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.channelData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1c1f2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(v: number) => [formatCurrency(v), 'Ventas']}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle" 
                    formatter={(value) => <span className="text-white/60 text-xs">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Top Products */}
            <ChartCard title="Top 5 Productos" icon={<Package className="w-4 h-4" />}>
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {chartData.productData.map((prod, idx) => (
                  <div key={prod.name} className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-white/60 font-medium">{prod.name}</span>
                      <span className="text-white font-bold">{formatCurrency(prod.value)}</span>
                    </div>
                    <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(prod.value / chartData.productData[0].value) * 100}%` }}
                        className="bg-accent-purple h-full rounded-full transition-all duration-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </ChartCard>
          </div>

          {/* Detailed Table */}
          <div className="bg-card-bg rounded-2xl border border-white/5 shadow-xl overflow-hidden glass-card">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-semibold text-white">Resumen de Ventas</h3>
              <span className="text-xs font-medium text-white/40 bg-white/5 px-2 py-1 rounded-md">
                {filteredData.length} registros
              </span>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/[0.02] text-white/40 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-6 py-4">Fecha</th>
                    <th className="px-6 py-4">Cliente</th>
                    <th className="px-6 py-4">Producto</th>
                    <th className="px-6 py-4">Vendedor</th>
                    <th className="px-6 py-4">Canal</th>
                    <th className="px-6 py-4 text-right">Cantidad</th>
                    <th className="px-6 py-4 text-right">Ventas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredData.slice(0, 50).map((row, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4 text-white/50 whitespace-nowrap">{format(row.fecha, 'dd/MM/yyyy')}</td>
                      <td className="px-6 py-4 font-medium text-white group-hover:text-accent-purple transition-colors">{row.cliente}</td>
                      <td className="px-6 py-4 text-white/70">{row.producto}</td>
                      <td className="px-6 py-4 text-white/70">{row.vendedor}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-blue/10 text-accent-blue border border-accent-blue/20 uppercase tracking-tight">
                          {row.canal}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-white/70">{row.cantidad}</td>
                      <td className="px-6 py-4 text-right font-bold text-white">{formatCurrency(row.ventas)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredData.length > 50 && (
              <div className="p-4 text-center border-t border-white/5 bg-white/[0.01]">
                <p className="text-xs text-white/30 italic">Mostrando los primeros 50 registros de {filteredData.length}</p>
              </div>
            )}
          </div>
        </main>
      </div>
      
      {/* Footer */}
      <footer className="py-6 border-t border-white/5 bg-sidebar-bg/50 mt-auto">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 text-center">
          <p className="text-sm text-white/40">
            creado por: <span className="text-white/60 font-medium">Samanta Pisco- Curso Excel con IA</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
