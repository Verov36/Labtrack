'use client'
// app/admin/page.tsx — Backup & Recovery Dashboard (admin only)
import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter }  from 'next/navigation'
import { PageHeader, Card, CardTitle, Toast } from '@/components/ui'

interface BackupEntry {
  id:             string
  filename:       string
  provider:       string
  sizeBytes:      number
  sha256:         string
  createdAt:      string
  expiresAt:      string
  status:         string
  lastVerified?:  string
  restoreTestAt?: string
  restoreTestOk?: boolean
}

interface BackupHealth {
  status:           'healthy' | 'warning' | 'critical'
  lastBackup:       string | null
  hoursSinceBackup: number | null
  backupCurrent:    boolean
  allVerified:      boolean
  allTested:        boolean
  totalBackups:     number
  diskUsageBytes:   number
  retentionDays:    number
  backupDir:        string
}

const HEALTH_COLOR  = { healthy:'#34C759', warning:'#F5A623', critical:'#FF3B30' }
const HEALTH_ICON   = { healthy:'✓', warning:'⚠', critical:'✕' }
const HEALTH_LABEL  = { healthy:'All Systems Healthy', warning:'Action Recommended', critical:'Action Required' }
const STATUS_COLORS: Record<string, string> = {
  ok:'#34C759', verified:'#34C759', corrupted:'#FF3B30', missing:'#FF3B30'
}

export default function AdminPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user as Record<string, unknown> | undefined

  const [health,  setHealth]  = useState<BackupHealth | null>(null)
  const [entries, setEntries] = useState<BackupEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [acting,  setActing]  = useState<string | null>(null)
  const [toast,   setToast]   = useState<{msg:string;type?:'ok'|'error'}|null>(null)

  const showToast = (msg: string, type: 'ok'|'error' = 'ok') => {
    setToast({msg,type}); setTimeout(()=>setToast(null), 4000)
  }

  // Redirect non-admins
  useEffect(() => {
    if (session && user?.role !== 'admin') router.push('/dashboard')
  }, [session, user, router])

  const loadData = useCallback(async () => {
    setLoading(true)
    const res  = await fetch('/api/admin/backup')
    const data = await res.json()
    if (res.ok) { setHealth(data.health); setEntries(data.entries) }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function runAction(action: string, entryId?: string, label?: string) {
    setActing(entryId || action)
    const res  = await fetch('/api/admin/backup', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body:   JSON.stringify({ action, entryId }),
    })
    const data = await res.json()
    setActing(null)

    if (res.ok) {
      showToast(`✓ ${label || action}: ${data.message}`)
      await loadData()
    } else {
      showToast(`✗ ${data.error || 'Operation failed'}`, 'error')
    }
  }

  const fmt = (ts: string) => new Date(ts).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})
  const fmtDate = (ts: string) => new Date(ts).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})
  const fmtSize = (bytes: number) => bytes > 1024*1024 ? `${(bytes/1024/1024).toFixed(1)} MB` : `${(bytes/1024).toFixed(1)} KB`

  if (user?.role !== 'admin') return null
  if (loading) return <div style={{color:'#4A5268',padding:40}}>Loading backup status…</div>

  const hc = health?.status || 'critical'

  return (
    <div>
      <PageHeader title="Backup & Recovery" sub="Database backup management and restore testing" />

      {/* Health banner */}
      <div style={{ display:'flex', alignItems:'center', gap:16, padding:'16px 20px', borderRadius:8, background:`${HEALTH_COLOR[hc]}10`, border:`1px solid ${HEALTH_COLOR[hc]}40`, marginBottom:24 }}>
        <div style={{ width:44, height:44, borderRadius:'50%', background:`${HEALTH_COLOR[hc]}20`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, color:HEALTH_COLOR[hc], flexShrink:0 }}>
          {HEALTH_ICON[hc]}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:15, fontWeight:700, color:HEALTH_COLOR[hc] }}>{HEALTH_LABEL[hc]}</div>
          <div style={{ fontSize:12, color:'#6B7494', marginTop:2 }}>
            {health?.lastBackup
              ? `Last backup: ${fmt(health.lastBackup)} (${health.hoursSinceBackup}h ago)`
              : 'No backups have been created yet'}
            {health && ` · ${health.totalBackups} backup${health.totalBackups!==1?'s':''} stored · ${fmtSize(health.diskUsageBytes)} used`}
          </div>
        </div>
        <button onClick={() => runAction('backup', undefined, 'Backup')} disabled={!!acting}
          style={{ padding:'10px 20px', background:'#4FC3F7', color:'#0D0F14', border:'none', borderRadius:6, fontWeight:700, fontSize:13, cursor:acting?'not-allowed':'pointer', opacity:acting?0.6:1, flexShrink:0 }}>
          {acting==='backup' ? '◌ Running…' : '▶ Run Backup Now'}
        </button>
      </div>

      {/* Status cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
        {[
          { label:'Total Backups',     value: health?.totalBackups ?? 0,                                    color:'#64B5F6' },
          { label:'Backups Verified',  value: entries.filter(e=>e.status==='verified').length,              color:'#34C759' },
          { label:'Restore Tested',    value: entries.filter(e=>e.restoreTestOk).length,                    color:'#E040FB' },
          { label:'Retention (days)',  value: health?.retentionDays ?? 30,                                  color:'#F5A623' },
        ].map(s => (
          <div key={s.label} style={{ background:'#13161E', border:'1px solid #1E2230', borderRadius:8, padding:'14px 16px', borderTop:`3px solid ${s.color}` }}>
            <div style={{ fontSize:26, fontWeight:800, color:s.color, lineHeight:1 }}>{s.value}</div>
            <div style={{ fontSize:11, color:'#4A5268', marginTop:5, textTransform:'uppercase', letterSpacing:'0.06em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Checklist — what healthcare auditors look for */}
      <Card style={{ marginBottom:20 }}>
        <CardTitle>📋 Healthcare Compliance Checklist</CardTitle>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {[
            { label:'Daily automated backups',          ok: health?.backupCurrent ?? false },
            { label:'Backup integrity verified',        ok: health?.allVerified ?? false },
            { label:'Restore test completed',           ok: health?.allTested ?? false },
            { label:'30-day retention policy active',   ok: (health?.retentionDays ?? 0) >= 30 },
            { label:'Backup manifest maintained',       ok: entries.length > 0 },
            { label:'SHA-256 checksums on all backups', ok: entries.every(e => !!e.sha256) },
          ].map(item => (
            <div key={item.label} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:6, background: item.ok?'rgba(52,199,89,0.05)':'rgba(255,59,48,0.05)' }}>
              <span style={{ color: item.ok?'#34C759':'#FF3B30', fontSize:14, flexShrink:0 }}>{item.ok?'✓':'✕'}</span>
              <span style={{ fontSize:13, color: item.ok?'#E8EAF0':'#B0B8CC' }}>{item.label}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Backup storage location */}
      {health?.backupDir && (
        <div style={{ background:'rgba(79,195,247,0.05)', border:'1px solid rgba(79,195,247,0.15)', borderRadius:8, padding:'12px 16px', marginBottom:20, display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ color:'#4FC3F7', fontSize:14 }}>📁</span>
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:'#4FC3F7' }}>Backup Storage Location</div>
            <div style={{ fontSize:12, fontFamily:'monospace', color:'#6B7494', marginTop:2 }}>{health.backupDir}</div>
          </div>
        </div>
      )}

      {/* Backup table */}
      <Card style={{ padding:0, overflow:'hidden' }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid #1E2230', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <CardTitle>Backup History</CardTitle>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => runAction('prune', undefined, 'Prune')} disabled={!!acting}
              style={{ background:'transparent', border:'1px solid #1E2230', color:'#6B7494', padding:'6px 12px', borderRadius:5, cursor:'pointer', fontSize:12 }}>
              Prune Expired
            </button>
            <button onClick={loadData} style={{ background:'transparent', border:'1px solid #1E2230', color:'#4FC3F7', padding:'6px 12px', borderRadius:5, cursor:'pointer', fontSize:12, fontWeight:600 }}>
              ↻ Refresh
            </button>
          </div>
        </div>

        {entries.length === 0 ? (
          <div style={{ padding:'40px', textAlign:'center', color:'#4A5268' }}>
            <div style={{ fontSize:32, marginBottom:12 }}>💾</div>
            <div style={{ fontWeight:600, marginBottom:6 }}>No backups yet</div>
            <div style={{ fontSize:12 }}>Click "Run Backup Now" to create the first backup.</div>
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ background:'#0D0F14' }}>
                  {['Created','Filename','Size','SHA-256','Integrity','Restore Test','Expires','Actions'].map(h=>(
                    <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:10, fontWeight:700, color:'#4A5268', textTransform:'uppercase', letterSpacing:'0.07em', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id} style={{ borderBottom:'1px solid #101318' }}>
                    <td style={{ padding:'10px 12px', color:'#B0B8CC', whiteSpace:'nowrap' }}>{fmt(e.createdAt)}</td>
                    <td style={{ padding:'10px 12px' }}>
                      <div style={{ fontFamily:'monospace', fontSize:11, color:'#E8EAF0' }}>{e.filename}</div>
                      <div style={{ fontSize:10, color:'#4A5268', marginTop:2 }}>{e.provider}</div>
                    </td>
                    <td style={{ padding:'10px 12px', color:'#B0B8CC', whiteSpace:'nowrap' }}>{fmtSize(e.sizeBytes)}</td>
                    <td style={{ padding:'10px 12px' }}>
                      <span style={{ fontFamily:'monospace', fontSize:10, color:'#4A5268' }} title={e.sha256}>{e.sha256.slice(0,12)}…</span>
                    </td>
                    <td style={{ padding:'10px 12px' }}>
                      <span style={{ fontSize:11, fontWeight:700, color: STATUS_COLORS[e.status]||'#8899BB', background:`${STATUS_COLORS[e.status]||'#8899BB'}18`, padding:'2px 8px', borderRadius:4 }}>
                        {e.status}
                      </span>
                      {e.lastVerified && <div style={{ fontSize:10, color:'#4A5268', marginTop:2 }}>{fmtDate(e.lastVerified)}</div>}
                    </td>
                    <td style={{ padding:'10px 12px' }}>
                      {e.restoreTestOk
                        ? <span style={{ fontSize:11, fontWeight:700, color:'#34C759', background:'rgba(52,199,89,0.12)', padding:'2px 8px', borderRadius:4 }}>✓ Passed</span>
                        : <span style={{ fontSize:11, fontWeight:700, color:'#F5A623', background:'rgba(245,166,35,0.12)', padding:'2px 8px', borderRadius:4 }}>Not tested</span>
                      }
                      {e.restoreTestAt && <div style={{ fontSize:10, color:'#4A5268', marginTop:2 }}>{fmtDate(e.restoreTestAt)}</div>}
                    </td>
                    <td style={{ padding:'10px 12px', color:'#6B7494', whiteSpace:'nowrap' }}>{fmtDate(e.expiresAt)}</td>
                    <td style={{ padding:'10px 12px' }}>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={() => runAction('verify', e.id, 'Verify')} disabled={!!acting}
                          style={{ background:'transparent', border:'1px solid rgba(79,195,247,0.3)', color:'#4FC3F7', padding:'4px 8px', borderRadius:4, cursor:'pointer', fontSize:11, fontWeight:600, whiteSpace:'nowrap' }}>
                          {acting===e.id ? '◌' : 'Verify'}
                        </button>
                        <button onClick={() => runAction('test', e.id, 'Restore test')} disabled={!!acting}
                          style={{ background:'transparent', border:'1px solid rgba(224,64,251,0.3)', color:'#E040FB', padding:'4px 8px', borderRadius:4, cursor:'pointer', fontSize:11, fontWeight:600, whiteSpace:'nowrap' }}>
                          {acting===e.id ? '◌' : 'Test'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Instructions for scheduling */}
      <Card style={{ marginTop:20 }}>
        <CardTitle>⏰ Scheduling Automated Backups</CardTitle>
        <p style={{ fontSize:12, color:'#6B7494', marginBottom:16 }}>
          The backup engine runs from the command line. Schedule it using your operating system's task scheduler to ensure daily automated backups.
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:'#E8EAF0', marginBottom:8 }}>Linux / Mac (cron)</div>
            <div style={{ background:'#0D0F14', border:'1px solid #1E2230', borderRadius:6, padding:'12px 14px', fontFamily:'monospace', fontSize:11, color:'#4FC3F7' }}>
              <div style={{ color:'#4A5268', marginBottom:4 }}># Run: crontab -e</div>
              <div>0 2 * * * cd /path/to/labtrack && \</div>
              <div>  npx tsx scripts/backup/scheduledBackup.ts \</div>
              <div>  &gt;&gt; logs/backup.log 2&gt;&amp;1</div>
            </div>
          </div>
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:'#E8EAF0', marginBottom:8 }}>Windows (Task Scheduler)</div>
            <div style={{ background:'#0D0F14', border:'1px solid #1E2230', borderRadius:6, padding:'12px 14px', fontSize:11, color:'#6B7494', lineHeight:1.8 }}>
              <div>1. Open Task Scheduler</div>
              <div>2. Create Basic Task → Daily at 2:00 AM</div>
              <div>3. Action: Start a program</div>
              <div style={{ color:'#4FC3F7' }}>   Program: node</div>
              <div style={{ color:'#4FC3F7' }}>   Args: node_modules/.bin/tsx scripts/backup/scheduledBackup.ts</div>
              <div style={{ color:'#4FC3F7' }}>   Start in: C:\path\to\labtrack</div>
            </div>
          </div>
        </div>

        <div style={{ marginTop:16, padding:'12px 14px', background:'rgba(52,199,89,0.05)', border:'1px solid rgba(52,199,89,0.2)', borderRadius:6 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#34C759', marginBottom:4 }}>Manual commands</div>
          <div style={{ fontFamily:'monospace', fontSize:11, color:'#4FC3F7', lineHeight:2 }}>
            <div>npx tsx scripts/backup/backupEngine.ts backup   <span style={{ color:'#4A5268' }}># run backup now</span></div>
            <div>npx tsx scripts/backup/backupEngine.ts verify   <span style={{ color:'#4A5268' }}># verify latest</span></div>
            <div>npx tsx scripts/backup/backupEngine.ts test     <span style={{ color:'#4A5268' }}># restore test</span></div>
            <div>npx tsx scripts/backup/backupEngine.ts list     <span style={{ color:'#4A5268' }}># list all backups</span></div>
            <div>npx tsx scripts/backup/restore.ts --latest     <span style={{ color:'#4A5268' }}># restore (interactive)</span></div>
          </div>
        </div>
      </Card>

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  )
}
