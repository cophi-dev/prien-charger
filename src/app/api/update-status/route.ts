import { NextResponse } from "next/server"

// We need to import and use the same cache from the charger API
// In a real-world application, this would be a database or shared cache
// For this example, we'll simulate the cache since we can't easily share it between files
interface CacheEntry {
  data: Record<string, unknown>;
  timestamp: number;
}

const cache: Record<string, CacheEntry> = {};

interface UpdateStatusRequest {
  evseId: string;
  status: string;
}

export async function POST(request: Request) {
  try {
    const data: UpdateStatusRequest = await request.json()
    const { evseId, status } = data

    if (!evseId || !status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Validate status
    const validStatuses = ["available", "charging", "error", "maintenance"]
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 })
    }

    // Invalidate the cache for this charger
    const cacheKey = `charger_${evseId}`;
    delete cache[cacheKey];
    
    // In a real implementation, we would send this status update to the charger
    // For this simulation, we'll just assume it worked
    
    // Create a mock response with the updated status
    const updatedData = {
      evseId,
      status,
      location: `Charger ${evseId}`,
      operator: "AUG. PRIEN Bauunternehmung (GmbH & Co. KG)",
      address: "Dampfschiffweg 2, 21079 Hamburg",
      plugType: "Type 2 (Mennekes) (max. 22 kW)",
      power: "22 kW",
      lastUpdated: new Date().toISOString(),
      isRealTime: true,
      manuallyUpdated: true
    };
    
    // Store in cache with current timestamp
    cache[cacheKey] = {
      data: updatedData,
      timestamp: Date.now()
    };

    return NextResponse.json({
      success: true,
      message: "Status updated successfully",
      ...updatedData
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error updating status: ${errorMessage}`);
    
    return NextResponse.json(
      { success: false, message: `Failed to update status: ${errorMessage}` },
      { status: 500 }
    );
  }
}

// Also allow GET requests to retrieve the current status
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const evseId = searchParams.get("evseId")

  if (!evseId) {
    return NextResponse.json({ error: "Missing evseId parameter" }, { status: 400 })
  }

  // Check for this charger in the cache
  const cacheKey = `charger_${evseId}`;
  const cachedData = cache[cacheKey];
  
  if (cachedData) {
    return NextResponse.json({
      ...cachedData.data,
      fromCache: true
    });
  }
  
  // If not in cache, respond with default status
  return NextResponse.json({
    evseId,
    status: "available", // Default to available for better UX
    location: `Charger ${evseId}`,
    operator: "AUG. PRIEN Bauunternehmung (GmbH & Co. KG)",
    address: "Dampfschiffweg 2, 21079 Hamburg",
    plugType: "Type 2 (Mennekes) (max. 22 kW)",
    power: "22 kW",
    lastUpdated: new Date().toISOString(),
    isRealTime: false
  });
}

