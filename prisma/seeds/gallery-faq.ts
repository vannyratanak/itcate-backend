// Placeholder gallery + FAQ content. Idempotent: each table is only filled when it is empty.
// Run: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seeds/gallery-faq.ts
// Khmer text was written by hand (Google Translate was rate-limited); have a native speaker proof-read it.
import { PrismaClient } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

// [caption_en, caption_kh, width, height, colour A, colour B, colour C]
const IMAGES: [string, string, number, number, string, string, string][] = [
  ['Sizzling fajitas', 'ហ្វាហ៊ីតាក្តៅៗ', 800, 600, '#F6B25A', '#E5902C', '#B8541A'],
  ['Fresh guacamole made at your table', 'ហ្គាកាម៉ូលីស្រស់ៗធ្វើនៅតុរបស់អ្នក', 600, 800, '#CFE3A0', '#8DB255', '#4F7A2A'],
  ['Our sunlit dining room', 'បន្ទប់បរិភោគដែលមានពន្លឺថ្ងៃ', 800, 600, '#FBE7B0', '#F3C46B', '#D98E2B'],
  ['Hand-pressed tortillas', 'តូទីយ៉ាសង្កត់ដោយដៃ', 800, 800, '#F9E2B8', '#E9BC78', '#C98A3B'],
  ['Margarita hour', 'ម៉ោងម៉ាហ្គារីតា', 600, 800, '#FFE7A8', '#F4A259', '#D1495B'],
  ['Street-style tacos', 'តាកូស្ទីលតាមដងផ្លូវ', 800, 600, '#F7C873', '#E5902C', '#9C4A12'],
  ['Churros with chocolate', 'ឈឺរ៉ូសជាមួយសូកូឡា', 800, 800, '#E9C39A', '#B9783F', '#5A3317'],
  ['Colourful cantina corner', 'ជ្រុងកានទីណាពណ៌ស្រស់ស្អាត', 600, 800, '#FFD6A5', '#F08A5D', '#B83B5E'],
  ['Slow-cooked carnitas', 'កាណីតាសចម្អិនយឺតៗ', 800, 600, '#E8B778', '#C9772E', '#7A3B12'],
  ['Chef plating the evening special', 'ចុងភៅរៀបចានម្ហូបពិសេសពេលល្ងាច', 800, 600, '#F3E2B5', '#DDAA55', '#8A5A1C'],
  ['Terrace evenings', 'ល្ងាចនៅរានហាល', 600, 800, '#FDD9A0', '#EE9B47', '#7B3F74'],
  ['Salsa bar', 'ជ្រុងសាល់សា', 800, 800, '#F9C0A0', '#E4572E', '#8E2C14'],
];

const FAQS: [string, string, string, string][] = [
  ['What are your opening hours?', 'តើម៉ោងបើករបស់អ្នកគឺប៉ុន្មាន?',
    'We are open every day. Weekdays 10:00 to 22:00 and Friday to Sunday 10:00 to 23:00. Check the footer of this page for the latest hours and holiday notices.',
    'យើងបើករាល់ថ្ងៃ។ ថ្ងៃធ្វើការម៉ោង ១០:០០ ដល់ ២២:០០ និងថ្ងៃសុក្រដល់ថ្ងៃអាទិត្យម៉ោង ១០:០០ ដល់ ២៣:០០។ សូមមើលផ្នែកខាងក្រោមនៃទំព័រនេះសម្រាប់ម៉ោងថ្មីៗ និងសេចក្តីជូនដំណឹងអំពីថ្ងៃឈប់សម្រាក។'],
  ['Do I need to make a reservation?', 'តើខ្ញុំត្រូវកក់តុជាមុនទេ?',
    'Walk-ins are always welcome, but we recommend booking a table on weekends and for groups of six or more. You can reserve online on our Reservations page or call us.',
    'យើងស្វាគមន៍ភ្ញៀវដែលមកដោយមិនបានកក់ជានិច្ច ប៉ុន្តែយើងណែនាំឱ្យកក់តុនៅចុងសប្តាហ៍ និងសម្រាប់ក្រុមចាប់ពីប្រាំមួយនាក់ឡើង។ អ្នកអាចកក់តុតាមអ៊ីនធឺណិតនៅទំព័រកក់តុរបស់យើង ឬទូរស័ព្ទមកយើង។'],
  ['Is there parking?', 'តើមានកន្លែងចតរថយន្តទេ?',
    'Yes. Free parking is available in front of the restaurant for about ten cars, and there is more street parking nearby. Motorbike parking is free.',
    'មាន។ មានកន្លែងចតរថយន្តឥតគិតថ្លៃនៅមុខភោជនីយដ្ឋានសម្រាប់ប្រហែលដប់គ្រឿង ហើយមានកន្លែងចតតាមដងផ្លូវនៅក្បែរនោះបន្ថែមទៀត។ កន្លែងចតម៉ូតូគឺឥតគិតថ្លៃ។'],
  ['Do you have vegetarian or vegan options?', 'តើអ្នកមានម្ហូបបួស ឬម្ហូបបួសសុទ្ធទេ?',
    'Yes. Many dishes are vegetarian and we mark them on the menu. Most of our vegetarian dishes can be made vegan on request, just ask your server.',
    'មាន។ ម្ហូបជាច្រើនជាម្ហូបបួស ហើយយើងបានសម្គាល់វានៅលើម៉ឺនុយ។ ម្ហូបបួសភាគច្រើនអាចធ្វើជាម្ហូបបួសសុទ្ធតាមការស្នើសុំ គ្រាន់តែប្រាប់អ្នកបម្រើរបស់យើង។'],
  ['I have a food allergy. What should I do?', 'ខ្ញុំមានអាឡែស៊ីអាហារ។ តើខ្ញុំគួរធ្វើដូចម្តេច?',
    'Please tell your server before ordering. Our kitchen handles nuts, dairy, gluten, shellfish and eggs, so we cannot guarantee a completely allergen-free dish, but we will do our best to keep you safe.',
    'សូមប្រាប់អ្នកបម្រើរបស់យើងមុនពេលកុម្ម៉ង់។ ផ្ទះបាយរបស់យើងប្រើគ្រាប់ធញ្ញជាតិ ទឹកដោះគោ គ្លូតែន គ្រឿងសមុទ្រ និងពងមាន់ ដូច្នេះយើងមិនអាចធានាថាម្ហូបគ្មានសារធាតុអាឡែហ្សីទាំងស្រុងបានទេ ប៉ុន្តែយើងនឹងខំប្រឹងឱ្យអ្នកមានសុវត្ថិភាព។'],
  ['Which payment methods do you accept?', 'តើអ្នកទទួលវិធីបង់ប្រាក់អ្វីខ្លះ?',
    'We accept cash in US dollars and Cambodian riel, major credit cards, and QR payments such as ABA and KHQR.',
    'យើងទទួលសាច់ប្រាក់ជាដុល្លារអាមេរិក និងរៀលកម្ពុជា កាតឥណទានធំៗ និងការទូទាត់តាម QR ដូចជា ABA និង KHQR។'],
  ['Is there a dress code?', 'តើមានតម្រូវការអំពីការស្លៀកពាក់ទេ?',
    'No dress code. Come as you are. Smart casual is common in the evenings.',
    'មិនមានតម្រូវការអំពីការស្លៀកពាក់ទេ។ សូមមកតាមស្ទីលរបស់អ្នក។ ការស្លៀកពាក់សមរម្យសាមញ្ញជារឿងធម្មតាពេលល្ងាច។'],
  ['Are children welcome?', 'តើកុមារត្រូវបានស្វាគមន៍ទេ?',
    'Absolutely. We have high chairs and a small kids menu, and our staff are happy to help with smaller portions.',
    'ពិតណាស់។ យើងមានកៅអីខ្ពស់សម្រាប់ក្មេង និងម៉ឺនុយតូចសម្រាប់កុមារ ហើយបុគ្គលិករបស់យើងរីករាយជួយរៀបចំចំណែកតូចជាងនេះ។'],
  ['Do you offer delivery or takeaway?', 'តើអ្នកមានសេវាដឹកជញ្ជូន ឬយកទៅផ្ទះទេ?',
    'Takeaway is available during opening hours. For delivery, please call us or message us on Telegram and we will arrange it for you.',
    'សេវាយកទៅផ្ទះមានក្នុងម៉ោងបើក។ សម្រាប់ការដឹកជញ្ជូន សូមទូរស័ព្ទមកយើង ឬផ្ញើសារមកយើងតាម Telegram ហើយយើងនឹងរៀបចំជូនអ្នក។'],
  ['Can I host a private event or party?', 'តើខ្ញុំអាចរៀបចំពិធីជប់លៀងឯកជនបានទេ?',
    'Yes. We host birthdays, company dinners and weddings. See our Private dining and catering page and send us an enquiry with your date and number of guests.',
    'បាន។ យើងរៀបចំពិធីខួបកំណើត អាហារពេលល្ងាចក្រុមហ៊ុន និងពិធីមង្គលការ។ សូមមើលទំព័រជប់លៀង និងម្ហូបកម្មង់ ហើយផ្ញើសំណួរមកយើងជាមួយកាលបរិច្ឆេទ និងចំនួនភ្ញៀវរបស់អ្នក។'],
];

const svg = (w: number, h: number, a: string, b: string, c: string, n: number) => {
  // Soft gradient + a few overlapping circles ("plates"), no text, no scripts.
  const circles = [[0.3, 0.38, 0.28, 0.35], [0.68, 0.55, 0.22, 0.3], [0.5, 0.78, 0.16, 0.25]]
    .map(([x, y, r, o], i) => `<circle cx="${Math.round(x * w)}" cy="${Math.round(y * h)}" r="${Math.round(r * Math.min(w, h))}" fill="${i === 1 ? c : '#FFFBEA'}" fill-opacity="${o}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><linearGradient id="g${n}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>
<radialGradient id="v${n}" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#3a1f05" stop-opacity=".28"/></radialGradient></defs>
<rect width="${w}" height="${h}" fill="url(#g${n})"/>${circles}<rect width="${w}" height="${h}" fill="url(#v${n})"/></svg>`;
};

async function main() {
  if ((await prisma.galleryImage.count()) === 0) {
    const dir = join(process.cwd(), 'uploads');
    mkdirSync(dir, { recursive: true });
    const data = IMAGES.map(([caption_en, caption_kh, w, h, a, b, c], i) => {
      const name = `gallery-${i + 1}.svg`;
      writeFileSync(join(dir, name), svg(w, h, a, b, c, i + 1));
      return { url: `/uploads/${name}`, caption_en, caption_kh, sort_order: i + 1 };
    });
    await prisma.galleryImage.createMany({ data });
    console.log(`gallery: ${data.length} placeholder images`);
  } else console.log('gallery: already has rows, skipped');

  if ((await prisma.faq.count()) === 0) {
    await prisma.faq.createMany({
      data: FAQS.map(([question_en, question_kh, answer_en, answer_kh], i) => ({ question_en, question_kh, answer_en, answer_kh, sort_order: i + 1 })),
    });
    console.log(`faq: ${FAQS.length} questions`);
  } else console.log('faq: already has rows, skipped');
}
main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
