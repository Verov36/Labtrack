'use client'
// components/ui.tsx  — shared primitive components
import { ExpiryStatus, StockStatus, OpenStatus, STATUS_META, STOCK_META, OPEN_META } from '@/lib/types'
import { ReactNode, CSSProperties } from 'react'

// ── Badges ────────────────────────────────────────────────────────────────────
const badgeBase: CSSProperties = { display:'inline-block', fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:4, letterSpacing:'0.03em', whiteSpace:'nowrap' }

export function StatusBadge({ status }: { status: ExpiryStatus }) {
  const m = STATUS_META[status] ?? STATUS_META.ok
  return <span style={{ ...badgeBase, background:m.bg, color:m.color }}>{m.label}</span>
}
export function StockBadge({ status }: { status: StockStatus }) {
  const m = STOCK_META[status] ?? STOCK_META.ok
  return <span style={{ ...badgeBase, background:m.bg, color:m.color }}>{m.label}</span>
}
export function OpenBadge({ status }: { status: OpenStatus }) {
  const m = OPEN_META[status] ?? OPEN_META.none
  return <span style={{ ...badgeBase, background:m.bg, color:m.color }}>{m.label}</span>
}

// ── Page header ───────────────────────────────────────────────────────────────
export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:28 }}>
      <div>
        <h1 style={{ fontSize:26, fontWeight:700, letterSpacing:'-0.02em', color:'#E8EAF0' }}>{title}</h1>
        {sub && <p style={{ fontSize:12, color:'#4A5268', marginTop:4 }}>{sub}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
export function StatCard({ icon, value, label, color }: { icon: string; value: number; label: string; color: string }) {
  return (
    <div style={{ flex:'1 1 100px', background:'#13161E', border:'1px solid #1E2230', borderRadius:8, padding:'14px 16px', borderTop:`3px solid ${color}`, minWidth:90 }}>
      <div style={{ fontSize:17, color, marginBottom:5 }}>{icon}</div>
      <div style={{ fontSize:26, fontWeight:800, color, lineHeight:1, letterSpacing:'-0.02em' }}>{value}</div>
      <div style={{ fontSize:10, color:'#4A5268', marginTop:5, textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</div>
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 }}>
      <div style={{ background:'#13161E', border:'1px solid #1E2230', borderRadius:10, width:'100%', maxWidth: wide ? 720 : 600, maxHeight:'92vh', display:'flex', flexDirection:'column' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'20px 24px', borderBottom:'1px solid #1E2230' }}>
          <span style={{ fontSize:16, fontWeight:700, color:'#E8EAF0' }}>{title}</span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#4A5268', cursor:'pointer', fontSize:18, lineHeight:1 }}>✕</button>
        </div>
        <div style={{ padding:'20px 24px', overflowY:'auto' }}>{children}</div>
      </div>
    </div>
  )
}

// ── Form label ────────────────────────────────────────────────────────────────
export function Label({ children }: { children: ReactNode }) {
  return <div style={{ fontSize:11, fontWeight:700, color:'#4A5268', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:6, marginTop:12 }}>{children}</div>
}

// ── Input / Select ────────────────────────────────────────────────────────────
export const inputStyle: CSSProperties = { width:'100%', background:'#0D0F14', border:'1px solid #1E2230', borderRadius:6, padding:'9px 12px', color:'#E8EAF0', fontSize:13, outline:'none', boxSizing:'border-box' }

// ── Buttons ───────────────────────────────────────────────────────────────────
export function BtnPrimary({ children, onClick, type = 'button', disabled }: { children: ReactNode; onClick?: () => void; type?: 'button'|'submit'; disabled?: boolean }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{ padding:'10px 22px', background:'#4FC3F7', color:'#0D0F14', border:'none', borderRadius:6, cursor:'pointer', fontWeight:700, fontSize:13, opacity: disabled ? 0.5 : 1 }}>
      {children}
    </button>
  )
}
export function BtnSecondary({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick}
      style={{ padding:'10px 22px', background:'transparent', color:'#6B7494', border:'1px solid #1E2230', borderRadius:6, cursor:'pointer', fontWeight:600, fontSize:13 }}>
      {children}
    </button>
  )
}
export function BtnOutline({ children, onClick, color = '#4FC3F7' }: { children: ReactNode; onClick?: () => void; color?: string }) {
  return (
    <button onClick={onClick}
      style={{ background:'transparent', border:`1px solid ${color}44`, borderRadius:5, color, padding:'5px 12px', cursor:'pointer', fontSize:12, fontWeight:600, whiteSpace:'nowrap' }}>
      {children}
    </button>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────────
export function Toast({ msg, type }: { msg: string; type?: 'ok' | 'error' }) {
  return (
    <div style={{ position:'fixed', bottom:28, right:28, background: type === 'error' ? '#FF3B30' : '#34C759', color:'#fff', padding:'12px 20px', borderRadius:8, fontWeight:600, fontSize:13, zIndex:200, boxShadow:'0 4px 20px rgba(0,0,0,0.4)', maxWidth:360 }}>
      {msg}
    </div>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ background:'#13161E', border:'1px solid #1E2230', borderRadius:8, padding:'18px 20px', ...style }}>{children}</div>
}
export function CardTitle({ children }: { children: ReactNode }) {
  return <div style={{ fontSize:12, fontWeight:700, letterSpacing:'0.05em', color:'#8899BB', textTransform:'uppercase', marginBottom:12 }}>{children}</div>
}

// ── Alert row ─────────────────────────────────────────────────────────────────
export function AlertRow({ color, children, onClick }: { color: string; children: ReactNode; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{ padding:'9px 11px', marginBottom:7, borderRadius:5, background:'rgba(255,255,255,0.025)', borderLeft:`3px solid ${color}`, cursor: onClick ? 'pointer' : 'default' }}>
      {children}
    </div>
  )
}

// ── Section heading ───────────────────────────────────────────────────────────
export function SectionHead({ children, color = '#8899BB' }: { children: ReactNode; color?: string }) {
  return <div style={{ fontSize:12, fontWeight:700, color:'#8899BB', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:12, paddingLeft:10, borderLeft:`3px solid ${color}` }}>{children}</div>
}

// ── Table primitives ──────────────────────────────────────────────────────────
export function Table({ children }: { children: ReactNode }) {
  return <div style={{ background:'#13161E', border:'1px solid #1E2230', borderRadius:8, overflow:'hidden', marginBottom:20 }}>{children}</div>
}
export function THead({ cols, labels }: { cols: string; labels: string[] }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:cols, background:'#0D0F14', borderBottom:'1px solid #1E2230', padding:'0 4px' }}>
      {labels.map(l => <div key={l} style={{ padding:'10px 10px', fontSize:10, fontWeight:700, color:'#4A5268', textTransform:'uppercase', letterSpacing:'0.08em' }}>{l}</div>)}
    </div>
  )
}
export function TRow({ cols, children, highlight }: { cols: string; children: ReactNode; highlight?: string }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:cols, borderBottom:'1px solid #101318', padding:'0 4px', background: highlight || 'transparent' }}>
      {children}
    </div>
  )
}
export function TD({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ padding:'11px 10px', display:'flex', alignItems:'center', ...style }}>{children}</div>
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function Empty({ children }: { children: ReactNode }) {
  return <div style={{ color:'#4A5268', fontSize:13, textAlign:'center', padding:'24px 0' }}>{children}</div>
}

// ── Qty stepper ───────────────────────────────────────────────────────────────
export function QtyInput({ value, onChange, max }: { value: number; onChange: (v: number) => void; max: number }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
      <button onClick={() => onChange(Math.max(1, value - 1))}
        style={{ width:40, height:40, background:'#1E2230', border:'1px solid #2A3050', borderRadius:6, color:'#E8EAF0', fontSize:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
      <input type="number" min={1} max={max} value={value} onChange={e => onChange(Number(e.target.value))}
        style={{ ...inputStyle, textAlign:'center', fontWeight:700, fontSize:18, flex:1 }} />
      <button onClick={() => onChange(Math.min(max, value + 1))}
        style={{ width:40, height:40, background:'#1E2230', border:'1px solid #2A3050', borderRadius:6, color:'#E8EAF0', fontSize:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
    </div>
  )
}

// ── Filter bar ────────────────────────────────────────────────────────────────
export const filterBarStyle: CSSProperties = { display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }
export const searchStyle: CSSProperties = { ...inputStyle, flex:1, minWidth:180 }
export const selectStyle: CSSProperties = { ...inputStyle, width:'auto' }

// ── Bar chart ─────────────────────────────────────────────────────────────────
export function BarRow({ label, count, total, color }: { label: ReactNode; count: number; total: number; color: string }) {
  const pct = total ? Math.round((count / total) * 100) : 0
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        {label}<span style={{ color:'#ccc', fontSize:13 }}>{count} ({pct}%)</span>
      </div>
      <div style={{ height:5, background:'#1E2230', borderRadius:3, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:3, transition:'width 0.4s' }} />
      </div>
    </div>
  )
}
