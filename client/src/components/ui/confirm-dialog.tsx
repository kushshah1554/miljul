import { AlertDialog } from "radix-ui"
import { create } from "zustand"

import { Button } from "@/components/ui/button"

type ConfirmOptions = {
  title: string
  description?: string
  confirmText?: string
  destructive?: boolean
}

type ConfirmState = {
  options: ConfirmOptions | null
  resolve: ((ok: boolean) => void) | null
}

const useConfirmStore = create<ConfirmState>(() => ({ options: null, resolve: null }))

// Drop-in replacement for window.confirm: `if (await confirm({ title })) ...`
export function confirm(options: ConfirmOptions): Promise<boolean> {
  useConfirmStore.getState().resolve?.(false)
  return new Promise((resolve) => useConfirmStore.setState({ options, resolve }))
}

function settle(ok: boolean) {
  useConfirmStore.getState().resolve?.(ok)
  useConfirmStore.setState({ options: null, resolve: null })
}

// Mounted once in App
export function ConfirmDialog() {
  const options = useConfirmStore((s) => s.options)

  return (
    <AlertDialog.Root open={!!options} onOpenChange={(open) => !open && settle(false)}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/10 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-3xl bg-popover p-5 text-sm text-popover-foreground shadow-lg data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95">
          <div className="space-y-1">
            <AlertDialog.Title className="text-base font-medium text-foreground">
              {options?.title}
            </AlertDialog.Title>
            <AlertDialog.Description className="text-muted-foreground">
              {options?.description}
            </AlertDialog.Description>
          </div>
          <div className="flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="outline">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                variant={options?.destructive ? "destructive" : "default"}
                onClick={() => settle(true)}
              >
                {options?.confirmText ?? "Confirm"}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
