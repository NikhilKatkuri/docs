import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import configVars from './env';

function databaseUrl(): string {
    const {
        POSTGRES_USER,
        POSTGRES_PASSWORD,
        POSTGRES_HOST,
        POSTGRES_PORT,
        POSTGRES_DB,
    } = configVars;
    return `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}`;
}

const adapter = new PrismaPg({ connectionString: databaseUrl() });
const prisma = new PrismaClient({ adapter });

async function connectToDatabase(): Promise<void> {
    try {
        await prisma.$connect();
        console.log('Connected to the database successfully.');
    } catch (error) {
        console.error('Error connecting to the database:', error);
        throw new Error('Failed to connect to the database.', { cause: error });
    }
}

async function disconnectFromDatabase(): Promise<void> {
    try {
        await prisma.$disconnect();
        console.log('Disconnected from the database successfully.');
    } catch (error) {
        console.error('Error disconnecting from the database:', error);
        throw new Error('Failed to disconnect from the database.', {
            cause: error,
        });
    }
}

export { databaseUrl, connectToDatabase, disconnectFromDatabase, prisma };
