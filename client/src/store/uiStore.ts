import { create } from "zustand";

/**
 * Small, purely visual settings that more than one component needs.
 * `theater` = wide-player layout: the player takes the full page width and the side panels
 * (chat, participants, invite) move underneath it. It is personal: it is never sent to the server.
 */
interface UiState {
  theater: boolean;
  toggleTheater: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  theater: false,
  toggleTheater: () => set((s) => ({ theater: !s.theater })),
}));
