import { Toaster } from 'sonner'
import { usePhoneLayout } from '../../lib/hooks'
import { useTheme } from '../../lib/theme'
import { useUi } from '../../store/useUi'
import { Button } from './Button'
import { Modal } from './Modal'

/** Confirm dialog and toast stack, mounted once at the root. */
export function Overlays() {
  const req = useUi((s) => s.confirmRequest)
  const theme = useTheme((s) => s.resolved)
  // Toasts move to the top wherever the bottom tab bar is showing.
  const phone = usePhoneLayout()

  return (
    <>
      <Modal
        open={!!req}
        onClose={() => req?.resolve(false)}
        title={req?.title ?? ''}
        description={req?.body}
        size="sm"
        footer={
          <>
            {/* For anything destructive, Enter lands on Cancel so a reflex keypress can't delete. */}
            <Button variant="ghost" onClick={() => req?.resolve(false)} autoFocus={req?.danger}>
              Cancel
            </Button>
            <Button variant={req?.danger ? 'danger' : 'primary'} onClick={() => req?.resolve(true)} autoFocus={!req?.danger}>
              {req?.confirmLabel ?? 'Confirm'}
            </Button>
          </>
        }
      >
        <span className="sr-only">Confirm to continue</span>
      </Modal>

      <Toaster
        theme={theme}
        position={phone ? 'top-center' : 'bottom-right'}
        offset={phone ? 16 : 24}
        gap={10}
        toastOptions={{
          classNames: {
            toast:
              '!rounded-2xl !border !border-line-2 !bg-panel-2/95 !backdrop-blur-xl !text-fg !shadow-[var(--shadow-lg)] !font-sans !text-[13.5px] !gap-2.5',
            description: '!text-muted',
            actionButton: '!bg-aqua !text-aqua-fg !font-semibold !rounded-lg !px-3 !h-7',
            success: '[&_[data-icon]]:!text-aqua',
            error: '[&_[data-icon]]:!text-bad',
          },
        }}
      />
    </>
  )
}
