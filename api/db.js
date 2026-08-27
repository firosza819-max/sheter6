import pg from 'pg';

const { Pool } = pg;

// تنظيف رابط الاتصال من أي sslmode قديم يسبب التحذير
const connectionString = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, '')
  : '';

// إعداد الاتصال بـ Neon أو PostgreSQL عبر السحابة مع ضبط SSL صريح
export const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});
