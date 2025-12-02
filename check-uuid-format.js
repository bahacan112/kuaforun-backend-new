import { db } from "./src/db/index.ts";
import { users } from "./src/db/schema.ts";

async function checkUserUUID() {
  try {
    console.log('Checking all users to understand ID format...');
    const allUsers = await db
      .select({
        id: users.id,
        email: users.email,
        authUserId: users.authUserId,
        role: users.role,
        tenantId: users.tenantId
      })
      .from(users)
      .limit(5);
    
    console.log('Sample users:');
    allUsers.forEach((user, index) => {
      console.log(`${index + 1}. ID: "${user.id}" (type: ${typeof user.id}), Email: ${user.email}, authUserId: ${user.authUserId}`);
    });
    
    // Find the specific user
    const user27 = await db
      .select()
      .from(users)
      .where(users.email.eq('test@example.com'))
      .limit(1);
    
    if (user27.length > 0) {
      console.log('\nTest user details:');
      console.log('ID:', user27[0].id, '(type:', typeof user27[0].id + ')');
      console.log('Email:', user27[0].email);
      console.log('AuthUserId:', user27[0].authUserId);
      console.log('Role:', user27[0].role);
      
      // Update authUserId to match the UUID id
      if (!user27[0].authUserId) {
        console.log('\nUpdating authUserId to match id...');
        const [updated] = await db
          .update(users)
          .set({ authUserId: user27[0].id })
          .where(users.email.eq('test@example.com'))
          .returning();
        
        console.log('Updated authUserId to:', updated.authUserId);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkUserUUID();