// Placeholder job openings (English + Khmer). Idempotent: only fills the Job table when it is empty.
// Run: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seeds/careers.ts
// Khmer: Google Translate output, hand-corrected for job titles (e.g. "Server" = waiter, not a computer server).
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const jobs = [
  {"title_en": "Server", "title_kh": "អ្នករត់តុ", "type_en": "Full-time", "type_kh": "ពេញម៉ោង", "description_en": "Welcome guests, take orders and bring our dishes to the table with a smile. You will learn the menu inside out and help every guest feel at home.", "description_kh": "ស្វាគមន៍ភ្ញៀវ ទទួលការកម្មង់ ហើយយកចានរបស់យើងមកតុដោយស្នាមញញឹម។ អ្នកនឹងរៀនពីម៉ឺនុយខាងក្នុង និងជួយភ្ញៀវគ្រប់រូបមានអារម្មណ៍នៅផ្ទះ។"},
  {"title_en": "Line Cook", "title_kh": "ចុងភៅ", "type_en": "Full-time", "type_kh": "ពេញម៉ោង", "description_en": "Prepare tacos, sauces and grilled dishes to our recipes. You will work with a small, friendly kitchen team and keep your station clean and organised.", "description_kh": "រៀបចំ តាកូស ទឹកជ្រលក់ និងចានដុតតាមរូបមន្តរបស់យើង។ អ្នកនឹងធ្វើការជាមួយក្រុមផ្ទះបាយតូច និងរួសរាយរាក់ទាក់ ហើយរក្សាស្ថានីយ៍របស់អ្នកឱ្យស្អាត និងរៀបចំ។"},
  {"title_en": "Barista", "title_kh": "បារីស្តា", "type_en": "Part-time", "type_kh": "ពាក់កណ្តាលម៉ោង", "description_en": "Make coffee, fresh juices and cocktails with care. You will keep the bar stocked and chat with guests about their favourite drinks.", "description_kh": "ធ្វើកាហ្វេ ទឹកផ្លែឈើស្រស់ និងស្រាក្រឡុកដោយប្រុងប្រយ័ត្ន។ អ្នកនឹងរក្សារបារស្តុកទុក ហើយជជែកជាមួយភ្ញៀវអំពីភេសជ្ជៈដែលពួកគេចូលចិត្ត។"},
  {"title_en": "Host / Hostess", "title_kh": "អ្នកទទួលភ្ញៀវ", "type_en": "Part-time", "type_kh": "ពាក់កណ្តាលម៉ោង", "description_en": "Greet guests, manage reservations and the waiting list, and make sure everyone is seated quickly and comfortably.", "description_kh": "ជំរាបសួរភ្ញៀវ គ្រប់គ្រងការកក់ទុក និងបញ្ជីរង់ចាំ ហើយត្រូវប្រាកដថាអ្នកគ្រប់គ្នាអង្គុយយ៉ាងរហ័ស និងងាយស្រួល។"},
  {"title_en": "Kitchen Helper", "title_kh": "អ្នកជំនួយផ្ទះបាយ", "type_en": "Full-time", "type_kh": "ពេញម៉ោង", "description_en": "Help with washing, chopping and preparing ingredients, and keep the kitchen tidy. A great first step into restaurant work, and we will train you.", "description_kh": "ជួយលាងសម្អាត កាត់ និងរៀបចំគ្រឿងផ្សំ និងរក្សាផ្ទះបាយឱ្យស្អាត។ ជំហានដំបូងដ៏អស្ចារ្យក្នុងការងារភោជនីយដ្ឋាន ហើយយើងនឹងបណ្តុះបណ្តាលអ្នក។"},
];

async function main() {
  if ((await prisma.job.count()) > 0) { console.log('careers seed: jobs already exist, nothing to do'); return; }
  await prisma.job.createMany({ data: jobs.map((j, i) => ({ ...j, sort_order: i + 1, active: true })) });
  console.log(`careers seed: created ${jobs.length} jobs`);
}
main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
