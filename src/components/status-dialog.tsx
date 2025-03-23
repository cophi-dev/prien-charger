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

interface StatusDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  charger: {
    evseId: string
    location: string
  }
  onStatusUpdate: (status: string) => void
  currentStatus: string
}

export default function StatusDialog({
  open,
  onOpenChange,
  charger,
  onStatusUpdate,
  currentStatus,
}: StatusDialogProps) {
  const [status, setStatus] = useState(currentStatus)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setStatus(currentStatus)
      setError(null)
    }
    onOpenChange(open)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsUpdating(true)
    
    try {
      const response = await fetch("/api/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evseId: charger.evseId,
          status: status,
        }),
      })
      
      if (!response.ok) {
        throw new Error(`Failed to update status: ${response.statusText}`)
      }
      
      // Successfully updated
      onStatusUpdate(status)
      onOpenChange(false)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      setError(errorMessage)
      console.error("Error updating status:", errorMessage)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Update Charger Status</DialogTitle>
          <DialogDescription>Manually update the status for {charger.location}</DialogDescription>
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
          
          {error && (
            <div className="mt-4 text-sm text-red-500">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isUpdating}>
            {isUpdating ? "Updating..." : "Update"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

