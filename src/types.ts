export interface SalesData {
  cliente: string;
  pais: string;
  canal: string;
  formaDePago: string;
  producto: string;
  vendedor: string;
  fecha: Date;
  ventas: number;
  cantidad: number;
}

export interface DashboardStats {
  totalSales: number;
  totalQuantity: number;
  averageTicket: number;
  totalClients: number;
}

export interface FilterState {
  dateRange: { start: string; end: string };
  pais: string[];
  canal: string[];
  vendedor: string[];
  producto: string[];
  formaDePago: string[];
}
