// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// Zustand cart store — replaces CartContext with selector-based re-renders.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Synchronous localStorage reader for instant hydration
function readCartFromStorage() {
  try {
    const raw = localStorage.getItem('pcl-cart');
    if (!raw) return [];
    const data = JSON.parse(raw);
    return data?.state?.items || data?.items || [];
  } catch { return []; }
}

// Backward-compatible hook that matches old CartContext API
export const useCart = () => {
  const items = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQty = useCartStore((s) => s.updateQty);
  const clearCart = useCartStore((s) => s.clearCart);
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  return { items, addItem, removeItem, updateQty, clearCart, total, count };
};

// Pre-hydrate the store synchronously from localStorage
const initialItems = readCartFromStorage();

export const useCartStore = create(
  persist(
    (set, get) => ({
      // State — initialize from localStorage synchronously
      items: initialItems,

      // Actions
      addItem: (product, quantity = 1) => {
        set((state) => {
          const existing = state.items.find((i) => i._id === product._id);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i._id === product._id
                  ? { ...i, quantity: i.quantity + quantity }
                  : i
              ),
            };
          }
          return { items: [...state.items, { ...product, quantity }] };
        });
      },

      removeItem: (id) => {
        set((state) => ({
          items: state.items.filter((i) => i._id !== id),
        }));
      },

      updateQty: (id, quantity) => {
        if (quantity < 1) {
          get().removeItem(id);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i._id === id ? { ...i, quantity } : i
          ),
        }));
      },

      clearCart: () => set({ items: [] }),

      // Selectors (for convenience)
      getTotal: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      getCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    {
      name: 'pcl-cart',
      storage: createJSONStorage(() => localStorage),
    }
  )
);


