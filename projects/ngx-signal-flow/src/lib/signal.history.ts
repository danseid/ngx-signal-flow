import type {Patch} from 'immer';

export interface PatchHistory {
  canUndo(): boolean;
  canRedo(): boolean;
  undo: () => Patch[];
  redo: () => Patch[];
  addPatches: (patch: Patch[], inversePatch: Patch[]) => void;
}

type PatchEntry = {
  patches: Patch[];
  inversePatches: Patch[];
};

/**
 * Keeps up to `limit` entries in a ring buffer, so adding an entry stays O(1) once the limit is reached.
 */
export const createPatchHistory = (limit = Number.POSITIVE_INFINITY): PatchHistory => {
  const capacity = Number.isFinite(limit) ? Math.max(0, Math.trunc(limit)) : Number.POSITIVE_INFINITY;
  const entries: (PatchEntry | undefined)[] = [];
  let oldest = 0;
  let size = 0;
  let applied = 0;

  const slot = (offset: number) => (oldest + offset) % capacity;

  /**
   * Slots for offsets below `size` always hold an entry.
   */
  const storedEntry = (offset: number) => entries[slot(offset)] as PatchEntry;

  const discardRedoEntries = () => {
    for (let offset = applied; offset < size; offset++) {
      entries[slot(offset)] = undefined;
    }
    size = applied;
  };

  const discardOldestEntry = () => {
    entries[oldest] = undefined;
    oldest = slot(1);
    size--;
  };

  const addPatches = (patches: Patch[], inversePatches: Patch[]) => {
    if (patches.length === 0 || capacity === 0) {
      return;
    }

    discardRedoEntries();
    if (size === capacity) {
      discardOldestEntry();
    }
    entries[slot(size)] = {patches, inversePatches};
    size++;
    applied = size;
  };

  const canUndo = () => applied > 0;

  const canRedo = () => applied < size;

  const undo = (): Patch[] => {
    if (!canUndo()) {
      return [];
    }
    applied--;
    return storedEntry(applied).inversePatches;
  };

  const redo = (): Patch[] => {
    if (!canRedo()) {
      return [];
    }
    const {patches} = storedEntry(applied);
    applied++;
    return patches;
  };

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    addPatches,
  };
};
