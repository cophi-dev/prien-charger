import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const evseId = searchParams.get("evseId")

  if (!evseId) {
    return NextResponse.json({ error: "Missing evseId parameter" }, { status: 400 })
  }

  try {
    // Use the direct URL format that shows in the browser
    const url = `https://www.chrg.direct/?evseId=${encodeURIComponent(evseId)}`

    // Add a random query parameter to prevent caching
    const cacheBuster = Date.now()
    const fetchUrl = `${url}&_=${cacheBuster}`

    const response = await fetch(fetchUrl, {
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
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

    // Extract status information
    let statusText = ""
    let status = "unknown"

    // Look for "Status:" followed by text
    const statusMatch = html.match(/Status:\s*([A-Za-z]+)/i)
    if (statusMatch && statusMatch[1]) {
      statusText = statusMatch[1].trim()
    }

    // Determine status based on keywords
    const htmlLower = html.toLowerCase()
    const containsOccupied =
      htmlLower.includes("occupied") || htmlLower.includes("besetzt") || htmlLower.includes("in use")
    const containsAvailable =
      htmlLower.includes("available") || htmlLower.includes("verfügbar") || htmlLower.includes("free")
    const containsError = htmlLower.includes("error") || htmlLower.includes("fehler")
    const containsMaintenance = htmlLower.includes("maintenance") || htmlLower.includes("wartung")

    if (statusText) {
      statusText = statusText.toLowerCase()
      if (statusText.includes("occupied") || statusText.includes("charging")) {
        status = "charging"
      } else if (statusText.includes("available")) {
        status = "available"
      } else if (statusText.includes("error")) {
        status = "error"
      } else if (statusText.includes("maintenance")) {
        status = "maintenance"
      }
    } else if (containsOccupied) {
      status = "charging"
    } else if (containsAvailable) {
      status = "available"
    } else if (containsError) {
      status = "error"
    } else if (containsMaintenance) {
      status = "maintenance"
    }

    // Return the extracted information
    return NextResponse.json({
      evseId,
      html: html.substring(0, 5000), // Return first 5000 chars to avoid response size limits
      statusText,
      status,
      containsOccupied,
      containsAvailable,
      containsError,
      containsMaintenance,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error fetching charger info:", error)
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

