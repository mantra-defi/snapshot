import pool from './dbConfig.js';

let client;

export async function createConnection() {
  client = await pool.connect();
  return client;
}

export async function closeConnection() {
  await client.release();
}

export async function insertUserAddressHistory(address: string, balance: number, timestamp: bigint, category: string, points: number = 0.0) {
  try {
    const sql = `
      INSERT INTO "UserAddressHistory"(id, address, balance, timestamp, category, points)
      VALUES(gen_random_uuid(), $1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const res = await client.query(sql, [address, balance, timestamp.toString(), category, points]);
    console.log("UserAddressHistory inserted:", res.rows[0]);
    return res.rows[0];
  } catch (err) {
    console.error('Error inserting UserAddressHistory', err);
    throw err;
  }
}

export async function getUserAddressHistory(address: string) {
  try {
    const sql = `
      SELECT * FROM "UserAddressHistory"
      WHERE address = $1
      ORDER BY timestamp DESC;
    `;
    const res = await client.query(sql, [address]);
    return res.rows;
  } catch (err) {
    console.error('Error fetching UserAddressHistory', err);
    throw err;
  }
}

export async function createOrUpdateUserAddress(address: string, balance: number, timestamp: bigint, points: number = 0.0) {
  try {
    // First check if address exists
    const checkSql = `
      SELECT id FROM "UserAddress"
      WHERE address = $1;
    `;
    const checkRes = await client.query(checkSql, [address]);

    let sql;
    let params;

    if (checkRes.rows.length > 0) {
      // Update existing record
      sql = `
        UPDATE "UserAddress"
        SET balance = $2,
            "timestampLatest" = $3,
            points = $4,
            "dateUpdated" = NOW()
        WHERE address = $1
        RETURNING *;
      `;
      params = [address, balance, timestamp.toString(), points];
    } else {
      // Insert new record
      sql = `
        INSERT INTO "UserAddress" (id, address, balance, "timestampLatest", points)
        VALUES (gen_random_uuid(), $1, $2, $3, $4)
        RETURNING *;
      `;
      params = [address, balance, timestamp.toString(), points];
    }

    const res = await client.query(sql, params);
    console.log("UserAddress created/updated:", res.rows[0]);
    return res.rows[0];
  } catch (err) {
    console.error('Error creating/updating UserAddress', err);
    throw err;
  }
}

export async function getUserAddress(address: string) {
  try {
    const sql = `
      SELECT * FROM "UserAddress"
      WHERE address = $1;
    `;
    const res = await client.query(sql, [address]);
    return res.rows[0] || null;
  } catch (err) {
    console.error('Error fetching UserAddress', err);
    throw err;
  }
}

export async function getAllUserAddresses(limit?: number) {
  try {
    let sql = `
      SELECT address, points, balance, "timestampLatest" FROM "UserAddress"
      ORDER BY points DESC
    `;

    if (limit) {
      sql += ` LIMIT $1`;
    }

    sql += `;`;

    const res = limit
      ? await client.query(sql, [limit])
      : await client.query(sql);

    return res.rows;
  } catch (err) {
    console.error('Error fetching all UserAddresses', err);
    throw err;
  }
}

export async function getReferralPointsByAddress(address: string) {
  try {
    const sql = `
      SELECT * FROM "ReferralPoints"
      WHERE address = $1;
    `;
    const res = await client.query(sql, [address]);
    return res.rows[0] || null;
  } catch (err) {
    console.error('Error fetching ReferralPoints', err);
    throw err;
  }
}

export async function getReferralPointsForMultipleAddresses(addresses: string[]) {
  try {
    if (!addresses || addresses.length === 0) {
      return [];
    }
    
    // Create parameterized query with the right number of placeholders
    const placeholders = addresses.map((_, index) => `$${index + 1}`).join(', ');
    const sql = `
      SELECT address, "totalPoints" 
      FROM "ReferralPoints"
      WHERE address IN (${placeholders});
    `;
    
    const res = await client.query(sql, addresses);
    return res.rows;
  } catch (err) {
    console.error('Error fetching ReferralPoints for multiple addresses', err);
    throw err;
  }
}

export async function getTopReferrers(limit: number = 10) {
  try {
    const sql = `
      SELECT address, "totalPoints" 
      FROM "ReferralPoints"
      ORDER BY "totalPoints" DESC
      LIMIT $1;
    `;
    
    const res = await client.query(sql, [limit]);
    return res.rows;
  } catch (err) {
    console.error('Error fetching top referrers', err);
    throw err;
  }
}

export async function getReferralsForAddress(referrerAddress: string) {
  try {
    const sql = `
      SELECT * FROM "Referral"
      WHERE "referrerAddress" = $1
      ORDER BY "dateCreated" DESC;
    `;
    
    const res = await client.query(sql, [referrerAddress]);
    return res.rows;
  } catch (err) {
    console.error('Error fetching referrals for address', err);
    throw err;
  }
}