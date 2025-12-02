import { db } from "./src/db/index.ts";
import { users } from "./src/db/schema.ts";
import { eq } from "drizzle-orm";

async function fixTestUserAuthId() {
  try {
    console.log('Finding test user...');
    const testUser = await db
      .select()
      .from(users)
      .where(eq(users.email, 'test@example.com'))
      .limit(1);
    
    if (testUser.length > 0) {
      console.log('Found test user:', {
        id: testUser[0].id,
        email: testUser[0].email,
        authUserId: testUser[0].authUserId
      });
      
      // Generate a proper UUID for authUserId
      const crypto = await import('crypto');
      const newAuthUserId = crypto.randomUUID();
      
      console.log('Generated new authUserId:', newAuthUserId);
      
      const [updatedUser] = await db
        .update(users)
        .set({ authUserId: newAuthUserId })
        .where(eq(users.email, 'test@example.com'))
        .returning();
      
      console.log('Updated user authUserId to:', updatedUser.authUserId);
      
      // Now we need to update the JWT generation to use this authUserId
      console.log('\nIMPORTANT: You need to update the JWT generation logic to use authUserId instead of id');
      console.log('Current JWT uses id:', testUser[0].id);
      console.log('Should use authUserId:', newAuthUserId);
      
    } else {
      console.log('Test user not found');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

fixTestUserAuthId();