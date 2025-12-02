import { db } from "./src/db/index.ts";
import { users } from "./src/db/schema.ts";
import { eq } from "drizzle-orm";

async function fixAuthUserId() {
  try {
    console.log('Fixing authUserId for user 27...');
    
    // Update the user's authUserId to match their id
    const [updatedUser] = await db
      .update(users)
      .set({ authUserId: '27' }) // Set to string representation of ID
      .where(eq(users.id, '27'))
      .returning();
    
    if (updatedUser) {
      console.log('Updated user authUserId:', {
        id: updatedUser.id,
        email: updatedUser.email,
        authUserId: updatedUser.authUserId,
        role: updatedUser.role,
        tenantId: updatedUser.tenantId
      });
    } else {
      console.log('User not found');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

fixAuthUserId();