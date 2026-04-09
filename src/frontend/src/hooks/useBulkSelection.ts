/**
 * useBulkSelection.ts
 *
 * Custom hook for managing bulk image selection state.
 * Uses a Set<number> of image IDs to track selections.
 * Selection persists across pagination pages.
 */

import { useState, useCallback } from "react";

export interface BulkSelectionState {
  selectedIds: Set<number>;
  isSelected: (id: number) => boolean;
  toggleSelection: (id: number) => void;
  selectAll: (ids: number[]) => void;
  selectNone: () => void;
  selectRange: (ids: number[], fromId: number, toId: number) => void;
  selectedCount: number;
  hasSelection: boolean;
}

export function useBulkSelection(): BulkSelectionState {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const isSelected = useCallback(
    (id: number) => selectedIds.has(id),
    [selectedIds]
  );

  const toggleSelection = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: number[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectNone = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  /**
   * Range selection: selects all images between fromId and toId in the provided
   * ordered ids array (inclusive). Adds to existing selection.
   */
  const selectRange = useCallback((ids: number[], fromId: number, toId: number) => {
    const fromIndex = ids.indexOf(fromId);
    const toIndex = ids.indexOf(toId);
    if (fromIndex === -1 || toIndex === -1) return;

    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);

    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (let i = start; i <= end; i++) {
        next.add(ids[i]);
      }
      return next;
    });
  }, []);

  return {
    selectedIds,
    isSelected,
    toggleSelection,
    selectAll,
    selectNone,
    selectRange,
    selectedCount: selectedIds.size,
    hasSelection: selectedIds.size > 0,
  };
}
