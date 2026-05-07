const { sql } = require('@vercel/postgres');

let initialized = false;

async function initDb() {
    if (initialized) return;

    await sql`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            google_id VARCHAR(255) UNIQUE NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            name VARCHAR(255) NOT NULL,
            picture TEXT,
            role VARCHAR(50) DEFAULT 'member',
            created_at TIMESTAMP DEFAULT NOW()
        )
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS checkins (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            date DATE NOT NULL,
            check_in_time TIMESTAMP NOT NULL,
            working_on TEXT NOT NULL,
            goal TEXT NOT NULL,
            check_out_time TIMESTAMP,
            accomplished TEXT,
            went_well_poorly TEXT,
            UNIQUE(user_id, date)
        )
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS sales_tips (
            id SERIAL PRIMARY KEY,
            tip_text TEXT NOT NULL,
            category VARCHAR(100) DEFAULT 'General',
            created_by INTEGER REFERENCES users(id),
            created_at TIMESTAMP DEFAULT NOW()
        )
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS requests (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            type VARCHAR(50) NOT NULL,
            manufacturer VARCHAR(255),
            needed_by VARCHAR(50),
            customer_needs TEXT,
            pdf_data TEXT,
            pdf_filename VARCHAR(255),
            status VARCHAR(50) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT NOW()
        )
    `;

    await sql`ALTER TABLE requests ADD COLUMN IF NOT EXISTS state VARCHAR(2)`;
    await sql`ALTER TABLE requests ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255)`;
    await sql`ALTER TABLE requests ADD COLUMN IF NOT EXISTS customer_address TEXT`;

    await sql`ALTER TABLE checkins ADD COLUMN IF NOT EXISTS energy_start INT`;
    await sql`ALTER TABLE checkins ADD COLUMN IF NOT EXISTS help_needed TEXT`;
    await sql`ALTER TABLE checkins ADD COLUMN IF NOT EXISTS team_advice TEXT`;
    await sql`ALTER TABLE checkins ADD COLUMN IF NOT EXISTS energy_end INT`;
    await sql`ALTER TABLE checkins ALTER COLUMN working_on DROP NOT NULL`;

    await sql`
        CREATE TABLE IF NOT EXISTS request_files (
            id SERIAL PRIMARY KEY,
            request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
            file_data TEXT NOT NULL,
            file_name VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        )
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS settings (
            key VARCHAR(255) PRIMARY KEY,
            value TEXT,
            updated_at TIMESTAMP DEFAULT NOW()
        )
    `;

    // Seed default tips if empty
    const { rows } = await sql`SELECT COUNT(*)::int as count FROM sales_tips`;
    if (rows[0].count === 0) {
        const tips = [
            ["Always listen more than you talk. The customer will tell you exactly what they need.", "Communication"],
            ["Follow up within 24 hours. Speed wins deals.", "Follow-Up"],
            ["Know your product inside and out. Confidence comes from knowledge.", "Product Knowledge"],
            ["Build relationships, not just transactions. Repeat customers are your best asset.", "Relationships"],
            ["Every 'no' gets you closer to a 'yes'. Stay persistent and positive.", "Mindset"],
        ];
        for (const [text, cat] of tips) {
            await sql`INSERT INTO sales_tips (tip_text, category) VALUES (${text}, ${cat})`;
        }
    }

    initialized = true;
}

module.exports = { sql, initDb };
