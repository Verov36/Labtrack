'use client'
// app/account/page.tsx
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { PageHeader, Card, CardTitle, Label, BtnPrimary, BtnSecondary, Toast, inputStyle } from '@/components/ui'
import { validatePassword } from '@/lib/passwordPolicy'

export default function AccountPage() {
  const { data: session } = useSession()
  const user = session?.user as Record<string, unknown> | undefined

  // Password change state
  const [pwForm,   setPwForm]   = useState({ currentPassword:'', newPassword:'', confirmPassword:'' })
  const [pwErrors, setPwErrors] = useState<string[]>([])
  const [pwSaving, setPwSaving] = useState(false)
  const [pwDone,   setPwDone]   = useState(false)

  // MFA state
  const [mfaStage,       setMfaStage]       = useState<'idle'|'setup'|'confirm'|'done'>('idle')
  const [mfaQr,          setMfaQr]          = useState('')
  const [mfaManualKey,   setMfaManualKey]   = useState('')
  const [mfaSecret,      setMfaSecret]      = useState('')
  const [mfaCode,        setMfaCode]        = useState('')
  const [mfaBackupCodes, setMfaBackupCodes] = useState<string[]>([])
  const [mfaError,       setMfaError]       = useState('')
  const [mfaLoading,     setMfaLoading]     = useState(false)

  const [toast, setToast] = useState<{ msg: string; type?: 'ok' | 'error' } | null>(null)
  const showToast = (msg: string, type: 'ok'|'error' = 'ok') => { setToast({msg,type}); setTimeout(()=>setToast(null),4000) }

  // ── Password change ────────────────────────────────────────────────────────
  async function handlePasswordChange() {
    const { currentPassword, newPassword, confirmPassword } = pwForm
    setPwErrors([])

    if (!currentPassword) { setPwErrors(['Please enter your current password']); return }
    if (newPassword !== confirmPassword) { setPwErrors(['New passwords do not match']); return }

    const validation = validatePassword(newPassword, user?.email as string, user?.name as string)
    if (!validation.valid) { setPwErrors(validation.errors); return }

    setPwSaving(true)
    const res = await fetch('/api/auth/change-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    })
    const data = await res.json()
    setPwSaving(false)

    if (res.ok) {
      setPwDone(true)
      setPwForm({ currentPassword:'', newPassword:'', confirmPassword:'' })
      showToast('✓ Password changed successfully')
    } else {
      setPwErrors(data.details || [data.error || 'Failed to change password'])
    }
  }

  // Password strength indicator
  const pwStrength = pwForm.newPassword.length > 0
    ? validatePassword(pwForm.newPassword, user?.email as string, user?.name as string).strength
    : null
  const strengthColors = { weak:'#FF3B30', fair:'#F5A623', strong:'#4FC3F7', 'very-strong':'#34C759' }
  const strengthLabels = { weak:'Weak', fair:'Fair', strong:'Strong', 'very-strong':'Very Strong' }
  const strengthWidths = { weak:'25%', fair:'50%', strong:'75%', 'very-strong':'100%' }

  // ── MFA setup ──────────────────────────────────────────────────────────────
  async function startMfaSetup() {
    setMfaLoading(true); setMfaError('')
    const res = await fetch('/api/auth/mfa-setup')
    const data = await res.json()
    setMfaLoading(false)
    if (res.ok) { setMfaQr(data.qrCodeUrl); setMfaManualKey(data.manualKey); setMfaSecret(data.secret); setMfaStage('setup') }
    else showToast(data.error || 'Failed to start MFA setup', 'error')
  }

  async function confirmMfaSetup() {
    if (!mfaCode || mfaCode.length !== 6) { setMfaError('Enter the 6-digit code from your app'); return }
    setMfaLoading(true); setMfaError('')
    const res  = await fetch('/api/auth/mfa-setup', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ secret:mfaSecret, code:mfaCode }) })
    const data = await res.json()
    setMfaLoading(false)
    if (res.ok) { setMfaBackupCodes(data.backupCodes); setMfaStage('done') }
    else { setMfaError(data.error || 'Invalid code. Please try again.') }
  }

  async function disableMfa() {
    if (!confirm('Disable two-factor authentication? Your account will be less secure.')) return
    const res = await fetch('/api/auth/mfa-setup', { method:'DELETE' })
    if (res.ok) showToast('✓ MFA disabled'); else showToast('Failed to disable MFA', 'error')
  }

  const mfaEnabled = !!(user?.mfaEnabled)

  return (
    <div>
      <PageHeader title="Account Settings" sub="Security settings for your LabTrack account" />

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>

        {/* Password change */}
        <Card>
          <CardTitle>🔑 Change Password</CardTitle>
          <p style={{ fontSize:12, color:'#6B7494', marginBottom:16 }}>
            Passwords must be at least 12 characters and include uppercase, lowercase, numbers, and symbols. You cannot reuse your last 10 passwords. Passwords expire every 90 days.
          </p>

          {pwDone && <div style={{ background:'rgba(52,199,89,0.1)', border:'1px solid rgba(52,199,89,0.3)', borderRadius:6, padding:'10px 14px', marginBottom:16, fontSize:13, color:'#34C759' }}>✓ Password changed successfully</div>}

          {pwErrors.length > 0 && (
            <div style={{ background:'rgba(255,59,48,0.08)', border:'1px solid rgba(255,59,48,0.25)', borderRadius:6, padding:'10px 14px', marginBottom:16 }}>
              {pwErrors.map(e => <div key={e} style={{ fontSize:12, color:'#FF3B30', marginBottom:2 }}>• {e}</div>)}
            </div>
          )}

          <Label>Current Password</Label>
          <input style={inputStyle} type="password" value={pwForm.currentPassword} onChange={e=>setPwForm(f=>({...f,currentPassword:e.target.value}))} placeholder="••••••••" />

          <Label>New Password</Label>
          <input style={inputStyle} type="password" value={pwForm.newPassword} onChange={e=>setPwForm(f=>({...f,newPassword:e.target.value}))} placeholder="Minimum 12 characters" />

          {/* Strength indicator */}
          {pwStrength && (
            <div style={{ marginTop:8, marginBottom:4 }}>
              <div style={{ height:4, background:'#1E2230', borderRadius:2, overflow:'hidden' }}>
                <div style={{ height:'100%', width: strengthWidths[pwStrength], background: strengthColors[pwStrength], transition:'all 0.3s', borderRadius:2 }} />
              </div>
              <div style={{ fontSize:11, color: strengthColors[pwStrength], marginTop:4 }}>{strengthLabels[pwStrength]}</div>
            </div>
          )}

          <Label>Confirm New Password</Label>
          <input style={inputStyle} type="password" value={pwForm.confirmPassword} onChange={e=>setPwForm(f=>({...f,confirmPassword:e.target.value}))} placeholder="••••••••" />

          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:20 }}>
            <BtnPrimary onClick={handlePasswordChange} disabled={pwSaving}>{pwSaving ? 'Saving…' : 'Change Password'}</BtnPrimary>
          </div>
        </Card>

        {/* MFA */}
        <Card>
          <CardTitle>🔐 Two-Factor Authentication</CardTitle>

          {mfaStage === 'idle' && (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, padding:'10px 14px', borderRadius:6, background: mfaEnabled?'rgba(52,199,89,0.08)':'rgba(245,166,35,0.08)', border:`1px solid ${mfaEnabled?'rgba(52,199,89,0.25)':'rgba(245,166,35,0.25)'}` }}>
                <span style={{ fontSize:18 }}>{mfaEnabled ? '✓' : '⚠'}</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color: mfaEnabled?'#34C759':'#F5A623' }}>{mfaEnabled ? 'MFA is enabled' : 'MFA is not enabled'}</div>
                  <div style={{ fontSize:11, color:'#6B7494' }}>{mfaEnabled ? 'Your account is protected with two-factor authentication' : 'Enable MFA to significantly improve account security'}</div>
                </div>
              </div>
              <p style={{ fontSize:12, color:'#6B7494', marginBottom:16 }}>
                Use Google Authenticator, Microsoft Authenticator, or Authy. You will also receive 8 backup codes for account recovery.
              </p>
              {mfaEnabled
                ? <BtnSecondary onClick={disableMfa}>Disable MFA</BtnSecondary>
                : <BtnPrimary onClick={startMfaSetup} disabled={mfaLoading}>{mfaLoading ? 'Loading…' : 'Enable MFA'}</BtnPrimary>
              }
            </>
          )}

          {mfaStage === 'setup' && (
            <>
              <p style={{ fontSize:12, color:'#6B7494', marginBottom:16 }}>
                Scan this QR code with your authenticator app, then enter the 6-digit code to confirm setup.
              </p>
              <div style={{ textAlign:'center', marginBottom:16 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mfaQr} alt="MFA QR Code" style={{ width:180, height:180, borderRadius:8, border:'2px solid #1E2230' }} />
              </div>
              <div style={{ background:'#0D0F14', border:'1px solid #1E2230', borderRadius:6, padding:'10px 14px', marginBottom:16 }}>
                <div style={{ fontSize:10, color:'#4A5268', marginBottom:4 }}>MANUAL ENTRY KEY</div>
                <div style={{ fontFamily:'monospace', fontSize:13, color:'#4FC3F7', letterSpacing:'0.1em', wordBreak:'break-all' }}>{mfaManualKey}</div>
              </div>
              {mfaError && <div style={{ fontSize:12, color:'#FF3B30', marginBottom:12 }}>⚠ {mfaError}</div>}
              <Label>Enter the 6-digit code from your app</Label>
              <input style={{...inputStyle, textAlign:'center', fontSize:22, fontWeight:700, letterSpacing:'0.3em'}}
                type="text" inputMode="numeric" maxLength={6} value={mfaCode}
                onChange={e=>setMfaCode(e.target.value.replace(/\D/g,''))} placeholder="000000" />
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:16 }}>
                <BtnSecondary onClick={()=>{setMfaStage('idle');setMfaCode('')}}>Cancel</BtnSecondary>
                <BtnPrimary onClick={confirmMfaSetup} disabled={mfaLoading || mfaCode.length<6}>{mfaLoading?'Verifying…':'Confirm Setup'}</BtnPrimary>
              </div>
            </>
          )}

          {mfaStage === 'done' && (
            <>
              <div style={{ textAlign:'center', marginBottom:20 }}>
                <div style={{ fontSize:36, marginBottom:8 }}>✅</div>
                <div style={{ fontSize:15, fontWeight:700, color:'#34C759' }}>MFA Enabled Successfully</div>
                <div style={{ fontSize:12, color:'#6B7494', marginTop:4 }}>Save your backup codes in a secure location. Each code can only be used once.</div>
              </div>
              <div style={{ background:'#0D0F14', border:'1px solid #1E2230', borderRadius:6, padding:'14px 16px', marginBottom:16 }}>
                <div style={{ fontSize:10, color:'#4A5268', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.06em' }}>Backup Recovery Codes</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                  {mfaBackupCodes.map((code, i) => (
                    <div key={i} style={{ fontFamily:'monospace', fontSize:13, color:'#E8EAF0', background:'#13161E', border:'1px solid #1E2230', borderRadius:4, padding:'6px 10px', textAlign:'center' }}>{code}</div>
                  ))}
                </div>
              </div>
              <BtnPrimary onClick={()=>setMfaStage('idle')}>Done</BtnPrimary>
            </>
          )}
        </Card>
      </div>

      {/* Auth events for admins */}
      {user?.role === 'admin' && <AuthEventsPanel />}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  )
}

function AuthEventsPanel() {
  const [events, setEvents]   = useState<Record<string,unknown>[]>([])
  const [loaded, setLoaded]   = useState(false)
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    const data = await fetch('/api/auth/auth-events').then(r=>r.json())
    setEvents(data); setLoaded(true); setLoading(false)
  }

  const EVENT_COLORS: Record<string,string> = {
    login_success:'#34C759', login_failure:'#FF3B30', logout:'#4A5268',
    account_locked:'#FF3B30', mfa_success:'#34C759', mfa_failure:'#FF6B00',
    mfa_enabled:'#E040FB', password_changed:'#4FC3F7', backup_code_used:'#F5A623',
  }

  return (
    <div style={{ marginTop:20 }}>
      <Card>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <CardTitle>🔍 Authentication Audit Log</CardTitle>
          <button onClick={load} disabled={loading}
            style={{ background:'transparent', border:'1px solid #1E2230', color:'#4FC3F7', padding:'6px 14px', borderRadius:6, cursor:'pointer', fontSize:12, fontWeight:600 }}>
            {loading ? 'Loading…' : loaded ? 'Refresh' : 'Load Events'}
          </button>
        </div>
        {loaded && events.length > 0 && (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ background:'#0D0F14' }}>
                  {['Time','Email','Event','IP Address','Detail'].map(h=>(
                    <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:10, fontWeight:700, color:'#4A5268', textTransform:'uppercase', letterSpacing:'0.07em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map((e,i) => (
                  <tr key={i} style={{ borderBottom:'1px solid #101318' }}>
                    <td style={{ padding:'8px 10px', color:'#6B7494', whiteSpace:'nowrap' }}>
                      {new Date(e.createdAt as string).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
                    </td>
                    <td style={{ padding:'8px 10px', color:'#B0B8CC' }}>{e.email as string}</td>
                    <td style={{ padding:'8px 10px' }}>
                      <span style={{ fontSize:11, fontWeight:700, color: EVENT_COLORS[e.event as string]||'#8899BB', background:`${EVENT_COLORS[e.event as string]||'#8899BB'}18`, padding:'2px 8px', borderRadius:4 }}>
                        {(e.event as string).replace(/_/g,' ')}
                      </span>
                    </td>
                    <td style={{ padding:'8px 10px', color:'#6B7494', fontFamily:'monospace', fontSize:11 }}>{e.ipAddress as string || '—'}</td>
                    <td style={{ padding:'8px 10px', color:'#6B7494', fontSize:11 }}>{e.detail as string || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {loaded && events.length === 0 && <div style={{ color:'#4A5268', textAlign:'center', padding:'20px 0' }}>No auth events recorded yet</div>}
        {!loaded && <div style={{ color:'#4A5268', textAlign:'center', padding:'20px 0', fontSize:13 }}>Click "Load Events" to view the authentication audit log</div>}
      </Card>
    </div>
  )
}
