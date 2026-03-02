import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // Create admin user
    const adminPasswordHash = await bcrypt.hash('Admin@123456', 12);
    const admin = await prisma.user.upsert({
        where: { mobile: '+919999000001' },
        update: {},
        create: {
            mobile: '+919999000001',
            email: 'admin@apexarena.in',
            passwordHash: adminPasswordHash,
            dateOfBirth: new Date('1990-01-01'),
            ageVerified: true,
            role: 'admin',
            accountStatus: 'active',
            kycStatus: 'verified',
            state: 'Karnataka',
            wallet: {
                create: {
                    depositBalance: 0,
                    winningBalance: 0,
                    bonusBalance: 0,
                },
            },
        },
    });
    console.log(`  ✅ Admin user: ${admin.id} (${admin.mobile})`);

    // Create a second admin for dual-approval testing
    const admin2Hash = await bcrypt.hash('Admin@654321', 12);
    const admin2 = await prisma.user.upsert({
        where: { mobile: '+919999000002' },
        update: {},
        create: {
            mobile: '+919999000002',
            email: 'admin2@apexarena.in',
            passwordHash: admin2Hash,
            dateOfBirth: new Date('1992-05-15'),
            ageVerified: true,
            role: 'admin',
            accountStatus: 'active',
            kycStatus: 'verified',
            state: 'Maharashtra',
            wallet: {
                create: {
                    depositBalance: 0,
                    winningBalance: 0,
                    bonusBalance: 0,
                },
            },
        },
    });
    console.log(`  ✅ Admin 2: ${admin2.id} (${admin2.mobile})`);

    // Create test user
    const userHash = await bcrypt.hash('User@123456', 12);
    const user = await prisma.user.upsert({
        where: { mobile: '+919876543210' },
        update: {},
        create: {
            mobile: '+919876543210',
            email: 'user@test.com',
            passwordHash: userHash,
            dateOfBirth: new Date('2000-06-15'),
            ageVerified: true,
            accountStatus: 'active',
            kycStatus: 'verified',
            panNumber: 'ABCDE1234F',
            state: 'Karnataka',
            wallet: {
                create: {
                    depositBalance: 5000,
                    winningBalance: 2000,
                    bonusBalance: 100,
                },
            },
        },
    });
    console.log(`  ✅ Test user: ${user.id} (${user.mobile})`);

    // Create a sample tournament
    const tournament = await prisma.tournament.create({
        data: {
            title: 'Daily Chess Blitz #1',
            gameType: 'chess',
            entryFee: 50,
            commissionPercent: 15,
            maxParticipants: 8,
            status: 'open',
            scheduledAt: new Date(Date.now() + 3600000), // 1 hour from now
            createdBy: admin.id,
        },
    });
    console.log(`  ✅ Tournament: ${tournament.id} (${tournament.title})`);

    console.log('✅ Seed complete');
}

main()
    .catch((e) => {
        console.error('❌ Seed error:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
