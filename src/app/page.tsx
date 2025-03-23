"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ChargerSkeleton } from "@/components/charger-skeleton"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ExternalLink, Battery, BatteryCharging, BatteryFull, AlertTriangle, BatteryWarning, RefreshCw, Info, MapPin } from "lucide-react"

// The actual charger IDs from the screenshot
const CHARGER_IDS = [
  "DE*MDS*E006234",
  "DE*MDS*E006198",
  "DE*PRI*E000001",
  "DE*PRI*E000002",
]

interface ChargerData {
  evseId: string
  status: string
  location: string
  operator: string
  address: string
  plugType?: string
  power?: string
  steckertyp?: string
  leistung?: string
  preis?: string
  lastUpdated: string
  isRealTime: boolean
}

export default function Home() {
  const [chargers, setChargers] = useState<ChargerData[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  useEffect(() => {
    fetchChargers()
    
    // Set up automatic refreshing every 60 seconds
    const interval = setInterval(() => {
      fetchChargers()
    }, 60 * 1000)
    
    return () => clearInterval(interval)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchChargers = async () => {
    if (refreshing) return
    
    setRefreshing(true)
    try {
      const chargerPromises = CHARGER_IDS.map(async (evseId) => {
        try {
          // Use the bypass parameter to force a fresh fetch from the source
          const response = await fetch(`/api/charger?evseId=${evseId}${loading ? '&bypass=true' : ''}`)
          if (!response.ok) {
            throw new Error(`Failed to fetch charger data: ${response.statusText}`)
          }
          return await response.json()
        } catch (error) {
          console.error(`Error fetching charger ${evseId}:`, error)
          return {
            evseId,
            status: "error",
            location: `Charger ${evseId}`,
            operator: "AUG. PRIEN Bauunternehmung (GmbH & Co. KG)",
            address: "Unknown",
            plugType: "Unknown",
            power: "Unknown",
            lastUpdated: new Date().toISOString(),
            isRealTime: false,
            error: error instanceof Error ? error.message : "Unknown error",
          }
        }
      })

      const results = await Promise.all(chargerPromises)
      setChargers(results)
      setLastRefresh(new Date())
    } catch (error) {
      console.error("Error fetching chargers:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "available":
        return "bg-green-100 text-green-800"
      case "charging":
        return "bg-[#e6eeff] text-[#0a2158]"
      case "error":
        return "bg-red-100 text-red-800"
      case "maintenance":
        return "bg-amber-100 text-amber-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "available":
        return <BatteryFull className="h-5 w-5" />
      case "charging":
        return <BatteryCharging className="h-5 w-5" />
      case "maintenance":
        return <BatteryWarning className="h-5 w-5" />
      case "error":
        return <AlertTriangle className="h-5 w-5" />
      default:
        return <Battery className="h-5 w-5" />
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case "available":
        return "Available"
      case "charging":
        return "Occupied"
      case "error":
        return "Error"
      case "maintenance":
        return "Maintenance"
      default:
        return "Unknown"
    }
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) {
        return "Invalid Date"
      }
      return date.toLocaleTimeString()
    } catch (e) {
      return "Invalid Date"
    }
  }
  
  const getChargerUrl = (evseId: string) => {
    return `https://www.chrg.direct/?evseId=${encodeURIComponent(evseId)}`;
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="container px-4 mx-auto">
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-3xl font-bold text-[#0a2158] text-center">Ladestation Dashboard</h1>
          <p className="text-gray-600 mt-2 text-center max-w-2xl">
            Übersicht der Ladestationen auf dem Firmenparkplatz
          </p>
          <div className="mt-4">
            <Button 
              onClick={fetchChargers} 
              disabled={refreshing} 
              className="bg-[#0a2158] hover:bg-[#0a2158]/90"
            >
              {refreshing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Aktualisiere...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Aktualisieren
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading
            ? Array(3)
                .fill(0)
                .map((_, index) => <ChargerSkeleton key={index} />)
            : chargers.map((charger) => (
                <Card 
                  key={charger.evseId}
                  className="h-full border-0 shadow-md overflow-hidden"
                >
                  <CardHeader className="bg-white border-b border-gray-100">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-[#0a2158]">
                        {charger.location || `Ladestation ${charger.evseId.split('*').pop()}`}
                      </CardTitle>
                      <Badge className={getStatusColor(!charger.isRealTime ? "unknown" : charger.status)}>
                        <span className="flex items-center gap-1">
                          {getStatusIcon(!charger.isRealTime ? "unknown" : charger.status)}
                          {getStatusLabel(!charger.isRealTime ? "unknown" : charger.status)}
                        </span>
                      </Badge>
                    </div>
                    <CardDescription className="flex items-center gap-1">
                      <Info className="h-3.5 w-3.5" /> {charger.evseId}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="bg-white pt-6">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-center py-6">
                        {!charger.isRealTime ? (
                          <div className="flex flex-col items-center">
                            <Battery className="h-20 w-20 text-gray-400" />
                            <p className="mt-2 text-sm text-gray-600">Unbekannt</p>
                          </div>
                        ) : charger.status.toLowerCase() === "charging" ? (
                          <div className="flex flex-col items-center">
                            <BatteryCharging className="h-20 w-20 text-[#0a2158] animate-pulse" />
                            <p className="mt-2 text-sm text-gray-600">Besetzt</p>
                          </div>
                        ) : charger.status.toLowerCase() === "available" ? (
                          <div className="flex flex-col items-center">
                            <BatteryFull className="h-20 w-20 text-green-500" />
                            <p className="mt-2 text-sm text-gray-600">Verfügbar</p>
                          </div>
                        ) : charger.status.toLowerCase() === "error" ? (
                          <div className="flex flex-col items-center">
                            <AlertTriangle className="h-20 w-20 text-red-500" />
                            <p className="mt-2 text-sm text-red-600">Fehler</p>
                          </div>
                        ) : (
                          <Battery className="h-20 w-20 text-gray-400" />
                        )}
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Steckertyp:</span>
                          <span className="font-medium">{charger.steckertyp || charger.plugType}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Leistung:</span>
                          <span className="font-medium">{charger.leistung || charger.power}</span>
                        </div>
                        {charger.preis && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Preis:</span>
                            <span className="font-medium">{charger.preis}</span>
                          </div>
                        )}
                        {charger.address && (
                          <div className="flex items-start gap-1 mt-2 text-gray-500">
                            <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <span className="text-xs">{charger.address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                  
                  <CardFooter className="flex justify-between bg-white border-t border-gray-100 py-4">
                    <div className="text-xs text-gray-600">
                      <div className="flex flex-col">
                        <span>Zuletzt aktualisiert: {formatDate(charger.lastUpdated)}</span>
                      </div>
                    </div>
                    <div>
                      <a 
                        href={getChargerUrl(charger.evseId)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-[#0a2158] text-[#0a2158] hover:bg-[#0a2158] hover:text-white transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5 mr-1" />
                          Details
                        </Button>
                      </a>
                    </div>
                  </CardFooter>
                </Card>
              ))}
        </div>

        <div className="mt-12 text-center text-sm text-gray-500">
          <p>© {new Date().getFullYear()} AUG. PRIEN Bauunternehmung (GmbH & Co. KG). Alle Rechte vorbehalten.</p>
        </div>
      </div>
    </main>
  )
}
