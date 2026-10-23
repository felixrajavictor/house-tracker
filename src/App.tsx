import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { UserX } from 'lucide-react'
import { LangProvider, useT } from './lib/i18n'
import { AuthProvider, useAuth } from './lib/auth'
import { DataProvider, useData } from './lib/data'
import Layout from './components/Layout'
import { Button, Card, LangToggle, Spinner } from './components/ui'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Expenses from './pages/Expenses'
import Workers from './pages/Workers'
import WorkerDetail from './pages/WorkerDetail'
import Attendance from './pages/Attendance'
import More from './pages/More'

function NotMember() {
  const { t } = useT()
  const { session, signOut } = useAuth()
  return (
    <div className="min-h-dvh bg-bg text-ink flex flex-col">
      <div className="flex justify-end p-4">
        <LangToggle />
      </div>
      <div className="grow grid place-items-center p-6">
        <Card className="max-w-sm w-full text-center space-y-3">
          <UserX className="mx-auto text-muted" size={40} />
          <h1 className="font-semibold text-lg">{t('notMemberTitle')}</h1>
          <p className="text-sm text-ink-2">{t('notMember')}</p>
          <p className="text-xs text-muted">
            {t('signedInAs')} {session?.user.email}
          </p>
          <div className="flex gap-2 justify-center pt-1">
            <Button variant="secondary" onClick={() => location.reload()}>
              {t('reload')}
            </Button>
            <Button variant="ghost" onClick={signOut}>
              {t('logout')}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

function AppRoutes() {
  const d = useData()
  if (d.loading && !d.settings) return <Spinner full />
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="workers" element={<Workers />} />
          <Route path="workers/:id" element={<WorkerDetail />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="more" element={<More />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

function Gate() {
  const { session, profile, loading } = useAuth()
  if (loading) return <Spinner full />
  if (!session) return <Login />
  if (!profile) return <NotMember />
  return (
    <DataProvider>
      <AppRoutes />
    </DataProvider>
  )
}

export default function App() {
  return (
    <LangProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </LangProvider>
  )
}
