import * as pg from 'pg'
import fs from 'fs';
import path from 'path';
const { Pool } = pg.default;


const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  }
});

export default pool;
