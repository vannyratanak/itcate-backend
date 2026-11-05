// LOCAL TESTING ONLY. Never run this against production: it creates accounts with known passwords.
//   DATABASE_URL=postgresql://... npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seeds/staff-demo.ts
// In production, create staff in the dashboard (Staff & Roles) instead.
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../../src/auth/password';

const prisma = new PrismaClient();
const demo = [
  { username: 'demo-owner', role: 'owner', password: 'demo-owner-password' },
  { username: 'demo-manager', role: 'manager', password: 'demo-manager-password' },
  { username: 'demo-viewer', role: 'viewer', password: 'demo-viewer-password' },
];

async function main() {
  if (/(itacate|prod)/i.test(process.env.DATABASE_URL ?? '')) throw new Error('Refusing to seed demo accounts into what looks like a production database.');
  for (const u of demo) {
    await prisma.adminUser.upsert({
      where: { username: u.username },
      update: {},
      create: { username: u.username, role: u.role, password_hash: await hashPassword(u.password) },
    });
    console.log(`demo account: ${u.username} (${u.role})`);
  }
}
main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
