import { create } from 'zustand'

/** The assistant panel's open state, shared so the phone top bar can open it too. `enabled` is null until the server answers. */
export const useAssistant = create<{ open: boolean; enabled: boolean | null }>(() => ({ open: false, enabled: null }))
export const openAssistant = () => useAssistant.setState({ open: true })
