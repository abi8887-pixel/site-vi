// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 2: PHOTO ENGINE & WATERMARKING
// Handles IndexedDB storage, Canvas watermarking, and Lightbox Gallery
// ═══════════════════════════════════════════════════════════════════════════════

// Global state for photos
let sitePhotos = [];
let _photoDB = null;
let _retakeTargetId = null;
let _lbIndex = 0;

// ── 1. INDEXED-DB STORAGE (50MB+ Safe Storage) ─────────────────────────────

function openPhotoDB() {
    return new Promise((resolve, reject) => {
        if (_photoDB) return resolve(_photoDB);
        const req = indexedDB.open('SIF_Photos', 1);
        req.onupgradeneeded = (e) => {
            e.target.result.createObjectStore('photos', { keyPath: 'id' });
        };
        req.onsuccess = (e) => { _photoDB = e.target.result; resolve(_photoDB); };
        req.onerror = () => reject('IndexedDB unavailable');
    });
}

async function savePhotoToDB(photo) {
    const db = await openPhotoDB();
    return new Promise((resolve) => {
        const tx = db.transaction('photos', 'readwrite');
        tx.objectStore('photos').put(photo);
        tx.oncomplete = resolve;
    });
}

async function deletePhotoFromDB(id) {
    const db = await openPhotoDB();
    return new Promise((resolve) => {
        const tx = db.transaction('photos', 'readwrite');
        tx.objectStore('photos').delete(id);
        tx.oncomplete = resolve;
    });
}

async function loadPhotosFromDB() {
    try {
        const db = await openPhotoDB();
        return new Promise((resolve) => {
            const tx = db.transaction('photos', 'readonly');
            const req = tx.objectStore('photos').getAll();
            req.onsuccess = () => {
                sitePhotos = req.result || [];
                resolve();
            };
            req.onerror = () => { sitePhotos = []; resolve(); };
        });
    } catch (e) {
        sitePhotos = [];
    }
}

// ── 2. PROFESSIONAL CANVAS WATERMARKING ────────────────────────────────────

async function handleCapture(input, retakeId = null) {
    if (!input.files?.[0]) return;
    const file = input.files[0];
    const label = G('photoLabel').value;

    // Parse GPS Coords
    const coordsStr = V('locationCoords') || 'GPS NOT LOCKED';
    let latLonStr = coordsStr;
    if (coordsStr !== 'GPS NOT LOCKED' && coordsStr.includes(',')) {
        const pts = coordsStr.split(',').map(p => p.trim());
        latLonStr = `Lat ${pts[0]}° / Lon ${pts[1]}°`;
    }

    const rawDate = new Date();
    const timestamp = rawDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });

    // Fallback if _lastReverseAddress (from location.js) isn't ready
    const lastRevAddr = typeof _lastReverseAddress !== 'undefined' ? _lastReverseAddress : '';
    const shortAddr = lastRevAddr || V('address').split('\n')[0] || V('locality') || coordsStr;
    const addrLines = shortAddr.split(', ').slice(0, 3);

    toast('✍️ Stamping professional verification…');
    const reader = new FileReader();

    reader.onload = (e) => {
        const img = new Image();
        img.onload = async () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const targetW = 1200;
            const scale = targetW / img.width;
            canvas.width = targetW;
            canvas.height = img.height * scale;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Layout Settings
            const marginLeft = 40;
            const marginBottom = 40;
            let yCursor = canvas.height - marginBottom;

            const soraMain = 'bold 30px Sora, sans-serif';
            const dmMonoSub = '500 18px "DM Mono", monospace';
            const soraAddr = '500 18px Sora, sans-serif';

            ctx.shadowColor = 'rgba(0,0,0,0.85)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left';

            const lineHeight = 34;

            // Address Lines
            ctx.font = soraAddr;
            for (let j = Math.min(3, addrLines.length) - 1; j >= 0; j--) {
                ctx.fillText(addrLines[j].trim(), marginLeft, yCursor);
                yCursor -= lineHeight;
            }
            yCursor -= 10;

            // Compass + Lat/Lon
            ctx.font = dmMonoSub;
            drawCompassIcon(ctx, marginLeft + 15, yCursor - 10, 32);
            ctx.fillText(latLonStr, marginLeft + 50, yCursor);
            yCursor -= (lineHeight + 30);

            // Date / Time
            ctx.font = soraMain;
            ctx.fillText(timestamp.toUpperCase() + ' (GMT+5:30)', marginLeft, yCursor);

            // Footer
            ctx.font = '500 20px Sora, sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.textAlign = 'right';
            ctx.shadowBlur = 4;
            ctx.fillText(`SIF Modular App | ${label.toUpperCase()}`, canvas.width - 40, canvas.height - 20);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
            const photo = {
                id: retakeId || Date.now(),
                data: dataUrl,
                label,
                coords: coordsStr,
                address: shortAddr,
                timestamp,
                hasGps: coordsStr !== 'GPS NOT LOCKED'
            };

            await savePhotoToDB(photo);
            await loadPhotosFromDB();
            renderGallery();
            input.value = '';
            toast('✅ Professional Photo Saved');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

async function handleRetake(input) {
    if (!_retakeTargetId) return;
    await handleCapture(input, _retakeTargetId);
}

function drawCompassIcon(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ffffff';
    ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = '#ea4335';
    ctx.moveTo(0, -(size / 2) + 2);
    ctx.lineTo(-size / 6, -1);
    ctx.lineTo(size / 6, -1);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = '#ffffff';
    ctx.moveTo(0, (size / 2) - 2);
    ctx.lineTo(-size / 6, 1);
    ctx.lineTo(size / 6, 1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

// ── 3. GALLERY & LIGHTBOX UI ───────────────────────────────────────────────

function renderGallery() {
    const container = G('photoGallery');
    const empty = G('photoEmpty');
    if (!container) return;

    if (!sitePhotos.length) {
        container.innerHTML = '';
        if (empty) empty.style.display = 'block';
        return;
    }
    if (empty) empty.style.display = 'none';

    container.innerHTML = sitePhotos.map((p, i) => {
        const gpsOk = p.hasGps !== false;
        const stamp = gpsOk
            ? `<div class="verify-stamp">✓ GPS</div>`
            : `<div class="verify-stamp no-gps-stamp">⚠ No GPS</div>`;
        return `
        <div class="photo-tile" id="pt-${p.id}">
            <img class="thumb" src="${p.data}" onclick="openLightbox(${i})" loading="lazy">
            ${stamp}
            <div class="tile-footer">
                <span class="tile-label">${typeof sanitizeHTML === 'function' ? sanitizeHTML(p.label) : p.label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')}</span>
                <div class="tile-btns">
                    <button class="tile-btn" onclick="openLightbox(${i})" title="View full image">🔍</button>
                    <button class="tile-btn" onclick="openLightbox(${i}); lbRetakeMode()" title="Retake">🔄</button>
                    <button class="tile-btn danger" onclick="removePhoto(${p.id})" title="Delete">✕</button>
                </div>
            </div>
        </div>`;
    }).join('');
}

async function removePhoto(id) {
    if (!confirm('Delete this photo?')) return;
    sitePhotos = sitePhotos.filter(p => p.id !== id);
    await deletePhotoFromDB(id);
    renderGallery();
    toast('🗑 Photo deleted');
}

function openLightbox(idx) {
    if (!sitePhotos.length) return;
    _lbIndex = Math.max(0, Math.min(idx, sitePhotos.length - 1));
    renderLightbox();
    G('photoLightbox').classList.add('open');
}

function closeLightbox() {
    G('photoLightbox').classList.remove('open');
}

function lbNav(dir) {
    _lbIndex = (_lbIndex + dir + sitePhotos.length) % sitePhotos.length;
    renderLightbox();
}

function renderLightbox() {
    const p = sitePhotos[_lbIndex];
    if (!p) return;
    G('lbImage').src = p.data;
    G('lbLabel').textContent = p.label;
    G('lbCounter').textContent = `${_lbIndex + 1} of ${sitePhotos.length}`;

    G('lbPrev').style.display = sitePhotos.length > 1 ? 'flex' : 'none';
    G('lbNext').style.display = sitePhotos.length > 1 ? 'flex' : 'none';

    const gpsOk = p.hasGps !== false;
    G('lbGpsIcon').textContent = gpsOk ? '✅' : '⚠️';
    G('lbGpsText').textContent = p.coords || 'Not recorded';
    G('lbGpsText').className = 'lb-verify-text ' + (gpsOk ? 'lb-verify-ok' : 'lb-verify-fail');

    G('lbAddrText').textContent = p.address || 'Address not recorded';
    G('lbTimeText').textContent = p.timestamp || 'Timestamp not recorded';

    const burnOk = p.coords && p.timestamp;
    G('lbBurnStatus').textContent = burnOk ? 'Watermark permanently burned into image ✓' : '⚠ Incomplete watermark — consider retaking';
    G('lbBurnStatus').className = 'lb-verify-text ' + (burnOk ? 'lb-verify-ok' : 'lb-verify-fail');
}

function lbRetake() {
    const p = sitePhotos[_lbIndex];
    if (!p) return;
    _retakeTargetId = p.id;
    G('photoLabel').value = p.label;
    G('retakeInput').click();
    closeLightbox();
}

function lbRetakeMode() {
    // Lightbox is open, user clicked retake from gallery
}

async function lbRename() {
    const p = sitePhotos[_lbIndex];
    if (!p) return;
    const newName = prompt('Rename this photo:', p.label);
    if (newName && newName.trim()) {
        p.label = newName.trim();
        await savePhotoToDB(p);
        renderGallery();
        renderLightbox();
        toast('✅ Label updated');
    }
}

async function lbDelete() {
    const p = sitePhotos[_lbIndex];
    if (!p || !confirm('Delete this photo?')) return;
    await deletePhotoFromDB(p.id);
    sitePhotos = sitePhotos.filter(x => x.id !== p.id);
    renderGallery();
    if (!sitePhotos.length) { closeLightbox(); return; }
    _lbIndex = Math.min(_lbIndex, sitePhotos.length - 1);
    renderLightbox();
    toast('🗑 Photo deleted');
}

// ── 4. EVENT LISTENERS (Swipe to navigate) ─────────────────────────────────

// We attach these after the DOM loads in app.js, but we define the logic here.
let _lbTouchX = 0;
function setupLightboxTouch() {
    const lb = G('photoLightbox');
    if (!lb) return;

    lb.addEventListener('touchstart', e => { _lbTouchX = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - _lbTouchX;
        if (Math.abs(dx) > 50) lbNav(dx < 0 ? 1 : -1);
    }, { passive: true });

    lb.addEventListener('click', e => {
        if (e.target === lb || e.target === G('lbImage')) closeLightbox();
    });
}