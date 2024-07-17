import {Patch} from "immer";

export interface PatchHistory {
   canUndo(): boolean;
   canRedo(): boolean;
   undo: () => Patch[];
   redo: () => Patch[];
   addPatches: (patch: Patch[], inversePatch: Patch[]) => void;
}

export const createPatchHistory = (): PatchHistory => {
   let patches: Patch[][] = [];
   let inversePatches: Patch[][] = [];
   const index = {current: -1};

   const addPatches = (patch: Patch[], inversePatch: Patch[]) => {
      patches = patches.slice(0, index.current + 1);
      inversePatches = inversePatches.slice(0, index.current + 1);
      patches.push(patch);
      inversePatches.push(inversePatch);
      index.current++;
   }

   const canUndo = () => {
      return index.current >= 0;
   }

   const canRedo = () => {
      return index.current < patches.length - 1;
   }

   const undo = () => {
      if(canUndo()) {
         index.current--;
         return inversePatches[index.current + 1];
      }
      return [] as Patch[];
   }

   const redo = () => {
      if(canRedo()) {
         index.current++;
         return patches[index.current];
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
