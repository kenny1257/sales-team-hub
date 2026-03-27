const { rcGet } = require('../../lib/ringcentral');
const { getUserId } = require('../../lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const date = req.query.date || new Date().toISOString().split('T')[0];
    const dateFrom = `${date}T00:00:00.000Z`;
    const dateTo = `${date}T23:59:59.999Z`;

    try {
        // Fetch all user extensions
        const extData = await rcGet('/restapi/v1.0/account/~/extension', {
            type: 'User',
            status: 'Enabled',
            perPage: '1000',
        });

        const extensions = {};
        for (const ext of (extData.records || [])) {
            extensions[ext.id] = {
                id: String(ext.id),
                name: ext.name || `Ext ${ext.extensionNumber}`,
                extensionNumber: ext.extensionNumber,
            };
        }

        // Fetch call logs with pagination
        let allRecords = [];
        let page = 1;
        let hasMore = true;

        while (hasMore && page <= 10) {
            const logData = await rcGet('/restapi/v1.0/account/~/call-log', {
                dateFrom,
                dateTo,
                type: 'Voice',
                view: 'Simple',
                perPage: '1000',
                page: String(page),
            });

            allRecords = allRecords.concat(logData.records || []);
            hasMore = !!(logData.navigation && logData.navigation.nextPage);
            page++;
        }

        // Aggregate by extension
        const stats = {};
        for (const record of allRecords) {
            const extId = record.extension ? String(record.extension.id) : null;
            if (!extId || !extensions[extId]) continue;

            if (!stats[extId]) {
                stats[extId] = {
                    ...extensions[extId],
                    calls: 0,
                    talkTime: 0,
                };
            }
            stats[extId].calls++;
            stats[extId].talkTime += record.duration || 0;
        }

        // Sort by talk time descending
        const leaderboard = Object.values(stats).sort((a, b) => b.talkTime - a.talkTime);

        const totalCalls = leaderboard.reduce((sum, r) => sum + r.calls, 0);
        const totalTalkTime = leaderboard.reduce((sum, r) => sum + r.talkTime, 0);

        res.json({
            date,
            leaderboard,
            totalCalls,
            totalTalkTime,
            lastUpdated: new Date().toISOString(),
        });
    } catch (err) {
        console.error('RingCentral error:', err);
        res.status(500).json({ error: 'Failed to fetch talk time data: ' + err.message });
    }
};
