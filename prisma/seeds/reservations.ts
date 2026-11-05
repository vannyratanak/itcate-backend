// Placeholder reservations + one blocked date. Idempotent: only fills an EMPTY Reservation table.
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const day = (offset: number) => {
  const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + offset); return d;
};

async function main() {
  if ((await prisma.reservation.count()) === 0) {
    const rows: [string, string, number, number, string, string, string?, string?][] = [
      // name, phone, party, dayOffset, time, status, notes, admin_note
      ['Sokha Chan', '+85512345001', 2, 0, '18:30', 'confirmed', 'Anniversary dinner'],
      ['Dara Kim', '+85592345002', 4, 0, '19:00', 'pending', 'High chair for a toddler'],
      ['Mony Sao', '+85577345003', 6, 1, '12:30', 'confirmed', null, 'Called to confirm'],
      ['Vanna Ly', '+85516345004', 3, 1, '20:00', 'pending'],
      ['Sreyneang Heng', '+85581345005', 8, 3, '19:30', 'pending', 'Birthday, bringing a cake'],
      ['Rithy Pich', '+85570345006', 2, 4, '13:00', 'declined', null, 'Fully booked at that time'],
      ['Chenda Oum', '+85510345007', 5, 6, '18:00', 'confirmed', 'Two vegetarians'],
      ['Bopha Tep', '+85569345008', 2, -2, '19:00', 'cancelled', null, 'Guest cancelled by phone'],
    ];
    for (const [name, phone, party_size, off, time, status, notes, admin_note] of rows) {
      await prisma.reservation.create({ data: { name, phone, party_size, date: day(off), time, status, notes: notes ?? null, admin_note: admin_note ?? null } });
    }
    console.log(`seeded ${rows.length} reservations`);
  }
  const blocked = day(10);
  await prisma.blockedDate.upsert({ where: { date: blocked }, update: {}, create: { date: blocked, reason: 'Private event (sample)' } });
}
main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
