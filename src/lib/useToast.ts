import {
  ToastActionElement,
  type ToastProps,
} from "@/components/ui/toast"

import {
  useToast as useToastOriginal,
} from "@/hooks/use-toast"

export type ToastVariant = NonNullable<ToastProps["variant"]>

export interface UseToast {
  toast: (props: {
    title?: string
    description?: string
    variant?: ToastVariant
    action?: ToastActionElement
  }) => void
}

export const useToast = (): UseToast => {
  const { toast } = useToastOriginal()

  return {
    toast: ({ title, description, variant, action }) => {
      toast({
        title,
        description,
        variant,
        action,
      })
    },
  }
} 