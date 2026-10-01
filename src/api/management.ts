import { api } from './client'

export interface ChangeLogEntry {
  id: string
  action: string
  field: string | null
  before_value: string | null
  after_value: string | null
  changed_by_email: string | null
  changed_at: string
}

export interface User {
  id: string
  email: string
  name: string | null
  role: 'admin' | 'cellar' | 'viewer'
  status: 'active' | 'deactivated'
  last_sign_in_at: string | null
}

export interface UserCreateInput {
  email: string
  name?: string | null
  role: string
  password: string
}

export const usersApi = {
  list: () => api.get<User[]>('/users'),
  create: (body: UserCreateInput) => api.post<User>('/users', body),
  update: (id: string, body: { name?: string | null; role?: string }) =>
    api.patch<User>(`/users/${id}`, body),
  deactivate: (id: string) => api.post<User>(`/users/${id}/deactivate`),
  reactivate: (id: string) => api.post<User>(`/users/${id}/reactivate`),
  changeLog: (id: string) => api.get<ChangeLogEntry[]>(`/users/${id}/change-log`),
}
