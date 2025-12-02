import { db } from "./src/db/index.ts";
import { users } from "./src/db/schema.ts";
import { eq } from "drizzle-orm";

async function checkUserData() {
  try {
    console.log('Checking user with ID 27...');
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, '27'))
      .limit(1);
    
    if (user.length > 0) {
      console.log('User found:', {
        id: user[0].id,
        email: user[0].email,
        authUserId: user[0].authUserId,
        role: user[0].role,
        tenantId: user[0].tenantId
      });
    } else {
      console.log('User not found with ID 27');
    }
    
    // Also check by authUserId
    console.log('\nChecking user with authUserId 27...');
    const userByAuth = await db
      .select()
      .from(users)
      .where(eq(users.authUserId, '27'))
      .limit(1);
    
    if (userByAuth.length > 0) {
      console.log('User found by authUserId:', {
        id: userByAuth[0].id,
        email: userByAuth[0].email,
        authUserId: userByAuth[0].authUserId,
        role: userByAuth[0].role,
        tenantId: userByAuth[0].tenantId
      });
    } else {
      console.log('User not found with authUserId 27');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkUserData();