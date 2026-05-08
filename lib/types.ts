// lib/types.ts
export type ExpiryStatus = 'expired' | 'critical' | 'warning' | 'ok'
export type StockStatus  = 'out' | 'critical' | 'low' | 'ok'
export type OpenStatus   = 'expired' | 'critical' | 'warning' | 'ok' | 'sealed' | 'none'
export type UserRole     = 'admin' | 'technician' | 'viewer'

export interface Product {
  id: number
  name: string
  barcode?: string | null
  category: string
  lot: string
  location: string
  quantity: number
  unit: string
  expiry: string
  addedBy: string
  addedOn: string
  lowStockThreshold: number
  useWithinDays?: number | null
  openedOn?: string | null
  openedBy?: string | null
  deletedAt?: string | null
  // computed
  days?: number
  status?: ExpiryStatus
  stockStatus?: StockStatus
  openExpiry?: string | null
  openDays?: number | null
  oStatus?: OpenStatus
}

export interface TeamMember {
  id: number
  name: string
  email: string
  role: UserRole
  location: string
  status: string
  avatar: string
  joined: string
  lastActive: string
}

export interface UsageLog {
  id: number
  productId: number
  productName: string
  barcode?: string | null
  qty: number
  unit: string
  usedBy: string
  teamMemberId?: number | null
  date: string
  note?: string | null
  openedProduct: boolean
}

export interface ActivityLog {
  id: number
  type: string
  target: string
  detail: string
  actor: string
  teamMemberId?: number | null
  productId?: number | null
  createdAt: string
}

// ── Date/status helpers (shared between client + server) ──────────────────────
export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const exp = new Date(dateStr), now = new Date()
  now.setHours(0,0,0,0); exp.setHours(0,0,0,0)
  return Math.round((exp.getTime() - now.getTime()) / 86400000)
}

export function expiryStatus(days: number | null): ExpiryStatus {
  if (days == null) return 'ok'
  if (days < 0)  return 'expired'
  if (days <= 7) return 'critical'
  if (days <= 30) return 'warning'
  return 'ok'
}

export function stockStatus(qty: number, threshold: number): StockStatus {
  if (!threshold || threshold <= 0) return 'ok'
  if (qty <= 0)                     return 'out'
  if (qty <= threshold * 0.5)       return 'critical'
  if (qty <= threshold)             return 'low'
  return 'ok'
}

export function calcOpenExpiry(openedOn: string | null | undefined, useWithinDays: number | null | undefined): string | null {
  if (!openedOn || !useWithinDays) return null
  const dt = new Date(openedOn)
  dt.setDate(dt.getDate() + useWithinDays)
  return dt.toISOString().split('T')[0]
}

export function openStatus(p: Product): OpenStatus {
  if (!p.useWithinDays) return 'none'
  if (!p.openedOn) return 'sealed'
  const days = daysUntil(calcOpenExpiry(p.openedOn, p.useWithinDays))
  return expiryStatus(days)
}

export function enrichProduct(p: Product): Product {
  const days      = daysUntil(p.expiry)
  const status    = expiryStatus(days)
  const sStatus   = stockStatus(p.quantity, p.lowStockThreshold)
  const openExp   = calcOpenExpiry(p.openedOn, p.useWithinDays)
  const openDays  = openExp ? daysUntil(openExp) : null
  const oStatus   = openStatus(p)
  return { ...p, days, status, stockStatus: sStatus, openExpiry: openExp, openDays, oStatus }
}

export function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
}

export function today(): string {
  return new Date().toISOString().split('T')[0]
}

export const STATUS_META: Record<ExpiryStatus, { label: string; color: string; bg: string }> = {
  expired:  { label:'Expired',  color:'#FF3B30', bg:'rgba(255,59,48,0.12)'  },
  critical: { label:'Critical', color:'#FF6B00', bg:'rgba(255,107,0,0.12)'  },
  warning:  { label:'Warning',  color:'#F5A623', bg:'rgba(245,166,35,0.12)' },
  ok:       { label:'In Date',  color:'#34C759', bg:'rgba(52,199,89,0.12)'  },
}

export const STOCK_META: Record<StockStatus, { label: string; color: string; bg: string }> = {
  out:      { label:'Out of Stock', color:'#FF3B30', bg:'rgba(255,59,48,0.12)'  },
  critical: { label:'Very Low',     color:'#FF6B00', bg:'rgba(255,107,0,0.12)'  },
  low:      { label:'Low Stock',    color:'#F5A623', bg:'rgba(245,166,35,0.12)' },
  ok:       { label:'In Stock',     color:'#34C759', bg:'rgba(52,199,89,0.12)'  },
}

export const OPEN_META: Record<OpenStatus, { label: string; color: string; bg: string }> = {
  expired:  { label:'Use-By Passed', color:'#FF3B30', bg:'rgba(255,59,48,0.15)'  },
  critical: { label:'Use Soon',      color:'#FF6B00', bg:'rgba(255,107,0,0.15)'  },
  warning:  { label:'Use By Soon',   color:'#F5A623', bg:'rgba(245,166,35,0.15)' },
  ok:       { label:'Open — OK',     color:'#34C759', bg:'rgba(52,199,89,0.15)'  },
  sealed:   { label:'Sealed',        color:'#4A5268', bg:'rgba(74,82,104,0.15)'  },
  none:     { label:'No Limit',      color:'#4A5268', bg:'rgba(74,82,104,0.12)'  },
}

export const ROLES: Record<UserRole, { label: string; color: string; bg: string; desc: string }> = {
  admin:      { label:'Admin',      color:'#FF6B00', bg:'rgba(255,107,0,0.12)',   desc:'Full access — manage team, products, and settings' },
  technician: { label:'Technician', color:'#4FC3F7', bg:'rgba(79,195,247,0.12)',  desc:'Can add/use products and view all data' },
  viewer:     { label:'Viewer',     color:'#8899BB', bg:'rgba(136,153,187,0.12)', desc:'Read-only access to inventory and reports' },
}

export const ACTIVITY_META: Record<string, { icon: string; label: string; color: string }> = {
  product_added:       { icon:'＋', label:'Product Added',        color:'#34C759' },
  product_edited:      { icon:'✎',  label:'Product Edited',       color:'#4FC3F7' },
  quantity_changed:    { icon:'↕',  label:'Quantity Changed',     color:'#4FC3F7' },
  expiry_changed:      { icon:'📅', label:'Expiry Changed',       color:'#F5A623' },
  threshold_changed:   { icon:'↓',  label:'Threshold Changed',    color:'#B39DDB' },
  product_opened:      { icon:'⊙',  label:'Product Opened',       color:'#E040FB' },
  user_role_changed:   { icon:'◎',  label:'Role Changed',         color:'#FF6B00' },
  user_status_changed: { icon:'◎',  label:'User Status Changed',  color:'#8899BB' },
  product_deleted:     { icon:'✕',  label:'Product Deleted',      color:'#FF3B30' },
}

export const CATEGORIES = ['All','Reagent','Disinfectant','Solvent','Chemical','Biological']
export const LOCATIONS   = ['Lab A – Shelf 3','Lab A – Cabinet 2','Lab A – Fridge 1','Lab B – Fridge 1','Lab B – Fridge 2','Lab C – Shelf 1','Lab C – Cabinet 1']
export const AVATAR_COLORS = ['#4FC3F7','#FF6B00','#34C759','#F5A623','#B39DDB','#F48FB1','#80CBC4']
export const avatarColor = (id: number) => AVATAR_COLORS[(id - 1) % AVATAR_COLORS.length]
