import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Testing new user creation with Google payload...');
        const newUser = await prisma.user.create({
            data: {
                email: 'test_new_google_user999@test.com',
                googleId: '1234567890999',
                authProvider: 'GOOGLE',
                wallet: {
                    create: {
                        depositBalance: 0,
                        winningBalance: 0,
                        bonusBalance: 0,
                    },
                },
            },
        });
        console.log('Success:', newUser);
    } catch (e) {
        console.error('Error creating user:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
