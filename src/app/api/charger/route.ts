import { NextResponse } from "next/server"
import puppeteer from 'puppeteer';

// Cache mechanism to prevent excessive requests
interface CacheEntry {
  data: Record<string, unknown>;
  timestamp: number;
}

// Define the charger data interface
interface ChargerInfo {
  id: string;
  location: string;
  steckertyp: string;
  leistung: string;
  preis: string;
  address: string;
}

// Define the type for CHARGER_DATA with an index signature
type ChargerDataMap = {
  [key: string]: ChargerInfo;
};

const cache: Record<string, CacheEntry> = {};
const CACHE_DURATION = 30 * 1000; // 30 seconds cache

// Data from the screenshot for the actual chargers
const CHARGER_DATA: ChargerDataMap = {
  "DE*MDS*E006234": {
    id: "DE*MDS*E006234",
    location: "Ladestation 1",
    steckertyp: "Typ 2",
    leistung: "22 kW",
    preis: "0,49 €/kWh",
    address: "Prien am Chiemsee, 83209"
  },
  "DE*MDS*E006198": {
    id: "DE*MDS*E006198",
    location: "Ladestation 2",
    steckertyp: "Typ 2",
    leistung: "22 kW",
    preis: "0,49 €/kWh",
    address: "Prien am Chiemsee, 83209"
  },
  "DE*PRI*E000001": {
    id: "DE*PRI*E000001",
    location: "Ladestation 3",
    steckertyp: "CCS",
    leistung: "50 kW",
    preis: "0,59 €/kWh",
    address: "Prien am Chiemsee, 83209"
  },
  "DE*PRI*E000002": {
    id: "DE*PRI*E000002",
    location: "Ladestation 4",
    steckertyp: "CCS",
    leistung: "50 kW",
    preis: "0,59 €/kWh",
    address: "Prien am Chiemsee, 83209"
  }
};

let browser: any = null;

// Initialize browser instance
async function initBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
  }
  return browser;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const evseId = searchParams.get("evseId");
  const bypass = searchParams.get("bypass") === "true";

  if (!evseId) {
    return NextResponse.json(
      { error: "Missing evseId parameter" },
      { status: 400 }
    );
  }

  // Check if we can use cache
  if (!bypass && cache[evseId] && (Date.now() - cache[evseId].timestamp) < CACHE_DURATION) {
    return NextResponse.json(cache[evseId].data);
  }

  try {
    // Get base charger data
    const chargerData = CHARGER_DATA[evseId] || {
      id: evseId,
      location: `Charger ${evseId}`,
      steckertyp: "Typ 2",
      leistung: "22 kW",
      preis: "0,49 €/kWh",
      address: "Prien am Chiemsee, 83209"
    };

    // Initialize browser if needed
    const browser = await initBrowser();
    const page = await browser.newPage();

    // Set viewport and user agent
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    // Navigate to the page and wait for content to load
    const url = `https://www.chrg.direct/?evseId=${encodeURIComponent(evseId)}`;
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

    // Wait for status badge to appear
    await page.waitForSelector('.badge.rounded-pill', { timeout: 10000 });

    // Extract status information
    const statusInfo = await page.evaluate(() => {
      const badge = document.querySelector('.badge.rounded-pill');
      if (!badge) return { status: 'unknown', statusText: 'Unbekannt' };

      const text = badge.textContent?.trim().toLowerCase() || '';
      const className = badge.className;

      if (className.includes('bg-success') || text.includes('available') || text.includes('verfügbar')) {
        return { status: 'available', statusText: 'Verfügbar' };
      } else if (className.includes('bg-warning') || text.includes('maintenance') || text.includes('wartung')) {
        return { status: 'maintenance', statusText: 'Wartung' };
      } else if (className.includes('bg-danger') || text.includes('error') || text.includes('fehler')) {
        return { status: 'error', statusText: 'Fehler' };
      } else if (className.includes('bg-secondary') || text.includes('charging') || text.includes('besetzt')) {
        return { status: 'charging', statusText: 'Besetzt' };
      }

      return { status: 'unknown', statusText: 'Unbekannt' };
    });

    // Close the page to free up resources
    await page.close();

    const response_data = {
      evseId,
      status: statusInfo.status,
      location: chargerData.location,
      operator: "AUG. PRIEN Bauunternehmung (GmbH & Co. KG)",
      address: chargerData.address,
      plugType: chargerData.steckertyp,
      power: chargerData.leistung,
      steckertyp: chargerData.steckertyp,
      leistung: chargerData.leistung,
      preis: chargerData.preis,
      lastUpdated: new Date().toISOString(),
      isRealTime: true,
      statusText: statusInfo.statusText
    };

    // Cache the response
    cache[evseId] = {
      data: response_data,
      timestamp: Date.now()
    };

    return NextResponse.json(response_data);

  } catch (error: unknown) {
    console.error('Error fetching charger data:', error);
    
    // Use the full evseId for status
    const defaultResponse = {
      evseId,
      status: 'unknown',
      location: CHARGER_DATA[evseId]?.location || `Charger ${evseId}`,
      operator: "AUG. PRIEN Bauunternehmung (GmbH & Co. KG)",
      address: CHARGER_DATA[evseId]?.address || "Prien am Chiemsee, 83209",
      plugType: CHARGER_DATA[evseId]?.steckertyp || "Typ 2",
      power: CHARGER_DATA[evseId]?.leistung || "22 kW",
      steckertyp: CHARGER_DATA[evseId]?.steckertyp || "Typ 2", 
      leistung: CHARGER_DATA[evseId]?.leistung || "22 kW",
      preis: CHARGER_DATA[evseId]?.preis || "0,49 €/kWh",
      lastUpdated: new Date().toISOString(),
      isRealTime: false,
      statusText: 'Unbekannt',
      error: error instanceof Error ? error.message : String(error)
    };
    
    return NextResponse.json(defaultResponse);
  }
}

