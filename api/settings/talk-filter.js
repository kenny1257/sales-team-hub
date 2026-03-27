const { sql, initDb } = require('../../lib/db');
const { getUserId } = require('../../lib/auth');

module.exports = async function handler(req, res) {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    await initDb();

    // GET — anyone can read the shared filter
    if (req.method === 'GET') {
        const { rows } = await sql`SELECT value FROM settings WHERE key = 'talk_hidden_ids'`;
        const hiddenIds = rows.length > 0 ? JSON.parse(rows[0].value) : [];
        return res.json({ hiddenIds });
    }

    // POST — admin only can save the filter
    if (req.method === 'POST') {
        const { rows: userRows } = await sql`SELECT role FROM users WHERE id = ${userId}`;
        if (!userRows[0] || userRows[0].role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { hiddenIds } = req.body;
        if (!Array.isArray(hiddenIds)) return res.status(400).json({ error: 'hiddenIds must be an array' });

        const value = JSON.stringify(hiddenIds);

        // Upsert
        const existing = await sql`SELECT key FROM settings WHERE key = 'talk_hidden_ids'`;
        if (existing.rows.length > 0) {
            await sql`UPDATE settings SET value = ${value}, updated_at = NOW() WHERE key = 'talk_hidden_ids'`;
        } else {
            await sql`INSERT INTO settings (key, value) VALUES ('talk_hidden_ids', ${value})`;
        }

        return res.json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
};
