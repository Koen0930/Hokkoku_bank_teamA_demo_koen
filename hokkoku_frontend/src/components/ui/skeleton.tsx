import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-neutral-200/50 bg-shimmer-gradient bg-[length:200%_100%] animate-shimmer",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
