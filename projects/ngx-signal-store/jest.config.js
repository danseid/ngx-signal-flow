module.exports = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  globalSetup: 'jest-preset-angular/global-setup',
  roots: ['src'],
 // setupFilesAfterEnv: ['<rootDir>/src/setup-jest.ts'],
  // ... other configurations ...
};
