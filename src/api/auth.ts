import { api, tokenStore } from './client'
import type { CurrentUser, TokenResponse } from './types'

export async function login(email: string, password: string): Promise<void> {
  const res = await api.post<TokenResponse>('/auth/login', { email, password }, { auth: false })
  tokenStore.set(res.access_token)
}

export function fetchCurrentUser(): Promise<CurrentUser> {
  return api.get<CurrentUser>('/auth/me')
}
