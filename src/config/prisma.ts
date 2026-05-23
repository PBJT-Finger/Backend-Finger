import { PrismaClient, Prisma } from '@prisma/client';
import logger from '../utils/logger';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient<Prisma.PrismaClientOptions, 'query'> | undefined;
}

const prismaOptions: Prisma.PrismaClientOptions = {
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' },
  ],
  errorFormat: 'minimal',
};

// We explicitly cast the client instantiation to listen to 'query' events
export const prisma =
  global.prisma ||
  new PrismaClient<Prisma.PrismaClientOptions, 'query'>(prismaOptions);

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

/**
 * Query Logging (Development Only)
 * Log slow queries for performance monitoring
 */
if (process.env.NODE_ENV !== 'production') {
  prisma.$on('query', (e: Prisma.QueryEvent) => {
    if (e.duration > 100) {
      logger.warn(`Slow Query (${e.duration}ms): ${e.query}`);
    }
  });
}

let isDisconnecting = false;

process.on('beforeExit', async () => {
  if (isDisconnecting) return;
  isDisconnecting = true;
  try {
    await prisma.$disconnect();
    logger.info('Prisma Client disconnected');
  } catch (error) {
    logger.error('Error during Prisma Client beforeExit disconnect:', { error: String(error) });
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  if (isDisconnecting) return;
  isDisconnecting = true;
  try {
    await prisma.$disconnect();
    logger.info('Prisma Client disconnected (SIGINT)');
  } catch (error) {
    logger.error('Error during Prisma Client SIGINT disconnect:', { error: String(error) });
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (isDisconnecting) return;
  isDisconnecting = true;
  try {
    await prisma.$disconnect();
    logger.info('Prisma Client disconnected (SIGTERM)');
  } catch (error) {
    logger.error('Error during Prisma Client SIGTERM disconnect:', { error: String(error) });
  }
  process.exit(0);
});

export default prisma;
