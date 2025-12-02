import { drizzle as _drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function convertIdsToUUID() {
  console.log('🔄 Starting UUID conversion process...');
  
  try {
    // Create migration client
    const migrationClient = postgres(connectionString, { max: 1 });

    console.log('📊 Checking current database structure...');
    
    // Get current table structure
    const tables = await migrationClient`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

    console.log(`📋 Found ${tables.length} tables to process`);

    // UUID conversion queries - simplified version
    const uuidConversionQueries = [
      // 1. Drop foreign key constraints first
      `ALTER TABLE IF EXISTS barber_shops DROP CONSTRAINT IF EXISTS barber_shops_owner_user_id_fkey;`,
      `ALTER TABLE IF EXISTS services DROP CONSTRAINT IF EXISTS services_barber_shop_id_fkey;`,
      `ALTER TABLE IF EXISTS services DROP CONSTRAINT IF EXISTS services_service_template_id_fkey;`,
      `ALTER TABLE IF EXISTS barber_comments DROP CONSTRAINT IF EXISTS barber_comments_barber_shop_id_fkey;`,
      `ALTER TABLE IF EXISTS barber_comments DROP CONSTRAINT IF EXISTS barber_comments_user_id_fkey;`,
      `ALTER TABLE IF EXISTS barber_comment_replies DROP CONSTRAINT IF EXISTS barber_comment_replies_comment_id_fkey;`,
      `ALTER TABLE IF EXISTS barber_comment_replies DROP CONSTRAINT IF EXISTS barber_comment_replies_user_id_fkey;`,
      `ALTER TABLE IF EXISTS barber_comment_reply_moderations DROP CONSTRAINT IF EXISTS barber_comment_reply_moderations_reply_id_fkey;`,
      `ALTER TABLE IF EXISTS barber_comment_reply_history DROP CONSTRAINT IF EXISTS barber_comment_reply_history_comment_id_fkey;`,
      `ALTER TABLE IF EXISTS barber_comment_reply_history DROP CONSTRAINT IF EXISTS barber_comment_reply_history_reply_id_fkey;`,
      `ALTER TABLE IF EXISTS barber_reviews DROP CONSTRAINT IF EXISTS barber_reviews_barber_shop_id_fkey;`,
      `ALTER TABLE IF EXISTS barber_photos DROP CONSTRAINT IF EXISTS barber_photos_barber_shop_id_fkey;`,
      `ALTER TABLE IF EXISTS barber_hours DROP CONSTRAINT IF EXISTS barber_hours_barber_shop_id_fkey;`,
      `ALTER TABLE IF EXISTS shop_staff DROP CONSTRAINT IF EXISTS shop_staff_shop_id_fkey;`,
      `ALTER TABLE IF EXISTS shop_staff DROP CONSTRAINT IF EXISTS shop_staff_auth_user_id_fkey;`,
      `ALTER TABLE IF EXISTS staff_hours DROP CONSTRAINT IF EXISTS staff_hours_staff_id_fkey;`,
      `ALTER TABLE IF EXISTS staff_leaves DROP CONSTRAINT IF EXISTS staff_leaves_staff_id_fkey;`,
      `ALTER TABLE IF EXISTS user_favorite_barbers DROP CONSTRAINT IF EXISTS user_favorite_barbers_staff_id_fkey;`,
      `ALTER TABLE IF EXISTS user_favorite_shops DROP CONSTRAINT IF EXISTS user_favorite_shops_shop_id_fkey;`,
      `ALTER TABLE IF EXISTS bookings DROP CONSTRAINT IF EXISTS bookings_shop_id_fkey;`,
      `ALTER TABLE IF EXISTS bookings DROP CONSTRAINT IF EXISTS bookings_barber_id_fkey;`,
      `ALTER TABLE IF EXISTS booking_services DROP CONSTRAINT IF EXISTS booking_services_booking_id_fkey;`,
      `ALTER TABLE IF EXISTS booking_services DROP CONSTRAINT IF EXISTS booking_services_service_id_fkey;`,
      `ALTER TABLE IF EXISTS notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;`,
      `ALTER TABLE IF EXISTS in_app_notifications DROP CONSTRAINT IF EXISTS in_app_notifications_user_id_fkey;`,

      // 2. Convert users table
      `ALTER TABLE users ALTER COLUMN id TYPE uuid USING gen_random_uuid();`,
      `ALTER TABLE users ALTER COLUMN id SET DEFAULT gen_random_uuid();`,

      // 3. Convert barber_shops table
      `ALTER TABLE barber_shops ALTER COLUMN id TYPE uuid USING gen_random_uuid();`,
      `ALTER TABLE barber_shops ALTER COLUMN id SET DEFAULT gen_random_uuid();`,
      `ALTER TABLE barber_shops ALTER COLUMN owner_user_id TYPE uuid USING NULL;`,

      // 4. Convert service_templates table
      `ALTER TABLE service_templates ALTER COLUMN id TYPE uuid USING gen_random_uuid();`,
      `ALTER TABLE service_templates ALTER COLUMN id SET DEFAULT gen_random_uuid();`,

      // 5. Convert services table
      `ALTER TABLE services ALTER COLUMN id TYPE uuid USING gen_random_uuid();`,
      `ALTER TABLE services ALTER COLUMN id SET DEFAULT gen_random_uuid();`,
      `ALTER TABLE services ALTER COLUMN barber_shop_id TYPE uuid USING gen_random_uuid();`,
      `ALTER TABLE services ALTER COLUMN service_template_id TYPE uuid USING gen_random_uuid();`,

      // 6. Convert barber_comments table
      `ALTER TABLE barber_comments ALTER COLUMN id TYPE uuid USING gen_random_uuid();`,
      `ALTER TABLE barber_comments ALTER COLUMN id SET DEFAULT gen_random_uuid();`,
      `ALTER TABLE barber_comments ALTER COLUMN barber_shop_id TYPE uuid USING gen_random_uuid();`,
      `ALTER TABLE barber_comments ALTER COLUMN user_id TYPE uuid USING gen_random_uuid();`,

      // 7. Convert barber_comment_replies table
      `ALTER TABLE barber_comment_replies ALTER COLUMN id TYPE uuid USING gen_random_uuid();`,
      `ALTER TABLE barber_comment_replies ALTER COLUMN id SET DEFAULT gen_random_uuid();`,
      `ALTER TABLE barber_comment_replies ALTER COLUMN comment_id TYPE uuid USING gen_random_uuid();`,
      `ALTER TABLE barber_comment_replies ALTER COLUMN user_id TYPE uuid USING gen_random_uuid();`,

      // 8. Convert barber_comment_reply_moderations table
      `ALTER TABLE barber_comment_reply_moderations ALTER COLUMN id TYPE uuid USING gen_random_uuid();`,
      `ALTER TABLE barber_comment_reply_moderations ALTER COLUMN id SET DEFAULT gen_random_uuid();`,
      `ALTER TABLE barber_comment_reply_moderations ALTER COLUMN reply_id TYPE uuid USING gen_random_uuid();`,

      // 9. Convert barber_comment_reply_history table
      `ALTER TABLE barber_comment_reply_history ALTER COLUMN id TYPE uuid USING gen_random_uuid();`,
      `ALTER TABLE barber_comment_reply_history ALTER COLUMN id SET DEFAULT gen_random_uuid();`,
      `ALTER TABLE barber_comment_reply_history ALTER COLUMN comment_id TYPE uuid USING gen_random_uuid();`,
      `ALTER TABLE barber_comment_reply_history ALTER COLUMN reply_id TYPE uuid USING gen_random_uuid();`,

      // 10. Convert barber_reviews table
      `ALTER TABLE barber_reviews ALTER COLUMN id TYPE uuid USING gen_random_uuid();`,
      `ALTER TABLE barber_reviews ALTER COLUMN id SET DEFAULT gen_random_uuid();`,
      `ALTER TABLE barber_reviews ALTER COLUMN barber_shop_id TYPE uuid USING gen_random_uuid();`,

      // 11. Convert barber_photos table
      `ALTER TABLE barber_photos ALTER COLUMN id TYPE uuid USING gen_random_uuid();`,
      `ALTER TABLE barber_photos ALTER COLUMN id SET DEFAULT gen_random_uuid();`,
      `ALTER TABLE barber_photos ALTER COLUMN barber_shop_id TYPE uuid USING gen_random_uuid();`,

      // 12. Convert system_settings table
      `ALTER TABLE system_settings ALTER COLUMN id TYPE uuid USING gen_random_uuid();`,
      `ALTER TABLE system_settings ALTER COLUMN id SET DEFAULT gen_random_uuid();`,

      // 13. Convert barber_hours table
      `ALTER TABLE barber_hours ALTER COLUMN id TYPE uuid USING gen_random_uuid();`,
      `ALTER TABLE barber_hours ALTER COLUMN id SET DEFAULT gen_random_uuid();`,
      `ALTER TABLE barber_hours ALTER COLUMN barber_shop_id TYPE uuid USING gen_random_uuid();`,

      // 14. Convert shop_staff table foreign keys
      `ALTER TABLE shop_staff ALTER COLUMN shop_id TYPE uuid USING gen_random_uuid();`,

      // 15. Convert staff_hours table
      `ALTER TABLE staff_hours ALTER COLUMN id TYPE uuid USING gen_random_uuid();`,
      `ALTER TABLE staff_hours ALTER COLUMN id SET DEFAULT gen_random_uuid();`,
      `ALTER TABLE staff_hours ALTER COLUMN staff_id TYPE uuid USING gen_random_uuid();`,

      // 16. Convert staff_leaves table
      `ALTER TABLE staff_leaves ALTER COLUMN id TYPE uuid USING gen_random_uuid();`,
      `ALTER TABLE staff_leaves ALTER COLUMN id SET DEFAULT gen_random_uuid();`,
      `ALTER TABLE staff_leaves ALTER COLUMN staff_id TYPE uuid USING gen_random_uuid();`,

      // 17. Convert logs table
      `ALTER TABLE logs ALTER COLUMN id TYPE uuid USING gen_random_uuid();`,
      `ALTER TABLE logs ALTER COLUMN id SET DEFAULT gen_random_uuid();`,

      // 18. Re-add foreign key constraints
      `ALTER TABLE barber_shops ADD CONSTRAINT barber_shops_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL;`,
      `ALTER TABLE services ADD CONSTRAINT services_barber_shop_id_fkey FOREIGN KEY (barber_shop_id) REFERENCES barber_shops(id) ON DELETE CASCADE;`,
      `ALTER TABLE services ADD CONSTRAINT services_service_template_id_fkey FOREIGN KEY (service_template_id) REFERENCES service_templates(id) ON DELETE SET NULL;`,
      `ALTER TABLE barber_comments ADD CONSTRAINT barber_comments_barber_shop_id_fkey FOREIGN KEY (barber_shop_id) REFERENCES barber_shops(id) ON DELETE CASCADE;`,
      `ALTER TABLE barber_comments ADD CONSTRAINT barber_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;`,
      `ALTER TABLE barber_comment_replies ADD CONSTRAINT barber_comment_replies_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES barber_comments(id) ON DELETE CASCADE;`,
      `ALTER TABLE barber_comment_replies ADD CONSTRAINT barber_comment_replies_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;`,
      `ALTER TABLE barber_comment_reply_moderations ADD CONSTRAINT barber_comment_reply_moderations_reply_id_fkey FOREIGN KEY (reply_id) REFERENCES barber_comment_replies(id) ON DELETE CASCADE;`,
      `ALTER TABLE barber_comment_reply_history ADD CONSTRAINT barber_comment_reply_history_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES barber_comments(id) ON DELETE CASCADE;`,
      `ALTER TABLE barber_comment_reply_history ADD CONSTRAINT barber_comment_reply_history_reply_id_fkey FOREIGN KEY (reply_id) REFERENCES barber_comment_replies(id) ON DELETE CASCADE;`,
      `ALTER TABLE barber_reviews ADD CONSTRAINT barber_reviews_barber_shop_id_fkey FOREIGN KEY (barber_shop_id) REFERENCES barber_shops(id) ON DELETE CASCADE;`,
      `ALTER TABLE barber_photos ADD CONSTRAINT barber_photos_barber_shop_id_fkey FOREIGN KEY (barber_shop_id) REFERENCES barber_shops(id) ON DELETE CASCADE;`,
      `ALTER TABLE barber_hours ADD CONSTRAINT barber_hours_barber_shop_id_fkey FOREIGN KEY (barber_shop_id) REFERENCES barber_shops(id) ON DELETE CASCADE;`,
      `ALTER TABLE shop_staff ADD CONSTRAINT shop_staff_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES barber_shops(id) ON DELETE CASCADE;`,
      `ALTER TABLE shop_staff ADD CONSTRAINT shop_staff_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES users(auth_user_id) ON DELETE CASCADE;`,
      `ALTER TABLE staff_hours ADD CONSTRAINT staff_hours_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES shop_staff(id) ON DELETE CASCADE;`,
      `ALTER TABLE staff_leaves ADD CONSTRAINT staff_leaves_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES shop_staff(id) ON DELETE CASCADE;`,
      `ALTER TABLE user_favorite_barbers ADD CONSTRAINT user_favorite_barbers_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES shop_staff(id) ON DELETE CASCADE;`,
      `ALTER TABLE user_favorite_shops ADD CONSTRAINT user_favorite_shops_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES barber_shops(id) ON DELETE CASCADE;`,
      `ALTER TABLE bookings ADD CONSTRAINT bookings_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES barber_shops(id) ON DELETE CASCADE;`,
      `ALTER TABLE bookings ADD CONSTRAINT bookings_barber_id_fkey FOREIGN KEY (barber_id) REFERENCES shop_staff(id) ON DELETE SET NULL;`,
      `ALTER TABLE booking_services ADD CONSTRAINT booking_services_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;`,
      `ALTER TABLE booking_services ADD CONSTRAINT booking_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE;`,
      `ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;`,
      `ALTER TABLE in_app_notifications ADD CONSTRAINT in_app_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;`,
    ];

    // Execute queries one by one
    for (let i = 0; i < uuidConversionQueries.length; i++) {
      const query = uuidConversionQueries[i];
      console.log(`[${i + 1}/${uuidConversionQueries.length}] Executing migration step...`);
      
      try {
        await migrationClient.unsafe(query);
        console.log(`✅ Step ${i + 1} completed successfully`);
      } catch (error) {
        console.error(`❌ Step ${i + 1} failed:`, error.message);
        // Continue with next query instead of stopping
        console.log('⚠️  Continuing with next step...');
      }
    }

    console.log('\n🎉 UUID conversion process completed!');
    
    // Verify the conversion
    console.log('\n🔍 Verifying UUID conversion...');
    const verification = await migrationClient`
      SELECT table_name, column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND column_name = 'id'
      ORDER BY table_name
    `;
    
    console.log('\n📊 Final ID column types:');
    verification.forEach(row => {
      console.log(`  ${row.table_name}.id: ${row.data_type} (default: ${row.column_default || 'none'})`);
    });

    await migrationClient.end();
    
  } catch (error) {
    console.error('❌ UUID conversion failed:', error);
    process.exit(1);
  }
}

// Run the conversion
convertIdsToUUID().catch(console.error);