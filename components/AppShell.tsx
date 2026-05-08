'use client'
// components/AppShell.tsx
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useCallback, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { avatarColor, ROLES, type UserRole } from '@/lib/types'

// ── Inactivity timeout ───────────────────────────────────────────────────────
// Hospital policy: auto-sign-out after 30 minutes of inactivity.
// Inactivity = no mouse move, keypress, click, or scroll.
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
const INACTIVITY_WARNING_MS = 25 * 60 * 1000 // warn at 25 minutes

const NAV = [
  { href: '/dashboard',  icon: '◈', label: 'Dashboard'    },
  { href: '/inventory',  icon: '⊟', label: 'Inventory'    },
  { href: '/alerts',     icon: '⚠', label: 'Alerts'       },
  { href: '/log',        icon: '⊞', label: 'Usage Log'    },
  { href: '/activity',   icon: '◷', label: 'Activity Log' },
  { href: '/team',       icon: '◎', label: 'Team'         },
  { href: '/reports',    icon: '⊠', label: 'Reports'      },
  { href: '/admin',      icon: '💾', label: 'Backup & Recovery', adminOnly: true },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [scannerActive, setScannerActive] = useState(true)
  const [lastScan, setLastScan] = useState<{ barcode: string; result: string; name: string; ts: string } | null>(null)
  const [alertCount, setAlertCount] = useState(0)
  const [showSignOut, setShowSignOut] = useState(false)
  const [showInactivityWarning, setShowInactivityWarning] = useState(false)
  const buf = useRef(''), timer = useRef<NodeJS.Timeout | null>(null)
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null)
  const warningTimer    = useRef<NodeJS.Timeout | null>(null)

  const user       = session?.user
  const userRole   = (user as Record<string, unknown>)?.role as string || 'viewer'
  const userAvatar = (user as Record<string, unknown>)?.avatar as string || (user?.name?.slice(0,2).toUpperCase() || '?')
  const userId     = parseInt((user as Record<string, unknown>)?.id as string || '1') || 1

  // ── Inactivity timeout ────────────────────────────────────────────────────
  const resetInactivityTimer = useCallback(() => {
    setShowInactivityWarning(false)
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
    if (warningTimer.current)    clearTimeout(warningTimer.current)

    warningTimer.current = setTimeout(() => {
      setShowInactivityWarning(true)
    }, INACTIVITY_WARNING_MS)

    inactivityTimer.current = setTimeout(() => {
      signOut({ callbackUrl: '/login?reason=inactivity' })
    }, INACTIVITY_TIMEOUT_MS)
  }, [])

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll']
    events.forEach(ev => window.addEventListener(ev, resetInactivityTimer, { passive: true }))
    resetInactivityTimer()
    return () => {
      events.forEach(ev => window.removeEventListener(ev, resetInactivityTimer))
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
      if (warningTimer.current)    clearTimeout(warningTimer.current)
    }
  }, [resetInactivityTimer])

  // ── Alert badge count ─────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/products')
      .then(r => r.json())
      .then(products => {
        const today = new Date(); today.setHours(0,0,0,0)
        let count = 0
        for (const p of products) {
          const exp = new Date(p.expiry); exp.setHours(0,0,0,0)
          const days = Math.round((exp.getTime() - today.getTime()) / 86400000)
          if (days < 0 || days <= 7) count++
          if (p.lowStockThreshold > 0 && p.quantity <= p.lowStockThreshold) count++
        }
        setAlertCount(count)
      })
      .catch(() => {})
  }, [pathname])

  // ── Global barcode scanner ─────────────────────────────────────────────────
  const handleScan = useCallback(async (barcode: string) => {
    const ts = new Date().toLocaleTimeString('en-GB')
    try {
      const products = await fetch('/api/products').then(r => r.json())
      const match = products.find((p: { barcode: string; name: string }) => p.barcode === barcode)
      if (match) {
        setLastScan({ barcode, result: 'found', name: match.name, ts })
        window.dispatchEvent(new CustomEvent('barcode-scan', { detail: { product: match } }))
      } else {
        setLastScan({ barcode, result: 'unknown', ts })
        window.dispatchEvent(new CustomEvent('barcode-scan', { detail: { barcode, unknown: true } }))
      }
    } catch { setLastScan({ barcode, result: 'unknown', ts }) }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!scannerActive) return
      const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase()
      if (['input','textarea','select'].includes(tag)) return
      if (e.key === 'Enter') {
        if (buf.current.length >= 4) handleScan(buf.current.trim())
        buf.current = ''; if (timer.current) clearTimeout(timer.current); return
      }
      if (e.key.length === 1) {
        buf.current += e.key
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => { buf.current = '' }, 80)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [scannerActive, handleScan])

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#0D0F14', color:'#E8EAF0', fontFamily:"'Segoe UI',system-ui,sans-serif" }}>

      {/* Inactivity warning banner */}
      {showInactivityWarning && (
        <div style={{ position:'fixed', top:0, left:0, right:0, zIndex:1000, background:'#FF6B00', color:'#fff', padding:'12px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:13, fontWeight:600 }}>
          <span>⚠ You will be signed out in 5 minutes due to inactivity.</span>
          <button onClick={resetInactivityTimer} style={{ background:'rgba(255,255,255,0.2)', border:'none', color:'#fff', padding:'6px 16px', borderRadius:6, cursor:'pointer', fontWeight:700, fontSize:13 }}>
            Stay signed in
          </button>
        </div>
      )}

      {/* Sidebar */}
      <nav style={{ width:244, background:'#13161E', borderRight:'1px solid #1E2230', display:'flex', flexDirection:'column', padding:'24px 0', gap:3, flexShrink:0, position:'sticky', top:0, height:'100vh', overflowY:'auto' }}>
        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'0 20px 24px', borderBottom:'1px solid #1E2230', marginBottom:8 }}>
          <div style={{ fontSize:28, color:'#4FC3F7', lineHeight:1 }}>⬡</div>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:'#E8EAF0' }}>LabTrack</div>
            <div style={{ fontSize:10, color:'#4A5268', letterSpacing:'0.08em', textTransform:'uppercase' }}>Expiry Management</div>
          </div>
        </div>

        {NAV.filter(item => !('adminOnly' in item) || !item.adminOnly || userRole === 'admin').map(({ href, icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          const isAlerts = href === '/alerts'
          return (
            <Link key={href} href={href} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 20px', color:active?'#4FC3F7':'#6B7494', background:active?'rgba(79,195,247,0.08)':'transparent', borderLeft:active?'2px solid #4FC3F7':'2px solid transparent', textDecoration:'none', fontSize:13, fontWeight:500 }}>
              <span style={{ fontSize:15 }}>{icon}</span>
              <span style={{ flex:1 }}>{label}</span>
              {isAlerts && alertCount > 0 && <span style={{ background:'#FF3B30', color:'#fff', borderRadius:10, fontSize:10, fontWeight:700, padding:'1px 6px' }}>{alertCount}</span>}
            </Link>
          )
        })}

        <div style={{ flex:1 }} />

        {/* Scanner status */}
        <div style={{ margin:'0 14px 6px', padding:'10px 12px', background:'#0D0F14', borderRadius:6, border:'1px solid #1E2230' }}>
          <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom: lastScan ? 8 : 0 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:scannerActive?'#34C759':'#4A5268', flexShrink:0 }}/>
            <span style={{ fontSize:11, fontWeight:700, color:scannerActive?'#34C759':'#4A5268', flex:1 }}>{scannerActive?'SCANNER ACTIVE':'SCANNER PAUSED'}</span>
            <button onClick={() => setScannerActive(v => !v)} style={{ background:'transparent', border:'1px solid #1E2230', color:'#6B7494', fontSize:10, padding:'2px 8px', borderRadius:4, cursor:'pointer' }}>
              {scannerActive ? 'Pause' : 'Resume'}
            </button>
          </div>
          {lastScan && (
            <div style={{ borderTop:'1px solid #1E2230', paddingTop:8 }}>
              <div style={{ fontFamily:'monospace', fontSize:11, fontWeight:700, color:lastScan.result==='found'?'#34C759':'#F5A623' }}>{lastScan.barcode}</div>
              <div style={{ fontSize:11, color:'#6B7494', marginTop:1 }}>{lastScan.result==='found'?`↳ ${lastScan.name}`:'↳ Unknown'}</div>
            </div>
          )}
        </div>

        <Link href="/inventory?add=1" style={{ margin:'6px 16px 4px', padding:'10px', background:'#4FC3F7', color:'#0D0F14', borderRadius:6, fontWeight:700, fontSize:13, textAlign:'center', textDecoration:'none', display:'block' }}>
          + Add Product
        </Link>

        {/* Current user with sign-out */}
        <div style={{ position:'relative', borderTop:'1px solid #1E2230', marginTop:6 }}>
          <button onClick={() => setShowSignOut(v => !v)}
            style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 20px', width:'100%', background:'transparent', border:'none', cursor:'pointer', textAlign:'left' }}>
            <div style={{ width:34, height:34, borderRadius:'50%', background:avatarColor(userId), color:'#0D0F14', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, flexShrink:0 }}>
              {userAvatar}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'#E8EAF0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.name || 'User'}</div>
              <div style={{ fontSize:10, color:ROLES[userRole as UserRole]?.color||'#4A5268' }}>{ROLES[userRole as UserRole]?.label||userRole}</div>
            </div>
            <span style={{ fontSize:10, color:'#4A5268' }}>⌄</span>
          </button>

          {showSignOut && (
            <div style={{ position:'absolute', bottom:'100%', left:0, right:0, background:'#13161E', border:'1px solid #1E2230', borderRadius:'8px 8px 0 0', overflow:'hidden' }}>
              <div style={{ padding:'10px 20px', borderBottom:'1px solid #1E2230' }}>
                <div style={{ fontSize:11, color:'#4A5268', marginBottom:2 }}>Signed in as</div>
                <div style={{ fontSize:12, color:'#B0B8CC', overflow:'hidden', textOverflow:'ellipsis' }}>{user?.email}</div>
              </div>
              <Link href="/account" onClick={() => setShowSignOut(false)}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 20px', color:'#B0B8CC', fontSize:13, textDecoration:'none', borderBottom:'1px solid #1E2230' }}>
                <span>⚙</span> Account Settings
              </Link>
              <button onClick={() => signOut({ callbackUrl: '/login' })}
                style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'12px 20px', background:'transparent', border:'none', color:'#FF3B30', fontSize:13, cursor:'pointer', fontWeight:600 }}>
                <span>→</span> Sign out
              </button>
            </div>
          )}
        </div>
      </nav>

      <main style={{ flex:1, padding: showInactivityWarning ? '72px 36px 32px' : '32px 36px', overflowY:'auto', minHeight:'100vh' }}>
        {children}
      </main>
    </div>
  )
}
