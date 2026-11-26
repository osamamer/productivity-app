import { setupServer } from 'msw/node';

export const API = 'http://api.test';

/** The HTTP boundary for component tests: each test registers the responses it needs. */
export const server = setupServer();
