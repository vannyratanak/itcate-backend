// Placeholder inbox messages. Safe to re-run: only fills when the table is empty.
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const ago = (h: number) => new Date(Date.now() - h * 3600_000);

const rows = [
  { kind: 'contact', name: 'Sokha Chan', email: 'sokha@example.com', phone: '+855 12 111 222', subject: 'Opening hours on public holidays', message: 'Hello! Are you open on Khmer New Year? We would love to come with the family.', status: 'new', created_at: ago(2) },
  { kind: 'contact', name: 'Dara Kim', email: 'dara.kim@example.com', phone: null, subject: 'Vegetarian options', message: 'Do you have vegetarian or vegan dishes? My sister does not eat meat.', status: 'read', created_at: ago(20) },
  { kind: 'contact', name: 'Maly Sok', email: null, phone: '+855 97 555 0101', subject: 'Lost item', message: 'I think I left a blue scarf on Saturday evening near the window table. Could you check?', status: 'replied', created_at: ago(70) },
  { kind: 'catering', name: 'Vanna Heng', email: 'vanna@company.example', phone: '+855 92 333 444', subject: 'Company year-end dinner', message: 'We would like a set menu for our team dinner with a vegetarian option for 3 people.', data: { event_date: '2026-12-19', guests: 40, event_type: 'Corporate dinner' }, status: 'new', created_at: ago(5) },
  { kind: 'catering', name: 'Srey Pich', email: 'sreypich@example.com', phone: '+855 78 222 333', subject: 'Birthday party', message: 'Looking for a private room for a 30th birthday. Can we bring our own cake?', data: { event_date: '2027-01-09', guests: 18, event_type: 'Birthday' }, status: 'read', created_at: ago(30) },
  { kind: 'catering', name: 'Rithy Long', email: 'rithy@example.com', phone: null, subject: 'Wedding reception enquiry', message: 'Planning a small reception for around 80 guests next March. Please send packages and prices.', data: { event_date: '2027-03-13', guests: 80, event_type: 'Wedding' }, status: 'archived', created_at: ago(200) },
  { kind: 'gift_card', name: 'Nary Phan', email: 'nary@example.com', phone: '+855 10 987 654', subject: 'Gift card', message: 'Happy birthday Bopha! Enjoy a lovely dinner on me.', data: { amount: 50, recipient_name: 'Bopha' }, status: 'new', created_at: ago(8) },
  { kind: 'gift_card', name: 'Chea Vuthy', email: null, phone: '+855 16 444 888', subject: 'Gift card', message: '(gift card request)', data: { amount: 25, recipient_name: 'Mom' }, status: 'replied', created_at: ago(90) },
  { kind: 'career', name: 'Sopheak Lim', email: 'sopheak@example.com', phone: '+855 15 321 654', subject: 'Application: Line Cook', message: 'I have 3 years of kitchen experience and I am available for evening shifts.', data: { job_id: 1, job_title: 'Line Cook' }, status: 'new', created_at: ago(12) },
  { kind: 'career', name: 'Kunthea Roth', email: 'kunthea@example.com', phone: null, subject: 'Application: Server', message: 'Friendly, speaks Khmer, English and some Spanish. Happy to do a trial shift.', data: { job_id: 2, job_title: 'Server' }, status: 'read', created_at: ago(48) },
];

async function main() {
  if ((await prisma.contactMessage.count()) > 0) { console.log('messages: table not empty, skipping'); return; }
  await prisma.contactMessage.createMany({ data: rows as any });
  console.log(`messages: seeded ${rows.length}`);
}
main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
