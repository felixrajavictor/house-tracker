import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { HardHat, Home, Menu, Plus, ReceiptText } from 'lucide-react'
import { useT } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/data'
import { UiContext } from '../lib/uiContext'
import type { Expense } from '../lib/types'
import ExpenseForm from '../pages/ExpenseForm'
import { Avatar, LangToggle } from './ui'

export default function Layout() {
  const { t } = useT()
  const { profile, isEditor } = useAuth()
  const { settings, error } = useData()
  const loc = useLocation()
  const [sheet, setSheet] = useState<{ open: boolean; expense?: Expense }>({ open: false })

  const openExpense = useCallback((expense?: Expense) => setSheet({ open: true, expense }), [])
  const closeSheet = useCallback(() => setSheet({ open: false }), [])

  const houseName = settings?.house_name || t('appName')
  useEffect(() => {
    document.title = houseName
  }, [houseName])

  const showFab = isEditor && (loc.pathname === '/' || loc.pathname === '/expenses')

  const tabs = [
    { to: '/', icon: Home, label: t('home'), active: loc.pathname === '/' },
    { to: '/expenses', icon: ReceiptText, label: t('expenses'), active: loc.pathname.startsWith('/expenses') },
    { to: '/workers', icon: HardHat, label: t('workers'), active: loc.pathname.startsWith('/workers') || loc.pathname.startsWith('/attendance') },
    { to: '/more', icon: Menu, label: t('more'), active: loc.pathname.startsWith('/more') },
  ]

  return (
    <UiContext.Provider value={{ openExpense }}>
      <div className="min-h-dvh bg-bg text-ink">
        <header className="sticky top-0 z-20 bg-bg/85 backdrop-blur border-b border-line">
          <div className="mx-auto max-w-xl px-4 h-14 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-8 w-8 rounded-xl hero-gradient grid place-items-center text-white shrink-0">
                <Home size={16} />
              </div>
              <div className="font-semibold truncate">{houseName}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <LangToggle />
              {profile && <Avatar name={profile.name} size="sm" />}
            </div>
          </div>
        </header>

        {/* key on the path re-runs the entrance animation on every page change */}
        <main key={loc.pathname} className="mx-auto max-w-xl px-4 pt-4 pb-28 animate-fade-up">
          {error && (
            <div className="mb-4 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-critical">
              {t('error')}: {error}
            </div>
          )}
          <Outlet />
        </main>

        {showFab && (
          <button
            type="button"
            onClick={() => openExpense()}
            className="fixed bottom-20 right-4 sm:right-[calc(50%-18rem)] z-20 h-14 w-14 rounded-full hero-gradient text-white shadow-lg shadow-accent/30 grid place-items-center transition-transform hover:scale-105 active:scale-95 animate-pop"
            aria-label={t('addExpense')}
          >
            <Plus size={26} />
          </button>
        )}

        <nav className="fixed bottom-0 inset-x-0 z-20 bg-surface/95 backdrop-blur border-t border-line pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto max-w-xl grid grid-cols-4">
            {tabs.map(({ to, icon: Icon, label, active }) => (
              <NavLink key={to} to={to} className={`flex flex-col items-center gap-1 py-2 text-[11px] transition-colors ${active ? 'text-accent font-semibold' : 'text-muted'}`}>
                <span className={`px-4 py-1 rounded-full transition-all duration-300 ${active ? 'bg-accent-soft' : 'bg-transparent'}`}>
                  <Icon size={22} strokeWidth={active ? 2.4 : 2} />
                </span>
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        {sheet.open && <ExpenseForm expense={sheet.expense} onClose={closeSheet} />}
      </div>
    </UiContext.Provider>
  )
}
