// prisma/seed.ts
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../lib/passwordPolicy'

const prisma = new PrismaClient()

function d(days: number): string {
  const dt = new Date()
  dt.setDate(dt.getDate() + days)
  return dt.toISOString().split('T')[0]
}

async function main() {
  console.log('🌱 Seeding database...')

  // Clear existing data (order matters for FK constraints)
  await prisma.activityLog.deleteMany()
  await prisma.usageLog.deleteMany()
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.user.deleteMany()
  await prisma.product.deleteMany()
  await prisma.teamMember.deleteMany()

  // ── Seed team members ────────────────────────────────────────────────────
  const team = await Promise.all([
    prisma.teamMember.create({ data: { name:'Dr. Sarah Chen',   email:'s.chen@labtrack.io',    role:'admin',      location:'Lab A', status:'active',   avatar:'SC', joined:d(-180), lastActive:d(-1)  }}),
    prisma.teamMember.create({ data: { name:'Mihail Patel',     email:'m.patel@labtrack.io',   role:'technician', location:'Lab B', status:'active',   avatar:'MP', joined:d(-120), lastActive:d(0)   }}),
    prisma.teamMember.create({ data: { name:'Lucia Moreno',     email:'l.moreno@labtrack.io',  role:'technician', location:'Lab C', status:'active',   avatar:'LM', joined:d(-90),  lastActive:d(-3)  }}),
    prisma.teamMember.create({ data: { name:'James Osei',       email:'j.osei@labtrack.io',    role:'viewer',     location:'Lab A', status:'active',   avatar:'JO', joined:d(-60),  lastActive:d(-7)  }}),
    prisma.teamMember.create({ data: { name:'Tomoko Nakamura',  email:'t.nakamura@labtrack.io',role:'technician', location:'Lab B', status:'inactive', avatar:'TN', joined:d(-200), lastActive:d(-30) }}),
  ])
  console.log(`✓ ${team.length} team members created`)

  // ── Seed login users (linked to team members) ────────────────────────────
  // Default password for all demo accounts: LabTrack2024!
  const defaultPassword = await hashPassword('LabTrack2024!')

  const users = await Promise.all([
    prisma.user.create({ data: {
      email: 's.chen@labtrack.io', name: 'Dr. Sarah Chen',
      password: defaultPassword, role: 'admin', status: 'active', avatar: 'SC',
      teamMemberId: team[0].id,
    }}),
    prisma.user.create({ data: {
      email: 'm.patel@labtrack.io', name: 'Mihail Patel',
      password: defaultPassword, role: 'technician', status: 'active', avatar: 'MP',
      teamMemberId: team[1].id,
    }}),
    prisma.user.create({ data: {
      email: 'l.moreno@labtrack.io', name: 'Lucia Moreno',
      password: defaultPassword, role: 'technician', status: 'active', avatar: 'LM',
      teamMemberId: team[2].id,
    }}),
    prisma.user.create({ data: {
      email: 'j.osei@labtrack.io', name: 'James Osei',
      password: defaultPassword, role: 'viewer', status: 'active', avatar: 'JO',
      teamMemberId: team[3].id,
    }}),
  ])
  console.log(`✓ ${users.length} user accounts created`)
  console.log('  Login with any of these accounts, password: LabTrack2024!')
  users.forEach(u => console.log(`  → ${u.email}`))

  // ── Seed products ────────────────────────────────────────────────────────
  const products = await Promise.all([
    prisma.product.create({ data: { name:'Sodium Hypochlorite 10%', barcode:'5901234123457', category:'Disinfectant', lot:'LOT-2241A', location:'Lab A – Shelf 3',   quantity:4,  unit:'bottles', expiry:d(5),   addedBy:'Dr. Sarah Chen', addedOn:d(-30), lowStockThreshold:5,  useWithinDays:30,  openedOn:d(-5),  openedBy:'Mihail Patel'   }}),
    prisma.product.create({ data: { name:'EDTA Buffer Solution',    barcode:'4006381333931', category:'Reagent',      lot:'LOT-8812B', location:'Lab B – Fridge 1',  quantity:12, unit:'vials',   expiry:d(14),  addedBy:'Mihail Patel',   addedOn:d(-20), lowStockThreshold:10                                                                                      }}),
    prisma.product.create({ data: { name:'Ethanol 70%',             barcode:'7350053850149', category:'Solvent',       lot:'LOT-5503C', location:'Lab A – Cabinet 2', quantity:6,  unit:'liters',  expiry:d(62),  addedBy:'Dr. Sarah Chen', addedOn:d(-10), lowStockThreshold:4                                                                                       }}),
    prisma.product.create({ data: { name:'Potassium Chloride',      barcode:'0012345678905', category:'Chemical',      lot:'LOT-3390D', location:'Lab C – Shelf 1',   quantity:2,  unit:'kg',      expiry:d(-3),  addedBy:'Lucia Moreno',   addedOn:d(-60), lowStockThreshold:3                                                                                       }}),
    prisma.product.create({ data: { name:'HRP-Conjugate Antibody',  barcode:'5000159407236', category:'Biological',    lot:'LOT-7701E', location:'Lab B – Fridge 2',  quantity:8,  unit:'vials',   expiry:d(30),  addedBy:'Mihail Patel',   addedOn:d(-5),  lowStockThreshold:5,  useWithinDays:14,  openedOn:d(-10), openedBy:'Dr. Sarah Chen' }}),
    prisma.product.create({ data: { name:'Phosphate Buffer Saline', barcode:'8710908500025', category:'Reagent',       lot:'LOT-1123F', location:'Lab A – Fridge 1',  quantity:20, unit:'sachets', expiry:d(90),  addedBy:'Dr. Sarah Chen', addedOn:d(-2),  lowStockThreshold:8                                                                                       }}),
    prisma.product.create({ data: { name:'Acetic Acid 5%',          barcode:'3045140105502', category:'Solvent',       lot:'LOT-9934G', location:'Lab C – Cabinet 1', quantity:3,  unit:'liters',  expiry:d(2),   addedBy:'Lucia Moreno',   addedOn:d(-45), lowStockThreshold:5                                                                                       }}),
    prisma.product.create({ data: { name:'Trypsin-EDTA Solution',   barcode:'5901234123458', category:'Biological',    lot:'LOT-6620H', location:'Lab B – Fridge 1',  quantity:5,  unit:'vials',   expiry:d(120), addedBy:'Mihail Patel',   addedOn:d(-1),  lowStockThreshold:4,  useWithinDays:7                                                                   }}),
  ])
  console.log(`✓ ${products.length} products created`)

  // ── Seed usage logs ──────────────────────────────────────────────────────
  await prisma.usageLog.createMany({ data: [
    { productId:products[1].id, productName:'EDTA Buffer Solution',   barcode:'4006381333931', qty:2, unit:'vials',  usedBy:'Dr. Sarah Chen', teamMemberId:team[0].id, date:d(-2), note:'PCR prep batch 44',   openedProduct:false },
    { productId:products[2].id, productName:'Ethanol 70%',            barcode:'7350053850149', qty:1, unit:'liters', usedBy:'Mihail Patel',   teamMemberId:team[1].id, date:d(-1), note:'Surface disinfection', openedProduct:false },
    { productId:products[4].id, productName:'HRP-Conjugate Antibody', barcode:'5000159407236', qty:1, unit:'vials',  usedBy:'Lucia Moreno',   teamMemberId:team[2].id, date:d(0),  note:'ELISA run #7',        openedProduct:true  },
  ]})
  console.log('✓ Usage logs created')

  // ── Seed activity log ────────────────────────────────────────────────────
  await prisma.activityLog.createMany({ data: [
    { type:'product_added',     actor:'Dr. Sarah Chen', teamMemberId:team[0].id, productId:products[0].id, target:'Sodium Hypochlorite 10%', detail:`Added to Lab A – Shelf 3 · qty 4 bottles · expiry ${d(5)}` },
    { type:'product_added',     actor:'Mihail Patel',   teamMemberId:team[1].id, productId:products[1].id, target:'EDTA Buffer Solution',    detail:`Added to Lab B – Fridge 1 · qty 12 vials · expiry ${d(14)}` },
    { type:'product_opened',    actor:'Dr. Sarah Chen', teamMemberId:team[0].id, productId:products[4].id, target:'HRP-Conjugate Antibody',  detail:`Opened · use within 14 days · use by ${d(4)}` },
    { type:'threshold_changed', actor:'Dr. Sarah Chen', teamMemberId:team[0].id, productId:products[1].id, target:'EDTA Buffer Solution',    detail:'Low stock threshold: 0 → 10 vials' },
    { type:'user_role_changed', actor:'Dr. Sarah Chen', teamMemberId:team[0].id, target:'James Osei',                                        detail:'Role: technician → viewer' },
    { type:'quantity_changed',  actor:'Lucia Moreno',   teamMemberId:team[2].id, productId:products[6].id, target:'Acetic Acid 5%',          detail:'Quantity: 5 → 3 liters (usage logged)' },
  ]})
  console.log('✓ Activity logs created')

  console.log('\n✅ Seed complete!')
  console.log('\n📋 Demo login credentials:')
  console.log('   Email:    s.chen@labtrack.io  (Admin)')
  console.log('   Password: LabTrack2024!')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

