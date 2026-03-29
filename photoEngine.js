// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 2: PHOTO ENGINE & WATERMARKING
// Handles IndexedDB storage, Canvas watermarking, and Lightbox Gallery
// ═══════════════════════════════════════════════════════════════════════════════

/// ═══════════════════════════════════════════════════════════════════════════════
// MODULE: PRO PHOTO ENGINE & STORAGE VAULT
// Async processing, IndexedDB Quota (50MB), and Professional Watermarking
// ═══════════════════════════════════════════════════════════════════════════════

const MAX_STORAGE_MB = 50;
let dbPromise = null;
let currentLightboxPhotoId = null;

// --- 1. INDEXED-DB VAULT LOGIC ---
function initDB() {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open('SIF_Vault', 1);
            request.onupgradeneeded = (e) => e.target.result.createObjectStore('photos', { keyPath: 'id' });
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e);
        });
    }
    return dbPromise;
}

async function getStorageUsage() {
    const db = await initDB();
    return new Promise((resolve) => {
        const tx = db.transaction('photos', 'readonly');
        const store = tx.objectStore('photos');
        const request = store.getAll();
        request.onsuccess = () => {
            const photos = request.result || [];
            // Base64 string length * 0.75 gives approx byte size
            const totalBytes = photos.reduce((acc, p) => acc + (p.data.length * 0.75), 0);
            const mb = (totalBytes / (1024 * 1024)).toFixed(2);
            resolve({ photos, mb: parseFloat(mb) });
        };
    });
}

async function updateQuotaUI() {
    const { mb } = await getStorageUsage();
    const pct = Math.min((mb / MAX_STORAGE_MB) * 100, 100);
    
    const fill = document.getElementById('storageFill');
    const text = document.getElementById('storageUsage');
    
    if (text) text.innerText = `${mb} MB / ${MAX_STORAGE_MB} MB`;
    if (fill) {
        fill.style.width = `${pct}%`;
        fill.className = `storage-fill ${pct > 90 ? 'danger' : pct > 75 ? 'warn' : ''}`;
    }
    return mb;
}

// --- 2. ASYNC PROFESSIONAL WATERMARKING ---
async function handleCapture(input) {
    if (!input.files || !input.files[0]) return;
    
    const currentMB = await updateQuotaUI();
    if (currentMB >= MAX_STORAGE_MB) {
        toast("❌ Vault Full (50MB). Delete old photos or sync drafts.");
        input.value = '';
        return;
    }

    const file = input.files[0];
    const label = document.getElementById('photoLabel').value;
    const coords = document.getElementById('locationCoords')?.value || "GPS NOT LOCKED";
    const btn = input.previousElementSibling;
    const originalText = btn.innerText;
    
    btn.innerHTML = '<span class="spinner"></span> Processing...';
    btn.disabled = true;

    try {
        // Offload to Async Promise to prevent UI freeze
        const watermarkedBase64 = await applyProfessionalWatermark(file, label, coords);
        
        const photoObj = {
            id: Date.now(),
            label: label,
            coords: coords,
            data: watermarkedBase64,
            timestamp: Date.now() // Use numeric timestamp for easier arithmetic
        };

        const db = await initDB();
        const tx = db.transaction('photos', 'readwrite');
        tx.objectStore('photos').put(photoObj);
        
        tx.oncomplete = async () => {
            toast("✅ Photo Saved to Vault");
            await updateQuotaUI();
            await loadAndRenderGallery();
            input.value = '';
        };

    } catch (err) {
        console.error(err);
        toast("❌ Image processing failed.");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

function applyProfessionalWatermark(file, label, coords) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Target width 1280px for high-quality, low footprint
                const targetW = 1280;
                const scale = targetW / img.width;
                canvas.width = targetW;
                canvas.height = img.height * scale;

                // Draw Base Image
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // --- PROFESSIONAL OVERLAY ---
                // 1. Dark Gradient at Bottom for text readability
                const gradHeight = 180;
                const grad = ctx.createLinearGradient(0, canvas.height - gradHeight, 0, canvas.height);
                grad.addColorStop(0, 'rgba(0,0,0,0)');
                grad.addColorStop(0.5, 'rgba(0,0,0,0.6)');
                grad.addColorStop(1, 'rgba(0,0,0,0.9)');
                ctx.fillStyle = grad;
                ctx.fillRect(0, canvas.height - gradHeight, canvas.width, gradHeight);

                // 2. Setup Typography
                ctx.fillStyle = 'white';
                ctx.shadowColor = 'rgba(0,0,0,0.8)';
                ctx.shadowBlur = 4;
                ctx.shadowOffsetY = 2;
                
                // 3. Draw GPS Data (Bottom Left)
                ctx.textAlign = 'left';
                ctx.font = '500 24px "DM Mono", monospace';
                const hasGps = coords !== 'GPS NOT LOCKED';
                const coordColor = hasGps ? '#4ade80' : '#f87171';
                
                // Little GPS dot
                ctx.fillStyle = coordColor;
                ctx.beginPath(); ctx.arc(30, canvas.height - 75, 8, 0, Math.PI * 2); ctx.fill();
                
                ctx.fillStyle = 'white';
                ctx.fillText(`GPS: ${coords}`, 50, canvas.height - 67);
                
                // 4. Draw Date/Time (Bottom Left)
                ctx.font = '400 20px "DM Sans", sans-serif';
                ctx.fillStyle = '#cbd5e1';
                ctx.fillText(new Date().toLocaleString('en-IN'), 50, canvas.height - 35);

                // 5. Draw Label & Branding (Bottom Right)
                ctx.textAlign = 'right';
                ctx.fillStyle = '#fbbf24'; // Warning yellow for label
                ctx.font = '700 32px "Sora", sans-serif';
                ctx.fillText(label.toUpperCase(), canvas.width - 30, canvas.height - 65);
                
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.font = '500 18px "DM Sans", sans-serif';
                ctx.fillText('SIF ENTERPRISE VERIFIED', canvas.width - 30, canvas.height - 35);

                // Compress heavily to keep inside 50MB quota (0.7 quality is visually fine, tiny size)
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// --- 3. GALLERY & LIGHTBOX ENGINE ---
async function loadAndRenderGallery() {
    const { photos } = await getStorageUsage();
    const gallery = document.getElementById('photoGallery');
    if (!gallery) return;

    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    
    // AUTO-EXPIRY CLEANUP
    const db = await initDB();
    const tx = db.transaction('photos', 'readwrite');
    const store = tx.objectStore('photos');
    
    const validPhotos = photos.filter(p => {
        // Support both old string timestamps and new numeric ones
        const ts = typeof p.timestamp === 'number' ? p.timestamp : Date.parse(p.timestamp);
        if (!isNaN(ts) && now - ts > sevenDays) {
            store.delete(p.id);
            return false;
        }
        return true;
    });

    if (validPhotos.length === 0) {
        gallery.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; padding:40px; opacity:0.5;">No photos in vault.</div>`;
        return;
    }

    gallery.innerHTML = validPhotos.reverse().map(p => `
        <div class="photo-card ${p.coords === 'GPS NOT LOCKED' ? 'no-gps' : ''}" onclick="openLightbox(${p.id})">
            <div class="photo-badge">${p.label}</div>
            <img src="${p.data}" loading="lazy">
        </div>
    `).join('');
}

async function openLightbox(id) {
    const { photos } = await getStorageUsage();
    const photo = photos.find(p => p.id === id);
    if (!photo) return;

    currentLightboxPhotoId = id;
    document.getElementById('lbImage').src = photo.data;
    document.getElementById('lbTitle').innerText = photo.label;
    document.getElementById('lightbox').classList.add('active');
}

function closeLightbox() {
    document.getElementById('lightbox').classList.remove('active');
    currentLightboxPhotoId = null;
}

async function deleteCurrentPhoto() {
    if (!confirm("Permanently delete this photo?")) return;
    
    const db = await initDB();
    const tx = db.transaction('photos', 'readwrite');
    tx.objectStore('photos').delete(currentLightboxPhotoId);
    
    tx.oncomplete = async () => {
        closeLightbox();
        await updateQuotaUI();
        await loadAndRenderGallery();
        toast("🗑️ Photo Deleted");
    };
}

async function retakeCurrentPhoto() {
    // 1. Trigger the camera
    document.getElementById('photoInput').click();
    // 2. Delete the current bad one
    deleteCurrentPhoto();
}

async function shareCurrentPhoto() {
    const { photos } = await getStorageUsage();
    const photo = photos.find(p => p.id === currentLightboxPhotoId);
    if (!photo) return;

    try {
        // Convert Base64 back to Blob for Native Sharing
        const res = await fetch(photo.data);
        const blob = await res.blob();
        const file = new File([blob], `${photo.label.replace(' ', '_')}.jpg`, { type: 'image/jpeg' });

        if (navigator.share && navigator.canShare({ files: [file] })) {
            await navigator.share({
                title: photo.label,
                text: `SIF Verification Photo - GPS: ${photo.coords}`,
                files: [file]
            });
        } else {
            // Fallback for desktop browsers: Download
            const a = document.createElement('a');
            a.href = photo.data;
            a.download = `${photo.label}.jpg`;
            a.click();
            toast("⬇️ Image Downloaded");
        }
    } catch (err) {
        console.error("Share failed", err);
    }
}

// Initial Load
document.addEventListener('DOMContentLoaded', async () => {
    await updateQuotaUI();
    await loadAndRenderGallery();
});
