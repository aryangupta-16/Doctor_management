import { PrismaClient} from '@prisma/client';

const prisma = new PrismaClient({ log: ['error', 'warn'] });
export default prisma;

// Example usage:
// const adminRole: RoleType = RoleType.ADMIN;
// const doctorRole: RoleType = RoleType.DOCTOR;
