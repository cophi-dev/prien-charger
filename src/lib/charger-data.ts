const userStatusStore: Record<string, any> = {}

// Function to get charger data from the API
export async function getChargerData(evseId: string) {
  try {
    // Check if we have a manual status update (user-set status)
    const hasManualUpdate = userStatusStore[evseId]?.updatedBy === "user"

    // Try to get info from the charger URL
    const response = await fetch(`/api/charger-info?evseId=${encodeURIComponent(evseId)}`, {
      cache: "no-store",
      next: { revalidate: 0 }, // Don't cache the response
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch charger data: ${response.statusText}`)
    }

    const data = await response.json()

    // If there's an error in the API response, throw it
    if (data.error) {
      throw new Error(data.error)
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
  } catch (error) {
    console.error("Error fetching charger data:", error)

    // If we have a manual update, return that with the error
    if (userStatusStore[evseId]?.updatedBy === "user") {
      return {
        evseId,
        status: userStatusStore[evseId].status,
        location: `Ladestation ${evseId.split("*").pop() || ""}`,
        error: error instanceof Error ? error.message : "Unknown error",
        lastUpdated: new Date(userStatusStore[evseId].lastUpdated).toLocaleTimeString(),
        updatedBy: "user",
        plugType: "Unknown",
        power: "Unknown",
        price: "Unknown",
        operator: "Unknown",
        address: "Unknown",
      }
    }

    // Return an error state
    return {
      evseId,
      status: "error",
      location: `Ladestation ${evseId.split("*").pop() || ""}`,
      error: error instanceof Error ? error.message : "Unknown error",
      lastUpdated: new Date().toLocaleTimeString(),
      updatedBy: "system",
      plugType: "Unknown",
      power: "Unknown",
      price: "Unknown",
      operator: "Unknown",
      address: "Unknown",
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

