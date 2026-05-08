'use client'
// app/activity/page.tsx
import { useEffect, useState } from 'react'
import { ACTIVITY_META, avatarColor, type ActivityLog, type TeamMember } from '@/lib/types'
import { PageHeader, Table, THead, TRow, TD, Empty, filterBarStyle, searchStyle, selectStyle } from '@/components/ui'

export default function ActivityPage() {
  const [logs,   setLogs]   = useState<ActivityLog[]>([])
  const [team,   setTeam]   = useState<TeamMember[]>([])
  const [loading, setL]     = useState(true)
  const [search,  setSearch] = useState('')
  const [filter,  setFilter] = useState('all')

  useEffect(() => {
    Promise.all([fetch('/api/activity').then(r=>r.json()), fetch('/api/team').then(r=>r.json())])
      .then(([a,t]) => { setLogs(a); setTeam(t); setL(false) })
  }, [])

  const fmtTs = (ts: string) => {
    const dt = new Date(ts)
    return dt.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) + ' ' + dt.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})
  }

  const filtered = logs.filter(e => {
    const typeOk = filter==='all' || e.type===filter
    const s = search.toLowerCase()
    const srchOk = !s || e.target.toLowerCase().includes(s) || e.actor.toLowerCase().includes(s) || e.detail.toLowerCase().includes(s)
    return typeOk && srchOk
  })

  const COLS    = '1.6fr 1fr 1.4fr 3fr 1fr'
  const HEADERS = ['Date & Time','Event','Actor','Detail','Target']

  if (loading) return <div style={{color:'#4A5268',padding:40}}>Loading…</div>

  return (
    <div>
      <PageHeader title="Activity Log" sub={`${logs.length} events recorded`}/>

      {/* Summary chips */}
      <div style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap'}}>
        {Object.entries(ACTIVITY_META).map(([key,m]) => {
          const count = logs.filter(e=>e.type===key).length
          if (!count) return null
          return (
            <button key={key} onClick={()=>setFilter(f=>f===key?'all':key)}
              style={{ display:'flex',alignItems:'center',gap:6,background:'#13161E',border:`1px solid ${filter===key?m.color:'#1E2230'}`,borderRadius:6,padding:'6px 12px',cursor:'pointer' }}>
              <span style={{color:m.color,fontSize:13}}>{m.icon}</span>
              <span style={{fontSize:12,color:'#B0B8CC'}}>{m.label}</span>
              <span style={{fontSize:11,fontWeight:700,color:m.color,background:`${m.color}22`,padding:'1px 6px',borderRadius:10}}>{count}</span>
            </button>
          )
        })}
        {filter!=='all'&&<button onClick={()=>setFilter('all')} style={{background:'transparent',border:'1px solid #1E2230',borderRadius:5,color:'#4FC3F7',padding:'5px 12px',cursor:'pointer',fontSize:12,fontWeight:600}}>✕ Clear</button>}
      </div>

      <div style={filterBarStyle}>
        <input style={searchStyle} placeholder="Search product, user, detail…" value={search} onChange={e=>setSearch(e.target.value)}/>
        <select style={selectStyle} value={filter} onChange={e=>setFilter(e.target.value)}>
          <option value="all">All Event Types</option>
          {Object.entries(ACTIVITY_META).map(([k,m])=><option key={k} value={k}>{m.label}</option>)}
        </select>
      </div>

      <Table>
        <THead cols={COLS} labels={HEADERS}/>
        {filtered.map(e => {
          const m = ACTIVITY_META[e.type] || { icon:'•', label:e.type, color:'#8899BB' }
          const member = team.find(u=>u.name===e.actor)
          return (
            <TRow key={e.id} cols={COLS} highlight={`${m.color}08`}>
              <TD><span style={{fontSize:12,color:'#6B7494'}}>{fmtTs(e.createdAt)}</span></TD>
              <TD><span style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,fontWeight:700,padding:'3px 8px',borderRadius:4,background:`${m.color}18`,color:m.color}}><span>{m.icon}</span><span>{m.label}</span></span></TD>
              <TD>
                <div style={{display:'flex',alignItems:'center',gap:7}}>
                  {member&&<div style={{width:22,height:22,borderRadius:'50%',background:avatarColor(member.id),color:'#0D0F14',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:800}}>{member.avatar}</div>}
                  <span style={{fontSize:12,color:'#B0B8CC'}}>{e.actor}</span>
                </div>
              </TD>
              <TD><span style={{fontSize:12,color:'#6B7494'}}>{e.detail}</span></TD>
              <TD><span style={{fontSize:12,fontWeight:600,color:'#E8EAF0'}}>{e.target}</span></TD>
            </TRow>
          )
        })}
        {filtered.length===0&&<Empty>No matching activity events</Empty>}
      </Table>
    </div>
  )
}
