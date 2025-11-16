import { Pool } from "pg";
import { config } from "./index";

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
});

export const connectDB = async () => {
  try {
    await pool.connect();
    console.log("✅ Connected to PostgreSQL");
  } catch (err) {
    console.error("❌ Database connection failed", err);
    process.exit(1);
  }
};
