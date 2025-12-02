import { db } from "./src/db/index.ts";
import { users } from "./src/db/schema.ts";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function checkUsers() {
  try {
    console.log('Checking existing users...');
    const existingUsers = await db.select().from(users);
    console.log('Existing users count:', existingUsers.length);
    
    if (existingUsers.length > 0) {
      console.log('First user:', {
        id: existingUsers[0].id,
        email: existingUsers[0].email,
        role: existingUsers[0].role,
        tenantId: existingUsers[0].tenantId
      });
    }
    
    // Create a test user if none exists
    const testEmail = 'test@example.com';
    const testPassword = 'password';
    const tenantId = 'kuaforun';
    
    const existingTestUser = await db
      .select()
      .from(users)
      .where(eq(users.email, testEmail))
      .limit(1);
    
    if (existingTestUser.length === 0) {
      console.log('Creating test user...');
      const hashedPassword = await bcrypt.hash(testPassword, 10);
      
      const [testUser] = await db
        .insert(users)
        .values({
          email: testEmail,
          passwordHash: hashedPassword,
          name: 'Test User',
          role: 'customer',
          tenantId: tenantId,
          emailVerifiedAt: new Date()
        })
        .returning();
      
      console.log('Created test user:', {
        id: testUser.id,
        email: testUser.email,
        role: testUser.role,
        tenantId: testUser.tenantId
      });
    } else {
      console.log('Test user already exists:', {
        id: existingTestUser[0].id,
        email: existingTestUser[0].email,
        role: existingTestUser[0].role,
        tenantId: existingTestUser[0].tenantId
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkUsers();