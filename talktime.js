const { rcGet } = require('../../lib/ringcentral');
const { getUserId } = require('../../lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const date = req.query.date || new Date().toISOString().split('T')[0];
    // Use account-local time (no Z suffix) so RingCentral uses the account's timezone
    const dateFrom = `${date}T00:00:00`;
    const dateTo = `${date}T23:59:59`;

    try {
        // Fetch all user extensions
        const extData = await rcGet('/restapi/v1.0/account/~/extension', {
            type: 'User',
            status: 'Enabled',
            perPage: '1000',
        });

        const extensions = {};
        const allExtensions = [];
        for (const ext of (extData.records || [])) {
            const id = String(ext.id);
            const entry = {
                id,
                name: ext.name || ('Ext ' + ext.extensionNumber),
                extensionNumber: ext.extensionNumber,
            };
            extensions[id] = entry;
            allExtensions.push(entry);
        }
        allExtensions.sort((a, b) => a.name.localeCompare(b.name));

        // Fetch call logs — no type filter to capture all calls
        let allRecords = [];
        let page = 1;
        let hasMore = true;

        while (hasMore && page <= 20) {
            const logData = await rcGet('/restapi/v1.0/account/~/call-log', {
                dateFrom,
                dateTo,
                view: 'Simple',
                perPage: '1000',
                page: String(page),
            });

            allRecords = allRecords.concat(logData.records || []);

            // Check if there's a next page
            if (logData.paging) {
                hasMore = logData.paging.page < logData.paging.totalPages;
            } else if (logData.navigation) {
                hasMore = !!logData.navigation.nextPage;
            } else {
                hasMore = false;
            }
            page++;
        }

        // Aggregate by extension
        const stats = {};
        for (const record of allRecords) {
            // Try multiple ways to find the extension ID
            let extId = null;
            if (record.extension && record.extension.id) {
                extId = String(record.extension.id);
            }
            if (!extId) continue;
            if (!extensions[extId]) continue;

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
            allExtensions,
            totalCalls,
            totalTalkTime,
            recordCount: allRecords.length,
            lastUpdated: new Date().toISOString(),
        });
    } catch (err) {
        console.error('RingCentral error:', err);
        res.status(500).json({ error: 'Failed to fetch talk time data: ' + err.message });
    }
};
