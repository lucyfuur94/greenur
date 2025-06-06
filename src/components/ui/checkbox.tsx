import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-5 w-5 shrink-0 rounded-sm border border-gray-300 bg-white shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#17A34A] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[#17A34A] data-[state=checked]:border-[#17A34A] relative",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className="absolute inset-0 flex items-center justify-center"
    >
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="16" 
        height="16" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="white" 
        strokeWidth="3" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }