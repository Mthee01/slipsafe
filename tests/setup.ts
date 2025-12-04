import { db } from "../server/db";
import { sql } from "drizzle-orm";

declare global {
  namespace NodeJS {
    interface Global {}
  }
}

export async function cleanDatabase() {
  try {
    await db.execute(sql`TRUNCATE TABLE user_activity CASCADE`);
    await db.execute(sql`TRUNCATE TABLE organization_invitations CASCADE`);
    await db.execute(sql`TRUNCATE TABLE organization_members CASCADE`);
    await db.execute(sql`TRUNCATE TABLE claims CASCADE`);
    await db.execute(sql`TRUNCATE TABLE purchases CASCADE`);
    await db.execute(sql`TRUNCATE TABLE organizations CASCADE`);
    await db.execute(sql`TRUNCATE TABLE business_profiles CASCADE`);
    await db.execute(sql`TRUNCATE TABLE merchant_rules CASCADE`);
    await db.execute(sql`TRUNCATE TABLE settings CASCADE`);
    await db.execute(sql`DELETE FROM users WHERE username LIKE 'test_%'`);
  } catch (error) {
    console.error('[Test Setup] Database cleanup error:', error);
    throw error;
  }
}

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await cleanDatabase();
});
