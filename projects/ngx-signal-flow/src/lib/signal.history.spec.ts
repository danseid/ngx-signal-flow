import {createPatchHistory} from "./signal.history";
import {applyPatches, enablePatches, produceWithPatches} from "immer";

enablePatches()

describe('Signal History', () => {

   let baseState: {count: number};

   beforeEach(() => {
      baseState = {count: 0};
   });

   it('should initialize history', () => {
      const history = createPatchHistory();
      expect(history.canUndo()).toBe(false);
      expect(history.canRedo()).toBe(false);
   });

   it('should add patches to history', () => {
      const history = createPatchHistory();
      const [newState, patches, inversePatches] = produceWithPatches(baseState, draft => {
         draft.count = 1;
      })
      history.addPatches(patches, inversePatches);
      expect(newState.count).toBe(1);
      expect(history.canUndo()).toBe(true);
      expect(history.canRedo()).toBe(false);
   });

   it('should undo patches', () => {
      const history = createPatchHistory();
      const [newState, patches, inversePatches] = produceWithPatches(baseState, draft => {
         draft.count = 1;
      })
      history.addPatches(patches, inversePatches);
      expect(history.undo()).toBe(inversePatches);
      expect(history.canUndo()).toBe(false);
      expect(history.canRedo()).toBe(true);
   });

   it('should redo patches', () => {
      const history = createPatchHistory();
      const [newState, patches, inversePatches] = produceWithPatches(baseState, draft => {
         draft.count = 1;
      })
      history.addPatches(patches, inversePatches);
      history.undo();
      expect(history.redo()).toBe(patches);
      expect(history.canUndo()).toBe(true);
      expect(history.canRedo()).toBe(false);
   });

   it('should undo more than one time', () => {
      let state = baseState;
      const history = createPatchHistory();
      const [firstState, patches, inversePatches] = produceWithPatches(baseState, draft => {
         draft.count = 1;
      })
      history.addPatches(patches, inversePatches);
      const [secondState, patches2, inversePatches2] = produceWithPatches(firstState, draft => {
         draft.count = 2;
      })
      history.addPatches(patches2, inversePatches2);
      expect(history.canUndo()).toBe(true);
      expect(history.canRedo()).toBe(false);
      expect(secondState.count).toBe(2);

      expect(history.undo()).toBe(inversePatches2);
      state = applyPatches(state, inversePatches2);
      expect(history.canUndo()).toBe(true);
      expect(history.canRedo()).toBe(true);
      expect(state.count).toBe(1);

      expect(history.undo()).toBe(inversePatches);
      state = applyPatches(state, inversePatches);
      expect(history.canUndo()).toBe(false);
      expect(history.canRedo()).toBe(true);
      expect(state.count).toBe(0);

      expect(history.redo()).toBe(patches);
      state = applyPatches(state, patches);
      expect(history.canUndo()).toBe(true);
      expect(history.canRedo()).toBe(true);
      expect(state.count).toBe(1);

      expect(history.redo()).toBe(patches2);
      state = applyPatches(state, patches2);
      expect(history.canUndo()).toBe(true);
      expect(history.canRedo()).toBe(false);
      expect(state.count).toBe(2);
   });

   it('should override further patches when new patch is added', () => {
      let state = baseState;
      const history = createPatchHistory();
      const [newState, patches, inversePatches] = produceWithPatches(baseState, draft => {
         draft.count = 1;
      })
      history.addPatches(patches, inversePatches);
      const [newState2, patches2, inversePatches2] = produceWithPatches(newState, draft => {
         draft.count = 2;
      })
      history.addPatches(patches2, inversePatches2);
      expect(history.undo()).toBe(inversePatches2);
      state = applyPatches(state, inversePatches2);
      expect(state.count).toBe(1);

      const [newState3, patches3, inversePatches3] = produceWithPatches(state, draft => {
         draft.count = 3;
      })

      history.addPatches(patches3, inversePatches3);
      expect(history.undo()).toEqual(inversePatches3);
      expect(history.redo()).toEqual(patches3);
      expect(history.redo()).toEqual([]);
      expect(history.undo()).toEqual(inversePatches3);
      expect(history.undo()).toEqual(inversePatches);
      expect(history.redo()).toEqual(patches);
      expect(history.redo()).toEqual(patches3);
   });


   it('should not undo when no patches', () => {
      const history = createPatchHistory();
      expect(history.undo()).toEqual([]);
   });

   it('should not redo when no patches', () => {
      const history = createPatchHistory();
      expect(history.redo()).toEqual([]);
   });



});
