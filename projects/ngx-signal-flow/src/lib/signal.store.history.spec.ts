import {createStore} from './signal.store';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {Component} from '@angular/core';

interface TestState {
   count: number;
   total: number;
}

class TestServiceWithStore {
   private state = createStore<TestState>({count: 0, total: 0}, {
      withPatches: true
   });

   public readonly count$ = this.state.source<number>();

   readonly count = this.state.select('count');

   constructor() {
      this.count$.reduce((draft, value) => {
         draft.count = value;
      });
   }

   public undo = this.state.undo.bind(this.state);
   public redo = this.state.redo.bind(this.state);
   public canUndo = this.state.canUndo.bind(this.state);
   public canRedo = this.state.canRedo.bind(this.state);
}

@Component({
   template: ''
})
class TestComponent {
   public readonly service = TestBed.inject(TestServiceWithStore);
   count = this.service.count;

   public next(value: number) {
      this.service.count$(value);
   }

}

describe('State Store Test', () => {
   let fixture: ComponentFixture<TestComponent>;
   beforeEach(() => {
      fixture = TestBed.configureTestingModule({
         declarations: [TestComponent],
         providers: [TestServiceWithStore]
      }).createComponent(TestComponent);
   });

   it('should initialize state', () => {
      const component = fixture.componentInstance;
      expect(component.count()).toBe(0);

      component.next(1);
      fixture.detectChanges();
      expect(component.count()).toBe(1);
   });

   it('should undo state', () => {
      const component = fixture.componentInstance;
      component.next(1);
      fixture.detectChanges();
      expect(component.count()).toBe(1);
      component.service.undo();
      fixture.detectChanges();
      expect(component.count()).toBe(0);
   });

   it('should redo state', () => {
      const component = fixture.componentInstance;
      component.next(1);
      fixture.detectChanges();
      expect(component.count()).toBe(1);
      component.service.undo();
      fixture.detectChanges();
      expect(component.count()).toBe(0);
      component.service.redo();
      fixture.detectChanges();
      expect(component.count()).toBe(1);
   });

   it('should not undo state', () => {
      const component = fixture.componentInstance;
      component.service.undo();
      fixture.detectChanges();
      expect(component.count()).toBe(0);
   });

   it('should not redo state', () => {
      const component = fixture.componentInstance;
      component.service.redo();
      fixture.detectChanges();
      expect(component.count()).toBe(0);
   });

   it('should override redo after undo', () => {
      const component = fixture.componentInstance;
      expect(component.count()).toBe(0);
      component.next(1);
      expect(component.count()).toBe(1);
      component.next(2);
      expect(component.count()).toBe(2);
      component.next(3);
      expect(component.count()).toBe(3);
      component.service.undo();
      expect(component.count()).toBe(2);
      component.service.redo();
      expect(component.count()).toBe(3);
      component.service.undo();
      component.service.undo();
      expect(component.count()).toBe(1);
      component.next(4);
      component.next(5);
      expect(component.count()).toBe(5);
      component.service.redo();
      expect(component.count()).toBe(5)
      component.service.undo();
      expect(component.count()).toBe(4);
      component.service.undo()
      expect(component.count()).toBe(1);
   });

});
