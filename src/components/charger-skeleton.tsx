import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function ChargerSkeleton() {
  return (
    <Card className="h-full border-0 shadow-md overflow-hidden">
      <CardHeader className="bg-white border-b border-gray-100">
        <div className="flex justify-between items-center">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-24" />
        </div>
        <Skeleton className="h-4 w-40 mt-1" />
      </CardHeader>
      <CardContent className="bg-white pt-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-center py-6">
            <Skeleton className="h-20 w-20 rounded-full" />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex items-start gap-1 mt-2">
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between bg-white border-t border-gray-100 py-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-20" />
      </CardFooter>
    </Card>
  )
}

