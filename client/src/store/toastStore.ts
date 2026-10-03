import { create } from "zustand";

export type ToastTone = "info" | "success" | "warning";
export interface Toast { id: number; message: string; tone: ToastTone }

interface ToastState {
  toasts: Toast[];
  push: (message: string, tone?: ToastTone) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],
  push: (message, tone = "info") => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, message, tone }] })); // keep at most 4 on screen
    setTimeout(() => get().dismiss(id), 4500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = (message: string, tone: ToastTone = "info") => useToastStore.getState().push(message, tone);
