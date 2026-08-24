import { cn } from "@workspace/ui/lib/utils"

import { BRAND_META, type BrandId } from "@/features/app-shell/brands.ts"

type Props = {
  brand: BrandId
  className?: string
  title?: string
}

/** Official product logos served from /public/brands. */
export function BrandIcon({ brand, className, title }: Props) {
  const meta = BRAND_META[brand]
  return (
    <img
      src={meta.src}
      alt={title ?? meta.label}
      className={cn("size-full object-contain", className)}
      draggable={false}
    />
  )
}
