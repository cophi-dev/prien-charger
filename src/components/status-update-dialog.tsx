"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"

interface StatusUpdateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  charger: {
    evseId: string
    location: string
  }
  onStatusUpdate: (status: string) => void
  currentStatus: string
}

export default function StatusUpdateDialog({
  open,
  onOpenChange,
  charger,
  onStatusUpdate,
  currentStatus,
}: StatusUpdateDialogProps) {
  const [status, setStatus] = useState(currentStatus)
  const [isUpdating, setIsUpdating] = useState(false)

  const handleSubmit = async () => {
    setIsUpdating(true)
    try {
      const response = await fetch("/api/update-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          evseId: charger.evseId,
          status,
        }),
      })

      if (response.ok) {
        onStatusUpdate(status)
        onOpenChange(false)
      } else {
        console.error("Failed to update status")
      }
    } catch (error) {
      console.error("Error updating status:", error)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Status aktualisieren</DialogTitle>
          <DialogDescription>Manuell den Status für {charger.location} aktualisieren</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <RadioGroup value={status} onValueChange={setStatus} className="space-y-3">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="available" id="available" />
              <Label htmlFor="available" className="flex items-center">
                <span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-2"></span>
                Available
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="charging" id="charging" />
              <Label htmlFor="charging" className="flex items-center">
                <span className="inline-block w-3 h-3 rounded-full bg-blue-500 mr-2"></span>
                Occupied
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="maintenance" id="maintenance" />
              <Label htmlFor="maintenance" className="flex items-center">
                <span className="inline-block w-3 h-3 rounded-full bg-amber-500 mr-2"></span>
                Maintenance
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="error" id="error" />
              <Label htmlFor="error" className="flex items-center">
                <span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-2"></span>
                Error
              </Label>
            </div>
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={isUpdating}>
            {isUpdating ? "Aktualisiere..." : "Aktualisieren"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

