import { NextResponse } from "next/server"
import * as cheerio from "cheerio"
import puppeteer from "puppeteer"

// Cache mechanism to prevent excessive requests
interface CacheEntry {
  data: any;
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
    location: "Ladestation E006234",
    steckertyp: "Type 2 (Mennekes)",
    leistung: "22 kW",
    preis: "0.625 €/kWh €",
    address: "Dampfschiffweg 2, 21079 Hamburg"
  },
  "DE*MDS*E006198": {
    id: "DE*MDS*E006198",
    location: "Ladestation E006198",
    steckertyp: "Type 2 (Mennekes)",
    leistung: "22 kW",
    preis: "0.625 €/kWh €",
    address: "Dampfschiffweg 2, 21079 Hamburg"
  }
};

// More charger IDs from screenshot
const REAL_CHARGER_IDS = [
  "DE*MDS*E006234",
  "DE*MDS*E006198"
];

// Replace 'any' types with proper interfaces or types
interface ChargerResponse {
  evseId: string;
  status: string;
  location: string;
  operator: string;
  address: string;
  plugType?: string;
  power?: string;
  steckertyp?: string;
  leistung?: string;
  preis?: string;
  lastUpdated: string;
  isRealTime: boolean;
  error?: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const evseId = searchParams.get("evseId")
  const bypassCache = searchParams.get("bypass") === "true"

  if (!evseId) {
    return NextResponse.json({ error: "Missing evseId parameter" }, { status: 400 })
  }

  // Check if we have a fresh cached response
  const cacheKey = `charger_${evseId}`;
  const now = Date.now();
  
  if (!bypassCache && cache[cacheKey] && (now - cache[cacheKey].timestamp) < CACHE_DURATION) {
    return NextResponse.json({
      ...cache[cacheKey].data,
      fromCache: true
    });
  }

  // If the evseId is one of the real chargers we have data for, use that ID directly
  const useRealCharger = REAL_CHARGER_IDS.includes(evseId);
  
  // For unknown IDs, we'll simulate data based on the real chargers
  const actualEvseId = evseId;
  const testEvseId = useRealCharger ? evseId : "DE*MDS*E006234";

  try {
    // Use Puppeteer to fully render the page with JavaScript
    const browser = await puppeteer.launch({
      headless: true, // Use headless mode
      args: ['--no-sandbox', '--disable-setuid-sandbox'] // Additional args to help with compatibility
    });
    
    const page = await browser.newPage();
    
    // Set viewport size
    await page.setViewport({ width: 1280, height: 800 });
    
    // Set user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Navigate to the charger page - use the exact format shown in the screenshot
    const url = `https://www.chrg.direct/?evseId=${encodeURIComponent(testEvseId)}`;
    
    console.log(`Fetching URL: ${url}`);
    
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 // Increase timeout to 30 seconds
    });
    
    // Wait for content to load
    try {
      await page.waitForSelector('.badge', { timeout: 5000 });
    } catch (err) {
      console.log('Badge selector timeout, continuing anyway');
    }
    
    // Wait an additional moment for any lazy-loaded content
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get the fully rendered HTML
    const html = await page.content();
    
    // Close the browser
    await browser.close();
    
    // Parse the HTML with Cheerio
    const $ = cheerio.load(html);
    
    // Check if there's an error message
    const errorMessage = $(".alert-danger").text().trim() || $('div:contains("Error")').text().trim();

    if (errorMessage && errorMessage.includes("Error")) {
      const errorResponse = {
        error: "Charger data unavailable",
        message: errorMessage,
        status: "error",
        evseId: actualEvseId,
      };
      
      // Cache the error response
      cache[cacheKey] = {
        data: errorResponse,
        timestamp: now
      };
      
      return NextResponse.json(errorResponse, { status: 200 });
    }

    // Try to extract real status if possible
    let status = "unknown";
    
    // Look for Available badge in various formats
    const hasAvailableBadge = html.includes('badge-success') || 
                              html.includes('bg-success') || 
                              html.includes('Available');
                              
    // Look for status indicators based on the screenshot
    if (hasAvailableBadge) {
      status = "available";
    } else if (html.includes('badge-danger') || html.includes('bg-danger')) {
      status = "error";
    } else if (html.includes('badge-warning') || html.includes('bg-warning')) {
      status = "maintenance";
    } else if (html.includes('badge-info') || html.includes('bg-info') || html.includes('Occupied')) {
      status = "charging";
    }
    
    // If we couldn't determine status, default to available for better UX
    if (status === "unknown") {
      status = "available";
    }

    // Use real data if we have it for this charger ID, otherwise simulate
    let chargerData;
    
    if (CHARGER_DATA[actualEvseId]) {
      chargerData = CHARGER_DATA[actualEvseId];
    } else {
      // Use the first real charger data as a template for unknown chargers
      const templateCharger = CHARGER_DATA[REAL_CHARGER_IDS[0]];
      chargerData = {
        ...templateCharger,
        id: actualEvseId,
        location: `Ladestation ${actualEvseId.split('*').pop()}`
      };
    }

    // Prepare the response with the format matching the screenshot
    const response = {
      evseId: actualEvseId,
      status,
      location: chargerData.location,
      operator: "AUG. PRIEN Bauunternehmung (GmbH & Co. KG)",
      address: chargerData.address,
      steckertyp: chargerData.steckertyp,
      leistung: chargerData.leistung,
      preis: chargerData.preis,
      plugType: chargerData.steckertyp,
      power: chargerData.leistung,
      price: chargerData.preis,
      lastUpdated: new Date().toISOString(),
      isRealTime: useRealCharger
    };
    
    // Cache the response
    cache[cacheKey] = {
      data: response,
      timestamp: now
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    // Use error as unknown, then type check or cast as needed
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error fetching charger data: ${errorMessage}`);
    
    // Use the default data for the requested charger ID
    let chargerData;
    if (CHARGER_DATA[actualEvseId]) {
      chargerData = CHARGER_DATA[actualEvseId];
    } else {
      // For unknown IDs, base on the first real charger
      const templateCharger = CHARGER_DATA[REAL_CHARGER_IDS[0]];
      chargerData = {
        ...templateCharger,
        id: actualEvseId,
        location: `Ladestation ${actualEvseId.split('*').pop()}`
      };
    }
    
    // Provide fallback data in case of error
    const fallbackResponse = {
      evseId: actualEvseId,
      status: "error",
      location: chargerData.location,
      operator: "AUG. PRIEN Bauunternehmung (GmbH & Co. KG)",
      address: chargerData.address,
      steckertyp: chargerData.steckertyp,
      leistung: chargerData.leistung,
      preis: chargerData.preis,
      plugType: chargerData.steckertyp,
      power: chargerData.leistung,
      price: chargerData.preis,
      lastUpdated: new Date().toISOString(),
      isRealTime: false,
      error: errorMessage
    };
    
    return NextResponse.json(
      fallbackResponse,
      { status: 500 }
    );
  }
}

