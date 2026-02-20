import { prisma } from '../db';
import { afterEach, afterAll } from 'vitest';

afterEach(async () => {
  await prisma.card.deleteMany();
  await prisma.category.deleteMany();
  await prisma.board.deleteMany();
  await prisma.accountUpgrade.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
