import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    console.log("Checking existing users...");
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
    console.log("Existing users:", users);

    if (users.length === 0) {
      console.log("No users found. Creating a test user...");
      const testUser = await prisma.user.create({
        data: {
          email: "test@example.com",
          password:
            "$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi", // password
          firstName: "Test",
          lastName: "User",
          role: "USER",
          isEmailVerified: true,
        },
      });
      console.log("Created test user:", testUser);
    }
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();