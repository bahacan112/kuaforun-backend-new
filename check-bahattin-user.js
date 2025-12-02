import { db } from "./src/db/index.ts";
import { users } from "./src/db/schema.ts";
import { eq } from "drizzle-orm";

async function checkBahattinUser() {
  try {
    console.log('Checking user with email bzenbil19@gmail.com...');
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, 'bzenbil19@gmail.com'))
      .limit(1);
    
    if (user.length > 0) {
      console.log('User found:', {
        id: user[0].id,
        email: user[0].email,
        name: user[0].name,
        authUserId: user[0].authUserId,
        role: user[0].role,
        createdAt: user[0].createdAt
      });
      
      if (!user[0].authUserId) {
        console.log('User does not have authUserId, generating one...');
        const crypto = await import('crypto');
        const newAuthUserId = crypto.randomUUID();
        
        const [updatedUser] = await db
          .update(users)
          .set({ authUserId: newAuthUserId })
          .where(eq(users.email, 'bzenbil19@gmail.com'))
          .returning();
        
        console.log('Updated user authUserId to:', updatedUser.authUserId);
        console.log('Next login will generate correct JWT token with UUID format');
      } else {
        console.log('User already has authUserId:', user[0].authUserId);
      }
    } else {
      console.log('User not found');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkBahattinUser();