// Placeholder offers + events (idempotent: only fills an EMPTY Offer table) and approves a few survey comments.
// Run:  npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seeds/offers.ts
// Khmer text: hand-written placeholder wording (Google Translate was rate-limited); have a native speaker proof-read.
import { PrismaClient } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();
const UPLOADS = join(process.cwd(), 'uploads');

// Warm-coloured placeholder artwork, written to uploads/ so the admin/website can serve it like any uploaded image.
const art = (emoji: string, c1: string, c2: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="800" height="500" fill="url(#g)"/><circle cx="640" cy="90" r="150" fill="#fff" fill-opacity=".12"/><circle cx="110" cy="440" r="190" fill="#fff" fill-opacity=".1"/><text x="400" y="320" font-size="200" text-anchor="middle">${emoji}</text></svg>`;

const days = (n: number, hour = 19) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(hour, 0, 0, 0); return d; };

type Seed = { key: string; kind: 'offer' | 'event'; emoji: string; c: [string, string]; en: [string, string]; kh: [string, string]; starts?: Date; ends?: Date };

const SEEDS: Seed[] = [
  { key: 'taco-tuesday', kind: 'offer', emoji: '🌮', c: ['#F0A43A', '#C8641A'], en: ['Taco Tuesday', 'Every Tuesday, enjoy three tacos of your choice for one special price. Dine in only.'], kh: ["តាកូថ្ងៃអង្គារ", "រៀងរាល់ថ្ងៃអង្គារ ទទួលទានតាកូបីតាមការជ្រើសរើសរបស់អ្នក ក្នុងតម្លៃពិសេសតែមួយ សម្រាប់ញ៉ាំនៅហាងប៉ុណ្ណោះ"] },
  { key: 'happy-hour', kind: 'offer', emoji: '🍹', c: ['#E5902C', '#9C3D1B'], en: ['Happy Hour', 'Half-price margaritas and cold beers every weekday from 3 PM to 6 PM.'], kh: ["ម៉ោងសប្បាយ", "ម៉ាហ្គារីតាតម្លៃពាក់កណ្តាល និងស្រាបៀរត្រជាក់ រៀងរាល់ថ្ងៃធ្វើការ ចាប់ពីម៉ោង ៣ រសៀល ដល់ម៉ោង ៦ ល្ងាច"], ends: days(60, 23) },
  { key: 'family-feast', kind: 'offer', emoji: '🍽️', c: ['#D9822B', '#7A4A17'], en: ['Family Feast', 'A shared platter for four with nachos, enchiladas, fajitas and dessert at a set price.'], kh: ["ពិធីជប់លៀងគ្រួសារ", "ចានចែករំលែកសម្រាប់មនុស្សបួននាក់ មាននាឆូស អេនឆីឡាដា ហ្វាហ៊ីតា និងបង្អែម ក្នុងតម្លៃកំណត់"] },
  { key: 'birthday-treat', kind: 'offer', emoji: '🎂', c: ['#F3B35A', '#B5541C'], en: ['Birthday Treat', 'Celebrating your birthday with us? Enjoy a free dessert with a candle when you book a table.'], kh: ["អំណោយថ្ងៃកំណើត", "ប្រារព្ធថ្ងៃកំណើតជាមួយយើងមែនទេ? ទទួលបង្អែមឥតគិតថ្លៃមួយជាមួយទៀនមួយ នៅពេលអ្នកកក់តុ"] },
  { key: 'mariachi-night', kind: 'event', emoji: '🎺', c: ['#E5902C', '#5C2E0E'], en: ['Live Mariachi Night', 'An evening of live mariachi music with a special set menu. Booking is recommended.'], kh: ["យប់តន្ត្រីម៉ារីអាឆីបន្តផ្ទាល់", "រាត្រីតន្ត្រីម៉ារីអាឆីបន្តផ្ទាល់ ជាមួយម្ហូបកំណត់ពិសេស ណែនាំឱ្យកក់ទុកជាមុន"], starts: days(9, 19) },
  { key: 'tequila-tasting', kind: 'event', emoji: '🥃', c: ['#C9822A', '#6B3A12'], en: ['Tequila Tasting', 'Taste five premium tequilas guided by our bartender, paired with small bites.'], kh: ["ភ្លក់តេគីឡា", "ភ្លក់តេគីឡាកម្រិតខ្ពស់ប្រាំប្រភេទ ដែលណែនាំដោយអ្នកលាយភេសជ្ជៈរបស់យើង ជាមួយអាហារស្រាលៗ"], starts: days(23, 18) },
  { key: 'christmas-eve', kind: 'event', emoji: '🎄', c: ['#B9722A', '#4F2A0C'], en: ['Christmas Eve Dinner', 'A festive multi-course dinner with live music. Limited seats, reserve early.'], kh: ["អាហារពេលល្ងាចបុណ្យណូអែល", "អាហារពេលល្ងាចបុណ្យច្រើនមុខ ជាមួយតន្ត្រីបន្តផ្ទាល់ កៅអីមានកំណត់ សូមកក់ទុកឱ្យលឿន"], starts: new Date(new Date().getFullYear() + (new Date() > new Date(new Date().getFullYear(), 11, 24) ? 1 : 0), 11, 24, 19, 0) },
  { key: 'cinco-de-mayo', kind: 'event', emoji: '🎉', c: ['#D88B35', '#8A3F1B'], en: ['Cinco de Mayo Party', 'Our big spring fiesta with music, margaritas and a special menu. (This event has ended.)'], kh: ["ពិធីជប់លៀងស៊ីនកូដឺម៉ាយយ៉ូ", "ពិធីបុណ្យនិទាឃរដូវដ៏ធំរបស់យើង ជាមួយតន្ត្រី ម៉ាហ្គារីតា និងម្ហូបពិសេស (ព្រឹត្តិការណ៍នេះបានបញ្ចប់ហើយ)"], starts: days(-190, 18) }, // already over: hidden on the website, shown as "Expired" in the admin
];

async function main() {
  if ((await prisma.offer.count()) === 0) {
    mkdirSync(UPLOADS, { recursive: true });
    let i = { offer: 0, event: 0 };
    for (const s of SEEDS) {
      const file = `seed-${s.key}.svg`;
      writeFileSync(join(UPLOADS, file), art(s.emoji, s.c[0], s.c[1]));
      await prisma.offer.create({
        data: {
          kind: s.kind, title_en: s.en[0], body_en: s.en[1], title_kh: s.kh[0], body_kh: s.kh[1],
          image_url: `/uploads/${file}`, starts_at: s.starts ?? null, ends_at: s.ends ?? null, sort_order: i[s.kind]++,
        },
      });
    }
    console.log(`offers: seeded ${SEEDS.length}`);
  } else console.log('offers: table not empty, skipped');

  // Publish a few existing survey comments on the Reviews page (only if none are published yet).
  if ((await prisma.survayerMessage.count({ where: { approved: true } })) === 0) {
    const pick = await prisma.survayerMessage.findMany({ where: { message: { not: '' } }, orderBy: { id: 'asc' }, take: 4, select: { id: true } });
    if (pick.length) await prisma.survayerMessage.updateMany({ where: { id: { in: pick.map((p) => p.id) } }, data: { approved: true } });
    console.log(`reviews: approved ${pick.length} comment(s)`);
  }
}
main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
