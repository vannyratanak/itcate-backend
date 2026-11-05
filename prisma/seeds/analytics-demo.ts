// LOCAL TESTING ONLY. Inserts ~150 fake survey responses spread over the last 60 days.
// Refuses to run unless DATABASE_URL points at localhost. Never part of any production seed.
//   DATABASE_URL=postgresql://phanne@localhost:5432/<db> npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seeds/analytics-demo.ts
import { PrismaClient } from '@prisma/client';

if (!/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? '')) {
  console.error('Refusing to run: DATABASE_URL is not a local database.');
  process.exit(1);
}
const prisma = new PrismaClient();
const names = ['Sok Dara', 'Chan Sophea', 'Vannak Chea', 'Lina Kim', 'Rithy Ly', 'Maly Heng', 'Pich Srey', 'Bora Meas', 'Sreyneang Keo', 'Dina Ouk', 'Tola Nget', 'Kosal Phan'];
const comments = ['Great food, loved the tacos!', 'Service was a bit slow tonight.', 'Beautiful place, will come again.', 'Please add more vegetarian dishes.', 'Napkins ran out and nobody noticed.', 'Best guacamole in town, honestly.', 'A little loud on Friday night.', 'Friendly staff, fair prices.'];
const rnd = (n: number) => Math.floor(Math.random() * n);
// position 0 = most positive. Weighted toward the top; some questions skew negative so the low-score flag shows up.
const pickPos = (n: number, skewLow: boolean) => {
  const w = skewLow ? [1, 2, 3, 4, 3] : [5, 4, 2, 1, 0.5];
  const ws = Array.from({ length: n }, (_, i) => w[Math.min(i, w.length - 1)]);
  let r = Math.random() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < n; i++) { r -= ws[i]; if (r <= 0) return i; }
  return n - 1;
};

async function main() {
  const questions = await prisma.menuQuestion.findMany({
    orderBy: { id: 'asc' },
    include: { group_option: { include: { options: { orderBy: { id: 'asc' } } } } },
  });
  if (!questions.length) throw new Error('Run prisma/seed.ts first (survey questions are missing).');
  const lowQuestions = new Set([questions[9]?.id, questions[10]?.id]); // napkins/sauces, seating
  for (let i = 0; i < 150; i++) {
    const created = new Date(Date.now() - Math.random() * 60 * 86_400_000);
    const s = await prisma.survayer.create({
      data: {
        name: names[rnd(names.length)], phoneNumber: `+8551${String(10000000 + rnd(89999999))}`,
        usedToVisit: Math.random() < 0.55, dateVisit: created, created_at: created, updated_at: created,
        survayOption: { create: questions.map((q) => ({
          menu_id: q.id,
          option_id: q.group_option.options[pickPos(q.group_option.options.length, lowQuestions.has(q.id))].option_id,
        })) },
        ...(Math.random() < 0.4 ? { survayMessage: { create: { message: comments[rnd(comments.length)] } } } : {}),
      },
    });
    void s;
  }
  console.log('inserted 150 demo responses');
}
main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
