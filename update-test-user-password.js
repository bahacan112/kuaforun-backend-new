import { db } from "./src/db/index.ts";
import { users } from "./src/db/schema.ts";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function updateTestUserPassword() {
  try {
    const testEmail = 'test@example.com';
    const newPassword = 'password';
    
    console.log('Updating test user password...');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const [updatedUser] = await db
      .update(users)
      .set({ 
        passwordHash: hashedPassword,
        emailVerifiedAt: new Date()
      })
      .where(eq(users.email, testEmail))
      .returning();
    
    if (updatedUser) {
      console.log('Updated test user password successfully:', {
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
        tenantId: updatedUser.tenantId
      });
    } else {
      console.log('Test user not found');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

updateTestUserPassword();