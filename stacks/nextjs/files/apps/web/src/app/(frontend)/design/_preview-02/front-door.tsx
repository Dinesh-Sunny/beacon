// Adapted from shadcn/ui (MIT): apps/v4/registry/bases/radix/blocks/preview-02. Regenerate with the design-system skill.
import { HugeiconsIcon } from "@hugeicons/react"
import { SquareLock02Icon } from "@hugeicons/core-free-icons"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function FrontDoor() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Front Door</CardTitle>
        <CardDescription>Smart Lock Pro</CardDescription>
        <CardAction>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            Locked
            <HugeiconsIcon icon={SquareLock02Icon} strokeWidth={2} className="size-4" />
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-muted bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,var(--border)_10px,var(--border)_11px)]">
          <Badge variant="destructive" className="absolute top-2 right-2">
            Live
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
