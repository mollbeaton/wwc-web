import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { RequireAuth, RequireRole } from './auth/guards'
import { LoginPage } from './auth/LoginPage'
import { AppShell } from './layout/AppShell'
import { DutyPage } from './pages/duty/DutyPage'
import { DutySettings } from './pages/duty/DutySettings'
import { LotPage } from './pages/lots/LotPage'
import { Placeholder } from './pages/Placeholder'
import { TanksPage } from './pages/tanks/TanksPage'

const MANAGE_LISTS: { path: string; title: string; subtitle: string }[] = [
  { path: 'users', title: 'Users', subtitle: 'Who can sign in, and what they can do' },
  { path: 'orchards', title: 'Orchards', subtitle: 'Where the fruit is grown' },
  { path: 'varieties', title: 'Varieties', subtitle: 'Apple and grape varieties' },
  { path: 'additives', title: 'Additives', subtitle: 'What can be added to a lot' },
  { path: 'suppliers', title: 'Suppliers & canners', subtitle: 'Bought-in juice and canning partners' },
  { path: 'packaging', title: 'Packaging', subtitle: 'Bottle, can and bag formats' },
  { path: 'loss-reasons', title: 'Loss reasons', subtitle: 'Why volume left a lot' },
  { path: 'vessels', title: 'Vessels', subtitle: 'Tanks, barrels and other vessels' },
]

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/tanks" replace />} />
          <Route path="/tanks" element={<TanksPage />} />
          <Route path="/lots/:lotId" element={<LotPage />} />
          <Route
            path="/trace"
            element={<Placeholder title="Trace" subtitle="What went into this, and where it went" spec="WD-11 to WD-16" />}
          />
          <Route
            path="/duty"
            element={
              <RequireRole roles={['admin', 'viewer']}>
                <DutyPage />
              </RequireRole>
            }
          />
          <Route
            path="/duty-settings"
            element={
              <RequireRole roles={['admin']}>
                <DutySettings />
              </RequireRole>
            }
          />

          {MANAGE_LISTS.map((list) => (
            <Route
              key={list.path}
              path={`/manage/${list.path}`}
              element={
                <RequireRole roles={['admin']}>
                  <Placeholder title={list.title} subtitle={list.subtitle} spec="WD-29 to WD-38" />
                </RequireRole>
              }
            />
          ))}
        </Route>

        <Route path="*" element={<Navigate to="/tanks" replace />} />
      </Routes>
    </AuthProvider>
  )
}
