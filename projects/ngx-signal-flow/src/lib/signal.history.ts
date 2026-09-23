import type {Patch} from "immer";

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
}

export const createPatchHistory = (limit = Number.POSITIVE_INFINITY): PatchHistory => {
   const entries: PatchEntry[] = [];
   const maximumEntries = Number.isFinite(limit) ? Math.max(0, Math.trunc(limit)) : Number.POSITIVE_INFINITY;
   let index = -1;

   const addPatches = (patches: Patch[], inversePatches: Patch[]) => {
      if (patches.length === 0 || maximumEntries === 0) {
         return;
      }

      entries.length = index + 1;
      entries.push({patches, inversePatches});

      if (entries.length > maximumEntries) {
         entries.splice(0, entries.length - maximumEntries);
      }

      index = entries.length - 1;
   }

   const canUndo = () => {
      return index >= 0;
   }

   const canRedo = () => {
      return index < entries.length - 1;
   }

   const undo = () => {
      if(canUndo()) {
         return entries[index--].inversePatches;
      }
      return [] as Patch[];
   }

   const redo = () => {
      if(canRedo()) {
         return entries[++index].patches;
      }
      return [] as Patch[];
   }

   return {
      canUndo,
      canRedo,
      undo,
      redo,
      addPatches
   }

}
