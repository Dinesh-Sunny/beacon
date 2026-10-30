// Adapted from shadcn/ui (MIT): apps/v4/registry/bases/radix/blocks/preview. Regenerate with the design-system skill.
"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { Copy01Icon, AlertCircleIcon, Delete02Icon, Share03Icon, ShoppingBag01Icon, MoreHorizontalCircle01Icon, Loading03Icon, PlusSignIcon, MinusSignIcon, ArrowLeft02Icon, ArrowRight02Icon, Tick02Icon, ArrowDown01Icon, ArrowRight01Icon, Search01Icon, Settings01Icon } from "@hugeicons/core-free-icons"

import { Card, CardContent } from "@/components/ui/card"

const PREVIEW_ICONS = [Copy01Icon, AlertCircleIcon, Delete02Icon, Share03Icon, ShoppingBag01Icon, MoreHorizontalCircle01Icon, Loading03Icon, PlusSignIcon, MinusSignIcon, ArrowLeft02Icon, ArrowRight02Icon, Tick02Icon, ArrowDown01Icon, ArrowRight01Icon, Search01Icon, Settings01Icon]

export function IconPreviewGrid() {
  return (
    <Card>
      <CardContent>
        <div className="grid grid-cols-8 place-items-center gap-4">
          {PREVIEW_ICONS.map((icon, index) => (
            <div
              key={index}
              className="flex size-8 items-center justify-center rounded-md ring ring-border *:[svg]:size-4"
            >
              <HugeiconsIcon icon={icon} strokeWidth={2} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
