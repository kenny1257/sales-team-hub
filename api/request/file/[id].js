const { sql, initDb } = require('../../../lib/db');
const { getUserId } = require('../../../lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    await initDb();

    const { rows: userRows } = await sql`SELECT role FROM users WHERE id = ${userId}`;
    const isAdmin = userRows[0] && userRows[0].role === 'admin';

    const { id } = req.query;
    const { rows } = await sql`
        SELECT rf.file_data, rf.file_name, r.user_id
        FROM request_files rf
        JOIN requests r ON rf.request_id = r.id
        WHERE rf.id = ${id}
    `;

    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (!isAdmin && rows[0].user_id !== userId) return res.status(403).json({ error: 'Access denied' });

    const buffer = Buffer.from(rows[0].file_data, 'base64');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${rows[0].file_name || 'document.pdf'}"`);
    res.send(buffer);
};
