// Export PrismaClient and Prisma namespace from the generated client
// This allows other packages in the monorepo to import from '@assignment/db'
// Note: After running 'prisma generate', the client will be in node_modules/.prisma/client
// or in the custom output path specified in schema.prisma
export { PrismaClient, Prisma } from '@prisma/client';

