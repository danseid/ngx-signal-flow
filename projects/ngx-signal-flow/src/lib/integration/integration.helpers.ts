import {provideZonelessChangeDetection} from '@angular/core';
import type {EnvironmentProviders, Provider} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import type {ComponentFixture} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';

export const configureIntegrationTestBed = (...providers: (Provider | EnvironmentProviders)[]) => {
   TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(), ...providers]
   });
};

export const httpTesting = () => TestBed.inject(HttpTestingController);

export const expectRequest = (url: string, params: Record<string, string | number> = {}) =>
   httpTesting().expectOne(request =>
      request.url === url
      && Object.entries(params).every(([key, value]) => request.params.get(key) === String(value))
   );

const host = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;

export const textOf = (fixture: ComponentFixture<unknown>, selector: string) =>
   host(fixture).querySelector(selector)?.textContent?.trim();

export const textsOf = (fixture: ComponentFixture<unknown>, selector: string) =>
   Array.from(host(fixture).querySelectorAll(selector)).map(element => element.textContent?.trim());

export const buttonOf = (fixture: ComponentFixture<unknown>, selector: string) =>
   host(fixture).querySelector<HTMLButtonElement>(selector)!;

export const click = (fixture: ComponentFixture<unknown>, selector: string) => buttonOf(fixture, selector).click();

export const typeInto = (fixture: ComponentFixture<unknown>, selector: string, value: string) => {
   const field = host(fixture).querySelector<HTMLInputElement>(selector)!;
   field.value = value;
   field.dispatchEvent(new Event('input'));
};

export const renderComponent = async <T>(component: new (...args: any[]) => T) => {
   const fixture = TestBed.createComponent(component);
   await fixture.whenStable();
   return fixture;
};
