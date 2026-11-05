// Placeholder contact details, opening hours, and menu tags. Idempotent: only fills what is empty.
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const hours = Array.from({ length: 7 }, (_, day) => ({ day, open: '10:00', close: day >= 4 ? '23:00' : '22:00', closed: false }));

async function main() {
  const existing = await prisma.siteSetting.findUnique({ where: { id: 1 } });
  if (!existing) {
    await prisma.siteSetting.create({
      data: {
        id: 1,
        phone: '+855 12 345 678',
        email: 'hello@itacate.example',
        address_en: '123 Sample Street, Phnom Penh, Cambodia',
        address_kh: 'ផ្លូវគំរូ ១២៣ ភ្នំពេញ កម្ពុជា',
        map_url: 'https://maps.google.com/?q=Phnom+Penh',
        facebook: 'https://facebook.com',
        instagram: 'https://instagram.com',
        hours,
      },
    });
  }
  // Tags + chef's picks on a few sample items (only if nothing is tagged yet).
  if ((await prisma.menuItem.count({ where: { OR: [{ chefs_pick: true }, { NOT: { tags: { equals: [] } } }] } })) === 0) {
    const set = async (name_en: string, tags: string[], chefs_pick = false) =>
      prisma.menuItem.updateMany({ where: { name_en }, data: { tags, chefs_pick } });
    await set('Lorem Ipsum Salad', ['vegetarian', 'gluten-free']);
    await set('Dolor Sit Soup', ['vegan']);
    await set('Amet Croquettes', ['new']);
    await set('Consectetur Paella', ['halal'], true);
    await set('Adipiscing Steak', ['halal'], true);
    await set('Tempor Noodles', ['spicy', 'vegetarian']);
    await set('Eiusmod Chicken', ['spicy', 'halal'], true);
    await set('Labore Churros', ['vegetarian', 'new']);
  }
}
main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
