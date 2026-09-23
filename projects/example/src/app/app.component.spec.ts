import {TestBed} from '@angular/core/testing';
import {AppComponent} from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the count', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('p')?.textContent).toContain('Count: 0');
  });

  it('should update the count through the published library build', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const [increment, decrement] = Array.from(compiled.querySelectorAll('button'));

    increment.click();
    increment.click();
    decrement.click();
    await fixture.whenStable();

    expect(compiled.querySelector('p')?.textContent).toContain('Count: 1');
  });
});
