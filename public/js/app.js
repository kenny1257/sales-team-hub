/* ==============================================
   Metal America Sales Hub - Dashboard App
   ============================================== */

(function () {
    let currentUser = null;

    // ---- Bootstrap ----
    init();

    async function init() {
        try {
            const res = await api('/api/auth/me');
            currentUser = res.user;
        } catch {
            window.location.href = '/index.html';
            return;
        }

        renderUserInfo();
        setupNav();
        setupLogout();
        loadHome();
    }

    // ================ USER INFO ================
    function renderUserInfo() {
        document.getElementById('user-avatar').src = currentUser.picture || '';
        document.getElementById('user-name').textContent = currentUser.name;

        const hour = new Date().getHours();
        let greeting = 'Good evening';
        if (hour < 12) greeting = 'Good morning';
        else if (hour < 17) greeting = 'Good afternoon';
        document.getElementById('welcome-msg').textContent = `${greeting}, ${currentUser.name.split(' ')[0]}!`;

        const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', opts);
    }

    // ================ NAVIGATION ================
    function setupNav() {
        const links = document.querySelectorAll('.nav-link');
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = link.dataset.tab;
                links.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
                const el = document.getElementById('tab-' + tab);
                if (el) el.classList.add('active');
                onTabChange(tab);
            });
        });
    }

    function onTabChange(tab) {
        if (tab === 'home') loadHome();
        if (tab === 'checkin') loadCheckin();
    }

    // ================ LOGOUT ================
    function setupLogout() {
        document.getElementById('logout-btn').addEventListener('click', async () => {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/index.html';
        });
    }

    // ================ HOME TAB ================
    async function loadHome() {
        // Sales tip
        try {
            const data = await api('/api/salestip/today');
            document.getElementById('sales-tip-text').textContent = data.tip.tip_text;
            const cat = document.getElementById('sales-tip-category');
            cat.textContent = data.tip.category || '';
            cat.style.display = data.tip.category ? 'inline-block' : 'none';
        } catch {
            document.getElementById('sales-tip-text').textContent = 'Could not load tip.';
        }

        // Admin stats
        if (currentUser.role === 'admin') {
            document.getElementById('home-admin-panel').style.display = 'block';
            try {
                const [teamData, checkinData] = await Promise.all([
                    api('/api/admin/team'),
                    api('/api/admin/checkins')
                ]);
                const total = teamData.members.length;
                const checkedIn = checkinData.checkins.filter(c => !c.check_out_time).length;
                const checkedOut = checkinData.checkins.filter(c => c.check_out_time).length;
                document.getElementById('stat-checked-in').textContent = checkedIn;
                document.getElementById('stat-checked-out').textContent = checkedOut;
                document.getElementById('stat-not-in').textContent = Math.max(0, total - checkedIn - checkedOut);
            } catch { /* ignore */ }
        }
    }

    // ================ CHECK-IN / CHECK-OUT ================
    async function loadCheckin() {
        const area = document.getElementById('checkin-area');
        area.innerHTML = '<p class="text-muted">Loading...</p>';

        try {
            const data = await api('/api/checkin/status');
            renderCheckinState(data.checkin);
        } catch {
            area.innerHTML = '<p class="text-muted">Could not load check-in status.</p>';
        }

        // Admin panel
        if (currentUser.role === 'admin') {
            document.getElementById('admin-team-dashboard').style.display = 'block';
            const picker = document.getElementById('admin-date-picker');
            if (!picker.value) picker.value = todayStr();
            picker.onchange = () => loadTeamCheckins(picker.value);
            loadTeamCheckins(picker.value);
        }
    }

    function renderCheckinState(checkin) {
        const area = document.getElementById('checkin-area');

        // State 1: Not checked in
        if (!checkin) {
            area.innerHTML = `
                <div class="card">
                    <h3 class="card-title"><i class="fa-solid fa-arrow-right-to-bracket"></i> Check In</h3>
                    <form id="checkin-form">
                        <div class="form-group">
                            <label class="form-label">What are you working on today?</label>
                            <textarea class="form-control" id="ci-working" placeholder="Describe your tasks for today..." required></textarea>
                        </div>
                        <div class="form-group">
                            <label class="form-label">What is your goal for today?</label>
                            <textarea class="form-control" id="ci-goal" placeholder="What do you want to accomplish?" required></textarea>
                        </div>
                        <button type="submit" class="btn btn-primary"><i class="fa-solid fa-check"></i> Check In</button>
                    </form>
                </div>
            `;
            document.getElementById('checkin-form').addEventListener('submit', handleCheckin);
            return;
        }

        // State 2: Checked in but not checked out
        if (!checkin.check_out_time) {
            area.innerHTML = `
                <div class="card">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
                        <h3 class="card-title" style="margin-bottom:0;"><i class="fa-solid fa-clipboard-check"></i> Today's Check-In</h3>
                        <span class="status-badge checked-in"><i class="fa-solid fa-circle"></i> Checked In</span>
                    </div>
                    <div class="summary-section">
                        <div class="summary-label">Checked in at</div>
                        <div class="summary-time">${formatTime(checkin.check_in_time)}</div>
                    </div>
                    <div class="summary-section">
                        <div class="summary-label">Working on</div>
                        <div class="summary-value">${esc(checkin.working_on)}</div>
                    </div>
                    <div class="summary-section">
                        <div class="summary-label">Goal</div>
                        <div class="summary-value">${esc(checkin.goal)}</div>
                    </div>
                </div>

                <div class="card">
                    <h3 class="card-title"><i class="fa-solid fa-arrow-right-from-bracket"></i> Check Out</h3>
                    <form id="checkout-form">
                        <div class="form-group">
                            <label class="form-label">What did you get done today?</label>
                            <textarea class="form-control" id="co-accomplished" placeholder="Summarize what you accomplished..." required></textarea>
                        </div>
                        <div class="form-group">
                            <label class="form-label">What went well or poorly?</label>
                            <textarea class="form-control" id="co-reflection" placeholder="Reflect on your day..." required></textarea>
                        </div>
                        <button type="submit" class="btn btn-dark"><i class="fa-solid fa-check"></i> Check Out</button>
                    </form>
                </div>
            `;
            document.getElementById('checkout-form').addEventListener('submit', handleCheckout);
            return;
        }

        // State 3: Fully completed
        area.innerHTML = `
            <div class="card">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
                    <h3 class="card-title" style="margin-bottom:0;"><i class="fa-solid fa-clipboard-check"></i> Today's Summary</h3>
                    <span class="status-badge checked-out"><i class="fa-solid fa-circle-check"></i> Completed</span>
                </div>

                <div class="summary-section">
                    <div class="summary-label">Checked in at</div>
                    <div class="summary-time">${formatTime(checkin.check_in_time)}</div>
                </div>
                <div class="summary-section">
                    <div class="summary-label">Working on</div>
                    <div class="summary-value">${esc(checkin.working_on)}</div>
                </div>
                <div class="summary-section">
                    <div class="summary-label">Goal</div>
                    <div class="summary-value">${esc(checkin.goal)}</div>
                </div>

                <hr style="border:none; border-top:1px solid #e0e0e0; margin:20px 0;">

                <div class="summary-section">
                    <div class="summary-label">Checked out at</div>
                    <div class="summary-time">${formatTime(checkin.check_out_time)}</div>
                </div>
                <div class="summary-section">
                    <div class="summary-label">Accomplished</div>
                    <div class="summary-value">${esc(checkin.accomplished)}</div>
                </div>
                <div class="summary-section">
                    <div class="summary-label">Reflection</div>
                    <div class="summary-value">${esc(checkin.went_well_poorly)}</div>
                </div>
            </div>
        `;
    }

    async function handleCheckin(e) {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';

        try {
            const data = await api('/api/checkin', 'POST', {
                working_on: document.getElementById('ci-working').value.trim(),
                goal: document.getElementById('ci-goal').value.trim(),
            });
            renderCheckinState(data.checkin);
        } catch (err) {
            alert(err.message || 'Check-in failed');
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Check In';
        }
    }

    async function handleCheckout(e) {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';

        try {
            const data = await api('/api/checkout', 'POST', {
                accomplished: document.getElementById('co-accomplished').value.trim(),
                went_well_poorly: document.getElementById('co-reflection').value.trim(),
            });
            renderCheckinState(data.checkin);
        } catch (err) {
            alert(err.message || 'Check-out failed');
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Check Out';
        }
    }

    // ================ ADMIN - TEAM CHECKINS ================
    async function loadTeamCheckins(date) {
        const grid = document.getElementById('team-checkins-grid');
        grid.innerHTML = '<p class="text-muted">Loading team data...</p>';

        try {
            const data = await api(`/api/admin/checkins?date=${date}`);
            if (data.checkins.length === 0) {
                grid.innerHTML = `
                    <div class="no-data-message" style="grid-column:1/-1;">
                        <i class="fa-solid fa-inbox"></i>
                        No check-ins recorded for this date.
                    </div>`;
                return;
            }
            grid.innerHTML = data.checkins.map(c => renderMemberCard(c)).join('');
        } catch {
            grid.innerHTML = '<p class="text-muted">Could not load team data.</p>';
        }
    }

    function renderMemberCard(c) {
        const isComplete = !!c.check_out_time;
        const badgeClass = isComplete ? 'checked-out' : 'checked-in';
        const badgeText = isComplete ? 'Completed' : 'Working';
        const badgeIcon = isComplete ? 'fa-circle-check' : 'fa-circle';

        let html = `
        <div class="member-card">
            <div class="member-header">
                <img src="${c.picture || ''}" alt="" class="member-avatar">
                <div class="member-info">
                    <div class="member-name">${esc(c.name)}</div>
                    <div class="member-email">${esc(c.email)}</div>
                </div>
                <span class="status-badge ${badgeClass}"><i class="fa-solid ${badgeIcon}"></i> ${badgeText}</span>
            </div>
            <div class="member-details">
                <div><div class="summary-label">Checked In</div><div class="summary-time">${formatTime(c.check_in_time)}</div></div>
                <div><div class="summary-label">Working On</div><div class="summary-value">${esc(c.working_on)}</div></div>
                <div><div class="summary-label">Goal</div><div class="summary-value">${esc(c.goal)}</div></div>`;

        if (isComplete) {
            html += `
                <div style="border-top:1px solid #e0e0e0; padding-top:10px; margin-top:4px;">
                    <div class="summary-label">Checked Out</div><div class="summary-time">${formatTime(c.check_out_time)}</div>
                </div>
                <div><div class="summary-label">Accomplished</div><div class="summary-value">${esc(c.accomplished)}</div></div>
                <div><div class="summary-label">Reflection</div><div class="summary-value">${esc(c.went_well_poorly)}</div></div>`;
        }

        html += `</div></div>`;
        return html;
    }

    // ================ HELPERS ================
    async function api(url, method = 'GET', body = null) {
        const opts = { method, headers: {} };
        if (body) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(body);
        }
        const res = await fetch(url, opts);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Request failed');
        return data;
    }

    function todayStr() {
        return new Date().toISOString().split('T')[0];
    }

    function formatTime(isoStr) {
        if (!isoStr) return '—';
        const d = new Date(isoStr);
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }

    function esc(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }
})();
