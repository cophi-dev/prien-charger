import { NextResponse } from "next/server"

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
  }
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const evseId = searchParams.get("evseId")

  if (!evseId) {
    return NextResponse.json({ error: "Missing evseId parameter" }, { status: 400 })
  }

  try {
    // Get base charger data
    const chargerData = CHARGER_DATA[evseId];
    if (!chargerData) {
      throw new Error(`No data found for charger ${evseId}`);
    }

    // Instead of fetching the page directly, let's use a two-step approach
    // First, get the page to establish any necessary cookies
    const initialResponse = await fetch(`https://www.chrg.direct/?evseId=${encodeURIComponent(evseId)}`, {
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    })

    if (!initialResponse.ok) {
      return NextResponse.json(
        {
          error: `Failed to fetch initial page: ${initialResponse.statusText}`,
          status: initialResponse.status,
          evseId,
        },
        { status: 502 },
      )
    }

    // Get any cookies from the initial response
    const cookies = initialResponse.headers.get("set-cookie")

    // Now make a second request with the cookies
    const headers: HeadersInit = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Referer: `https://www.chrg.direct/?evseId=${encodeURIComponent(evseId)}`,
    }

    if (cookies) {
      headers["Cookie"] = cookies
    }

    // Add a random query parameter to prevent caching
    const cacheBuster = Date.now()
    const fetchUrl = `https://www.chrg.direct/?evseId=${encodeURIComponent(evseId)}&_=${cacheBuster}`

    const response = await fetch(fetchUrl, {
      cache: "no-store",
      headers,
    })

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `Failed to fetch charger data: ${response.statusText}`,
          status: response.status,
          evseId,
        },
        { status: 502 },
      )
    }

    const html = await response.text()

    // Check if we're getting the actual content
    if (html.includes("Adhoc Payment") && !html.includes("AUG. PRIEN")) {
      console.log("Still receiving initial page without charger data")

      // Since we can't get the real-time data, let's use our local data
      // but be honest about it being simulated
      return NextResponse.json({
        evseId,
        location: chargerData.location,
        operator: "AUG. PRIEN Bauunternehmung (GmbH & Co. KG)",
        address: chargerData.address,
        plugType: chargerData.steckertyp,
        power: chargerData.leistung,
        price: chargerData.preis,
        status: "unknown", // We can't get real-time status
        statusText: "Unbekannt",
        lastUpdated: new Date().toISOString(),
        isSimulated: true,
        message: "Using local data because the website requires JavaScript rendering",
      })
    }

    // Use dynamic import for cheerio to parse the HTML
    // @ts-ignore
    const cheerioModule = await import('cheerio');
    // @ts-ignore
    const $ = cheerioModule.default.load(html);

    // Extract data from the HTML
    let status = "unknown"
    let statusText = "Unbekannt"

    // Look for the status badge with multiple selectors
    const statusBadges = $('.badge.rounded-pill');
    
    // @ts-ignore
    statusBadges.each((_, elem) => {
      const badge = $(elem);
      const text = badge.text().trim().toLowerCase();
      const className = badge.attr('class') || '';

      if (className.includes('bg-success') || text.includes('available') || text.includes('verfügbar')) {
        status = 'available';
        statusText = 'Verfügbar';
      } else if (className.includes('bg-warning') || text.includes('maintenance') || text.includes('wartung')) {
        status = 'maintenance';
        statusText = 'Wartung';
      } else if (className.includes('bg-danger') || text.includes('error') || text.includes('fehler')) {
        status = 'error';
        statusText = 'Fehler';
      } else if (className.includes('bg-secondary') || text.includes('charging') || text.includes('besetzt')) {
        status = 'charging';
        statusText = 'Besetzt';
      }
    });

    // Return the data combining our local data with any real-time status we found
    return NextResponse.json({
      evseId,
      location: chargerData.location,
      operator: "AUG. PRIEN Bauunternehmung (GmbH & Co. KG)",
      address: chargerData.address,
      plugType: chargerData.steckertyp,
      power: chargerData.leistung,
      price: chargerData.preis,
      status,
      statusText,
      lastUpdated: new Date().toISOString(),
      isSimulated: false,
    })
  } catch (error) {
    console.error("Error fetching charger info:", error)
    
    // If we have local data, return it with unknown status
    const chargerData = CHARGER_DATA[evseId];
    if (chargerData) {
      return NextResponse.json({
        evseId,
        location: chargerData.location,
        operator: "AUG. PRIEN Bauunternehmung (GmbH & Co. KG)",
        address: chargerData.address,
        plugType: chargerData.steckertyp,
        power: chargerData.leistung,
        price: chargerData.preis,
        status: "unknown",
        statusText: "Unbekannt",
        lastUpdated: new Date().toISOString(),
        isSimulated: true,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    return NextResponse.json(
      {
        error: "Failed to fetch charger info",
        message: error instanceof Error ? error.message : String(error),
        evseId,
      },
      { status: 500 },
    )
  }
}

