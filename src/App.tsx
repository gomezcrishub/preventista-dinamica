import { useState, useEffect, useMemo } from "react";
import { Product, CartItem, ClientData, SavedOrder, SavedClient } from "./types";
import { 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  Send,
  Sparkles,
  User,
  MapPin,
  Phone,
  Grid,
  Package,
  Info,
  ArrowRight,
  Copy,
  Navigation,
  ChevronDown,
  ChevronUp,
  History,
  FileText,
  Save,
  Users
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Helper to format prices with dot for thousands and comma for decimals according to Argentinian style
const formatPrice = (val: string | number | undefined | null): string => {
  if (val === undefined || val === null) return "-";
  if (typeof val === "number") {
    return val.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  let clean = val.trim();
  if (!clean || clean === "-" || clean === "0" || clean === "0.00" || clean === "0,00") return "-";
  
  // Remove $ if present
  clean = clean.replace('$', '').trim();
  
  // Parse using Argentinian rules:
  // If there's a comma, it is the decimal separator (e.g. "642,5" -> "642.5" after removing thousand dots)
  if (clean.includes(',')) {
    clean = clean.replace(/\./g, '');
    clean = clean.replace(',', '.');
  } else {
    // Whole numbers or thousand dots only (e.g. "14.778" -> "14778" -> parsed correctly)
    clean = clean.replace(/\./g, '');
  }
  
  const num = parseFloat(clean);
  if (isNaN(num)) return val; // fallback to original value if parsing fails
  
  return num.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

// URL for direct Google Sheets CSV fetching
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1UVKTNUQuq9JEQr4k6_jJFmzFxpnct14xpR-bxfbBJsA/gviz/tq?tqx=out:csv&sheet=GolosinasMayorista";

// Helper to parse a single line of CSV
const parseCSVLineClient = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map(s => s.trim());
};

// Number parsing adjusted for Argentinian currency values
const parseNumberSpanishClient = (val: string | undefined | null): number => {
  if (!val) return 0;
  let clean = val.trim();
  clean = clean.replace('$', '').trim();
  if (clean.includes(',')) {
    clean = clean.replace(/\./g, '');
    clean = clean.replace(',', '.');
  } else {
    clean = clean.replace(/\./g, '');
  }
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

// Parse Google Sheet CSV data
const parseCSVDataClient = (csvText: string): Product[] => {
  const lines = csvText.split(/\r?\n/);
  if (lines.length === 0) return [];

  const parsedProducts: Product[] = [];
  let headerSkipped = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const columns = parseCSVLineClient(line);
    
    // Skip the first header row
    if (!headerSkipped) {
      if (columns[0] && columns[0].toLowerCase().includes('nombre')) {
        headerSkipped = true;
        continue;
      }
    }

    const nombre = columns[0] || "";
    const costo = columns[1] || "";
    const unidad = columns[2] || "";
    const mayor1 = columns[3] || "";
    const mayor2 = columns[4] || "";
    const bulto = columns[5] || "";
    const cajaMayor1 = columns[6] || "";
    const cajaMayor2 = columns[7] || "";

    // Skip fully empty rows
    if (!nombre && !costo && !unidad && !mayor1 && !mayor2 && !bulto && !cajaMayor1 && !cajaMayor2) {
      continue;
    }

    const costoVal = parseNumberSpanishClient(costo);
    const unidadVal = parseNumberSpanishClient(unidad);
    const mayor1Val = parseNumberSpanishClient(mayor1);
    const mayor2Val = parseNumberSpanishClient(mayor2);
    const bultoVal = parseNumberSpanishClient(bulto);
    const cajaMayor1Val = parseNumberSpanishClient(cajaMayor1);
    const cajaMayor2Val = parseNumberSpanishClient(cajaMayor2);

    // Identify if it's a category header row
    const isCategoryHeader = !!nombre && !costo && !cajaMayor1 && (unidadVal === 0) && (mayor1Val === 0) && (mayor2Val === 0);

    parsedProducts.push({
      id: `p-${i}-${nombre.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`,
      nombre,
      costo: costo || "",
      costoParsed: costoVal,
      unidad: unidad || "",
      unidadParsed: unidadVal,
      mayor1: mayor1 || "",
      mayor1Parsed: mayor1Val,
      mayor2: mayor2 || "",
      mayor2Parsed: mayor2Val,
      bulto: bulto || "",
      bultoParsed: bultoVal,
      cajaMayor1: cajaMayor1 || "",
      cajaMayor1Parsed: cajaMayor1Val,
      cajaMayor2: cajaMayor2 || "",
      cajaMayor2Parsed: cajaMayor2Val,
      isCategoryHeader: isCategoryHeader
    });
  }

  return parsedProducts;
};


export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<string>("Cargando...");
  
  // App States
  const [cart, setCart] = useState<CartItem[]>(() => {
    const savedCart = localStorage.getItem("wholesaler_cart");
    return savedCart ? JSON.parse(savedCart) : [];
  });
  
  const [client, setClient] = useState<ClientData>(() => {
    const savedClient = localStorage.getItem("wholesaler_client");
    if (savedClient) {
      try {
        const parsed = JSON.parse(savedClient);
        return {
          nombre: parsed.nombre || "",
          direccion: parsed.direccion || "",
          telefono: parsed.telefono || "",
          ubicacion: parsed.ubicacion || "",
          wholesaleWhatsapp: parsed.wholesaleWhatsapp || "5491123456789"
        };
      } catch (e) {
        console.error(e);
      }
    }
    return {
      nombre: "",
      direccion: "",
      telefono: "",
      ubicacion: "",
      wholesaleWhatsapp: "5491123456789"
    };
  });

  const [activeTab, setActiveTab] = useState<"planilla" | "pedidos">("planilla");
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  const [customDialog, setCustomDialog] = useState<{
    isOpen: boolean;
    type: "alert" | "confirm";
    title: string;
    message: string;
    onConfirm?: () => void;
  } | null>(null);

  const showAlert = (title: string, message: string) => {
    setCustomDialog({
      isOpen: true,
      type: "alert",
      title,
      message
    });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setCustomDialog({
      isOpen: true,
      type: "confirm",
      title,
      message,
      onConfirm
    });
  };

  const [savedOrders, setSavedOrders] = useState<SavedOrder[]>(() => {
    const saved = localStorage.getItem("wholesaler_saved_orders");
    return saved ? JSON.parse(saved) : [];
  });

  const savedOrdersTotal = useMemo(() => {
    return savedOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  }, [savedOrders]);

  const [savedClients, setSavedClients] = useState<SavedClient[]>(() => {
    const saved = localStorage.getItem("wholesaler_saved_clients");
    return saved ? JSON.parse(saved) : [];
  });

  const [isClientsModalOpen, setIsClientsModalOpen] = useState<boolean>(false);

  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  const [hoveredCell, setHoveredCell] = useState<{ row: number; colLetter: string; colName: string; value: string } | null>(null);
  const [activeCell, setActiveCell] = useState<{ row: number; colLetter: string } | null>(null);
  const [addedAnimation, setAddedAnimation] = useState<{ id: string; text: string } | null>(null);

  const [googleAppsScriptUrl, setGoogleAppsScriptUrl] = useState<string>(() => {
    return localStorage.getItem("wholesaler_apps_script_url") || "https://script.google.com/macros/s/AKfycbxqSr6bN_Ag1GRQcZabIG-r6O_OmHyllo7qqrXcouP7o1yQJ4olmMCOQ_RHkJUcCNEi_A/exec";
  });

  const [driveImagesMapping, setDriveImagesMapping] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem("wholesaler_drive_mapping");
    return saved ? JSON.parse(saved) : {};
  });

  const [isFetchingMapping, setIsFetchingMapping] = useState<boolean>(false);
  const [selectedProductForModal, setSelectedProductForModal] = useState<Product | null>(null);
  const [selectedProductRowIndex, setSelectedProductRowIndex] = useState<number | null>(null);

  const [isLocating, setIsLocating] = useState<boolean>(false);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      showAlert("No compatible", "La geolocalización no está soportada en este navegador o dispositivo móvil.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
        setClient(prev => ({ ...prev, ubicacion: mapsUrl }));
        setIsLocating(false);
        setAddedAnimation({
          id: "gps-" + Math.random(),
          text: "📍 Ubicación GPS obtenida con éxito"
        });
        setTimeout(() => setAddedAnimation(null), 2500);
      },
      (error) => {
        setIsLocating(false);
        let errorMsg = "No se pudo obtener la ubicación.";
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = "Permiso denegado. Por favor, habilita los permisos de ubicación en tu navegador o dispositivo móvil.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = "La información de ubicación no está disponible.";
        } else if (error.code === error.TIMEOUT) {
          errorMsg = "Se agotó el tiempo de espera para obtener la ubicación.";
        }
        showAlert("Error de GPS", errorMsg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  // Persistence
  useEffect(() => {
    localStorage.setItem("wholesaler_cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem("wholesaler_client", JSON.stringify(client));
  }, [client]);

  useEffect(() => {
    localStorage.setItem("wholesaler_saved_orders", JSON.stringify(savedOrders));
  }, [savedOrders]);

  useEffect(() => {
    localStorage.setItem("wholesaler_saved_clients", JSON.stringify(savedClients));
  }, [savedClients]);

  useEffect(() => {
    localStorage.setItem("wholesaler_apps_script_url", googleAppsScriptUrl);
  }, [googleAppsScriptUrl]);

  useEffect(() => {
    localStorage.setItem("wholesaler_drive_mapping", JSON.stringify(driveImagesMapping));
  }, [driveImagesMapping]);

  const fetchDriveImagesMapping = async (urlToFetch?: string) => {
    const targetUrl = urlToFetch || googleAppsScriptUrl;
    if (!targetUrl) return;
    setIsFetchingMapping(true);
    try {
      const res = await fetch(targetUrl);
      const data = await res.json();
      if (data && typeof data === "object") {
        setDriveImagesMapping(data);
      }
    } catch (err) {
      console.error("Error fetching Google Drive mapping:", err);
    } finally {
      setIsFetchingMapping(false);
    }
  };

  useEffect(() => {
    if (googleAppsScriptUrl) {
      fetchDriveImagesMapping();
    }
  }, []);

  // Load products
  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      // First, try fetching from Express API endpoint
      const res = await fetch("/api/products");
      if (!res.ok) {
        throw new Error(`Endpoint returned status ${res.status}`);
      }
      const data = await res.json();
      if (data.products && Array.isArray(data.products)) {
        setProducts(data.products);
        setDataSource(data.source === "live_google_sheets" ? "Google Sheets (En Vivo)" : "Caché de Respaldo");
      } else {
        throw new Error("Formato de datos de API no válido.");
      }
    } catch (err: any) {
      console.warn("Express API failed, falling back to direct Google Sheet fetching:", err);
      try {
        // Fallback: Fetch CSV directly from Google Sheets
        const directRes = await fetch(SHEET_CSV_URL);
        if (!directRes.ok) {
          throw new Error(`Direct Google Sheet returned status ${directRes.status}`);
        }
        const csvText = await directRes.text();
        const parsedProducts = parseCSVDataClient(csvText);
        if (parsedProducts && parsedProducts.length > 0) {
          setProducts(parsedProducts);
          setDataSource("Google Sheets (Conexión Directa)");
        } else {
          throw new Error("El archivo CSV analizado no contiene productos.");
        }
      } catch (directErr: any) {
        console.error("Direct fetch failed too:", directErr);
        setError("No se pudo conectar con la base de datos de Google Sheets (Directa o API).");
        setDataSource("Error de conexión");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleSync = () => {
    fetchProducts();
  };

  // Cart Functions
  const addToCart = (product: Product, presentation: 'unidad' | 'caja_mayor1' | 'caja_mayor2') => {
    let price = 0;
    let presentationLabel = "";
    
    if (presentation === 'unidad') {
      price = product.unidadParsed;
      presentationLabel = "Unidad";
    } else if (presentation === 'caja_mayor1') {
      price = product.cajaMayor1Parsed;
      presentationLabel = `Caja Mayorista 1 (x${product.bulto || 'u'})`;
    } else if (presentation === 'caja_mayor2') {
      price = product.cajaMayor2Parsed;
      presentationLabel = `Caja Mayorista 2 (x${product.bulto || 'u'})`;
    }

    if (price <= 0) return;

    const cartItemId = `${product.id}-${presentation}`;

    setCart(prev => {
      const existing = prev.find(item => item.id === cartItemId);
      if (existing) {
        return prev.map(item => 
          item.id === cartItemId ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        return [...prev, {
          id: cartItemId,
          product,
          presentation,
          presentationLabel,
          price,
          quantity: 1
        }];
      }
    });

    setAddedAnimation({
      id: cartItemId + Math.random(),
      text: `+1 ${product.nombre} (${presentationLabel})`
    });

    setTimeout(() => {
      setAddedAnimation(null);
    }, 2000);
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === itemId) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      }).filter((item): item is CartItem => item !== null);
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
  };

  const clearCart = () => {
    if (window.confirm("¿Estás seguro de que deseas vaciar el carrito?")) {
      setCart([]);
    }
  };

  // Total computation
  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  }, [cart]);

  const cartItemsCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  // Generar texto del pedido
  const generateOrderText = () => {
    let text = `• *Nombre:* ${client.nombre.trim()}\n`;
    text += `• ${client.direccion.trim()}\n`;
    text += `• ${client.telefono.trim()}\n`;
    if (client.ubicacion?.trim()) {
      text += `${client.ubicacion.trim()}\n`;
    }
    text += `==================================\n`;
    text += `*🛒 DETALLE DEL PEDIDO:*\n\n`;

    cart.forEach((item, index) => {
      const subtotal = item.price * item.quantity;
      text += `${index + 1}. ${item.product.nombre}\n`;
      text += `   (${item.quantity} x $${item.price.toLocaleString('es-AR')}) *$${subtotal.toLocaleString('es-AR')}*\n\n`;
    });

    text += `==================================\n`;
    text += `*💰 TOTAL DEL PEDIDO: $${cartTotal.toLocaleString('es-AR')}*\n`;
    text += `==================================`;
    return text;
  };

  // Guardar venta en el historial (o actualizar si está editando) y vaciar el carrito
  const handleSaveSale = () => {
    if (!client.nombre.trim() || !client.direccion.trim() || !client.telefono.trim()) {
      showAlert("Datos incompletos", "Por favor, completa todos los datos del cliente (Nombre, Dirección y Teléfono) antes de guardar la venta.");
      return;
    }

    if (cart.length === 0) {
      showAlert("Carrito vacío", "El carrito está vacío. Agrega algunos artículos antes de guardar la venta.");
      return;
    }

    const text = generateOrderText();

    if (editingOrderId) {
      // Estamos editando una venta existente, la actualizamos
      setSavedOrders(prev => prev.map(order => {
        if (order.id === editingOrderId) {
          return {
            ...order,
            client: { ...client },
            items: [...cart],
            total: cartTotal,
            text: text
          };
        }
        return order;
      }));

      setAddedAnimation({
        id: "save-edit-" + Math.random(),
        text: `📝 ¡Venta de ${client.nombre} actualizada con éxito!`
      });
      setEditingOrderId(null);
    } else {
      // Crear nueva venta con fecha y hora acumulada
      const newOrder: SavedOrder = {
        id: "ord-" + Date.now(),
        date: new Date().toLocaleString("es-AR"),
        client: { ...client },
        items: [...cart],
        total: cartTotal,
        text: text
      };
      setSavedOrders(prev => [newOrder, ...prev]);
      setExpandedOrders(prev => ({ ...prev, [newOrder.id]: false }));

      setAddedAnimation({
        id: "save-new-" + Math.random(),
        text: `💾 ¡Venta de ${client.nombre} guardada en el Historial!`
      });
    }

    // Guardar o actualizar cliente en la base de datos de clientes de forma local
    const clientNameNorm = client.nombre.trim().toLowerCase();
    setSavedClients(prev => {
      const existsIdx = prev.findIndex(c => c.nombre.trim().toLowerCase() === clientNameNorm);
      const newClientData = {
        id: existsIdx >= 0 ? prev[existsIdx].id : "cli-" + Date.now(),
        nombre: client.nombre.trim(),
        direccion: client.direccion.trim(),
        telefono: client.telefono.trim(),
        ubicacion: client.ubicacion.trim()
      };
      if (existsIdx >= 0) {
        const updated = [...prev];
        updated[existsIdx] = newClientData;
        return updated;
      } else {
        return [newClientData, ...prev];
      }
    });

    // El carrito se vacía para poder agregar otra venta
    setCart([]);
    // También se vacían los datos del cliente, preservando el número de WhatsApp de destino
    setClient({
      nombre: "",
      direccion: "",
      telefono: "",
      ubicacion: "",
      wholesaleWhatsapp: client.wholesaleWhatsapp
    });
    
    setTimeout(() => {
      setAddedAnimation(null);
    }, 2500);
  };

  // Copiar pedido actual al portapapeles (sin guardar ni vaciar el carrito)
  const handleCopyCart = () => {
    if (!client.nombre.trim() || !client.direccion.trim() || !client.telefono.trim()) {
      showAlert("Datos incompletos", "Por favor, completa todos los datos del cliente (Nombre, Dirección y Teléfono) antes de copiar.");
      return;
    }

    if (cart.length === 0) {
      showAlert("Carrito vacío", "El carrito está vacío. Agrega algunos artículos antes de copiar.");
      return;
    }

    const text = generateOrderText();
    navigator.clipboard.writeText(text).then(() => {
      setAddedAnimation({
        id: "copy-cart-" + Math.random(),
        text: "📋 ¡Mensaje del pedido copiado al portapapeles!"
      });
      setTimeout(() => {
        setAddedAnimation(null);
      }, 2000);
    }).catch(err => {
      console.error("No se pudo copiar el texto: ", err);
      showAlert("Error de copia", "No se pudo copiar el pedido automáticamente.");
    });
  };

  // Cargar pedido guardado en el carrito activo
  const loadOrderIntoCart = (order: SavedOrder) => {
    setCart(order.items);
    setClient({ ...order.client });
    setAddedAnimation({
      id: "load-" + Math.random(),
      text: `🔄 ¡Pedido de ${order.client.nombre} cargado en el carrito!`
    });
    setTimeout(() => {
      setAddedAnimation(null);
    }, 2500);
    // Cambiar a la pestaña de planilla
    setActiveTab("planilla");
  };

  // Eliminar un pedido individual del historial
  const deleteOrder = (orderId: string) => {
    showConfirm(
      "Eliminar venta",
      "¿Estás seguro de que deseas eliminar este pedido del historial?",
      () => {
        setSavedOrders(prev => prev.filter(o => o.id !== orderId));
      }
    );
  };

  // Limpiar todo el historial de pedidos
  const clearAllOrders = () => {
    showConfirm(
      "Borrar historial",
      "¿Estás seguro de que deseas eliminar TODOS los pedidos del historial?",
      () => {
        setSavedOrders([]);
      }
    );
  };

  // Google Sheets column mapping
  const sheetColumns = useMemo(() => {
    return [
      { letter: "A", name: "nombre", label: "Artículo / Descripción", type: "text" },
      { letter: "B", name: "unidad", label: "Unidad ($)", type: "button", presentation: "unidad" },
      { letter: "C", name: "mayor1", label: "Mayor 1 ($)", type: "text" },
      { letter: "D", name: "mayor2", label: "Mayor 2 ($)", type: "text" },
      { letter: "E", name: "bulto", label: "Bulto (u)", type: "text" },
      { letter: "F", name: "cajaMayor1", label: "Caja Mayor 1 ($)", type: "button", presentation: "caja_mayor1" },
      { letter: "G", name: "cajaMayor2", label: "Caja Mayor 2 ($)", type: "button", presentation: "caja_mayor2" }
    ];
  }, []);

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col font-sans text-[#3c4043] overflow-hidden border-4 border-white shadow-lg relative text-[11px]">
      
      {/* BENTO THEMED GOOGLE SHEETS HEADER BAR - REDUCED 80% */}
      <header className="flex-none bg-white border-b border-[#dadce0] flex flex-wrap items-center justify-between px-4 py-2 gap-2 shadow-sm z-20">
        <div className="flex items-center gap-3">
          <div className="bg-[#1d8045] p-2 rounded-none shadow-sm hover:scale-105 transition-transform shrink-0">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-2h2v2zm0-4H7v-2h2v2zm0-4H7V7h2v2zm4 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2zm4 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z"/>
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-[#202124] tracking-tight">GolosinasMayorista</h1>
            </div>
            <p className="text-[10px] text-gray-400 font-medium leading-none">Haga clic en Unidad o Caja para agregar al pedido</p>
          </div>
        </div>

        {/* TOP CONTROLS - PILL Design with Square/Sharp frames */}
        <div className="flex items-center flex-wrap gap-2">
          
          <div className="flex items-center bg-gray-100 p-0.5 rounded-none border border-[#dadce0]">
            <button 
              onClick={handleSync}
              disabled={loading}
              className="flex items-center gap-1 bg-transparent hover:bg-white text-[#3c4043] font-semibold text-[10px] py-1 px-2.5 rounded-none transition cursor-pointer disabled:opacity-50 border-r border-[#dadce0]"
              title="Sincronizar con Google Sheets"
            >
              <RefreshCw className={`w-3 h-3 text-[#1d8045] ${loading ? "animate-spin" : ""}`} />
              <span>Sincronizar</span>
            </button>
            <button 
              onClick={() => setIsClientsModalOpen(true)}
              className="flex items-center gap-1.5 bg-transparent hover:bg-white text-[#3c4043] font-semibold text-[10px] py-1 px-2.5 rounded-none transition cursor-pointer"
              title="Ver base de datos de clientes guardados"
            >
              <Users className="w-3 h-3 text-[#1d8045]" />
              <span>Clientes ({savedClients.length})</span>
            </button>
          </div>

          {/* TOTAL ESTIMADO PILL (Sharp Frame) */}
          <div className="bg-[#e6f4ea] border border-[#1d8045] px-3 py-1 rounded-none flex flex-col items-end shadow-sm select-none leading-none shrink-0">
            <span className="text-[8px] uppercase font-bold text-[#1d8045] tracking-widest leading-none">Total</span>
            <span className="text-sm font-mono font-black text-[#1d8045]">${cartTotal.toLocaleString('es-AR')}</span>
          </div>
        </div>
      </header>

      {/* GOOGLE SHEETS STYLE TABS BAR (Superior) */}
      <div className="flex-none bg-[#f1f3f4] border-b border-[#dadce0] px-4 flex items-end pt-1 gap-1 z-10 select-none">
        <button
          onClick={() => setActiveTab("planilla")}
          className={`px-4 py-1 font-bold text-[10px] tracking-tight transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === "planilla"
              ? "bg-white text-[#1d8045] border-t-2 border-t-[#1d8045] border-x border-x-[#dadce0] -mb-[1px] relative z-10 py-1.5"
              : "text-slate-600 hover:bg-[#e8eaed] hover:text-slate-800 border-t-2 border-t-transparent"
          }`}
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          <span>NUEVA VENTA</span>
        </button>
 
        <button
          onClick={() => setActiveTab("pedidos")}
          className={`px-4 py-1 font-bold text-[10px] tracking-tight transition-all flex items-center gap-1.5 cursor-pointer relative ${
            activeTab === "pedidos"
              ? "bg-white text-[#1d8045] border-t-2 border-t-[#1d8045] border-x border-x-[#dadce0] -mb-[1px] relative z-10 py-1.5"
              : "text-slate-600 hover:bg-[#e8eaed] hover:text-slate-800 border-t-2 border-t-transparent"
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>VENTAS GUARDADAS</span>
          {savedOrders.length > 0 && (
            <span className="bg-[#1d8045] text-white text-[8px] font-black px-1.5 py-0.2 rounded-full leading-none ml-1">
              {savedOrders.length}
            </span>
          )}
        </button>
      </div>

      {/* FLOATING PRODUCT ADDED ALERT ANIMATION (Compact) */}
      <AnimatePresence>
        {addedAnimation && (
          <motion.div 
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-[#202124] text-white text-[10px] font-semibold py-1.5 px-3 rounded-none shadow-md flex items-center gap-2 z-50 border border-gray-700"
          >
            <Sparkles className="w-3 h-3 text-yellow-400 shrink-0" />
            <span>{addedAnimation.text}</span>
          </motion.div>
        )}
      </AnimatePresence>



      {editingOrderId && (
        <div className="bg-[#fdf2e2] border-b border-[#f5c2c7] text-[#b06000] px-4 py-2 text-[10px] font-bold flex items-center justify-between gap-2 select-none shrink-0 z-10">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[#d97706] rounded-full animate-pulse"></span>
            <span>✏️ Estás editando una venta guardada de: <strong className="text-[#92400e]">{client.nombre || "Cliente"}</strong></span>
          </div>
          <button
            onClick={() => {
              setEditingOrderId(null);
              setCart([]);
              setClient({
                nombre: "",
                direccion: "",
                telefono: "",
                ubicacion: "",
                wholesaleWhatsapp: "5491123456789"
              });
              setAddedAnimation({
                id: "cancel-edit-" + Math.random(),
                text: "✏️ Edición cancelada y carrito vaciado"
              });
              setTimeout(() => setAddedAnimation(null), 2000);
            }}
            className="bg-white hover:bg-slate-100 text-[#d97706] border border-[#f5c2c7] px-2.5 py-1 rounded-none font-extrabold text-[9px] uppercase tracking-wider cursor-pointer"
          >
            Cancelar Edición
          </button>
        </div>
      )}

      {/* MAIN BODY: NO ROUNDED CORNERS, REDUCED SCALE */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden p-3 gap-3">
        
        {activeTab === "planilla" ? (
          /* LEFT COMPONENT: GOOGLE SPREADSHEET */
          <section className="flex-1 bg-white rounded-none border border-[#dadce0] shadow-sm flex flex-col overflow-hidden">
          


          {/* ERROR VIEW */}
          {error && (
            <div className="p-4 flex-1 flex flex-col items-center justify-center text-center bg-gray-50">
              <div className="bg-red-50 border border-red-200 rounded-none p-4 inline-block max-w-sm mx-auto text-left shadow-sm">
                <h3 className="font-bold text-red-800 mb-1 flex items-center gap-1.5">
                  <span>⚠️</span> Error al cargar
                </h3>
                <p className="text-red-700 text-[10px] mb-3 leading-relaxed">{error}</p>
                <button 
                  onClick={fetchProducts}
                  className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold py-1 px-3 rounded-none transition-all cursor-pointer"
                >
                  Intentar reconectar
                </button>
              </div>
            </div>
          )}

          {/* LOADING VIEW */}
          {loading && (
            <div className="p-8 flex-1 flex flex-col items-center justify-center gap-2 bg-[#fdfdfd]">
              <RefreshCw className="w-8 h-8 text-[#1d8045] animate-spin" />
              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest animate-pulse">Consultando Planilla...</p>
            </div>
          )}

          {/* INTERACTIVE TABLE GRID - STRICTLY SQUARE AND COMPACT */}
          {!loading && !error && (
            <div className="flex-1 overflow-auto max-w-full relative">
              <table className="w-full border-collapse text-left border-spacing-0">
                
                {/* ALPHABETICAL COLUMN LETTERS ROW REMOVED */}
                <thead>
                  {/* REAL DATA HEADERS */}
                  <tr className="bg-[#f8f9fa] select-none text-[10px]">
                    <th className="bg-[#f1f3f4] border-r border-b border-[#dadce0] w-10 text-center text-[9px] text-slate-400 font-bold py-2">
                      ID
                    </th>
                    {sheetColumns.map((col, index) => {
                      const isShoppingCol = col.type === 'button';
                      return (
                        <th 
                          key={index} 
                          className={`text-slate-700 font-bold border-r border-b border-[#dadce0] px-2 py-2 bg-[#f8f9fa] shadow-sm select-none ${isShoppingCol ? 'bg-[#e8f0fe] text-[#1967d2]' : ''}`}
                        >
                          <div className="flex items-center gap-1">
                            {col.name === 'costo' && <Package className="w-3 h-3 text-slate-400" />}
                            {isShoppingCol && <ShoppingCart className="w-3 h-3 text-[#1967d2]" />}
                            <span>{col.label}</span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                {/* SPREADSHEET ROWS */}
                <tbody className="divide-y divide-[#dadce0] text-[10px]">
                  {products.map((product, rowIndex) => {
                    const excelRowNumber = rowIndex + 3;

                    // If Category Header row
                    if (product.isCategoryHeader) {
                      return (
                        <tr key={product.id} className="bg-[#e2f0d9] font-bold text-emerald-900 border-b border-[#dadce0] select-none">
                          <td className="bg-slate-200/60 text-slate-500 font-mono text-[8px] text-center border-r border-b border-[#dadce0] font-bold select-none py-1">
                            {excelRowNumber}
                          </td>
                          <td 
                            colSpan={sheetColumns.length} 
                            className="px-3 py-1 text-[10px] font-extrabold tracking-wider uppercase bg-[#e2f0d9] text-[#2d6a4f] border-b border-[#dadce0] select-none"
                          >
                            📁 SECCIÓN: {product.nombre}
                          </td>
                        </tr>
                      );
                    }

                    const isEven = rowIndex % 2 === 0;

                    return (
                      <tr 
                        key={product.id} 
                        className={`hover:bg-[#e8f0fe]/50 transition-colors border-b border-[#dadce0] ${isEven ? 'bg-white' : 'bg-[#f4f5f7]/50'}`}
                      >
                        {/* Row Index Column */}
                        <td className="bg-[#f1f3f4]/70 text-slate-400 font-mono text-[8px] text-center border-r border-b border-[#dadce0] font-semibold select-none py-4">
                          {excelRowNumber}
                        </td>

                        {/* Data Columns */}
                        {sheetColumns.map((col) => {
                          const isClickable = col.type === "button";
                          const cellValue = product[col.name as keyof Product] as string;
                          const isZero = !cellValue || cellValue === "0" || cellValue.trim() === "";

                          // Active highlights
                          const isCellHovered = hoveredCell?.row === rowIndex && hoveredCell?.colLetter === col.letter;
                          const isCellSelected = activeCell?.row === rowIndex && activeCell?.colLetter === col.letter;

                          let cellStyle = "border-r border-b border-[#dadce0] px-2 py-4 font-medium relative transition-all ";
                          const isProductInCart = col.name === 'nombre' && cart.some(item => item.product.id === product.id);
                          const isPresentationInCart = isClickable && cart.some(item => item.product.id === product.id && item.presentation === col.presentation);
                          
                          if (isPresentationInCart) {
                            cellStyle += "bg-[#1d8045] text-white hover:bg-[#1a723e] cursor-pointer select-none font-bold text-center ";
                          } else if (isClickable) {
                            if (isZero) {
                              cellStyle += "text-gray-300 bg-gray-50/50 cursor-not-allowed";
                            } else {
                              cellStyle += "text-[#1967d2] hover:bg-[#d2e3fc] bg-[#e8f0fe]/60 cursor-pointer select-none font-bold text-center ";
                            }
                          } else {
                            if (!isProductInCart) {
                              cellStyle += "text-slate-600 ";
                            }
                          }

                          if (col.name === 'nombre') {
                            if (isProductInCart) {
                              cellStyle += "bg-[#1d8045] text-white font-bold text-left min-w-[180px] cursor-zoom-in";
                            } else {
                              cellStyle += "font-semibold text-slate-800 text-left min-w-[180px] cursor-zoom-in";
                            }
                          } else if (col.name === 'bulto') {
                            cellStyle += "text-center font-mono font-medium text-slate-400 w-12";
                          } else {
                            if (isClickable) {
                              cellStyle += "font-sans min-w-[75px]";
                            } else {
                              cellStyle += "text-right font-mono min-w-[75px]";
                            }
                          }

                          if (isCellSelected) {
                            cellStyle += " outline-2 outline-[#1d8045] z-10" + (isPresentationInCart ? "" : " bg-[#e6f4ea]");
                          } else if (isCellHovered && !isZero) {
                            cellStyle += " outline-1 outline-[#1967d2]" + (isPresentationInCart ? " bg-[#1a723e]/90" : " bg-[#d2e3fc]/80");
                          }

                          return (
                            <td
                              key={col.letter}
                              className={cellStyle}
                              onMouseEnter={() => !isZero && setHoveredCell({
                                row: rowIndex,
                                colLetter: col.letter,
                                colName: col.label,
                                value: cellValue
                              })}
                              onMouseLeave={() => setHoveredCell(null)}
                              onClick={() => {
                                  setActiveCell({ row: rowIndex, colLetter: col.letter });
                                  if (isClickable && !isZero) {
                                    addToCart(product, col.presentation as 'unidad' | 'caja_mayor1' | 'caja_mayor2');
                                  }
                              }}
                              onDoubleClick={() => {
                                if (col.name === 'nombre') {
                                  setSelectedProductForModal(product);
                                  setSelectedProductRowIndex(excelRowNumber);
                                }
                              }}
                              title={col.name === 'nombre' ? "Doble clic para ver foto y precios" : undefined}
                            >
                              {col.name === 'nombre' ? (
                                <span>{cellValue}</span>
                              ) : isClickable && !isZero ? (
                                <motion.div 
                                  className="font-sans text-center w-full h-full flex items-center justify-center select-none"
                                  whileTap={{ scale: 0.85, y: 1 }}
                                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                                >
                                  <span>${formatPrice(cellValue)}</span>
                                </motion.div>
                              ) : isZero ? (
                                <span className="text-gray-300">-</span>
                              ) : (
                                <span>{col.name !== 'bulto' ? `$${formatPrice(cellValue)}` : cellValue}</span>
                              )}

                              {isCellSelected && (
                                <span className="absolute bottom-[-3px] right-[-3px] w-[6px] h-[6px] bg-[#1d8045] border border-white z-20"></span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        ) : (
          /* LEFT COMPONENT: HISTORIAL DE PEDIDOS */
          <section className="flex-1 bg-white rounded-none border border-[#dadce0] shadow-sm flex flex-col overflow-hidden">
            <div className="bg-[#f1f3f4] border-b border-[#dadce0] px-3 py-1.5 flex items-center justify-between text-[10px] font-semibold text-slate-600">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="w-2 h-2 bg-[#1d8045] rounded-none"></span>
                <span className="text-slate-800 font-bold font-mono">Historial de Ventas</span>
                {savedOrders.length > 0 && (
                  <span className="text-[10px] text-slate-500 font-mono font-medium flex items-center gap-1">
                    <span>•</span>
                    <span>Monto Total:</span>
                    <span className="text-[#1d8045] font-black">${savedOrdersTotal.toLocaleString('es-AR')}</span>
                    <span className="text-slate-400">({savedOrders.length} {savedOrders.length === 1 ? 'venta' : 'ventas'})</span>
                  </span>
                )}
              </div>
              {savedOrders.length > 0 && (
                <button
                  onClick={clearAllOrders}
                  className="text-[9px] text-red-600 hover:text-red-800 font-extrabold uppercase tracking-wider cursor-pointer flex items-center gap-1 bg-transparent border-0"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Borrar Todo</span>
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {savedOrders.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-400">
                  <div className="bg-[#e6f4ea] p-4 rounded-full mb-3 text-[#1d8045] flex items-center justify-center w-12 h-12 mx-auto">
                    <FileText className="w-6 h-6" />
                  </div>
                  <p className="text-[11px] font-bold text-slate-700">Historial de Ventas Vacío</p>
                  <p className="text-[10px] text-gray-500 mt-1 max-w-[280px] leading-relaxed">
                    Las ventas se guardarán aquí automáticamente al presionar "Guardar venta" desde el carrito activo.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {savedOrders.map((order) => {
                    const isExpanded = !!expandedOrders[order.id];
                    return (
                      <div 
                        key={order.id} 
                        className="border border-[#dadce0] bg-[#f8f9fa] hover:border-slate-300 transition-colors flex flex-col rounded-none shadow-sm overflow-hidden"
                      >
                        {/* Header clickable bar - Synthesized Info */}
                        <div 
                          onClick={() => setExpandedOrders(prev => ({ ...prev, [order.id]: !isExpanded }))}
                          className="bg-white p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none border-b border-[#dadce0]/60 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const query = order.client.ubicacion?.trim() || order.client.direccion?.trim();
                                if (query) {
                                  if (query.startsWith("http://") || query.startsWith("https://")) {
                                    window.open(query, "_blank");
                                  } else {
                                    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
                                    window.open(mapsUrl, "_blank");
                                  }
                                } else {
                                  alert("No se especificó dirección ni ubicación para este cliente.");
                                }
                              }}
                              className="bg-[#e8f0fe] hover:bg-[#d2e3fc] text-[#1967d2] border border-[#1967d2]/25 p-1.5 rounded-none transition flex items-center justify-center cursor-pointer shrink-0"
                              title="Ver dirección en Google Maps"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                            </button>
                            <div>
                              <div className="font-bold text-[11px] text-slate-800 flex items-center gap-1.5">
                                <span>👤 {order.client.nombre || "Cliente sin nombre"}</span>
                              </div>
                              <p className="text-[9px] text-slate-500 font-semibold mt-0.5">
                                📅 {order.date}
                              </p>
                              {order.client.direccion && (
                                <p className="text-[9px] text-slate-500 font-semibold mt-0.5">
                                  📍 {order.client.direccion}
                                </p>
                              )}
                            </div>
                            <div className="sm:border-l sm:border-[#dadce0] sm:pl-4">
                              <span className="block text-[8px] uppercase tracking-wider text-gray-400 font-bold leading-none">Total</span>
                              <span className="font-mono font-black text-[11px] text-[#1d8045] inline-block mt-0.5">
                                ${order.total.toLocaleString('es-AR')}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto" onClick={e => e.stopPropagation()}>
                            {/* Accordion toggle indicator */}
                            <div 
                              className="text-slate-400 p-1 hover:text-slate-600 transition"
                              onClick={() => setExpandedOrders(prev => ({ ...prev, [order.id]: !isExpanded }))}
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4 cursor-pointer" /> : <ChevronDown className="w-4 h-4 cursor-pointer" />}
                            </div>
                          </div>
                        </div>

                        {/* Collapsed content with transition */}
                        {isExpanded && (
                          <div className="p-3 bg-white border-t border-[#dadce0]/60 space-y-3 text-[10px]">
                            {/* Item breakdown */}
                            <div>
                              <span className="block text-[8px] uppercase tracking-wider text-gray-400 font-bold mb-1">Detalle de Artículos</span>
                              <div className="border border-[#dadce0] overflow-x-auto">
                                <table className="w-full text-left border-collapse text-[9px]">
                                  <thead>
                                    <tr className="bg-slate-50 border-b border-[#dadce0] font-bold text-slate-500">
                                      <th className="p-1 px-2">Artículo</th>
                                      <th className="p-1 text-center w-24">Presentación</th>
                                      <th className="p-1 text-right w-16">Precio Unit.</th>
                                      <th className="p-1 text-center w-12">Cant.</th>
                                      <th className="p-1 text-right w-20">Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {order.items.map((item, idx) => {
                                      const sub = item.price * item.quantity;
                                      return (
                                        <tr key={idx} className="border-b border-[#dadce0]/40 hover:bg-slate-50/50">
                                          <td className="p-1 px-2 font-medium text-slate-800">{item.product.nombre}</td>
                                          <td className="p-1 text-center">
                                            <span className="bg-slate-100 text-slate-600 px-1 py-0.2 border border-slate-200">
                                              {item.presentationLabel}
                                            </span>
                                          </td>
                                          <td className="p-1 text-right font-mono">${item.price.toLocaleString('es-AR')}</td>
                                          <td className="p-1 text-center font-bold font-mono">{item.quantity}</td>
                                          <td className="p-1 text-right font-mono font-bold text-[#1d8045]">${sub.toLocaleString('es-AR')}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* Actions bar at the bottom of the expanded card */}
                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#dadce0]/60">
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(order.text);
                                  setAddedAnimation({
                                    id: "histcopy-" + Math.random(),
                                    text: `📋 Pedido de ${order.client.nombre} copiado!`
                                  });
                                  setTimeout(() => setAddedAnimation(null), 2000);
                                }}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[10px] py-1.5 px-3 rounded-none transition border border-slate-300 cursor-pointer flex items-center gap-1.5"
                                title="Copiar texto del pedido"
                              >
                                <Copy className="w-3.5 h-3.5 text-slate-500" />
                                <span>Copiar</span>
                              </button>

                              <button
                                onClick={() => {
                                  setCart(order.items);
                                  setClient({ ...order.client });
                                  setEditingOrderId(order.id);
                                  setAddedAnimation({
                                    id: "editload-" + Math.random(),
                                    text: `✏️ Editando venta de ${order.client.nombre}`
                                  });
                                  setTimeout(() => setAddedAnimation(null), 2500);
                                  setActiveTab("planilla");
                                }}
                                className="bg-[#e8f0fe] hover:bg-[#d2e3fc] text-[#1967d2] font-extrabold text-[10px] py-1.5 px-3 rounded-none transition border border-[#1967d2]/25 cursor-pointer flex items-center gap-1.5"
                                title="Editar esta venta"
                              >
                                <FileText className="w-3.5 h-3.5 text-[#1967d2]" />
                                <span>Editar</span>
                              </button>

                              <button
                                onClick={() => deleteOrder(order.id)}
                                className="bg-red-50 hover:bg-red-100 text-red-600 font-extrabold text-[10px] py-1.5 px-3 rounded-none transition border border-red-200 cursor-pointer flex items-center gap-1.5"
                                title="Eliminar venta del historial"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                <span>Borrar</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* RIGHT COMPONENT: BENTO CART BOX (strictly square-cornered, scaled-down) */}
        {activeTab === "planilla" && (
          <section className="w-full md:w-80 flex flex-col gap-3">
          
          <div className="bg-white rounded-none border border-[#dadce0] p-4 shadow-sm flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-[#dadce0] mb-2">
              <div className="flex items-center gap-1.5 text-[#202124]">
                <ShoppingCart className="w-4 h-4 text-[#1d8045]" />
                <h2 className="font-bold text-[11px] uppercase tracking-wide">Carrito</h2>
              </div>
              {cart.length > 0 && (
                <button 
                  onClick={clearCart}
                  className="text-gray-400 hover:text-red-500 text-[10px] font-semibold flex items-center gap-0.5 transition cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  Vaciar
                </button>
              )}
            </div>

            {/* CART ITEMS CONTAINER (tighter items, height grows with content) */}
            <div className="pr-1 space-y-1.5 text-[10px]">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 text-gray-400">
                  <ShoppingCart className="w-8 h-8 text-gray-200 mb-1 animate-bounce" />
                  <p className="text-[10px] font-bold text-gray-500">Carrito Vacío</p>
                  <p className="text-[9px] text-gray-400 mt-0.5 max-w-[160px] leading-tight">
                    Presione importes en la planilla para cargar pedidos.
                  </p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {cart.map((item) => {
                    const subtotal = item.price * item.quantity;
                    return (
                      <motion.div 
                        key={item.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-[#f8f9fa] border border-[#dadce0] rounded-none p-2 flex flex-col gap-1.5 hover:border-[#1d8045]/40 transition-colors"
                      >
                        <div className="flex justify-between items-start gap-1">
                          <div>
                            <p className="font-bold text-[10px] text-[#202124] leading-tight">{item.product.nombre}</p>
                            <span className="inline-block bg-[#e8f0fe] text-[#1967d2] font-extrabold text-[8px] px-1.5 py-0.5 rounded-none mt-1 border border-[#1967d2]/10">
                              {item.presentationLabel}
                            </span>
                          </div>
                          <button 
                            onClick={() => removeFromCart(item.id)}
                            className="text-gray-300 hover:text-red-500 transition p-0.5 cursor-pointer"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="flex justify-between items-center pt-1 border-t border-gray-200">
                          {/* Quantity selector (Tightened) */}
                          <div className="flex items-center border border-[#dadce0] rounded-none bg-white overflow-hidden shadow-sm">
                            <button 
                              onClick={() => updateQuantity(item.id, -1)}
                              className="px-1.5 py-0.5 text-gray-500 hover:bg-gray-100 transition active:scale-90"
                            >
                              <Minus className="w-2.5 h-2.5" />
                            </button>
                            <span className="px-1.5 font-mono text-[10px] font-bold text-slate-800 min-w-[15px] text-center">
                              {item.quantity}
                            </span>
                            <button 
                              onClick={() => updateQuantity(item.id, 1)}
                              className="px-1.5 py-0.5 text-gray-500 hover:bg-gray-100 transition active:scale-90"
                            >
                              <Plus className="w-2.5 h-2.5" />
                            </button>
                          </div>

                          <div className="text-right leading-none">
                            <p className="text-[8px] text-gray-400 font-mono">Unit: ${item.price.toLocaleString('es-AR')}</p>
                            <p className="font-mono text-[10px] font-extrabold text-[#1d8045]">${subtotal.toLocaleString('es-AR')}</p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>

            {/* MINI ESTIMATION BOX (Tightened) */}
            <div className="pt-2 border-t border-[#dadce0] mt-2 space-y-1.5">
              <div className="flex justify-between items-end font-mono text-[9px]">
                <span className="text-gray-400 font-bold uppercase tracking-wider">Subtotal:</span>
                <span className="text-[#202124] font-bold">${cartTotal.toLocaleString('es-AR')}</span>
              </div>
              <div className="bg-[#e6f4ea] rounded-none p-2 border border-[#1d8045]/30 flex justify-between items-center font-mono shadow-sm">
                <span className="text-[#1d8045] text-[10px] font-extrabold uppercase">Total Estimado</span>
                <span className="text-[#1d8045] text-sm font-black">${cartTotal.toLocaleString('es-AR')}</span>
              </div>
            </div>

          </div>

        </section>
        )}

      </main>

      {/* CLIENT INFO FOOTER: BENTO FORM STYLE (Strictly square and 80% compact) */}
      {activeTab === "planilla" && (
        <footer className="flex-none bg-white border-t border-[#dadce0] p-4 grid grid-cols-1 lg:grid-cols-4 gap-4 z-10 text-[10px]">
        
        {/* Customer Bento Card (strictly square edges, 4 columns) */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-4 bg-[#f8f9fa] p-3 rounded-none border border-[#dadce0] shadow-inner">
          
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-extrabold text-gray-500 uppercase tracking-widest flex items-center gap-1">
              <User className="w-3 h-3 text-[#1d8045]" />
              Nombre del Cliente *
            </label>
            <div className="relative">
              <input 
                type="text" 
                value={client.nombre}
                onChange={e => setClient({ ...client, nombre: e.target.value })}
                placeholder="Ej. Juan Pérez" 
                className="w-full px-2.5 py-1.5 pl-8 bg-white border border-[#dadce0] rounded-none text-[10px] focus:outline-none focus:ring-1 focus:ring-[#1d8045] transition-all font-medium text-[#202124]"
              />
              <User className="w-3 h-3 text-gray-400 absolute left-2.5 top-2" />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-extrabold text-gray-500 uppercase tracking-widest flex items-center gap-1">
              <MapPin className="w-3 h-3 text-[#1d8045]" />
              Dirección de Entrega *
            </label>
            <div className="relative">
              <input 
                type="text" 
                value={client.direccion}
                onChange={e => setClient({ ...client, direccion: e.target.value })}
                placeholder="Calle, Número, Localidad" 
                className="w-full px-2.5 py-1.5 pl-8 bg-white border border-[#dadce0] rounded-none text-[10px] focus:outline-none focus:ring-1 focus:ring-[#1d8045] transition-all font-medium text-[#202124]"
              />
              <MapPin className="w-3 h-3 text-gray-400 absolute left-2.5 top-2" />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-extrabold text-gray-500 uppercase tracking-widest flex items-center gap-1">
              <Phone className="w-3 h-3 text-[#1d8045]" />
              Teléfono de Contacto *
            </label>
            <div className="relative">
              <input 
                type="tel" 
                value={client.telefono}
                onChange={e => setClient({ ...client, telefono: e.target.value })}
                placeholder="Ej. +54 9 11 1234 5678" 
                className="w-full px-2.5 py-1.5 pl-8 bg-white border border-[#dadce0] rounded-none text-[10px] focus:outline-none focus:ring-1 focus:ring-[#1d8045] transition-all font-medium text-[#202124]"
              />
              <Phone className="w-3 h-3 text-gray-400 absolute left-2.5 top-2" />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-extrabold text-gray-500 uppercase tracking-widest flex items-center gap-1">
              <Navigation className="w-3 h-3 text-[#1d8045]" />
              Ubicación (Enlace/GPS)
            </label>
            <div className="relative">
              <input 
                type="text" 
                value={client.ubicacion}
                onChange={e => setClient({ ...client, ubicacion: e.target.value })}
                placeholder="Google Maps, GPS o Info Extra" 
                className="w-full px-2.5 py-1.5 pl-8 pr-14 bg-white border border-[#dadce0] rounded-none text-[10px] focus:outline-none focus:ring-1 focus:ring-[#1d8045] transition-all font-medium text-[#202124]"
              />
              <Navigation className="w-3 h-3 text-gray-400 absolute left-2.5 top-2" />
              <button
                type="button"
                onClick={handleGetLocation}
                disabled={isLocating}
                className="absolute right-1 top-1 bottom-1 px-2 bg-[#1d8045] hover:bg-[#1a723e] text-white font-bold text-[8px] uppercase tracking-wider flex items-center gap-1 rounded-none transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                title="Obtener ubicación GPS actual"
                id="gps-location-btn"
              >
                {isLocating ? (
                  <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                ) : (
                  <Navigation className="w-2.5 h-2.5" />
                )}
                <span>GPS</span>
              </button>
            </div>
          </div>

        </div>

        {/* Status indicator Bento Card (strictly square edges) */}
        <div className="bg-[#1d8045] rounded-none flex md:flex-row lg:flex-col items-center justify-between text-white p-3 shadow-md relative overflow-hidden group gap-2">
          <div className="absolute top-[-20px] right-[-20px] w-16 h-16 bg-white/5 rounded-none group-hover:scale-125 transition-transform"></div>
          <div>
            <div className="text-[9px] uppercase font-black tracking-widest opacity-80 leading-none">Estado</div>
            <div className="text-xl font-black font-mono mt-1">
              {cartItemsCount} <span className="text-[10px] font-medium opacity-90 tracking-wide">u.</span>
            </div>
          </div>

          <div className="flex gap-1.5 shrink-0 z-10">
            <button 
              onClick={handleCopyCart}
              disabled={cart.length === 0}
              className="bg-white/10 hover:bg-white hover:text-slate-800 text-white border border-white/20 font-bold text-[10px] py-1 px-2.5 rounded-none transition-all cursor-pointer flex items-center gap-1 active:scale-95 disabled:opacity-40"
              title="Copiar texto del pedido sin guardar"
            >
              <Copy className="w-3 h-3" />
              <span>Copiar</span>
            </button>

            <button 
              onClick={handleSaveSale}
              disabled={cart.length === 0}
              className="bg-white/20 hover:bg-white hover:text-[#1d8045] text-white border border-white/30 font-bold text-[10px] py-1 px-2.5 rounded-none transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-40"
              title={editingOrderId ? "Actualizar venta" : "Guardar venta en el historial"}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{editingOrderId ? "Actualizar" : "Guardar Venta"}</span>
            </button>
          </div>
        </div>

      </footer>
      )}

      {/* FOOTER BAR METRICS (Strictly square edges) */}
      <div className="bg-[#f1f3f4] border-t border-[#dadce0] text-[9px] text-slate-500 py-1 px-4 flex justify-between items-center select-none font-mono">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 font-bold text-slate-600">
            <span className="w-1.5 h-1.5 bg-[#1d8045] rounded-none animate-pulse"></span>
            Conectado
          </span>
          <span className="hidden sm:inline text-slate-300">|</span>
          <span className="hidden sm:inline">Pedido en Celdas: Unidad (C), Caja M1 (G), Caja M2 (H)</span>
        </div>
        <div className="hidden sm:block">
          <span>Golosinas Bento Sheets © 2026</span>
        </div>
      </div>

      {/* CUSTOM DIALOG MODAL */}
      <AnimatePresence>
        {customDialog && customDialog.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (customDialog.type === "alert") {
                  setCustomDialog(null);
                }
              }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            />
            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              className="relative w-full max-w-sm bg-white border border-[#dadce0] rounded-none shadow-xl overflow-hidden flex flex-col z-10"
            >
              {/* Header */}
              <div className="bg-[#f8f9fa] border-b border-[#dadce0] px-4 py-3 flex items-center justify-between">
                <span className="font-mono font-black text-[10px] text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-[#1d8045] rounded-none"></span>
                  {customDialog.title}
                </span>
                <button
                  onClick={() => setCustomDialog(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-xs"
                >
                  ✕
                </button>
              </div>
              
              {/* Message Body */}
              <div className="p-4 text-[11px] text-slate-600 leading-relaxed font-sans">
                {customDialog.message}
              </div>

              {/* Action Buttons */}
              <div className="bg-[#f8f9fa] border-t border-[#dadce0] px-4 py-3 flex justify-end gap-2">
                {customDialog.type === "confirm" ? (
                  <>
                    <button
                      onClick={() => setCustomDialog(null)}
                      className="bg-white hover:bg-slate-100 text-slate-600 border border-[#dadce0] px-3.5 py-1.5 rounded-none font-extrabold text-[10px] uppercase tracking-wider cursor-pointer transition active:scale-95"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => {
                        if (customDialog.onConfirm) {
                          customDialog.onConfirm();
                        }
                        setCustomDialog(null);
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white border border-transparent px-3.5 py-1.5 rounded-none font-black text-[10px] uppercase tracking-wider cursor-pointer transition active:scale-95 shadow-xs"
                    >
                      Confirmar
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setCustomDialog(null)}
                    className="bg-[#1d8045] hover:bg-[#186b3a] text-white border border-transparent px-4 py-1.5 rounded-none font-black text-[10px] uppercase tracking-wider cursor-pointer transition active:scale-95 shadow-xs"
                  >
                    Entendido
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CLIENTS MODAL */}
      <AnimatePresence>
        {isClientsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop with dark background and blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsClientsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            />
            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              className="relative w-full max-w-md bg-white border border-[#dadce0] rounded-none shadow-xl overflow-hidden flex flex-col z-10"
            >
              {/* Header */}
              <div className="bg-[#f8f9fa] border-b border-[#dadce0] px-4 py-3 flex items-center justify-between">
                <span className="font-mono font-black text-[10px] text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-[#1d8045] rounded-none"></span>
                  Clientes Guardados ({savedClients.length})
                </span>
                <button
                  onClick={() => setIsClientsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-xs"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="max-h-[300px] overflow-y-auto p-4 flex flex-col gap-3">
                {savedClients.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-[10px] font-medium font-mono leading-relaxed">
                    Ningún cliente guardado todavía.<br />Los clientes se guardan al registrar ventas.
                  </div>
                ) : (
                  savedClients.map((c) => (
                    <div 
                      key={c.id} 
                      className="border border-[#dadce0] p-3 hover:border-slate-400 transition bg-slate-50 flex flex-col gap-2"
                    >
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 text-[11px]">{c.nombre}</span>
                        <div className="flex flex-col gap-0.5 mt-1 text-slate-500 font-medium text-[10px]">
                          <div>
                            <span className="text-slate-400 font-bold">Dirección:</span> {c.direccion}
                          </div>
                          <div>
                            <span className="text-slate-400 font-bold">Teléfono:</span> {c.telefono}
                          </div>
                          {c.ubicacion && (
                            <div>
                              <span className="text-slate-400 font-bold">Ubicación:</span> {c.ubicacion}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Client actions */}
                      <div className="flex justify-end gap-1.5 pt-1.5 border-t border-slate-200">
                        <button
                          onClick={() => {
                            showConfirm(
                              "Eliminar cliente",
                              `¿Estás seguro de que deseas eliminar a ${c.nombre} de la lista de clientes guardados?`,
                              () => {
                                setSavedClients(prev => prev.filter(item => item.id !== c.id));
                              }
                            );
                          }}
                          className="bg-white hover:bg-red-50 text-red-600 border border-[#dadce0] px-2 py-1 rounded-none font-bold text-[9px] uppercase tracking-wider cursor-pointer transition active:scale-95"
                        >
                          Eliminar
                        </button>
                        <button
                          onClick={() => {
                            setClient(prev => ({
                              ...prev,
                              nombre: c.nombre,
                              direccion: c.direccion,
                              telefono: c.telefono,
                              ubicacion: c.ubicacion
                            }));
                            setActiveTab("planilla"); // Nueva Venta
                            setIsClientsModalOpen(false);
                            setAddedAnimation({
                              id: "autocomplete-" + Math.random(),
                              text: `👥 ¡Datos de ${c.nombre} cargados!`
                            });
                            setTimeout(() => {
                              setAddedAnimation(null);
                            }, 2000);
                          }}
                          className="bg-[#1d8045] hover:bg-[#186b3a] text-white border border-transparent px-3 py-1 rounded-none font-black text-[9px] uppercase tracking-wider cursor-pointer transition active:scale-95"
                        >
                          Vender
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="bg-[#f8f9fa] border-t border-[#dadce0] px-4 py-2.5 flex justify-end">
                <button
                  onClick={() => setIsClientsModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-[#dadce0] px-3.5 py-1.5 rounded-none font-black text-[10px] uppercase tracking-wider cursor-pointer transition"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PRODUCT PREVIEW MODAL */}
      <AnimatePresence>
        {selectedProductForModal && selectedProductRowIndex !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop with dark background and blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProductForModal(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              className="relative w-full max-w-lg bg-white border border-[#dadce0] rounded-none shadow-xl overflow-hidden flex flex-col z-10 font-sans"
            >
              {/* Header */}
              <div className="bg-[#f8f9fa] border-b border-[#dadce0] px-4 py-3 flex items-center justify-between shrink-0">
                <span className="font-mono font-black text-[10px] text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-[#1d8045] rounded-none"></span>
                  Fila {selectedProductRowIndex} • Vista Detallada
                </span>
                <button
                  onClick={() => setSelectedProductForModal(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="overflow-y-auto max-h-[80vh] p-4 flex flex-col gap-4">
                
                {/* Title */}
                <div>
                  <h2 className="text-xs font-black text-slate-800 uppercase tracking-tight leading-snug">
                    {selectedProductForModal.nombre}
                  </h2>
                </div>

                {/* Main section: image + simple specs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Left Column: Image wrapper */}
                  <div className="relative aspect-square w-full bg-slate-50 border border-[#dadce0] flex flex-col items-center justify-center overflow-hidden">
                    {selectedProductRowIndex && driveImagesMapping[String(selectedProductRowIndex)] ? (
                      <img 
                        src={`https://lh3.googleusercontent.com/d/${driveImagesMapping[String(selectedProductRowIndex)]}`} 
                        alt={selectedProductForModal.nombre}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center text-center p-4">
                        <div className="p-3 bg-emerald-50 text-[#1d8045] border border-emerald-100 mb-2">
                          <FileText className="w-5 h-5" />
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Sin foto cargada</span>
                        <span className="text-[8px] text-slate-400 font-medium leading-relaxed mt-1 max-w-[160px]">
                          Para ver fotos, puedes vincular tu carpeta de Google Drive debajo.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Prices Bento list */}
                  <div className="flex flex-col gap-2">
                    <span className="text-[8px] uppercase font-black text-slate-400 tracking-wider">Esquema de Precios</span>
                    
                    {/* Price grid box */}
                    <div className="grid grid-cols-1 gap-2">
                      {/* UNIDAD */}
                      <div className="border border-[#dadce0] bg-[#f8f9fa] p-3 flex flex-col justify-center rounded-none shadow-sm">
                        <div className="flex items-center gap-1.5 mb-1.5 select-none">
                          <span className="font-black text-[9px] tracking-wider uppercase text-slate-400">UNIDAD</span>
                          <span className="text-[7px] bg-slate-200 text-slate-600 px-1 py-0.2 font-bold uppercase">Minorista</span>
                        </div>
                        <div className="flex items-center flex-wrap gap-1 font-medium">
                          <span className="text-slate-600 font-bold text-xs mr-1">Unidad :</span>
                          <span className="font-mono text-base font-black text-slate-800">
                            ${formatPrice(selectedProductForModal.unidad)}
                          </span>
                          <span className="text-slate-400 font-bold text-xs mx-1">
                            (x {selectedProductForModal.bulto || "-"})
                          </span>
                          <span className="text-slate-300 font-medium text-xs mx-1">/</span>
                          <span className="font-mono text-base font-black text-slate-800">
                            ${selectedProductForModal.unidadParsed && selectedProductForModal.bultoParsed 
                              ? formatPrice(selectedProductForModal.unidadParsed * selectedProductForModal.bultoParsed) 
                              : "-"}
                          </span>
                        </div>
                      </div>

                      {/* MAYOR 1 */}
                      <div className="border border-[#dadce0] bg-[#e6f4ea]/40 p-3 flex flex-col justify-center rounded-none shadow-sm">
                        <div className="flex items-center gap-1.5 mb-1.5 select-none">
                          <span className="font-black text-[9px] tracking-wider uppercase text-[#1d8045]">MAYOR 1</span>
                          <span className="text-[7px] bg-[#e6f4ea] text-[#1d8045] px-1 py-0.2 font-bold uppercase">Estándar</span>
                        </div>
                        <div className="flex items-center flex-wrap gap-1 font-medium">
                          <span className="text-[#2d6a4f]/70 font-bold text-xs mr-1">Mayor 1 :</span>
                          <span className="font-mono text-base font-black text-[#1d8045]">
                            ${formatPrice(selectedProductForModal.mayor1)}
                          </span>
                          <span className="text-[#1d8045]/60 font-bold text-xs mx-1">
                            (x {selectedProductForModal.bulto || "-"})
                          </span>
                          <span className="text-[#1d8045]/30 font-medium text-xs mx-1">/</span>
                          <span className="font-mono text-base font-black text-[#1d8045]">
                            ${selectedProductForModal.cajaMayor1 
                              ? formatPrice(selectedProductForModal.cajaMayor1) 
                              : selectedProductForModal.mayor1Parsed && selectedProductForModal.bultoParsed
                                ? formatPrice(selectedProductForModal.mayor1Parsed * selectedProductForModal.bultoParsed)
                                : "-"}
                          </span>
                        </div>
                      </div>

                      {/* MAYOR 2 */}
                      <div className="border border-[#dadce0] bg-[#e6f4ea]/80 p-3 flex flex-col justify-center rounded-none shadow-sm">
                        <div className="flex items-center gap-1.5 mb-1.5 select-none">
                          <span className="font-black text-[9px] tracking-wider uppercase text-[#186b3a]">MAYOR 2</span>
                          <span className="text-[7px] bg-[#d2e7d6] text-[#186b3a] px-1 py-0.2 font-bold uppercase">Especial Bulto</span>
                        </div>
                        <div className="flex items-center flex-wrap gap-1 font-medium">
                          <span className="text-[#186b3a]/70 font-bold text-xs mr-1">Mayor 2 :</span>
                          <span className="font-mono text-base font-black text-[#186b3a]">
                            ${formatPrice(selectedProductForModal.mayor2)}
                          </span>
                          <span className="text-[#186b3a]/60 font-bold text-xs mx-1">
                            (x {selectedProductForModal.bulto || "-"})
                          </span>
                          <span className="text-[#186b3a]/30 font-medium text-xs mx-1">/</span>
                          <span className="font-mono text-base font-black text-[#186b3a]">
                            ${selectedProductForModal.cajaMayor2 
                              ? formatPrice(selectedProductForModal.cajaMayor2) 
                              : selectedProductForModal.mayor2Parsed && selectedProductForModal.bultoParsed
                                ? formatPrice(selectedProductForModal.mayor2Parsed * selectedProductForModal.bultoParsed)
                                : "-"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>



              </div>

              {/* Footer */}
              <div className="bg-[#f8f9fa] border-t border-[#dadce0] px-4 py-2.5 flex justify-end">
                <button
                  onClick={() => setSelectedProductForModal(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-[#dadce0] px-3.5 py-1.5 rounded-none font-black text-[10px] uppercase tracking-wider cursor-pointer transition"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
