const { sql, initDb } = require('../../lib/db');
const { getUserId } = require('../../lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    await initDb();

    const { type, color, media, ad, search, sort } = req.query;

    // Build dynamic query with filters
    let query = `
        SELECT m.*, u.name as uploaded_by, u.picture as uploader_picture
        FROM media m
        JOIN users u ON m.user_id = u.id
        WHERE 1=1
    `;
    const params = [];

    if (type) {
        params.push(type);
        query += ` AND m.building_type = $${params.length}`;
    }

    if (color) {
        params.push(color);
        query += ` AND m.color = $${params.length}`;
    }

    if (media) {
        params.push(media);
        query += ` AND m.file_type = $${params.length}`;
    }

    if (ad === 'true') {
        query += ` AND m.is_advertisement = true`;
    }

    if (search) {
        params.push(`%${search}%`);
        query += ` AND (m.building_type ILIKE $${params.length} OR m.color ILIKE $${params.length} OR m.file_name ILIKE $${params.length})`;
    }

    // Sort
    if (sort === 'oldest') {
        query += ` ORDER BY m.created_at ASC`;
    } else if (sort === 'az') {
        query += ` ORDER BY m.building_type ASC, m.created_at DESC`;
    } else {
        query += ` ORDER BY m.created_at DESC`;
    }

    query += ` LIMIT 200`;

    // Use sql.query for dynamic queries
    const { rows } = await sql.query(query, params);

    // Get counts for sidebar
    const { rows: countRows } = await sql`
        SELECT
            COUNT(*)::int as total,
            COUNT(*) FILTER (WHERE file_type = 'image')::int as images,
            COUNT(*) FILTER (WHERE file_type = 'video')::int as videos,
            COUNT(*) FILTER (WHERE is_advertisement = true)::int as ads
        FROM media
    `;

    const { rows: typeCounts } = await sql`
        SELECT building_type, COUNT(*)::int as count
        FROM media
        WHERE building_type IS NOT NULL
        GROUP BY building_type
        ORDER BY building_type
    `;

    res.json({
        media: rows,
        counts: countRows[0],
        typeCounts: typeCounts,
    });
};
