import '@testing-library/jest-dom';

// jsdom doesn't implement URL.createObjectURL / revokeObjectURL
global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-object-url');
global.URL.revokeObjectURL = vi.fn();

// Suppress noisy React act() warnings in tests that don't need them
global.IS_REACT_ACT_ENVIRONMENT = true;
