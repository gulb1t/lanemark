import { toast as sonner } from 'sonner'
import { create } from 'zustand'
import { changedIds, useStore } from './useStore'

export interface ConfirmRequest {
  title: string
  body?: string
  confirmLabel?: string
  danger?: boolean
}

export type GlobalDialog = 'newClass' | 'newSwimmer' | null

interface UiState {
  confirmRequest: (ConfirmRequest & { resolve: (ok: boolean) => void }) | null
  paletteOpen: boolean
  dialog: GlobalDialog
  /** Level to preselect when the new-class dialog opens. */
  presetLevelId: string | null
}

export const useUi = create<UiState>(() => ({ confirmRequest: null, paletteOpen: false, dialog: null, presetLevelId: null }))

export const openDialog = (dialog: GlobalDialog, presetLevelId: string | null = null) => useUi.setState({ dialog, paletteOpen: false, presetLevelId })
export const setPaletteOpen = (paletteOpen: boolean) => useUi.setState({ paletteOpen })

/** Promise-based confirmation: `if (await confirm({ title: 'Delete?' })) …` */
export function confirm(req: ConfirmRequest): Promise<boolean> {
  return new Promise((resolve) => {
    useUi.getState().confirmRequest?.resolve(false)
    useUi.setState({
      confirmRequest: {
        ...req,
        resolve: (ok) => {
          useUi.setState({ confirmRequest: null })
          resolve(ok)
        },
      },
    })
  })
}

export function toast(message: string, tone: 'default' | 'error' = 'default') {
  if (tone === 'error') sonner.error(message)
  else sonner.success(message)
}

/**
 * Runs an edit and offers to undo it. Only the documents the edit touched are rolled back, so anything else
 * changed in the meantime survives.
 */
export function withUndo(message: string, edit: () => void) {
  const pick = () => {
    const { swimmers, classes } = useStore.getState()
    return { swimmers, classes }
  }
  const before = pick()
  edit()
  const ids = changedIds(before, pick())
  if (!ids.classes.length && !ids.swimmers.length) return
  sonner(message, {
    duration: 7000,
    action: {
      label: 'Undo',
      onClick: () => {
        useStore.getState().restore(before, ids)
        sonner.success('Restored')
      },
    },
  })
}
