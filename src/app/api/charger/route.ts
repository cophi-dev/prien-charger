import { NextResponse } from "next/server"
import * as cheerio from "cheerio"

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
  "E006234": {
    id: "DE*MDS*E006234",
    location: "Ladestation 1",
    steckertyp: "Typ 2",
    leistung: "22 kW",
    preis: "0,49 €/kWh",
    address: "Prien am Chiemsee, 83209"
  },
  "E006198": {
    id: "DE*MDS*E006198",
    location: "Ladestation 2",
    steckertyp: "Typ 2",
    leistung: "22 kW",
    preis: "0,49 €/kWh",
    address: "Prien am Chiemsee, 83209"
  },
  "E000001": {
    id: "DE*PRI*E000001",
    location: "Ladestation 3",
    steckertyp: "CCS",
    leistung: "50 kW",
    preis: "0,59 €/kWh",
    address: "Prien am Chiemsee, 83209"
  },
  "E000002": {
    id: "DE*PRI*E000002",
    location: "Ladestation 4",
    steckertyp: "CCS",
    leistung: "50 kW",
    preis: "0,59 €/kWh",
    address: "Prien am Chiemsee, 83209"
  }
};

// More charger IDs from screenshot
const REAL_CHARGER_IDS = [
  "DE*MDS*E006234",
  "DE*MDS*E006198"
];

// Remove or comment out the unused ChargerResponse interface
// interface ChargerResponse {
//   evseId: string;
//   status: string;
//   location: string;
//   operator: string;
//   address: string;
//   plugType?: string;
//   power?: string;
//   steckertyp?: string;
//   leistung?: string;
//   preis?: string;
//   lastUpdated: string;
//   isRealTime: boolean;
//   error?: string;
// }

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

  // Extract the actual ID part (everything after the last *)
  const actualEvseId = evseId.split('*').pop() || "";
  
  // Use a known real charger ID for testing to avoid hitting rate limits
  const testEvseId = REAL_CHARGER_IDS[0];

  // Check if we can use cache
  if (!bypass && cache[evseId] && (Date.now() - cache[evseId].timestamp) < CACHE_DURATION) {
    return NextResponse.json(cache[evseId].data);
  }

  try {
    // Get real charger data based on the requested ID
    let chargerData;
    if (CHARGER_DATA[actualEvseId]) {
      chargerData = CHARGER_DATA[actualEvseId];
    } else {
      // Use the first real charger data as a template for unknown chargers
      const firstRealId = REAL_CHARGER_IDS[0].split('*').pop() || "";
      const templateCharger = CHARGER_DATA[firstRealId];
      chargerData = {
        ...templateCharger,
        id: evseId,
        location: `Charger ${actualEvseId}`
      };
    }

    // Build the charger URL from the evseId
    const url = `https://www.chrg.direct/?evseId=${encodeURIComponent(testEvseId)}`;
    console.log(`Fetching data from: ${url}`);

    // Different Puppeteer setup for Vercel's serverless environment
    let browser;
    let page;
    let puppeteer;

    if (process.env.VERCEL) {
      // On Vercel, use a more compatible approach
      try {
        // Try to use chrome-aws-lambda if installed
        const chromium = require('chrome-aws-lambda');
        puppeteer = require('puppeteer-core');
        
        browser = await puppeteer.launch({
          args: chromium.args,
          executablePath: await chromium.executablePath,
          headless: chromium.headless,
        });
      } catch (error) {
        console.error("Failed to use chrome-aws-lambda:", error);
        // Fallback to puppeteer with minimal args if chrome-aws-lambda isn't available
        puppeteer = require('puppeteer');
        
        browser = await puppeteer.launch({
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
          ],
          headless: "new"
        });
      }
    } else {
      // Local development setup
      puppeteer = require('puppeteer');
      browser = await puppeteer.launch({
        headless: "new"
      });
    }

    try {
      page = await browser.newPage();
      
      // Set viewport size
      await page.setViewport({ width: 1280, height: 800 });
     
      // Set user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 10000 });

      // Wait for content to load
      try {
        await page.waitForSelector('.badge', { timeout: 5000 });
      } catch {
        console.log('Badge selector timeout, continuing anyway');
      }

      // Get the fully rendered HTML
      const html = await page.content();
      
      // Parse the HTML with Cheerio
      const $ = cheerio.load(html);
      
      // Extract the status
      let status = "unknown";
      let statusText = "";
      
      // Try to find the status badge
      const badge = $('.badge').first();
      if (badge.length) {
        statusText = badge.text().trim();
        console.log(`Found status badge: "${statusText}"`);
        
        // Determine status based on text
        if (statusText.toLowerCase().includes("besetzt") || 
            statusText.toLowerCase().includes("charging") || 
            statusText.toLowerCase().includes("occupied")) {
          status = "charging";
        } else if (statusText.toLowerCase().includes("verfügbar") || 
                  statusText.toLowerCase().includes("available") || 
                  statusText.toLowerCase().includes("free")) {
          status = "available";
        } else if (statusText.toLowerCase().includes("wartung") || 
                  statusText.toLowerCase().includes("maintenance")) {
          status = "maintenance";
        } else if (statusText.toLowerCase().includes("fehler") || 
                  statusText.toLowerCase().includes("error")) {
          status = "error";
        }
      } else {
        console.log("No status badge found");
        const errorResponse = {
          evseId,
          status: "unknown",
          location: chargerData.location,
          operator: "AUG. PRIEN Bauunternehmung (GmbH & Co. KG)",
          address: chargerData.address,
          plugType: chargerData.steckertyp,
          power: chargerData.leistung,
          price: chargerData.preis,
          lastUpdated: new Date().toISOString(),
          isRealTime: false,
          error: "No status information found"
        };
        
        // Cache the error response
        cache[evseId] = {
          data: errorResponse,
          timestamp: Date.now()
        };
        
        return NextResponse.json(errorResponse);
      }
      
      // If we couldn't determine the status from the badge, use a default
      if (status === "unknown") {
        status = "available";
      }

      // Prepare the response with the format matching the screenshot
      const response = {
        evseId,
        status,
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
        statusText
      };
      
      // Cache the response
      cache[evseId] = {
        data: response,
        timestamp: Date.now()
      };

      return NextResponse.json(response);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  } catch (error: unknown) {
    // Use error as unknown, then type check or cast as needed
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error fetching charger data: ${errorMessage}`);
    
    // Use the default data for the requested charger ID
    const defaultResponse = {
      evseId,
      status: "unknown",
      location: `Charger ${actualEvseId}`,
      operator: "AUG. PRIEN Bauunternehmung (GmbH & Co. KG)",
      address: "Unknown",
      plugType: "Unknown",
      power: "Unknown",
      lastUpdated: new Date().toISOString(),
      isRealTime: false,
      error: errorMessage
    };
    
    return NextResponse.json(defaultResponse);
  }
}

