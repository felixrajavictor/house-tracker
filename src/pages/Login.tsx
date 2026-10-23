import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, Home } from 'lucide-react'
import { useT } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import { errMsg } from '../lib/format'
import { Avatar, Button, Field, Input, LangToggle, Spinner } from '../components/ui'

type Member = { name: string; email: string }

export default function Login() {
  const { t } = useT()
  const [members, setMembers] = useState<Member[] | null>(null)
  const [picked, setPicked] = useState<Member | null>(null)
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    supabase
      .rpc('login_members')
      .then(({ data }) => alive && setMembers((data as Member[] | null) ?? []))
    return () => {
      alive = false
    }
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!picked) return
    setBusy(true)
    setErr(null)
    const { error } = await supabase.auth.signInWithPassword({ email: picked.email, password: pw })
    setBusy(false)
    if (error) setErr(error.message.toLowerCase().includes('invalid') ? t('loginFailed') : errMsg(error))
  }

  return (
    <div className="min-h-dvh bg-bg text-ink flex flex-col">
      <div className="hero-gradient text-white rounded-b-[2.5rem] px-4 pt-4 pb-10 shadow-lg shadow-accent/25">
        <div className="flex justify-end">
          <LangToggle />
        </div>
        <div className="text-center mt-2 animate-pop">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-white/20 grid place-items-center">
            <Home size={32} />
          </div>
          <h1 className="text-2xl font-bold mt-4">{t('appName')}</h1>
          <p className="text-sm opacity-90 mt-1">{picked ? t('enterPassword') : t('whoAreYou')}</p>
        </div>
      </div>

      <div className="grow flex items-start justify-center px-4 pb-16 -mt-5">
        <div className="w-full max-w-sm">
          {members === null ? (
            <Spinner />
          ) : !picked ? (
            <div className="grid grid-cols-2 gap-3 stagger">
              {members.map((m) => (
                <button
                  key={m.email}
                  type="button"
                  onClick={() => {
                    setPicked(m)
                    setPw('')
                    setErr(null)
                  }}
                  className="rounded-2xl bg-surface border border-line p-4 flex flex-col items-center gap-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-[0.97] transition"
                >
                  <Avatar name={m.name} size="lg" />
                  <span className="font-semibold truncate max-w-full">{m.name}</span>
                </button>
              ))}
              {members.length === 0 && <p className="col-span-2 text-center text-sm text-muted py-6">{t('noMembersYet')}</p>}
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4 animate-pop">
              <div className="flex items-center gap-3 rounded-2xl bg-surface border border-line p-3 shadow-sm">
                <button type="button" onClick={() => setPicked(null)} className="h-9 w-9 grid place-items-center rounded-full hover:bg-surface-2" aria-label="Back">
                  <ArrowLeft size={18} />
                </button>
                <Avatar name={picked.name} />
                <span className="font-semibold">{picked.name}</span>
              </div>
              <Field label={t('password')}>
                <Input type="password" autoComplete="current-password" required value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
              </Field>
              <Button type="submit" size="lg" className="w-full" disabled={busy || !pw}>
                {busy ? t('loading') : t('login')}
              </Button>
              {err && <p className="text-sm text-center text-critical">{err}</p>}
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
