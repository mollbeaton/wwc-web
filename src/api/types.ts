// Shared API types. These mirror wwc-api's Pydantic schemas; keep them in step
// with the server rather than letting them drift.

export type Role = 'admin' | 'cellar' | 'viewer'

export interface CurrentUser {
  id: string
  email: string
  role: Role
}

export interface TokenResponse {
  access_token: string
  token_type: string
}
