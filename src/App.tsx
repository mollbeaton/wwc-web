import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { HomeRedirect, RequireAuth, RequireRole } from './auth/guards'
import { LoginPage } from './auth/LoginPage'
import { AppShell } from './layout/AppShell'
import { DutyPage } from './pages/duty/DutyPage'
import { DutySettings } from './pages/duty/DutySettings'
import { HarvestPage } from './pages/harvests/HarvestPage'
import { KegsPage } from './pages/kegs/KegsPage'
import { LotPage } from './pages/lots/LotPage'
import { CustomersPage } from './pages/manage/CustomersPage'
import { LocationsPage } from './pages/manage/LocationsPage'
import { OrchardsPage } from './pages/manage/OrchardsPage'
import { PriceListsPage } from './pages/manage/PriceListsPage'
import { ProductsPage } from './pages/manage/ProductsPage'
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
import { SaleDetailPage } from './pages/sales/SaleDetailPage'
import { SalesPage } from './pages/sales/SalesPage'
import { CloseOutPage } from './pages/stock/CloseOutPage'
import { EventsPage } from './pages/stock/EventsPage'
import { StockPage } from './pages/stock/StockPage'
import { StockTakePage } from './pages/stock/StockTakePage'
import { TransfersPage } from './pages/stock/TransfersPage'
import { TanksPage } from './pages/tanks/TanksPage'
import { TraceIndex } from './pages/trace/TraceIndex'
import { XeroPage } from './pages/xero/XeroPage'
import type { ReactNode } from 'react'

const AdminOnly = ({ children }: { children: ReactNode }) => (
  <RequireRole roles={['admin']}>{children}</RequireRole>
)
// Tanks and Ready for sale are the cellar's; a seller doesn't see them.
const CellarSide = ({ children }: { children: ReactNode }) => (
  <RequireRole roles={['admin', 'cellar', 'viewer']}>{children}</RequireRole>
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
          <Route index element={<HomeRedirect />} />
          <Route path="/tanks" element={<CellarSide><TanksPage /></CellarSide>} />
          <Route path="/lots/:lotId" element={<LotPage />} />
          <Route path="/trace" element={<TraceIndex />} />
          <Route path="/ready-for-sale" element={<CellarSide><ReadyForSalePage /></CellarSide>} />
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

          <Route path="/stock" element={<StockPage />} />
          <Route path="/sales" element={<SalesPage />} />
          <Route path="/sales/:saleId" element={<SaleDetailPage />} />
          <Route path="/transfers" element={<TransfersPage />} />
          <Route
            path="/stock-take"
            element={
              <RequireRole roles={['admin', 'seller']}>
                <StockTakePage />
              </RequireRole>
            }
          />
          <Route
            path="/stock/events"
            element={
              <RequireRole roles={['admin', 'seller']}>
                <EventsPage />
              </RequireRole>
            }
          />
          <Route
            path="/stock/events/:locationId/close-out"
            element={
              <RequireRole roles={['admin', 'seller']}>
                <CloseOutPage />
              </RequireRole>
            }
          />
          <Route path="/kegs" element={<KegsPage />} />
          <Route path="/manage/products" element={<AdminOnly><ProductsPage /></AdminOnly>} />
          <Route path="/manage/price-lists" element={<AdminOnly><PriceListsPage /></AdminOnly>} />
          <Route path="/manage/locations" element={<AdminOnly><LocationsPage /></AdminOnly>} />
          <Route path="/manage/customers" element={<AdminOnly><CustomersPage /></AdminOnly>} />
          <Route path="/manage/xero" element={<AdminOnly><XeroPage /></AdminOnly>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
