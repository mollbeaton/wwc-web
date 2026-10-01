// This is a test-only helper module, not a fast-refreshable component file.
/* oxlint-disable react/only-export-components */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement, ReactNode } from 'react'

/** A QueryClient tuned for tests: no retries (so an error surfaces at once) and
 *  no cache carried between renders. */
function makeTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  })
}

function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={makeTestQueryClient()}>{children}</QueryClientProvider>
}

/** Render a component inside a fresh QueryClientProvider, and return a
 *  user-event instance alongside the usual queries. */
export function renderWithClient(ui: ReactElement, options?: RenderOptions) {
  return { user: userEvent.setup(), ...render(ui, { wrapper: Wrapper, ...options }) }
}
