import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { RequireAuth, RequireRole } from './auth/guards'
import { LoginPage } from './auth/LoginPage'
import { AppShell } from './layout/AppShell'
import { DutyPage } from './pages/duty/DutyPage'
import { DutySettings } from './pages/duty/DutySettings'
import { HarvestPage } from './pages/harvests/HarvestPage'
import { LotPage } from './pages/lots/LotPage'
import { OrchardsPage } from './pages/manage/OrchardsPage'
import {
  AdditivesPage,
  LossReasonsPage,
  PackagingPage,
  SuppliersPage,
  VarietiesPage,
} from './pages/manage/referenceListPages'
import { UsersPage } from './pages/manage/UsersPage'
import { VesselsPage } from './pages/manage/VesselsPage'
import { ReadyForSalePage } from './pages/ready/ReadyForSalePage'
import { TanksPage } from './pages/tanks/TanksPage'
import { TraceIndex } from './pages/trace/TraceIndex'
import type { ReactNode } from 'react'

const AdminOnly = ({ children }: { children: ReactNode }) => (
  <RequireRole roles={['admin']}>{children}</RequireRole>
)

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
          <Route path="/trace" element={<TraceIndex />} />
          <Route path="/ready-for-sale" element={<ReadyForSalePage />} />
          <Route path="/harvests/:harvestId" element={<HarvestPage />} />
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

          <Route
            path="/manage/orchards"
            element={
              <RequireRole roles={['admin']}>
                <OrchardsPage />
              </RequireRole>
            }
          />
          <Route
            path="/manage/vessels"
            element={
              <RequireRole roles={['admin']}>
                <VesselsPage />
              </RequireRole>
            }
          />
          <Route path="/manage/users" element={<AdminOnly><UsersPage /></AdminOnly>} />
          <Route path="/manage/varieties" element={<AdminOnly><VarietiesPage /></AdminOnly>} />
          <Route path="/manage/additives" element={<AdminOnly><AdditivesPage /></AdminOnly>} />
          <Route path="/manage/suppliers" element={<AdminOnly><SuppliersPage /></AdminOnly>} />
          <Route path="/manage/packaging" element={<AdminOnly><PackagingPage /></AdminOnly>} />
          <Route path="/manage/loss-reasons" element={<AdminOnly><LossReasonsPage /></AdminOnly>} />
        </Route>

        <Route path="*" element={<Navigate to="/tanks" replace />} />
      </Routes>
    </AuthProvider>
  )
}
