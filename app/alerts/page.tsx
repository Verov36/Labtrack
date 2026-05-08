'use client'
// app/alerts/page.tsx
import { useEffect, useState } from 'react'
import { enrichProduct, fmtDate, calcOpenExpiry, STATUS_META, OPEN_META, STOCK_META, type Product } from '@/lib/types'
import { PageHeader, StatusBadge, StockBadge, OpenBadge, SectionHead, Empty } from '@/components/ui'

export default function Alerts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    fetch('/api/products').then(r=>r.json()).then(p => { setProducts(p.map(enrichProduct)); setLoading(false) })
  }, [])

  const expiryAlerts   = products.filter(p=>p.status!=='ok').sort((a,b)=>(a.days??0)-(b.days??0))
  const openIssueItems = products.filter(p=>p.oStatus==='expired'||p.oStatus==='critical'||p.oStatus==='warning').sort((a,b)=>{const o={expired:0,critical:1,warning:2};return (o[a.oStatus as keyof typeof o]??3)-(o[b.oStatus as keyof typeof o]??3)})
  const lowStockItems  = products.filter(p=>p.stockStatus!=='ok').sort((a,b)=>{const o={out:0,critical:1,low:2};return (o[a.stockStatus as keyof typeof o]??3)-(o[b.stockStatus as keyof typeof o]??3)})

  if (loading) return <div style={{color:'#4A5268',padding:40}}>Loading…</div>

  const AlertCard = ({ p, color, children }: { p: Product; color: string; children: React.ReactNode }) => (
    <div style={{ padding:'14px 16px', marginBottom:10, borderRadius:8, borderLeft:`3px solid ${color}`, background:`${color}12` }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:'#E8EAF0' }}>{p.name}</div>
          <div style={{ fontSize:11, color:'#4A5268', marginTop:2 }}>{p.lot} · {p.location}</div>
          {p.barcode && <div style={{ fontSize:10, fontFamily:'monospace', color:'#4A5268', marginTop:2 }}>{p.barcode}</div>}
        </div>
        <div style={{ textAlign:'right', flexShrink:0 }}>{children}</div>
      </div>
    </div>
  )

  return (
    <div>
      <PageHeader title="Alerts" sub="All active issues requiring attention" />

      {/* Open/In-Use — top priority */}
      <SectionHead color="#E040FB">⊙ Open / In-Use Expiry — {openIssueItems.length} items</SectionHead>
      {openIssueItems.length === 0
        ? <div style={{ background:'#13161E', border:'1px solid #1E2230', borderRadius:8, padding:'18px 20px', marginBottom:20 }}><Empty>No open-use expiry issues ✓</Empty></div>
        : <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:24 }}>
          {openIssueItems.map(p => {
            const pct = p.useWithinDays ? Math.max(0,Math.min(100,Math.round(((p.openDays||0)/p.useWithinDays)*100))) : 0
            const col = OPEN_META[p.oStatus!]?.color || '#888'
            return (
              <div key={p.id} style={{ padding:'14px 16px', borderRadius:8, borderLeft:`3px solid ${col}`, background:`${col}15` }}>
                <div style={{ display:'flex', justifyContent:'space-between', gap:12 }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:'#E8EAF0' }}>{p.name}</div>
                    <div style={{ fontSize:11, color:'#4A5268', marginTop:2 }}>{p.location} · {p.category}</div>
                    <div style={{ fontSize:11, color:'#6B7494', marginTop:3 }}>Opened {fmtDate(p.openedOn)} by {p.openedBy} · {p.useWithinDays}d limit</div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <OpenBadge status={p.oStatus!}/>
                    <div style={{ fontSize:18, fontWeight:800, color:col, marginTop:4 }}>{p.openDays!=null?(p.openDays<0?`${Math.abs(p.openDays)}d overdue`:`${p.openDays}d left`):''}</div>
                    <div style={{ fontSize:11, color:'#4A5268' }}>Use by {fmtDate(calcOpenExpiry(p.openedOn,p.useWithinDays))}</div>
                  </div>
                </div>
                <div style={{ marginTop:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ flex:1, height:5, background:'rgba(0,0,0,0.2)', borderRadius:3, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:col, borderRadius:3 }}/>
                    </div>
                    <span style={{ fontSize:10, color:'#4A5268' }}>{pct}% remaining</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      }

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        {/* Expiry */}
        <div>
          <SectionHead color="#FF3B30">Expiry Alerts — {expiryAlerts.length} items</SectionHead>
          {expiryAlerts.length === 0
            ? <div style={{ background:'#13161E', border:'1px solid #1E2230', borderRadius:8, padding:'18px 20px' }}><Empty>No expiry issues ✓</Empty></div>
            : expiryAlerts.map(p => (
              <AlertCard key={p.id} p={p} color={STATUS_META[p.status!]?.color||'#888'}>
                <StatusBadge status={p.status!}/>
                <div style={{ fontSize:14, fontWeight:700, color:STATUS_META[p.status!]?.color, marginTop:3 }}>{(p.days??0)<0?`${Math.abs(p.days!)}d overdue`:`${p.days}d left`}</div>
                <div style={{ fontSize:11, color:'#4A5268' }}>Exp. {fmtDate(p.expiry)}</div>
              </AlertCard>
            ))
          }
        </div>

        {/* Stock */}
        <div>
          <SectionHead color="#F5A623">Stock Alerts — {lowStockItems.length} items</SectionHead>
          {lowStockItems.length === 0
            ? <div style={{ background:'#13161E', border:'1px solid #1E2230', borderRadius:8, padding:'18px 20px' }}><Empty>All well stocked ✓</Empty></div>
            : lowStockItems.map(p => (
              <AlertCard key={p.id} p={p} color={STOCK_META[p.stockStatus!]?.color||'#888'}>
                <StockBadge status={p.stockStatus!}/>
                <div style={{ fontSize:20, fontWeight:800, color:STOCK_META[p.stockStatus!]?.color, marginTop:3 }}>{p.quantity} <span style={{ fontSize:11, fontWeight:400, color:'#4A5268' }}>{p.unit}</span></div>
                <div style={{ fontSize:11, color:'#4A5268' }}>min: {p.lowStockThreshold}</div>
              </AlertCard>
            ))
          }
        </div>
      </div>
    </div>
  )
}
