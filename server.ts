import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1UVKTNUQuq9JEQr4k6_jJFmzFxpnct14xpR-bxfbBJsA/gviz/tq?tqx=out:csv&sheet=GolosinasMayorista";

// Fallback hardcoded data in case of fetch errors
const FALLBACK_PRODUCTS = [
  { id: "p-1", nombre: "Pepas Trio 200gr x20u", costo: "642,5", costoParsed: 642.5, unidad: "771", unidadParsed: 771, mayor1: "739", mayor1Parsed: 739, mayor2: "707", mayor2Parsed: 707, bulto: "20", bultoParsed: 20, cajaMayor1: " $14.778", cajaMayor1Parsed: 14778, cajaMayor2: " $14.135", cajaMayor2Parsed: 14135, isCategoryHeader: false },
  { id: "p-2", nombre: "Pepas trio 500 gr x10u", costo: "1600", costoParsed: 1600, unidad: "1920", unidadParsed: 1920, mayor1: "1840", mayor1Parsed: 1840, mayor2: "1760", mayor2Parsed: 1760, bulto: "10", bultoParsed: 10, cajaMayor1: " $18.400", cajaMayor1Parsed: 18400, cajaMayor2: " $17.600", cajaMayor2Parsed: 17600, isCategoryHeader: false },
  { id: "p-3", nombre: "Pepas trio 1kg x4u", costo: "2665", costoParsed: 2665, unidad: "3198", unidadParsed: 3198, mayor1: "3065", mayor1Parsed: 3065, mayor2: "2932", mayor2Parsed: 2932, bulto: "4", bultoParsed: 4, cajaMayor1: " $12.259", cajaMayor1Parsed: 12259, cajaMayor2: " $11.726", cajaMayor2Parsed: 11726, isCategoryHeader: false },
  { id: "p-4", nombre: "Galleta LIA 400gr x21u", costo: "1680", costoParsed: 1680, unidad: "2016", unidadParsed: 2016, mayor1: "1932", mayor1Parsed: 1932, mayor2: "1848", mayor2Parsed: 1848, bulto: "21", bultoParsed: 21, cajaMayor1: " $40.572", cajaMayor1Parsed: 40572, cajaMayor2: " $38.808", cajaMayor2Parsed: 38808, isCategoryHeader: false },
  { id: "p-5", nombre: "Galleta DIVERSION 400gr x21u", costo: "1952", costoParsed: 1952, unidad: "2342", unidadParsed: 2342, mayor1: "2245", mayor1Parsed: 2245, mayor2: "2147", mayor2Parsed: 2147, bulto: "21", bultoParsed: 21, cajaMayor1: " $47.141", cajaMayor1Parsed: 47141, cajaMayor2: " $45.091", cajaMayor2Parsed: 45091, isCategoryHeader: false },
  { id: "p-6", nombre: "Galleta BAGLEY 400gr x21u", costo: "2476", costoParsed: 2476, unidad: "2971", unidadParsed: 2971, mayor1: "2847", mayor1Parsed: 2847, mayor2: "2724", mayor2Parsed: 2724, bulto: "21", bultoParsed: 21, cajaMayor1: " $59.795", cajaMayor1Parsed: 59795, cajaMayor2: " $57.196", cajaMayor2Parsed: 57196, isCategoryHeader: false },
  { id: "p-7", nombre: "Galleta Legendaria x500gr x8u", costo: "1333", costoParsed: 1333, unidad: "1600", unidadParsed: 1600, mayor1: "1533", mayor1Parsed: 1533, mayor2: "1466", mayor2Parsed: 1466, bulto: "8", bultoParsed: 8, cajaMayor1: " $12.264", cajaMayor1Parsed: 12264, cajaMayor2: " $11.730", cajaMayor2Parsed: 11730, isCategoryHeader: false },
  { id: "p-8", nombre: "Galleta Legendaria x1kg x4u", costo: "2665", costoParsed: 2665, unidad: "3198", unidadParsed: 3198, mayor1: "3065", mayor1Parsed: 3065, mayor2: "2932", mayor2Parsed: 2932, bulto: "4", bultoParsed: 4, cajaMayor1: " $12.259", cajaMayor1Parsed: 12259, cajaMayor2: " $11.726", cajaMayor2Parsed: 11726, isCategoryHeader: false },
  { id: "p-9", nombre: "Galleta Oreo 180gr x36", costo: "1350", costoParsed: 1350, unidad: "1620", unidadParsed: 1620, mayor1: "1553", mayor1Parsed: 1553, mayor2: "1485", mayor2Parsed: 1485, bulto: "36", bultoParsed: 36, cajaMayor1: " $55.890", cajaMayor1Parsed: 55890, cajaMayor2: " $53.460", cajaMayor2Parsed: 53460, isCategoryHeader: false },
  { id: "p-10", nombre: "Don Satur Saladas x30u", costo: "945", costoParsed: 945, unidad: "1134", unidadParsed: 1134, mayor1: "1087", mayor1Parsed: 1087, mayor2: "1040", mayor2Parsed: 1040, bulto: "30", bultoParsed: 30, cajaMayor1: " $32.603", cajaMayor1Parsed: 32603, cajaMayor2: " $31.185", cajaMayor2Parsed: 31185, isCategoryHeader: false },
  { id: "p-11", nombre: "Don Satur dulce x30u", costo: "945", costoParsed: 945, unidad: "1134", unidadParsed: 1134, mayor1: "1087", mayor1Parsed: 1087, mayor2: "1040", mayor2Parsed: 1040, bulto: "30", bultoParsed: 30, cajaMayor1: " $32.603", cajaMayor1Parsed: 32603, cajaMayor2: " $31.185", cajaMayor2Parsed: 31185, isCategoryHeader: false },
  { id: "p-12", nombre: "Turrones Misky x50u", costo: "152", costoParsed: 152, unidad: "182", unidadParsed: 182, mayor1: "175", mayor1Parsed: 175, mayor2: "167", mayor2Parsed: 167, bulto: "50", bultoParsed: 50, cajaMayor1: " $8.740", cajaMayor1Parsed: 8740, cajaMayor2: " $8.360", cajaMayor2Parsed: 8360, isCategoryHeader: false },
  { id: "p-13", nombre: "Turrones Fulbito x50u", costo: "108", costoParsed: 108, unidad: "130", unidadParsed: 130, mayor1: "124", mayor1Parsed: 124, mayor2: "119", mayor2Parsed: 119, bulto: "50", bultoParsed: 50, cajaMayor1: " $6.210", cajaMayor1Parsed: 6210, cajaMayor2: " $5.940", cajaMayor2Parsed: 5940, isCategoryHeader: false },
  { id: "p-14", nombre: "Alfajor Fantoche Triple x12u", costo: "667", costoParsed: 667, unidad: "800", unidadParsed: 800, mayor1: "767", mayor1Parsed: 767, mayor2: "734", mayor2Parsed: 734, bulto: "12", bultoParsed: 12, cajaMayor1: " $9.205", cajaMayor1Parsed: 9205, cajaMayor2: " $8.804", cajaMayor2Parsed: 8804, isCategoryHeader: false },
  { id: "p-15", nombre: "Alfajor guaymallen x40", costo: "245", costoParsed: 245, unidad: "294", unidadParsed: 294, mayor1: "282", mayor1Parsed: 282, mayor2: "270", mayor2Parsed: 270, bulto: "40", bultoParsed: 40, cajaMayor1: " $11.270", cajaMayor1Parsed: 11270, cajaMayor2: " $10.780", cajaMayor2Parsed: 10780, isCategoryHeader: false },
  { id: "p-16", nombre: "Alfajor guaymallen triple x24u", costo: "408", costoParsed: 408, unidad: "490", unidadParsed: 490, mayor1: "469", mayor1Parsed: 469, mayor2: "449", mayor2Parsed: 449, bulto: "24", bultoParsed: 24, cajaMayor1: " $11.261", cajaMayor1Parsed: 11261, cajaMayor2: " $10.771", cajaMayor2Parsed: 10771, isCategoryHeader: false },
  { id: "p-17", nombre: "Alfajor Tanti x24u", costo: "230", costoParsed: 230, unidad: "276", unidadParsed: 276, mayor1: "265", mayor1Parsed: 265, mayor2: "253", mayor2Parsed: 253, bulto: "24", bultoParsed: 24, cajaMayor1: " $6.348", cajaMayor1Parsed: 6348, cajaMayor2: " $6.072", cajaMayor2Parsed: 6072, isCategoryHeader: false },
  { id: "p-18", nombre: "Alfajor Fulbito x40u", costo: "145", costoParsed: 145, unidad: "174", unidadParsed: 174, mayor1: "167", mayor1Parsed: 167, mayor2: "160", mayor2Parsed: 160, bulto: "40", bultoParsed: 40, cajaMayor1: " $6.670", cajaMayor1Parsed: 6670, cajaMayor2: " $6.380", cajaMayor2Parsed: 6380, isCategoryHeader: false },
  { id: "p-19", nombre: "Pipas Tira x10. (CAJA x15tiras)", costo: "4700", costoParsed: 4700, unidad: "5640", unidadParsed: 5640, mayor1: "5405", mayor1Parsed: 5405, mayor2: "5170", mayor2Parsed: 5170, bulto: "", bultoParsed: 0, cajaMayor1: "", cajaMayor1Parsed: 0, cajaMayor2: "", cajaMayor2Parsed: 0, isCategoryHeader: false },
  { id: "p-20", nombre: "Pipas Negras en 12un CAJA( caja grande x12blister)", costo: "5700", costoParsed: 5700, unidad: "6840", unidadParsed: 6840, mayor1: "6555", mayor1Parsed: 6555, mayor2: "6270", mayor2Parsed: 6270, bulto: "", bultoParsed: 0, cajaMayor1: "", cajaMayor1Parsed: 0, cajaMayor2: "", cajaMayor2Parsed: 0, isCategoryHeader: false },
  { id: "p-21", nombre: "Pipas Gigantes x12u", costo: "1483", costoParsed: 1483, unidad: "1780", unidadParsed: 1780, mayor1: "1705", mayor1Parsed: 1705, mayor2: "1631", mayor2Parsed: 1631, bulto: "12", bultoParsed: 12, cajaMayor1: " $20.465", cajaMayor1Parsed: 20465, cajaMayor2: " $19.576", cajaMayor2Parsed: 19576, isCategoryHeader: false },
  { id: "p-22", nombre: "Vainillas x36u", costo: "409", costoParsed: 409, unidad: "491", unidadParsed: 491, mayor1: "470", mayor1Parsed: 470, mayor2: "450", mayor2Parsed: 450, bulto: "36", bultoParsed: 36, cajaMayor1: " $16.933", cajaMayor1Parsed: 16933, cajaMayor2: " $16.196", cajaMayor2Parsed: 16196, isCategoryHeader: false },
  { id: "p-23", nombre: "Fauna", costo: "", costoParsed: 0, unidad: "0", unidadParsed: 0, mayor1: "0", mayor1Parsed: 0, mayor2: "0", mayor2Parsed: 0, bulto: "", bultoParsed: 0, cajaMayor1: "", cajaMayor1Parsed: 0, cajaMayor2: "", cajaMayor2Parsed: 0, isCategoryHeader: true }
];

// Helper to parse a single line of CSV
function parseCSVLine(line: string): string[] {
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
}

// Number parsing adjusted for Argentinian currency values
function parseNumberSpanish(val: string | undefined | null): number {
  if (!val) return 0;
  let clean = val.trim();
  clean = clean.replace('$', '').trim();
  if (clean.includes(',')) {
    // Decimal comma (e.g. "642,5" -> "642.5" after removing thousand dots)
    clean = clean.replace(/\./g, '');
    clean = clean.replace(',', '.');
  } else {
    // Whole numbers or thousand dots only (e.g. "14.778" -> "14778")
    clean = clean.replace(/\./g, '');
  }
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

// Parse Google Sheet CSV data
function parseCSVData(csvText: string) {
  const lines = csvText.split(/\r?\n/);
  if (lines.length === 0) return [];

  const products = [];
  let headerSkipped = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const columns = parseCSVLine(line);
    
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

    const costoVal = parseNumberSpanish(costo);
    const unidadVal = parseNumberSpanish(unidad);
    const mayor1Val = parseNumberSpanish(mayor1);
    const mayor2Val = parseNumberSpanish(mayor2);
    const bultoVal = parseNumberSpanish(bulto);
    const cajaMayor1Val = parseNumberSpanish(cajaMayor1);
    const cajaMayor2Val = parseNumberSpanish(cajaMayor2);

    // Identify if it's a category header row
    // E.g. "Fauna" with no pricing info
    const isCategoryHeader = !!nombre && !costo && !cajaMayor1 && (unidadVal === 0) && (mayor1Val === 0) && (mayor2Val === 0);

    products.push({
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

  return products.length > 0 ? products : FALLBACK_PRODUCTS;
}

// API Routes
app.get("/api/products", async (req, res) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    const response = await fetch(SHEET_CSV_URL, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Google Sheet returned status ${response.status}`);
    }

    const csvText = await response.text();
    const products = parseCSVData(csvText);
    res.json({ success: true, products, source: "live_google_sheets" });
  } catch (error: any) {
    console.error("Error fetching live Google Sheet:", error.message || error);
    // Graceful fallback to static data
    res.json({
      success: false,
      products: FALLBACK_PRODUCTS,
      source: "local_cache_fallback",
      error: error.message || String(error)
    });
  }
});

async function startServer() {
  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
