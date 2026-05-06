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

        const hour = parseInt(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Chicago' }));
        let greeting = 'Good evening';
        if (hour < 12) greeting = 'Good morning';
        else if (hour < 17) greeting = 'Good afternoon';
        document.getElementById('welcome-msg').textContent = `${greeting}, ${currentUser.name.split(' ')[0]}!`;

        const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' };
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
        if (tab === 'quote') loadQuoteRequest();
        if (tab === 'pricematch') loadPriceMatch();
        if (tab === 'dailytalk') loadDailyTalk();
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

        // Sales goal
        try {
            const goalData = await api('/api/salesgoal');
            document.getElementById('goal-current').textContent = goalData.currentVolume.toLocaleString();
            document.getElementById('goal-target-label').textContent = goalData.goal.toLocaleString();
            document.getElementById('goal-pct').textContent = goalData.percentageRaw + '%';
            document.getElementById('goal-bar-fill').style.width = Math.min(goalData.percentageRaw, 100) + '%';
        } catch {
            document.getElementById('goal-current').textContent = '—';
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

    // ================ MULTI-FILE UPLOAD HELPERS ================
    // Each section gets its own file array
    let pmFiles = [];
    let quoteFiles = [];

    function setupMultiFileUpload(zoneId, inputId, listId, fileArray, fileArrayName) {
        const zone = document.getElementById(zoneId);
        const input = document.getElementById(inputId);
        if (!zone || !input) return;

        // Click-to-browse
        input.addEventListener('change', () => {
            for (const f of input.files) addFileToArray(f, fileArrayName, listId);
            input.value = '';
        });

        // Drag & drop
        zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            for (const f of e.dataTransfer.files) addFileToArray(f, fileArrayName, listId);
        });
    }

    function addFileToArray(file, arrayName, listId) {
        if (!file.type.includes('pdf')) {
            alert('Please upload PDF files only.');
            return;
        }
        if (file.size > 15 * 1024 * 1024) {
            alert('Each file must be under 15MB.');
            return;
        }
        const arr = arrayName === 'pm' ? pmFiles : quoteFiles;
        // Prevent duplicates by name
        if (arr.some(f => f.name === file.name && f.size === file.size)) return;
        arr.push(file);
        renderFileList(arrayName, listId);
    }

    function removeFileFromArray(index, arrayName, listId) {
        const arr = arrayName === 'pm' ? pmFiles : quoteFiles;
        arr.splice(index, 1);
        if (arrayName === 'pm') pmFiles = arr;
        else quoteFiles = arr;
        renderFileList(arrayName, listId);
    }

    function renderFileList(arrayName, listId) {
        const list = document.getElementById(listId);
        const arr = arrayName === 'pm' ? pmFiles : quoteFiles;
        if (!list) return;
        if (arr.length === 0) {
            list.innerHTML = '';
            return;
        }
        list.innerHTML = arr.map((f, i) => `
            <div class="file-list-item">
                <i class="fa-solid fa-file-pdf"></i>
                <span class="file-list-name">${esc(f.name)}</span>
                <span class="file-list-size">${(f.size / 1024).toFixed(0)} KB</span>
                <button type="button" class="file-remove-btn" data-index="${i}" data-array="${arrayName}" data-list="${listId}">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        `).join('');

        list.querySelectorAll('.file-remove-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                removeFileFromArray(parseInt(btn.dataset.index), btn.dataset.array, btn.dataset.list);
            });
        });
    }

    async function filesToBase64Array(fileArray) {
        const results = [];
        for (const file of fileArray) {
            const data = await fileToBase64(file);
            results.push({ data, name: file.name });
        }
        return results;
    }

    // ================ ARIZONA QUOTE REQUEST ================
    let quoteFormReady = false;

    function loadQuoteRequest() {
        if (!quoteFormReady) {
            setupMultiFileUpload('quote-file-upload-zone', 'quote-files-input', 'quote-file-list', quoteFiles, 'quote');
            const form = document.getElementById('quote-form');
            if (form) form.addEventListener('submit', handleQuoteSubmit);
            quoteFormReady = true;
        }
        loadMyQuotes();

        if (currentUser.role === 'admin') {
            document.getElementById('admin-quotes-panel').style.display = 'block';
            loadAdminQuotes();
        }
    }

    async function handleQuoteSubmit(e) {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');

        if (!quoteFiles || quoteFiles.length === 0) {
            alert('A contract must be attached before submitting.');
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';

        try {
            const files = await filesToBase64Array(quoteFiles);
            await api('/api/request', 'POST', {
                type: 'arizona_quote',
                state: document.getElementById('quote-state').value,
                customer_name: document.getElementById('quote-customer-name').value.trim(),
                customer_address: document.getElementById('quote-customer-address').value.trim(),
                customer_needs: document.getElementById('quote-special-requests').value.trim(),
                files: files,
            });

            document.getElementById('quote-form-area').innerHTML = `
                <div class="card">
                    <div class="success-message">
                        <i class="fa-solid fa-circle-check"></i>
                        <h3>Quote Request Submitted</h3>
                        <p>Your AZ / NV quote request has been sent to your manager.</p>
                        <button class="btn btn-primary" onclick="location.reload()"><i class="fa-solid fa-plus"></i> Submit Another</button>
                    </div>
                </div>
            `;
            quoteFiles = [];
            loadMyQuotes();
            if (currentUser.role === 'admin') loadAdminQuotes();
        } catch (err) {
            alert(err.message || 'Submission failed');
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Request';
        }
    }

    async function loadMyQuotes() {
        const area = document.getElementById('my-quotes-area');
        if (!area) return;
        try {
            const data = await api('/api/request/mine');
            const quotes = data.requests.filter(r => r.type === 'arizona_quote');
            if (quotes.length === 0) { area.innerHTML = ''; return; }
            area.innerHTML = `
                <h3 class="section-title" style="font-size:1rem;"><i class="fa-solid fa-clock-rotate-left"></i> Your Recent Quote Requests</h3>
                <div class="team-grid">${quotes.map(r => renderRequestCard(r, false)).join('')}</div>
            `;
        } catch { area.innerHTML = ''; }
    }

    async function loadAdminQuotes() {
        const grid = document.getElementById('admin-quotes-grid');
        if (!grid) return;
        grid.innerHTML = '<p class="text-muted">Loading...</p>';
        try {
            const data = await api('/api/admin/requests');
            const quotes = data.requests.filter(r => r.type === 'arizona_quote');
            if (quotes.length === 0) {
                grid.innerHTML = '<div class="no-data-message" style="grid-column:1/-1;"><i class="fa-solid fa-inbox"></i>No quote requests submitted yet.</div>';
                return;
            }
            grid.innerHTML = quotes.map(r => renderRequestCard(r, true)).join('');
            attachStatusListeners(grid);
        } catch {
            grid.innerHTML = '<p class="text-muted">Could not load quote requests.</p>';
        }
    }

    // ================ PRICE MATCH / DISCOUNT ================
    let currentRequestType = 'price_match';
    let pmFormReady = false;

    function loadPriceMatch() {
        setupTypeToggle();
        if (!pmFormReady) {
            setupMultiFileUpload('pm-file-upload-zone', 'pm-files-input', 'pm-file-list', pmFiles, 'pm');
            pmFormReady = true;
        }
        setupRequestForm();
        loadMyRequests();

        if (currentUser.role === 'admin') {
            document.getElementById('admin-requests-panel').style.display = 'block';
            loadAdminRequests();
        }
    }

    function setupTypeToggle() {
        const btns = document.querySelectorAll('.type-toggle-btn');
        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                btns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentRequestType = btn.dataset.type;
                updateFormLabels();
            });
        });
        updateFormLabels();
    }

    function updateFormLabels() {
        const title = document.getElementById('request-form-title');
        const lbl = document.getElementById('lbl-manufacturer');
        if (currentRequestType === 'price_match') {
            title.innerHTML = '<i class="fa-solid fa-scale-balanced"></i> Submit Price Match Request';
            lbl.textContent = 'Which manufacturer are we price matching?';
        } else {
            title.innerHTML = '<i class="fa-solid fa-percent"></i> Submit Discount Request';
            lbl.textContent = 'Which manufacturer / product is this for?';
        }
    }

    function setupRequestForm() {
        const form = document.getElementById('request-form');
        if (!form) return;
        form.removeEventListener('submit', handleRequestSubmit);
        form.addEventListener('submit', handleRequestSubmit);
    }

    async function handleRequestSubmit(e) {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';

        try {
            const files = await filesToBase64Array(pmFiles);
            await api('/api/request', 'POST', {
                type: currentRequestType,
                manufacturer: document.getElementById('req-manufacturer').value.trim(),
                needed_by: document.getElementById('req-needed-by').value,
                customer_needs: document.getElementById('req-customer-needs').value.trim(),
                files: files,
            });

            document.getElementById('request-form-area').innerHTML = `
                <div class="card">
                    <div class="success-message">
                        <i class="fa-solid fa-circle-check"></i>
                        <h3>Request Submitted</h3>
                        <p>Your ${currentRequestType === 'price_match' ? 'price match' : 'discount'} request has been sent to your manager.</p>
                        <button class="btn btn-primary" onclick="location.reload()"><i class="fa-solid fa-plus"></i> Submit Another</button>
                    </div>
                </div>
            `;
            pmFiles = [];
            loadMyRequests();
            if (currentUser.role === 'admin') loadAdminRequests();
        } catch (err) {
            alert(err.message || 'Submission failed');
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Request';
        }
    }

    async function loadMyRequests() {
        const area = document.getElementById('my-requests-area');
        if (!area) return;
        try {
            const data = await api('/api/request/mine');
            const reqs = data.requests.filter(r => r.type !== 'arizona_quote');
            if (reqs.length === 0) { area.innerHTML = ''; return; }
            area.innerHTML = `
                <h3 class="section-title" style="font-size:1rem;"><i class="fa-solid fa-clock-rotate-left"></i> Your Recent Requests</h3>
                <div class="team-grid">${reqs.map(r => renderRequestCard(r, false)).join('')}</div>
            `;
        } catch { area.innerHTML = ''; }
    }

    async function loadAdminRequests() {
        const grid = document.getElementById('admin-requests-grid');
        if (!grid) return;
        grid.innerHTML = '<p class="text-muted">Loading...</p>';
        try {
            const data = await api('/api/admin/requests');
            const reqs = data.requests.filter(r => r.type !== 'arizona_quote');
            if (reqs.length === 0) {
                grid.innerHTML = '<div class="no-data-message" style="grid-column:1/-1;"><i class="fa-solid fa-inbox"></i>No requests submitted yet.</div>';
                return;
            }
            grid.innerHTML = reqs.map(r => renderRequestCard(r, true)).join('');
            attachStatusListeners(grid);
        } catch {
            grid.innerHTML = '<p class="text-muted">Could not load requests.</p>';
        }
    }

    // ================ REQUEST CARD (shared for both sections) ================
    function renderRequestCard(r, showUser) {
        const isPM = r.type === 'price_match';
        const isQuote = r.type === 'arizona_quote';
        const isDiscount = r.type === 'discount';

        let typeLabel, typeBadgeClass, cardBorderClass;
        if (isPM) {
            typeLabel = 'Price Match';
            typeBadgeClass = 'price-match';
            cardBorderClass = '';
        } else if (isDiscount) {
            typeLabel = 'Discount Request';
            typeBadgeClass = 'discount';
            cardBorderClass = ' type-discount';
        } else {
            typeLabel = r.state ? `${r.state} Quote Request` : 'AZ / NV Quote Request';
            typeBadgeClass = 'az-quote';
            cardBorderClass = ' type-az-quote';
        }

        const date = new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        // Status badge
        const status = r.status || 'pending';
        const statusInfo = getStatusInfo(status);

        const userHtml = showUser ? `
            <div class="request-user">
                <img src="${r.picture || ''}" alt="">
                <div class="request-user-info">
                    <div class="request-user-name">${esc(r.name)}</div>
                    <div class="request-date">${date}</div>
                </div>
            </div>` : `<div class="request-date" style="font-size:0.8rem; color:var(--medium);">${date}</div>`;

        // Files section — new multi-file format
        let filesHtml = '';
        if (r.files && r.files.length > 0) {
            filesHtml = r.files.map(f =>
                `<a href="/api/request/file/${f.id}" target="_blank" class="request-pdf-link"><i class="fa-solid fa-file-pdf"></i> ${esc(f.file_name)}</a>`
            ).join('');
        }
        // Legacy single file fallback
        else if (r.pdf_filename) {
            filesHtml = `<a href="/api/request/pdf/${r.id}" target="_blank" class="request-pdf-link"><i class="fa-solid fa-file-pdf"></i> ${esc(r.pdf_filename)}</a>`;
        } else {
            filesHtml = '<span class="text-muted" style="font-size:0.82rem;">No documents attached</span>';
        }

        // Admin status control
        let adminStatusHtml = '';
        if (showUser && currentUser.role === 'admin') {
            adminStatusHtml = `
                <div class="admin-status-control">
                    <label class="admin-status-label">Status:</label>
                    <select class="status-select" data-request-id="${r.id}">
                        <option value="pending" ${status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="on_pause" ${status === 'on_pause' ? 'selected' : ''}>On Pause</option>
                        <option value="completed" ${status === 'completed' ? 'selected' : ''}>Completed</option>
                    </select>
                </div>`;
        }

        // Build fields based on type
        let fieldsHtml = '';
        if (isQuote) {
            fieldsHtml = `
                <div><div class="summary-label">State</div><div class="summary-value">${esc(r.state) || '—'}</div></div>
                <div><div class="summary-label">Customer Name</div><div class="summary-value">${esc(r.customer_name) || '—'}</div></div>
                <div><div class="summary-label">Customer Address</div><div class="summary-value">${esc(r.customer_address) || '—'}</div></div>
                <div><div class="summary-label">Special Notes / Requests</div><div class="summary-value">${esc(r.customer_needs)}</div></div>
                <div><div class="summary-label">Contract / Documents</div><div class="request-files-list">${filesHtml}</div></div>`;
        } else {
            fieldsHtml = `
                <div><div class="summary-label">Manufacturer</div><div class="summary-value">${esc(r.manufacturer)}</div></div>
                <div><div class="summary-label">Needed By</div><div class="summary-value">${r.needed_by || '—'}</div></div>
                <div><div class="summary-label">Customer Needs</div><div class="summary-value">${esc(r.customer_needs)}</div></div>
                <div><div class="summary-label">Documents</div><div class="request-files-list">${filesHtml}</div></div>`;
        }

        return `
        <div class="request-card${cardBorderClass}">
            <div class="request-meta">
                ${userHtml}
                <div class="request-badges">
                    <span class="request-type-badge ${typeBadgeClass}">${typeLabel}</span>
                    <span class="status-badge status-${status}"><i class="fa-solid ${statusInfo.icon}"></i> ${statusInfo.label}</span>
                </div>
            </div>
            <div class="request-fields">
                ${fieldsHtml}
            </div>
            ${adminStatusHtml}
        </div>`;
    }

    function getStatusInfo(status) {
        switch (status) {
            case 'completed': return { label: 'Completed', icon: 'fa-circle-check' };
            case 'on_pause': return { label: 'On Pause', icon: 'fa-pause' };
            default: return { label: 'Pending', icon: 'fa-clock' };
        }
    }

    function attachStatusListeners(container) {
        container.querySelectorAll('.status-select').forEach(select => {
            select.addEventListener('change', async (e) => {
                const requestId = e.target.dataset.requestId;
                const newStatus = e.target.value;
                e.target.disabled = true;
                try {
                    await api('/api/request/status', 'POST', { id: parseInt(requestId), status: newStatus });
                    // Update the badge in the same card
                    const card = e.target.closest('.request-card');
                    const badge = card.querySelector('.status-badge');
                    const info = getStatusInfo(newStatus);
                    badge.className = `status-badge status-${newStatus}`;
                    badge.innerHTML = `<i class="fa-solid ${info.icon}"></i> ${info.label}`;
                } catch (err) {
                    alert('Failed to update status: ' + (err.message || 'Unknown error'));
                }
                e.target.disabled = false;
            });
        });
    }

    // ================ DAILY TALK ================
    // hiddenExtIds = IDs the admin has REMOVED from the board (shared for all users)
    let hiddenExtIds = [];
    let talkData = null;
    let talkControlsReady = false;

    async function loadDailyTalk() {
        const datePicker = document.getElementById('talk-date');
        if (!datePicker.value) datePicker.value = todayStr();

        // Load shared filter from server
        try {
            const filterData = await api('/api/settings/talk-filter');
            hiddenExtIds = filterData.hiddenIds || [];
        } catch { hiddenExtIds = []; }

        if (!talkControlsReady) {
            setupTalkControls();
            talkControlsReady = true;
        }
        await fetchTalkTime(datePicker.value);
    }

    function setupTalkControls() {
        const datePicker = document.getElementById('talk-date');
        document.getElementById('talk-refresh-btn').onclick = () => fetchTalkTime(datePicker.value);
        datePicker.onchange = () => fetchTalkTime(datePicker.value);

        // Only admin can see and use the filter button
        const filterBtn = document.getElementById('talk-filter-btn');
        if (currentUser.role !== 'admin') {
            filterBtn.style.display = 'none';
            return;
        }

        filterBtn.onclick = () => {
            const panel = document.getElementById('talk-filter-panel');
            const isHidden = panel.style.display === 'none';
            panel.style.display = isHidden ? 'block' : 'none';
            if (isHidden) buildFilterList();
        };

        document.getElementById('talk-filter-close').onclick = () => {
            document.getElementById('talk-filter-panel').style.display = 'none';
        };

        document.getElementById('filter-select-all').onclick = () => {
            document.querySelectorAll('#talk-filter-list input').forEach(cb => cb.checked = true);
        };

        document.getElementById('filter-deselect-all').onclick = () => {
            document.querySelectorAll('#talk-filter-list input').forEach(cb => cb.checked = false);
        };

        document.getElementById('talk-filter-apply').onclick = async () => {
            const applyBtn = document.getElementById('talk-filter-apply');
            applyBtn.disabled = true;
            applyBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

            // Anything UNCHECKED gets added to the hidden list
            hiddenExtIds = [];
            document.querySelectorAll('#talk-filter-list input[type="checkbox"]').forEach(cb => {
                if (!cb.checked) hiddenExtIds.push(cb.value);
            });

            // Save to server so ALL users see the same filter
            try {
                await api('/api/settings/talk-filter', 'POST', { hiddenIds: hiddenExtIds });
            } catch (err) {
                alert('Failed to save filter: ' + err.message);
            }

            applyBtn.disabled = false;
            applyBtn.innerHTML = 'Apply Filter';
            document.getElementById('talk-filter-panel').style.display = 'none';
            renderLeaderboard();
        };
    }

    function buildFilterList() {
        const list = document.getElementById('talk-filter-list');
        if (!talkData) {
            list.innerHTML = '<p class="text-muted" style="padding:12px;">No data loaded yet. Load data first.</p>';
            return;
        }
        // Use allExtensions (every rep in RingCentral) for the filter, not just those with calls
        const reps = talkData.allExtensions || talkData.leaderboard || [];
        if (reps.length === 0) {
            list.innerHTML = '<p class="text-muted" style="padding:12px;">No reps found.</p>';
            return;
        }
        // checked = visible on the board, unchecked = hidden
        list.innerHTML = reps.map(rep => {
            const isHidden = hiddenExtIds.includes(rep.id);
            return `<label class="filter-item">
                <input type="checkbox" value="${rep.id}" ${isHidden ? '' : 'checked'}>
                ${esc(rep.name)}
            </label>`;
        }).join('');
    }

    async function fetchTalkTime(date) {
        const board = document.getElementById('talk-leaderboard');
        board.innerHTML = '<p class="text-muted"><i class="fa-solid fa-spinner fa-spin"></i> Loading talk time data...</p>';

        try {
            const data = await api(`/api/ringcentral/talktime?date=${date}`);
            talkData = data;
            renderLeaderboard();
        } catch (err) {
            board.innerHTML = `<div class="no-data-message"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(err.message)}</div>`;
            document.getElementById('talk-last-updated').textContent = '';
        }
    }

    function renderLeaderboard() {
        if (!talkData) return;
        const board = document.getElementById('talk-leaderboard');

        // Filter out hidden reps
        const items = talkData.leaderboard.filter(r => !hiddenExtIds.includes(r.id));

        // Update totals
        const totalCalls = items.reduce((s, r) => s + r.calls, 0);
        const totalTime = items.reduce((s, r) => s + r.talkTime, 0);
        document.getElementById('talk-total-calls').textContent = totalCalls.toLocaleString();
        document.getElementById('talk-total-time').textContent = fmtDuration(totalTime);
        document.getElementById('talk-total-reps').textContent = items.filter(r => r.calls > 0).length;

        const updated = new Date(talkData.lastUpdated);
        document.getElementById('talk-last-updated').textContent =
            `Last updated: ${updated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;

        if (items.length === 0) {
            board.innerHTML = '<div class="no-data-message"><i class="fa-solid fa-phone-slash"></i>No call data found for this date.</div>';
            return;
        }

        board.innerHTML = items.map((rep, i) => {
            const rank = i + 1;
            const rankClass = rank <= 3 ? ` rank-${rank}` : '';
            return `
            <div class="leaderboard-item${rankClass}">
                <div class="leaderboard-rank">#${rank}</div>
                <div class="leaderboard-name">${esc(rep.name)}</div>
                <div class="leaderboard-stat">
                    <span class="leaderboard-stat-value">${rep.calls}</span>
                    <span class="leaderboard-stat-label">Calls</span>
                </div>
                <div class="leaderboard-time">
                    <span class="leaderboard-time-value">${fmtDuration(rep.talkTime)}</span>
                    <span class="leaderboard-time-label">Talk Time</span>
                </div>
            </div>`;
        }).join('');
    }

    function fmtDuration(seconds) {
        if (!seconds || seconds === 0) return '0m';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}h ${m}m`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    }

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
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
        return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
    }

    function formatTime(isoStr) {
        if (!isoStr) return '—';
        const d = new Date(isoStr);
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago' });
    }

    function esc(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }
})();
