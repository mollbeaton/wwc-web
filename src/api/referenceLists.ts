import { api } from './client'
import type { ChangeLogEntry } from './management'

/** A row of any managed reference list: the shared fields plus list-specific
 *  ones (typed loosely, since one factory serves all five). */
export interface RefItem {
  id: string
  name: string
  status: 'active' | 'retired'
  used_count: number
  [key: string]: unknown
}

export type RefBody = Record<string, unknown>

export interface ReferenceListApi {
  list: (includeRetired: boolean) => Promise<RefItem[]>
  create: (body: RefBody) => Promise<RefItem>
  update: (id: string, body: RefBody) => Promise<RefItem>
  retire: (id: string) => Promise<RefItem>
  restore: (id: string) => Promise<RefItem>
  remove: (id: string) => Promise<void>
  changeLog: (id: string) => Promise<ChangeLogEntry[]>
}

export function makeReferenceListApi(prefix: string): ReferenceListApi {
  return {
    list: (includeRetired) => api.get<RefItem[]>(`${prefix}?include_retired=${includeRetired}`),
    create: (body) => api.post<RefItem>(prefix, body),
    update: (id, body) => api.patch<RefItem>(`${prefix}/${id}`, body),
    retire: (id) => api.post<RefItem>(`${prefix}/${id}/retire`),
    restore: (id) => api.post<RefItem>(`${prefix}/${id}/restore`),
    remove: (id) => api.del<void>(`${prefix}/${id}`),
    changeLog: (id) => api.get<ChangeLogEntry[]>(`${prefix}/${id}/change-log`),
  }
}
