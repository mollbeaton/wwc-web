// Shared API types. These mirror wwc-api's Pydantic schemas; keep them in step
// with the server rather than letting them drift.

// `seller` sits outside the viewer < cellar < admin ranking: they work the
// Stock pages (sales, transfers, stock takes) but not the cellar or duty ones.
export type Role = 'admin' | 'cellar' | 'viewer' | 'seller'

export interface CurrentUser {
  id: string
  email: string
  role: Role
}

export interface TokenResponse {
  access_token: string
  token_type: string
}
