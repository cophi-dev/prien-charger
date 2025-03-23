const userStatusStore: Record<string, any> = {}

// Define proper types for the charger data
export interface ChargerData {
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
  price?: string;
  lastUpdated: string;
  isRealTime: boolean;
  updatedBy?: string;
  error?: string;
}

// Function to get charger data from the API
export async function getChargerData(evseId: string): Promise<ChargerData> {
  try {
    // Check if we have a manual status update (user-set status)
    const hasManualUpdate = userStatusStore[evseId]?.updatedBy === "user"

    // Try to get info from the charger URL
    const response = await fetch(`/api/charger?evseId=${encodeURIComponent(evseId)}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.statusText}`);
    }
    const data = await response.json();

    // If there's an error in the API response, throw it
    if (data.error) {
      throw new Error(data.error);
    }

    // If we have a manual update, use that status instead of the API status
    if (hasManualUpdate) {
      return {
        ...data,
        status: userStatusStore[evseId].status,
        lastUpdated: new Date(userStatusStore[evseId].lastUpdated).toLocaleTimeString(),
        updatedBy: "user",
      }
    }

    // Otherwise, return the API data
    return {
      ...data,
      lastUpdated: new Date(data.lastUpdated).toLocaleTimeString(),
      updatedBy: "system",
    }
  } catch (error: unknown) {
    // Use error as unknown, then type check or cast as needed
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error in getChargerData: ${errorMessage}`);
    
    // If we have a manual update, return that with the error
    if (userStatusStore[evseId]?.updatedBy === "user") {
      return {
        evseId,
        status: userStatusStore[evseId].status,
        location: `Ladestation ${evseId.split("*").pop() || ""}`,
        error: errorMessage,
        lastUpdated: new Date(userStatusStore[evseId].lastUpdated).toLocaleTimeString(),
        updatedBy: "user",
        plugType: "Unknown",
        power: "Unknown",
        price: "Unknown",
        operator: "Unknown",
        address: "Unknown",
        isRealTime: false,
      }
    }

    // Return a default error response
    return {
      evseId,
      status: "error",
      location: `Ladestation ${evseId.split("*").pop() || ""}`,
      error: errorMessage,
      lastUpdated: new Date().toLocaleTimeString(),
      updatedBy: "system",
      plugType: "Unknown",
      power: "Unknown",
      price: "Unknown",
      operator: "AUG. PRIEN Bauunternehmung (GmbH & Co. KG)",
      address: "Unknown",
      isRealTime: false,
    }
  }
}

// Function to update charger status manually
export async function updateChargerStatus(evseId: string, status: string) {
  userStatusStore[evseId] = {
    status,
    lastUpdated: new Date().toISOString(),
    updatedBy: "user",
  }

  return {
    success: true,
    evseId,
    status,
    lastUpdated: new Date().toLocaleTimeString(),
  }
}

