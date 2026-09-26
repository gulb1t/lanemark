import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { Drawer } from 'vaul'
import { useIsMobile } from '../../lib/hooks'
import { IconButton } from './Button'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  children: ReactNode
  footer?: ReactNode
}

const WIDTH = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

/**
 * A centred dialog on desktop and a draggable bottom sheet on phones. The desktop version is a native <dialog>,
 * which gives focus trapping, Esc and an inert background for free.
 */
export function Modal(props: Props) {
  const mobile = useIsMobile()
  return mobile ? <Sheet {...props} /> : <DesktopDialog {...props} />
}

function Header({ title, description, onClose }: Pick<Props, 'title' | 'description' | 'onClose'>) {
  return (
    <header className="flex items-start justify-between gap-4 px-5 pb-3 pt-4">
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-1 text-[13px] leading-relaxed text-muted">{description}</p>}
      </div>
      <IconButton label="Close" onClick={onClose} className="-mr-2 -mt-1">
        <X size={17} />
      </IconButton>
    </header>
  )
}

function DesktopDialog({ open, onClose, title, description, size = 'md', children, footer }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`m-auto w-[calc(100%-2rem)] ${WIDTH[size]} max-h-[88dvh] overflow-hidden rounded-3xl border border-line-2 bg-panel p-0 text-fg shadow-[var(--shadow-lg)] open:flex open:flex-col`}
    >
      {open && (
        <>
          <Header title={title} description={description} onClose={onClose} />
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-1">{children}</div>
          {footer && <footer className="flex items-center justify-end gap-2 border-t border-line bg-panel-2/60 px-5 py-3">{footer}</footer>}
        </>
      )}
    </dialog>
  )
}

function Sheet({ open, onClose, title, description, children, footer }: Props) {
  return (
    <Drawer.Root open={open} onOpenChange={(o) => !o && onClose()} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[3px]" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[28px] border-t border-line-2 bg-panel text-fg outline-none">
          <div className="mx-auto mt-2.5 h-1.5 w-11 shrink-0 rounded-full bg-fg/15" aria-hidden />
          <Drawer.Title className="sr-only">{title}</Drawer.Title>
          {description && <Drawer.Description className="sr-only">{description}</Drawer.Description>}
          <Header title={title} description={description} onClose={onClose} />
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-1">{children}</div>
          {footer && (
            <footer className="flex items-center justify-end gap-2 border-t border-line px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {footer}
            </footer>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
