import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { dbUrl } from './src/config';

export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: {
        path: 'prisma/migrations',
        seed: 'tsx prisma/seed.ts',
    },
    datasource: {
        url: dbUrl(),
    },
});
