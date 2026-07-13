export interface Product {
  id: string;
  nombre: string;
  costo: string;
  costoParsed: number;
  unidad: string;
  unidadParsed: number;
  mayor1: string;
  mayor1Parsed: number;
  mayor2: string;
  mayor2Parsed: number;
  bulto: string;
  bultoParsed: number;
  cajaMayor1: string;
  cajaMayor1Parsed: number;
  cajaMayor2: string;
  cajaMayor2Parsed: number;
  isCategoryHeader: boolean;
}

export interface CartItem {
  id: string; // e.g. `${productId}-${presentation}`
  product: Product;
  presentation: 'unidad' | 'caja_mayor1' | 'caja_mayor2';
  presentationLabel: string;
  price: number;
  quantity: number;
}

export interface ClientData {
  nombre: string;
  direccion: string;
  telefono: string;
  ubicacion: string;
  wholesaleWhatsapp: string;
}

export interface SavedOrder {
  id: string;
  date: string;
  client: ClientData;
  items: CartItem[];
  total: number;
  text: string;
}

export interface SavedClient {
  id: string;
  nombre: string;
  direccion: string;
  telefono: string;
  ubicacion: string;
}

