import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return <div className="relative w-full" data-slot="native-select-wrapper">
    <select data-slot="native-select" className={cn('h-9 w-full min-w-0 appearance-none rounded-md border border-input bg-background px-3 py-1 pr-8 text-sm shadow-xs outline-none disabled:opacity-50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50', className)} {...props} />
    <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
  </div>
}
