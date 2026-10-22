import type { QueryClient } from '@tanstack/react-query'

/** After anything that changes Xero state: the Xero page reads under
 *  ['xero'], sales show their Xero chip, and stock shows the sync badge. */
export function invalidateXero(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['xero'] }),
    queryClient.invalidateQueries({ queryKey: ['sales'] }),
    queryClient.invalidateQueries({ queryKey: ['sale'] }),
    queryClient.invalidateQueries({ queryKey: ['stock'] }),
  ])
}
