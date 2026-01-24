const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function runSchema() {
    try {
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('🔌 Connecting to Supabase...');
        const client = await pool.connect();

        console.log('⚡ Executing Schema...');
        await client.query(schemaSql);

        console.log('✅ Schema successfully applied!');
        client.release();
        process.exit(0);
    } catch (err) {
        console.error('❌ Failed to apply schema:', err);
        process.exit(1);
    }
}

runSchema();
