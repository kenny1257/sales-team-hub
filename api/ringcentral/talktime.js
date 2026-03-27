const { rcGet, rcPost } = require('../../lib/ringcentral');
const { getUserId } = require('../../lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const date = req.query.date || new Date().toISOString().split('T')[0];

    try {
        // 1. Fetch ALL extensions for the filter list
        let allExtRecords = [];
        let extPage = 1;
        let extHasMore = true;
        while (extHasMore && extPage <= 10) {
            const extData = await rcGet('/restapi/v1.0/account/~/extension', {
                perPage: '1000',
                page: String(extPage),
            });
            allExtRecords = allExtRecords.concat(extData.records || []);
            if (extData.paging) {
                extHasMore = extData.paging.page < extData.paging.totalPages;
            } else {
                extHasMore = false;
            }
            extPage++;
        }

        const extensions = {};
        const allExtensions = [];
        for (const ext of allExtRecords) {
            const id = String(ext.id);
            const entry = {
                id,
                name: ext.name || ('Ext ' + ext.extensionNumber),
                extensionNumber: ext.extensionNumber || '',
                type: ext.type || '',
                status: ext.status || '',
            };
            extensions[id] = entry;
            allExtensions.push(entry);
        }
        allExtensions.sort((a, b) => a.name.localeCompare(b.name));

        // 2. Fetch aggregated call data from the Analytics API
        //    This gives the EXACT same numbers as the RingCentral dashboard
        const nextDate = new Date(date + 'T00:00:00');
        nextDate.setDate(nextDate.getDate() + 1);
        const nextDateStr = nextDate.toISOString().split('T')[0];

        const analyticsData = await rcPost('/analytics/calls/v1/accounts/~/aggregation/fetch', {
            grouping: {
                groupBy: 'Users',
            },
            timeSettings: {
                timeZone: 'America/Chicago',
                timeRange: {
                    timeFrom: `${date}T00:00:00.000Z`,
                    timeTo: `${nextDateStr}T00:00:00.000Z`,
                },
            },
            responseOptions: {
                counters: {
                    allCalls: { aggregationType: 'Sum' },
                },
                timers: {
                    allCallsDuration: { aggregationType: 'Sum' },
                    callsSegmentsDuration: { aggregationType: 'Sum' },
                },
            },
        });

        // 3. Build stats from analytics data
        const stats = {};

        // Initialize ALL extensions at 0
        for (const ext of allExtensions) {
            stats[ext.id] = {
                ...ext,
                calls: 0,
                talkTime: 0,
            };
        }

        // Fill in analytics data
        for (const record of (analyticsData.data || [])) {
            const extId = record.key ? String(record.key.extensionId) : null;
            if (!extId) continue;

            const calls = record.counters?.allCalls?.sum || 0;
            const segmentsDuration = record.timers?.callsSegmentsDuration?.sum || 0;
            const talkDuration = record.timers?.allCallsDuration?.sum || 0;

            if (stats[extId]) {
                stats[extId].calls = calls;
                stats[extId].talkTime = segmentsDuration || talkDuration;
            } else {
                stats[extId] = {
                    id: extId,
                    name: 'Extension ' + extId,
                    extensionNumber: '',
                    type: '',
                    status: '',
                    calls,
                    talkTime: segmentsDuration || talkDuration,
                };
                allExtensions.push(stats[extId]);
            }
        }

        // Sort by talk time descending
        const leaderboard = Object.values(stats).sort((a, b) => b.talkTime - a.talkTime);

        const totalCalls = leaderboard.reduce((sum, r) => sum + r.calls, 0);
        const totalTalkTime = leaderboard.reduce((sum, r) => sum + r.talkTime, 0);

        allExtensions.sort((a, b) => a.name.localeCompare(b.name));

        res.json({
            date,
            leaderboard,
            allExtensions,
            totalCalls,
            totalTalkTime,
            extensionCount: allExtensions.length,
            lastUpdated: new Date().toISOString(),
        });
    } catch (err) {
        console.error('RingCentral error:', err);
        res.status(500).json({ error: 'Failed to fetch talk time data: ' + err.message });
    }
};
