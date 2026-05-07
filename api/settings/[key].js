const { sql, initDb } = require('../../lib/db');
const { getUserId } = require('../../lib/auth');

const ALLOWED_KEYS = new Set(['morning_note', 'weekly_goal']);

module.exports = async function handler(req, res) {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { key } = req.query;
    if (!ALLOWED_KEYS.has(key)) return res.status(400).json({ error: 'Unknown setting' });

    await initDb();

    if (req.method === 'GET') {
        const { rows } = await sql`SELECT value, updated_at FROM settings WHERE key = ${key}`;
        return res.json({
            value: rows.length > 0 ? rows[0].value : '',
            updated_at: rows.length > 0 ? rows[0].updated_at : null,
        });
    }

    if (req.method === 'POST') {
        const { rows: userRows } = await sql`SELECT role FROM users WHERE id = ${userId}`;
        if (!userRows[0] || userRows[0].role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { value } = req.body;
        if (typeof value !== 'string') return res.status(400).json({ error: 'value must be a string' });

        const existing = await sql`SELECT key FROM settings WHERE key = ${key}`;
        if (existing.rows.length > 0) {
            await sql`UPDATE settings SET value = ${value}, updated_at = NOW() WHERE key = ${key}`;
        } else {
            await sql`INSERT INTO settings (key, value) VALUES (${key}, ${value})`;
        }
        return res.json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
};
