import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient({ log: ['error'] });
process.on('beforeExit', async () => { await prisma.$disconnect(); });
