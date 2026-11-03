// Placeholder (lorem ipsum) shop + menu content. Safe to re-run: only fills what is empty.
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const lorem = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.';
const items: [string, string, number][] = [
  ['Starters', 'Lorem Ipsum Salad', 5.5], ['Starters', 'Dolor Sit Soup', 4.75], ['Starters', 'Amet Croquettes', 6],
  ['Mains', 'Consectetur Paella', 12.5], ['Mains', 'Adipiscing Steak', 15], ['Mains', 'Eiusmod Chicken', 11.25],
  ['Mains', 'Tempor Noodles', 9.5], ['Desserts', 'Incididunt Flan', 4.5], ['Desserts', 'Labore Churros', 5],
  ['Drinks', 'Magna Aliqua Juice', 3.25], ['Drinks', 'Ut Enim Coffee', 2.75], ['Drinks', 'Minim Veniam Tea', 2.5],
];

async function main() {
  await prisma.shop.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, name: 'Lorem Ipsum Restaurant', title: 'Dolor sit amet, consectetur adipiscing' },
  });
  if ((await prisma.menuItem.count()) === 0) {
    const ids = new Map<string, number>();
    for (const [name_en] of items) { // first tuple element is the category
      if (ids.has(name_en)) continue;
      const c = await prisma.menuCategory.upsert({ where: { name_en }, update: {}, create: { name_en, sort_order: ids.size + 1 } });
      ids.set(name_en, c.id);
    }
    await prisma.menuItem.createMany({
      data: items.map(([category, name_en, price], i) => ({
        category_id: ids.get(category)!, name_en, price, description_en: lorem, description_kh: null, sort_order: i,
      })),
    });
  }
}
main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
