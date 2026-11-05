// Placeholder blog posts (English + Khmer) with generated SVG covers. Idempotent: only fills an EMPTY BlogPost table.
//   npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seeds/blog.ts
// Khmer text was written directly (Google Translate was rate-limited): have a native speaker proof-read it.
import { PrismaClient } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();
const UPLOADS = join(process.cwd(), 'uploads');

const svg = (inner: string, c1: string, c2: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 750" width="1200" height="750"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="1200" height="750" fill="url(#g)"/>${inner}</svg>`;

const COVERS: Record<string, string> = {
  // agave rosette
  agave: svg(
    [0, 1, 2, 3, 4, 5, 6].map((i) => `<path d="M600 640 C ${470 + i * 43} 450 ${540 + i * 20} 300 600 150 C ${660 - i * 20 + 40} 300 ${730 - i * 43 + 40} 450 600 640 Z" fill="#2f7d6d" opacity="${0.55 + i * 0.06}" transform="rotate(${(i - 3) * 18} 600 640)"/>`).join('') +
      '<circle cx="190" cy="140" r="70" fill="#fff6d6" opacity=".7"/><circle cx="1040" cy="620" r="110" fill="#fff6d6" opacity=".25"/>',
    '#f7d79a', '#e5902c'),
  // chilies
  chili: svg(
    '<path d="M290 250 C 290 205 345 185 395 205 C 580 275 790 410 890 600 C 925 665 855 705 805 660 C 660 530 475 410 325 355 C 300 345 290 305 290 250 Z" fill="#c8321f"/><path d="M335 200 C 315 160 330 120 370 112 C 372 145 385 170 400 190 Z" fill="#3a7d33"/>' +
      '<path d="M560 150 C 560 105 615 85 665 105 C 830 170 980 300 1050 470 C 1075 530 1010 560 970 520 C 870 410 740 310 595 255 C 570 245 560 205 560 150 Z" fill="#e0502b" opacity=".95"/><path d="M605 100 C 585 62 600 25 640 18 C 642 50 655 72 670 92 Z" fill="#3a7d33"/>' +
      '<circle cx="990" cy="150" r="60" fill="#fff6d6" opacity=".6"/>',
    '#fbe3b0', '#f0a24a'),
  // corn cob
  corn: svg(
    '<g transform="rotate(-18 600 380)"><ellipse cx="600" cy="380" rx="120" ry="270" fill="#f2c230"/>' +
      Array.from({ length: 9 }, (_, r) => Array.from({ length: 5 }, (_, c) => `<ellipse cx="${540 + c * 30}" cy="${170 + r * 48}" rx="12" ry="17" fill="#f7da6a" opacity=".9"/>`).join('')).join('') +
      '<path d="M600 650 C 470 600 440 430 470 300 C 520 460 560 540 600 650 Z" fill="#5c9a3d"/><path d="M600 650 C 730 600 760 430 730 300 C 680 460 640 540 600 650 Z" fill="#6fb04a"/></g>' +
      '<circle cx="1010" cy="150" r="80" fill="#fff6d6" opacity=".6"/>',
    '#fff0c2', '#f0b45a'),
  // sun + string lights
  sun: svg(
    '<circle cx="600" cy="470" r="190" fill="#ffd36b"/>' +
      Array.from({ length: 16 }, (_, i) => `<rect x="594" y="205" width="12" height="70" rx="6" fill="#ffe7a6" transform="rotate(${i * 22.5} 600 470)"/>`).join('') +
      '<path d="M0 120 C 300 220 900 220 1200 120" stroke="#4a3412" stroke-width="5" fill="none"/>' +
      Array.from({ length: 11 }, (_, i) => { const x = 60 + i * 108; const y = 120 + Math.sin((i / 10) * Math.PI) * 78 + 12; return `<circle cx="${x}" cy="${y}" r="15" fill="#fff6d6"/><circle cx="${x}" cy="${y}" r="30" fill="#fff6d6" opacity=".3"/>`; }).join('') +
      '<path d="M0 640 H1200 V750 H0 Z" fill="#4a3412" opacity=".85"/>',
    '#f08a3c', '#a2481a'),
};

const POSTS = [
  {
    "slug": "welcome-to-itacate",
    "cover": "agave",
    "days": 21,
    "title_en": "Welcome to Itacate: our story so far",
    "title_kh": "ស្វាគមន៍មកកាន់ Itacate៖ រឿងរ៉ាវរបស់យើងរហូតមកដល់ពេលនេះ",
    "excerpt_en": "How a small family kitchen became Phnom Penh's favourite place for honest Mexican food.",
    "excerpt_kh": "របៀបដែលផ្ទះបាយគ្រួសារតូចមួយបានក្លាយជាកន្លែងដែលអ្នករស់នៅភ្នំពេញចូលចិត្តបំផុតសម្រាប់អាហារម៉ិកស៊ិកពិតប្រាកដ។",
    "html_en": "<p>Itacate started with a simple idea: share the food we grew up eating with the people we love. What began as a tiny kitchen and six tables has grown into a warm, noisy, delicious place where friends gather every night.</p><h2>What makes us different</h2><p>We make our tortillas by hand every morning, roast our salsas over open flame and buy as much as we can from nearby farms. Nothing is rushed and nothing comes out of a packet.</p><ul><li>Fresh masa, pressed and cooked to order</li><li>Salsas roasted in small batches each day</li><li>Local vegetables and fish whenever we can</li></ul><blockquote>Good food is simply good people cooking with care.</blockquote><p>Come hungry, bring your family and stay for dessert. We would love to meet you.</p>",
    "html_kh": "<p>Itacate ចាប់ផ្តើមពីគំនិតសាមញ្ញមួយ៖ ចែករំលែកម្ហូបដែលយើងធ្លាប់ញ៉ាំកាលពីតូចជាមួយមនុស្សដែលយើងស្រលាញ់។ អ្វីដែលចាប់ផ្តើមពីផ្ទះបាយតូចមួយ និងតុប្រាំមួយ បានរីកធំជាកន្លែងកក់ក្តៅ រស់រវើក និងឆ្ងាញ់ ដែលមិត្តភក្តិជួបជុំគ្នារាល់ល្ងាច។</p><h2>អ្វីដែលធ្វើឱ្យយើងខុសគេ</h2><p>យើងធ្វើតូទីយ៉ាដោយដៃរាល់ព្រឹក អាំងសាល់ស្សាលើភ្លើងបើកចំហ ហើយទិញគ្រឿងផ្សំពីកសិដ្ឋានក្បែរៗឱ្យបានច្រើនតាមដែលអាចធ្វើបាន។ គ្មានអ្វីត្រូវប្រញាប់ប្រញាល់ ហើយគ្មានអ្វីមកពីកញ្ចប់ស្រាប់ឡើយ។</p><ul><li>ម៉ាសាស្រស់ សង្កត់ និងចម្អិនតាមការកម្មង់</li><li>សាល់ស្សាអាំងជាបរិមាណតិចៗរៀងរាល់ថ្ងៃ</li><li>បន្លែ និងត្រីក្នុងស្រុក នៅពេលណាដែលអាចធ្វើបាន</li></ul><blockquote>ម្ហូបឆ្ងាញ់គឺគ្រាន់តែជាមនុស្សល្អៗដែលចម្អិនដោយយកចិត្តទុកដាក់។</blockquote><p>សូមមកទាំងឃ្លាន នាំគ្រួសារមកជាមួយ ហើយនៅញ៉ាំបង្អែមផង។ យើងសង្ឃឹមថានឹងបានជួបអ្នក។</p>"
  },
  {
    "slug": "five-dishes-to-try",
    "cover": "chili",
    "days": 14,
    "title_en": "Five dishes you have to try this season",
    "title_kh": "មុខម្ហូបទាំងប្រាំដែលអ្នកត្រូវតែសាកល្បងក្នុងរដូវកាលនេះ",
    "excerpt_en": "From smoky street-style tacos to a flan that disappears in minutes: our team's favourites right now.",
    "excerpt_kh": "ពីតាកូស្ទីលតាមដងផ្លូវដែលមានក្លិនផ្សែង ដល់ហ្វ្លង់ដែលអស់ក្នុងប៉ុន្មាននាទី៖ មុខម្ហូបដែលក្រុមការងារយើងចូលចិត្តបំផុតពេលនេះ។",
    "html_en": "<p>Choosing from our menu is hard, so we asked the kitchen team to name the dishes they are proudest of this season.</p><h2>The shortlist</h2><ul><li>Street-style tacos al pastor with grilled pineapple</li><li>Slow-cooked chicken mole with sesame and rice</li><li>Crispy fish tacos with lime slaw</li><li>Charred corn with chili, lime and cheese</li><li>Vanilla flan with a caramel crown</li></ul><p>Everything is made to share, so order a few plates for the table and pass them around.</p><p>Ask your server about the chef's pick of the week. It changes with the market and it is rarely on the printed menu.</p>",
    "html_kh": "<p>ការជ្រើសរើសពីម៉ឺនុយរបស់យើងគឺពិបាក ដូច្នេះយើងបានសួរក្រុមផ្ទះបាយឱ្យប្រាប់មុខម្ហូបដែលពួកគេមានមោទនភាពបំផុតក្នុងរដូវកាលនេះ។</p><h2>បញ្ជីខ្លីដែលបានជ្រើសរើស</h2><ul><li>តាកូស្អាល់ប៉ាស្តរ ស្ទីលតាមដងផ្លូវ ជាមួយម្នាស់អាំង</li><li>មាន់ស្ងោរយឺតជាមួយម៉ូលេ ល្ង និងបាយ</li><li>តាកូសត្រីក្រៀបជាមួយសាឡាត់ស្ពៃក្រូចឆ្មារ</li><li>ពោតអាំងជាមួយម្ទេស ក្រូចឆ្មារ និងឈីស</li><li>ហ្វ្លង់វ៉ានីឡា ជាមួយស្ករដុតនៅលើ</li></ul><p>មុខម្ហូបទាំងអស់ត្រូវបានធ្វើសម្រាប់ចែករំលែក ដូច្នេះសូមកម្មង់ចានពីរបីសម្រាប់តុ ហើយបញ្ជូនគ្នាញ៉ាំ។</p><p>សូមសួរអ្នកបម្រើរបស់យើងអំពីមុខម្ហូបជ្រើសរើសរបស់ចុងភៅប្រចាំសប្តាហ៍។ វាប្រែប្រួលតាមទីផ្សារ ហើយកម្រមាននៅលើម៉ឺនុយដែលបានបោះពុម្ព។</p>"
  },
  {
    "slug": "behind-the-tortilla",
    "cover": "corn",
    "days": 7,
    "title_en": "Behind the tortilla: how we make masa every morning",
    "title_kh": "ពីក្រោយតូទីយ៉ា៖ របៀបដែលយើងធ្វើម៉ាសារាល់ព្រឹក",
    "excerpt_en": "Corn, lime, water and patience. A look at the first hour of every day in our kitchen.",
    "excerpt_kh": "ពោត ក្រូចឆ្មារ ទឹក និងការអត់ធ្មត់។ សូមមើលម៉ោងដំបូងនៃរាល់ថ្ងៃក្នុងផ្ទះបាយរបស់យើង។",
    "html_en": "<p>Long before the doors open, the kitchen is already busy. The first job of the day is masa, the dough every tortilla is made from.</p><h2>Step by step</h2><ol><li>Dried corn is simmered with a little lime until the skins loosen</li><li>It rests overnight, then is rinsed and stone-ground</li><li>The dough is pressed thin and cooked on a hot griddle until it puffs</li></ol><p>The result is a tortilla that is soft, fragrant and tastes of real corn. It is a small detail, but it is the one our guests mention most.</p><blockquote>If the tortilla is good, everything on top of it is already halfway there.</blockquote>",
    "html_kh": "<p>យូរមុនពេលបើកទ្វារ ផ្ទះបាយមមាញឹករួចទៅហើយ។ ការងារដំបូងរបស់ថ្ងៃគឺម៉ាសា ដែលជាម្សៅដំណោះដែលតូទីយ៉ានីមួយៗធ្វើពីវា។</p><h2>ជំហានម្តងមួយៗ</h2><ol><li>ពោតស្ងួតត្រូវស្ងោរជាមួយក្រូចឆ្មារបន្តិច រហូតដល់សំបកទន់ចេញ</li><li>វាត្រូវដាក់ទុកពេញមួយយប់ បន្ទាប់មកលាងសម្អាត ហើយកិនដោយថ្ម</li><li>ម្សៅត្រូវបានសង្កត់ឱ្យស្តើង ហើយចម្អិនលើខ្ទះក្តៅរហូតដល់ហើម</li></ol><p>លទ្ធផលគឺតូទីយ៉ាដែលទន់ មានក្លិនក្រអូប និងមានរសជាតិពោតពិតប្រាកដ។ វាជាព័ត៌មានលម្អិតតូចមួយ ប៉ុន្តែជារឿងដែលភ្ញៀវរបស់យើងនិយាយដល់ច្រើនបំផុត។</p><blockquote>បើតូទីយ៉ាឆ្ងាញ់ អ្វីៗដែលដាក់នៅលើវាក៏ជិតឆ្ងាញ់ពាក់កណ្តាលផ្លូវរួចហើយ។</blockquote>"
  },
  {
    "slug": "live-music-and-new-terrace",
    "cover": "sun",
    "days": 2,
    "title_en": "Live music Fridays and our new terrace",
    "title_kh": "តន្ត្រីផ្ទាល់រៀងរាល់ថ្ងៃសុក្រ និងរានហាលថ្មីរបស់យើង",
    "excerpt_en": "Join us outside on Friday evenings for live guitar, cold drinks and the best seats in the house.",
    "excerpt_kh": "សូមមកជាមួយយើងនៅខាងក្រៅរាល់ល្ងាចថ្ងៃសុក្រ ជាមួយភ្លេងហ្គីតាផ្ទាល់ ភេសជ្ជៈត្រជាក់ និងកៅអីល្អបំផុតក្នុងហាង។",
    "html_en": "<p>Our new terrace is finally open, and to celebrate we are starting live music every Friday night.</p><h2>What to expect</h2><ul><li>Acoustic guitar from 7 pm until late</li><li>Two-for-one lime margaritas during the first set</li><li>A special sharing menu for groups of four or more</li></ul><p>Tables outside fill quickly, so we recommend booking ahead on our reservations page. Walk-ins are always welcome inside.</p><p>Bring a jacket if you like it cool, and bring your dancing shoes if you do not.</p>",
    "html_kh": "<p>រានហាលថ្មីរបស់យើងបានបើកចំហនៅទីបំផុត ហើយដើម្បីអបអរ យើងចាប់ផ្តើមមានតន្ត្រីផ្ទាល់រៀងរាល់យប់ថ្ងៃសុក្រ។</p><h2>អ្វីដែលអ្នកអាចរំពឹង</h2><ul><li>ហ្គីតាអាកូស្ទិចចាប់ពីម៉ោង ៧ ល្ងាច រហូតដល់យប់ជ្រៅ</li><li>ម៉ាហ្គារីតាក្រូចឆ្មារ ទិញមួយថែមមួយ ក្នុងសំនៀងដំបូង</li><li>ម៉ឺនុយចែករំលែកពិសេសសម្រាប់ក្រុមចាប់ពីបួននាក់ឡើងទៅ</li></ul><p>តុនៅខាងក្រៅពេញលឿន ដូច្នេះយើងសូមណែនាំឱ្យកក់ទុកជាមុននៅទំព័រកក់តុរបស់យើង។ អ្នកដែលមកដោយមិនបានកក់ គឺស្វាគមន៍នៅខាងក្នុងជានិច្ច។</p><p>សូមយកអាវធំមក ប្រសិនបើអ្នកចូលចិត្តភាពត្រជាក់ ហើយយកស្បែកជើងរាំមក ប្រសិនបើអ្នកមិនចូលចិត្ត។</p>"
  }
] as const;

async function main() {
  mkdirSync(UPLOADS, { recursive: true });
  for (const [name, content] of Object.entries(COVERS)) writeFileSync(join(UPLOADS, `seed-blog-${name}.svg`), content); // cheap and safe to refresh
  if ((await prisma.blogPost.count()) > 0) { console.log('BlogPost already has rows: no posts added'); return; }
  for (const p of POSTS) {
    const at = new Date(Date.now() - p.days * 86_400_000);
    await prisma.blogPost.create({
      data: {
        slug: p.slug, title_en: p.title_en, title_kh: p.title_kh, excerpt_en: p.excerpt_en, excerpt_kh: p.excerpt_kh,
        cover_url: `/uploads/seed-blog-${p.cover}.svg`, html_en: p.html_en, html_kh: p.html_kh,
        published: true, published_at: at,
      },
    });
  }
  console.log(`Seeded ${POSTS.length} blog posts`);
}
main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
