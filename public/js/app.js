/* ==============================================
   Metal America Media Library - App
   ============================================== */
(function () {
    let currentUser = null;
    let allMedia = [];
    let currentFilter = {};
    let uploadFile = null;

    const BUILDING_TYPES = ['Carport','Garage','Storage','Gable','Shop','Barndo','Home','RV Cover','Metal Building','Concrete'];
    const TYPE_ICONS = {
        Carport:'fa-warehouse', Garage:'fa-warehouse', Storage:'fa-box-archive',
        Gable:'fa-house', Shop:'fa-screwdriver-wrench', Barndo:'fa-house-chimney',
        Home:'fa-house-user', 'RV Cover':'fa-caravan', 'Metal Building':'fa-building', Concrete:'fa-cubes'
    };
    const COLOR_MAP = {
        Red:'#dc2626', Gray:'#6b7280', White:'#e5e7eb', Tan:'#d2b48c',
        Blue:'#2563eb', Green:'#16a34a', Brown:'#92400e', Black:'#1f2937'
    };

    // ---- Init ----
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
        setupEventListeners();
        loadMedia();
    }

    // ================ USER ================
    function renderUserInfo() {
        const avatar = document.getElementById('user-avatar');
        if (currentUser.picture) {
            avatar.src = currentUser.picture;
        }
        // Show upload button for admins
        if (currentUser.role === 'admin') {
            document.getElementById('upload-btn').style.display = 'inline-flex';
        }
    }

    // ================ EVENTS ================
    function setupEventListeners() {
        // Logout
        document.getElementById('logout-btn').addEventListener('click', async () => {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/index.html';
        });

        // Sidebar
        document.getElementById('sidebar').addEventListener('click', (e) => {
            const item = e.target.closest('.sidebar-item[data-filter]');
            if (!item) return;
            document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            const filter = item.dataset.filter;
            const label = item.textContent.replace(/\d+/g, '').trim();
            document.getElementById('toolbar-title').textContent = label;
            applySidebarFilter(filter);
        });

        // Search
        let searchTimeout;
        document.getElementById('search-input').addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                currentFilter.search = e.target.value.trim() || undefined;
                loadMedia();
            }, 300);
        });

        // Color & sort filters
        document.getElementById('filter-color').addEventListener('change', (e) => {
            currentFilter.color = e.target.value || undefined;
            loadMedia();
        });
        document.getElementById('filter-sort').addEventListener('change', (e) => {
            currentFilter.sort = e.target.value || undefined;
            loadMedia();
        });

        // View toggle
        document.querySelectorAll('.view-toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const grid = document.getElementById('media-grid');
                if (btn.dataset.view === 'list') grid.classList.add('list-view');
                else grid.classList.remove('list-view');
            });
        });

        // Upload button
        document.getElementById('upload-btn').addEventListener('click', () => openModal('upload-modal'));

        // Upload zone
        const zone = document.getElementById('upload-drop-zone');
        const fileInput = document.getElementById('upload-file-input');
        zone.addEventListener('click', () => fileInput.click());
        zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            if (e.dataTransfer.files[0]) handleUploadFile(e.dataTransfer.files[0]);
        });
        fileInput.addEventListener('change', () => {
            if (fileInput.files[0]) handleUploadFile(fileInput.files[0]);
        });

        // Upload submit
        document.getElementById('upload-submit-btn').addEventListener('click', submitUpload);

        // Toggle switches
        document.querySelectorAll('.toggle-switch').forEach(el => {
            el.addEventListener('click', () => el.classList.toggle('on'));
        });

        // Modal close buttons
        document.querySelectorAll('[data-close]').forEach(btn => {
            btn.addEventListener('click', () => closeModal(btn.dataset.close));
        });
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) overlay.classList.remove('open');
            });
        });

        // Edit save
        document.getElementById('edit-save-btn').addEventListener('click', saveEdit);
        document.getElementById('edit-delete-btn').addEventListener('click', () => {
            document.getElementById('delete-id').value = document.getElementById('edit-id').value;
            closeModal('edit-modal');
            openModal('delete-modal');
        });

        // Delete confirm
        document.getElementById('delete-confirm-btn').addEventListener('click', confirmDelete);

        // Lightbox close
        document.getElementById('lightbox').addEventListener('click', (e) => {
            if (e.target.closest('.lightbox-close') || e.target === document.getElementById('lightbox')) {
                document.getElementById('lightbox').classList.remove('open');
            }
        });

        // Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
                document.getElementById('lightbox').classList.remove('open');
            }
        });
    }

    // ================ SIDEBAR FILTER ================
    function applySidebarFilter(filter) {
        // Clear type-specific filters
        delete currentFilter.type;
        delete currentFilter.media;
        delete currentFilter.ad;

        if (filter === 'images') currentFilter.media = 'image';
        else if (filter === 'videos') currentFilter.media = 'video';
        else if (filter === 'ads') currentFilter.ad = 'true';
        else if (filter !== 'all') currentFilter.type = filter;

        loadMedia();
    }

    // ================ LOAD MEDIA ================
    async function loadMedia() {
        const grid = document.getElementById('media-grid');
        grid.innerHTML = '<div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading media...</div>';

        try {
            const params = new URLSearchParams();
            Object.entries(currentFilter).forEach(([k, v]) => { if (v) params.set(k, v); });

            const data = await api(`/api/media/list?${params}`);
            allMedia = data.media;

            // Update sidebar counts
            document.getElementById('count-all').textContent = data.counts.total;
            document.getElementById('count-images').textContent = data.counts.images;
            document.getElementById('count-videos').textContent = data.counts.videos;
            document.getElementById('count-ads').textContent = data.counts.ads;

            // Update building type sidebar
            renderTypeSidebar(data.typeCounts);

            // Update toolbar count
            document.getElementById('toolbar-count').textContent = `${allMedia.length} items`;

            renderGrid();
        } catch (err) {
            grid.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><h3>Error loading media</h3><p>${esc(err.message)}</p></div>`;
        }
    }

    function renderTypeSidebar(typeCounts) {
        const container = document.getElementById('sidebar-types');
        const countMap = {};
        typeCounts.forEach(tc => { countMap[tc.building_type] = tc.count; });

        container.innerHTML = BUILDING_TYPES.map(type => {
            const count = countMap[type] || 0;
            const icon = TYPE_ICONS[type] || 'fa-building';
            const filterKey = type.toLowerCase().replace(/\s+/g, '-');
            const isActive = currentFilter.type === type ? ' active' : '';
            return `<div class="sidebar-item${isActive}" data-filter="${type}">
                <i class="fa-solid ${icon}"></i> ${type}
                <span class="count">${count}</span>
            </div>`;
        }).join('');
    }

    // ================ RENDER GRID ================
    function renderGrid() {
        const grid = document.getElementById('media-grid');

        if (allMedia.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column:1/-1;">
                    <i class="fa-solid fa-image"></i>
                    <h3>No media found</h3>
                    <p>Try adjusting your filters or upload new media.</p>
                </div>`;
            return;
        }

        const isAdmin = currentUser.role === 'admin';

        grid.innerHTML = allMedia.map(item => {
            const isVideo = item.file_type === 'video';
            const dim = (item.width && item.length) ? `${item.width}' × ${item.length}'${item.height ? ` × ${item.height}'` : ''}` : '';
            const dimFull = (item.width && item.length) ? `${item.width}' W × ${item.length}' L${item.height ? ` × ${item.height}' H` : ''}` : '';
            const colorDot = item.color && COLOR_MAP[item.color] ? `<span class="media-color-badge"><span class="media-color-dot" style="background:${COLOR_MAP[item.color]}"></span>${esc(item.color)}</span>` : '';

            const vendors = [];
            if (item.vendor_carport_experts) vendors.push('Carport Experts');
            if (item.vendor_us_steel) vendors.push('US Steel');
            if (item.vendor_eagle) vendors.push('Eagle');
            if (item.vendor_galv_struct) vendors.push('Galv Struct');
            if (item.vendor_bluestone) vendors.push('Bluestone');

            const adminBtns = isAdmin ? `
                <button class="media-overlay-btn" title="Edit" onclick="event.stopPropagation(); window._app.openEdit(${item.id})">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="media-overlay-btn" title="Delete" onclick="event.stopPropagation(); window._app.openDelete(${item.id})">
                    <i class="fa-solid fa-trash-can"></i>
                </button>` : '';

            return `
            <div class="media-card" onclick="window._app.openLightbox(${item.id})">
                <div class="media-thumbnail">
                    ${isVideo
                        ? `<video src="${esc(item.file_url)}" muted preload="metadata"></video>`
                        : `<img src="${esc(item.file_url)}" alt="${esc(item.building_type || 'Media')}" loading="lazy">`
                    }
                    <div class="media-type-icon">
                        <i class="fa-solid ${isVideo ? 'fa-video' : 'fa-image'}"></i>
                        ${isVideo ? 'Video' : 'Image'}
                    </div>
                    ${item.is_advertisement ? '<div class="media-ad-badge">AD</div>' : ''}
                    <div class="media-overlay">
                        <div class="media-dimensions">${dim}</div>
                        <div class="media-overlay-actions">
                            <a class="media-overlay-btn" title="Download" href="${esc(item.file_url)}" download="${esc(item.file_name)}" onclick="event.stopPropagation()">
                                <i class="fa-solid fa-download"></i>
                            </a>
                            ${adminBtns}
                        </div>
                    </div>
                </div>
                <div class="media-info">
                    <div class="media-info-top">
                        <span class="media-building-type">${esc(item.building_type || 'Uncategorized')}</span>
                        ${colorDot}
                    </div>
                    ${dimFull ? `<div class="media-dim-text">${dimFull}</div>` : ''}
                    ${vendors.length > 0 ? `<div class="media-vendors">${vendors.map(v => `<span class="vendor-tag">${v}</span>`).join('')}</div>` : ''}
                </div>
            </div>`;
        }).join('');
    }

    // ================ UPLOAD ================
    function handleUploadFile(file) {
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        if (!isImage && !isVideo) {
            showToast('error', 'Please upload an image or video file.');
            return;
        }
        if (file.size > 3 * 1024 * 1024) {
            showToast('error', 'File must be under 3MB.');
            return;
        }
        uploadFile = file;

        const zone = document.getElementById('upload-drop-zone');
        zone.classList.add('has-file');
        const preview = document.getElementById('upload-file-preview');
        preview.style.display = 'flex';

        if (isImage) {
            const url = URL.createObjectURL(file);
            preview.innerHTML = `
                <img src="${url}" class="upload-preview-img">
                <div class="upload-preview-info">
                    <div class="upload-preview-name">${esc(file.name)}</div>
                    <div class="upload-preview-size">${(file.size / 1024).toFixed(0)} KB</div>
                    <button class="btn btn-outline" style="margin-top:8px;padding:6px 12px;font-size:0.78rem;" onclick="window._app.clearUploadFile()">
                        <i class="fa-solid fa-xmark"></i> Remove
                    </button>
                </div>`;
        } else {
            preview.innerHTML = `
                <div class="upload-preview-video"><i class="fa-solid fa-video"></i></div>
                <div class="upload-preview-info">
                    <div class="upload-preview-name">${esc(file.name)}</div>
                    <div class="upload-preview-size">${(file.size / 1024).toFixed(0)} KB</div>
                    <button class="btn btn-outline" style="margin-top:8px;padding:6px 12px;font-size:0.78rem;" onclick="window._app.clearUploadFile()">
                        <i class="fa-solid fa-xmark"></i> Remove
                    </button>
                </div>`;
        }
    }

    function clearUploadFile() {
        uploadFile = null;
        document.getElementById('upload-drop-zone').classList.remove('has-file');
        document.getElementById('upload-file-preview').style.display = 'none';
        document.getElementById('upload-file-input').value = '';
    }

    async function submitUpload() {
        if (!uploadFile) {
            showToast('error', 'Please select a file to upload.');
            return;
        }

        const btn = document.getElementById('upload-submit-btn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';

        try {
            const fileData = await fileToBase64(uploadFile);

            await api('/api/media/upload', 'POST', {
                file_data: fileData,
                file_name: uploadFile.name,
                building_type: document.getElementById('up-type').value || null,
                width: parseInt(document.getElementById('up-width').value) || null,
                length: parseInt(document.getElementById('up-length').value) || null,
                height: parseInt(document.getElementById('up-height').value) || null,
                color: document.getElementById('up-color').value || null,
                is_advertisement: document.getElementById('up-ad-toggle').classList.contains('on'),
                vendor_carport_experts: document.getElementById('up-v-carport').value || null,
                vendor_us_steel: document.getElementById('up-v-ussteel').value || null,
                vendor_eagle: document.getElementById('up-v-eagle').value || null,
                vendor_galv_struct: document.getElementById('up-v-galv').value || null,
                vendor_bluestone: document.getElementById('up-v-bluestone').value || null,
            });

            showToast('success', 'Media uploaded successfully!');
            closeModal('upload-modal');
            resetUploadForm();
            loadMedia();
        } catch (err) {
            showToast('error', err.message || 'Upload failed');
        }

        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-arrow-up-from-bracket"></i> Upload';
    }

    function resetUploadForm() {
        clearUploadFile();
        document.getElementById('up-width').value = '';
        document.getElementById('up-length').value = '';
        document.getElementById('up-height').value = '';
        document.getElementById('up-type').value = '';
        document.getElementById('up-color').value = '';
        document.getElementById('up-ad-toggle').classList.remove('on');
        document.getElementById('up-v-carport').value = '';
        document.getElementById('up-v-ussteel').value = '';
        document.getElementById('up-v-eagle').value = '';
        document.getElementById('up-v-galv').value = '';
        document.getElementById('up-v-bluestone').value = '';
    }

    // ================ EDIT ================
    function openEdit(id) {
        const item = allMedia.find(m => m.id === id);
        if (!item) return;

        document.getElementById('edit-id').value = id;
        document.getElementById('edit-width').value = item.width || '';
        document.getElementById('edit-length').value = item.length || '';
        document.getElementById('edit-height').value = item.height || '';
        document.getElementById('edit-type').value = item.building_type || '';
        document.getElementById('edit-color').value = item.color || '';

        const adToggle = document.getElementById('edit-ad-toggle');
        if (item.is_advertisement) adToggle.classList.add('on');
        else adToggle.classList.remove('on');

        document.getElementById('edit-v-carport').value = item.vendor_carport_experts || '';
        document.getElementById('edit-v-ussteel').value = item.vendor_us_steel || '';
        document.getElementById('edit-v-eagle').value = item.vendor_eagle || '';
        document.getElementById('edit-v-galv').value = item.vendor_galv_struct || '';
        document.getElementById('edit-v-bluestone').value = item.vendor_bluestone || '';

        openModal('edit-modal');
    }

    async function saveEdit() {
        const id = document.getElementById('edit-id').value;
        const btn = document.getElementById('edit-save-btn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        try {
            await api(`/api/media/${id}`, 'PUT', {
                building_type: document.getElementById('edit-type').value || null,
                width: parseInt(document.getElementById('edit-width').value) || null,
                length: parseInt(document.getElementById('edit-length').value) || null,
                height: parseInt(document.getElementById('edit-height').value) || null,
                color: document.getElementById('edit-color').value || null,
                is_advertisement: document.getElementById('edit-ad-toggle').classList.contains('on'),
                vendor_carport_experts: document.getElementById('edit-v-carport').value || null,
                vendor_us_steel: document.getElementById('edit-v-ussteel').value || null,
                vendor_eagle: document.getElementById('edit-v-eagle').value || null,
                vendor_galv_struct: document.getElementById('edit-v-galv').value || null,
                vendor_bluestone: document.getElementById('edit-v-bluestone').value || null,
            });

            showToast('success', 'Changes saved!');
            closeModal('edit-modal');
            loadMedia();
        } catch (err) {
            showToast('error', err.message || 'Save failed');
        }

        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Save Changes';
    }

    // ================ DELETE ================
    function openDelete(id) {
        document.getElementById('delete-id').value = id;
        openModal('delete-modal');
    }

    async function confirmDelete() {
        const id = document.getElementById('delete-id').value;
        const btn = document.getElementById('delete-confirm-btn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deleting...';

        try {
            await api(`/api/media/${id}`, 'DELETE');
            showToast('success', 'Media deleted');
            closeModal('delete-modal');
            loadMedia();
        } catch (err) {
            showToast('error', err.message || 'Delete failed');
        }

        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-trash-can"></i> Delete';
    }

    // ================ LIGHTBOX ================
    function openLightbox(id) {
        const item = allMedia.find(m => m.id === id);
        if (!item) return;

        const container = document.getElementById('lightbox-media');
        if (item.file_type === 'video') {
            container.innerHTML = `<video src="${esc(item.file_url)}" controls autoplay class="lightbox-content"></video>`;
        } else {
            container.innerHTML = `<img src="${esc(item.file_url)}" alt="" class="lightbox-content">`;
        }

        const dim = (item.width && item.length) ? `${item.width}' × ${item.length}'${item.height ? ` × ${item.height}'` : ''}` : '';
        document.getElementById('lightbox-title').textContent = `${item.building_type || 'Media'}${dim ? ' — ' + dim : ''}`;
        document.getElementById('lightbox-detail').textContent = `${item.color || 'No color'} • ${item.file_type === 'video' ? 'Video' : 'Image'}`;
        document.getElementById('lightbox').classList.add('open');
    }

    // ================ MODALS ================
    function openModal(id) { document.getElementById(id).classList.add('open'); }
    function closeModal(id) { document.getElementById(id).classList.remove('open'); }

    // ================ TOAST ================
    function showToast(type, message) {
        const container = document.getElementById('toast-container');
        const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fa-solid ${icon}"></i> ${esc(message)}`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
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

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function esc(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    // Expose functions for inline onclick handlers
    window._app = { openEdit, openDelete, openLightbox, clearUploadFile };
})();
