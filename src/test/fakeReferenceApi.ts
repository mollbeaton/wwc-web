import { vi } from 'vitest'
import type { ChangeLogEntry } from '../api/management'
import type { RefBody, RefItem, ReferenceListApi } from '../api/referenceLists'

/** A stateful in-memory ReferenceListApi for tests: create/retire/restore/remove
 *  mutate a backing array and list() reflects it, so create→invalidate→refetch
 *  flows behave as they do against the real API — no fetch mocking needed. */
export function makeFakeReferenceApi(initial: Partial<RefItem>[] = []): ReferenceListApi & {
  items: () => RefItem[]
} {
  let items: RefItem[] = initial.map((i, n) => ({
    id: i.id ?? `id-${n}`,
    name: i.name ?? `Item ${n}`,
    status: i.status ?? 'active',
    used_count: i.used_count ?? 0,
    ...i,
  }))

  return {
    items: () => items,
    list: vi.fn(async (includeRetired: boolean) =>
      includeRetired ? items : items.filter((i) => i.status === 'active'),
    ),
    create: vi.fn(async (body: RefBody) => {
      const item: RefItem = {
        id: `new-${items.length}`,
        status: 'active',
        used_count: 0,
        name: '',
        ...body,
      } as RefItem
      items = [...items, item]
      return item
    }),
    update: vi.fn(async (id: string, body: RefBody) => {
      items = items.map((i) => (i.id === id ? { ...i, ...body } : i))
      return items.find((i) => i.id === id)!
    }),
    retire: vi.fn(async (id: string) => {
      items = items.map((i) => (i.id === id ? { ...i, status: 'retired' as const } : i))
      return items.find((i) => i.id === id)!
    }),
    restore: vi.fn(async (id: string) => {
      items = items.map((i) => (i.id === id ? { ...i, status: 'active' as const } : i))
      return items.find((i) => i.id === id)!
    }),
    remove: vi.fn(async (id: string) => {
      items = items.filter((i) => i.id !== id)
    }),
    changeLog: vi.fn(async (): Promise<ChangeLogEntry[]> => []),
  }
}
