// ═══════════════════════════════════════════════════════════════════════════════
// UI & MULTI-DRAFT ENGINE
// ═══════════════════════════════════════════════════════════════════════════════
async function loginAgent(id, pass) {
    const url = localStorage.getItem('sif_url');
    
    if (!url) {
        console.error("❌ No API URL configured. Check localStorage.sif_url");
        toast('❌ API URL not configured');
        return false;
    }
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            mode: 'cors',
            cache: 'no-cache',
            headers: {
                'Content-Type': 'application/json;charset=utf-8', // ← FIXED
            },
            body: JSON.stringify({
                action: 'login',
                agentId: id,
                password: pass
            })
        });

        if (!response.ok) {
            console.error(`API Error: ${response.status} ${response.statusText}`);
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        return result.status === 'success';
    } catch (err) {
        console.error("Login Error:", err.message);
        console.warn("API Offline, using local bypass for UI testing");
        return id === "admin" && pass === "123"; 
    }
}

let currentStep = 0;
const totalSteps = 12; // 12 total steps (s0..s11)
let currentDraftId = null; // Tracks which file is currently open

// --- 0. TOAST UTILITY (used globally across all modules) ---
function toast(msg, duration = 3000) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.innerText = msg;
    t.classList.add('show');
    clearTimeout(t._toastTimer);
    t._toastTimer = setTimeout(() => t.classList.remove('show'), duration);
}

// --- 1. THEME ENGINE ---
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('sif_theme', newTheme);
    
    const themeBtn = document.getElementById('themeBtn');
    if (themeBtn) themeBtn.innerText = newTheme === 'dark' ? '☀️' : '🌙';
}

function initTheme() {
    const savedTheme = localStorage.getItem('sif_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const themeBtn = document.getElementById('themeBtn');
    if (themeBtn) themeBtn.innerText = savedTheme === 'dark' ? '☀️' : '🌙';
}

// --- 2. INDEXED-DB MULTI-DRAFT ENGINE ---
let draftDbPromise = null;
// Automatically recover the active draft ID if the page refreshed
currentDraftId = localStorage.getItem('sif_active_draft') || null; 

function initDraftDB() {
    if (!draftDbPromise) {
        draftDbPromise = new Promise((resolve, reject) => {
            // Renamed to force a brand new, clean database
            const request = indexedDB.open('SIF_Vault_Pro_Drafts', 1); 
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('drafts')) {
                    db.createObjectStore('drafts', { keyPath: 'id' });
                }
            };
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e);
        });
    }
    return draftDbPromise;
}

async function saveDraftLocally() {
    // Failsafe: If no ID exists but we are typing, create a new file instantly
    if (!currentDraftId) {
        currentDraftId = 'sif_' + Date.now();
        localStorage.setItem('sif_active_draft', currentDraftId);
    }

    const draftData = {};
    document.querySelectorAll('#appContainer input, #appContainer select, #appContainer textarea').forEach(el => {
        if (el.id && el.type !== 'file' && el.type !== 'button') draftData[el.id] = el.value;
    });

    // Ensure it never saves as blank
    let title = draftData.applicantName ? draftData.applicantName.trim() : '';
    let subtitle = draftData.bankName ? draftData.bankName.trim() : '';
    
    if (title === '') title = 'Untitled Walk-in';
    if (subtitle === '') subtitle = 'Draft Report';

    try {
        const db = await initDraftDB();
        const tx = db.transaction('drafts', 'readwrite');
        tx.objectStore('drafts').put({ 
            id: currentDraftId, 
            title: title,
            subtitle: subtitle,
            step: currentStep, // Save current position
            data: draftData, 
            timestamp: Date.now() 
        });
    } catch (e) {
        console.error("Failed to save draft", e);
    }
}

// --- 3. RENDER THE FILES TAB ---
async function openDrafts() {
    document.getElementById('inboxView').style.display = 'none';
    document.getElementById('appContainer').style.display = 'none';
    document.getElementById('draftsView').style.display = 'flex';
    
    const bottomNav = document.getElementById('bottomNav');
    if (bottomNav) bottomNav.style.display = 'flex';

    document.getElementById('navGlobal').style.display = 'flex';
    if(document.getElementById('navForm')) document.getElementById('navForm').style.display = 'none';

    try {
        const db = await initDraftDB();
        const tx = db.transaction('drafts', 'readwrite');
        const store = tx.objectStore('drafts');
        const request = store.getAll();
        
        request.onsuccess = () => {
            const allDrafts = request.result || [];
            const list = document.getElementById('draftList');
            const now = Date.now();
            const sevenDays = 7 * 24 * 60 * 60 * 1000;

            // AUTO-EXPIRY CLEANUP
            let cleaned = 0;
            const drafts = allDrafts.filter(d => {
                if (now - d.timestamp > sevenDays) {
                    store.delete(d.id);
                    cleaned++;
                    return false;
                }
                return true;
            });

            if (cleaned > 0) console.log(`🧹 Cleaned ${cleaned} expired drafts`);
            
            if (drafts.length === 0) {
                list.innerHTML = `<div style="text-align:center; color:var(--text-3); padding:30px; border: 2px dashed var(--border); border-radius:12px;">No saved files found.</div>`;
                return;
            }

            list.innerHTML = drafts.sort((a,b) => b.timestamp - a.timestamp).map(d => `
                <div class="card" style="padding: 15px; cursor: pointer; border-left: 4px solid var(--warn); margin-bottom:12px;" onclick="resumeDraft('${d.id}')">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <h3 style="font-size:1.1rem; margin-bottom:4px; color:var(--text);">${d.title}</h3>
                            <p style="font-size:0.8rem; color:var(--text-2);">${d.subtitle}</p>
                            <p style="font-size:0.7rem; color:var(--text-3); margin-top:8px;">🕒 Last saved: ${new Date(d.timestamp).toLocaleString('en-IN', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'})}</p>
                        </div>
                        <button onclick="deleteDraft(event, '${d.id}')" style="background:var(--surface-2); color:var(--danger); font-size:1.2rem; border:1px solid var(--border); border-radius:8px; padding:8px 12px; transition:0.2s;">🗑</button>
                    </div>
                </div>
            `).join('');
        };
    } catch (e) {
        console.error("Failed to load drafts", e);
    }
}

async function resumeDraft(id) {
    currentDraftId = id;
    localStorage.setItem('sif_active_draft', currentDraftId); // Remember this file
    
    const db = await initDraftDB();
    const tx = db.transaction('drafts', 'readonly');
    const request = tx.objectStore('drafts').get(id);
    
    request.onsuccess = () => {
        if (request.result && request.result.data) {
            const draft = request.result.data;
            Object.keys(draft).forEach(key => {
                const el = document.getElementById(key);
                if (el) el.value = draft[key];
            });
            // Restore current step position
            currentStep = request.result.step || 0;
            
            // 2. Specialized restoration for Selection Groups (Chips)
            ['loanType', 'occupiedBy', 'nearbyLandUsage', 'roofing'].forEach(id => {
                const val = draft[id];
                if (val) {
                    // Update the hidden input value
                    const hidden = document.getElementById(id);
                    if (hidden) hidden.value = val;

                    // Update chip visual state
                    let containerId = id + 'Container';
                    if (id === 'occupiedBy') containerId = 'occupancyContainer';
                    if (id === 'nearbyLandUsage') containerId = 'landUsageContainer';

                    const container = document.getElementById(containerId);
                    if (container) {
                        container.querySelectorAll('.chip').forEach(chip => {
                            chip.classList.toggle('active', chip.innerText.trim() === val);
                        });
                    }
                }
            });
        }
        openFormUI_Resumed();
    };
}

async function deleteDraft(event, id) {
    event.stopPropagation(); 
    if(!confirm("Permanently delete this file?")) return;
    
    const db = await initDraftDB();
    const tx = db.transaction('drafts', 'readwrite');
    tx.objectStore('drafts').delete(id);
    tx.oncomplete = () => {
        if (currentDraftId === id) {
            currentDraftId = null;
            localStorage.removeItem('sif_active_draft');
        }
        openDrafts(); 
    };
}

async function clearAllDrafts() {
    if (!confirm("⚠️ WARNING: This will permanently delete ALL saved drafts AND all photos in the vault. Continue?")) return;
    
    // 1. Clear Drafts
    const dbDrafts = await initDraftDB();
    const txDrafts = dbDrafts.transaction('drafts', 'readwrite');
    txDrafts.objectStore('drafts').clear();
    
    txDrafts.oncomplete = async () => {
        // 2. Clear Photos (Global Sync)
        if (typeof initDB === 'function') {
            const dbPhotos = await initDB();
            const txPhotos = dbPhotos.transaction('photos', 'readwrite');
            txPhotos.objectStore('photos').clear();
            txPhotos.oncomplete = () => {
                if(typeof updateQuotaUI === 'function') updateQuotaUI();
                if(typeof loadAndRenderGallery === 'function') loadAndRenderGallery();
            };
        }
        
        toast("💥 GLOBAL WIPE SUCCESSFUL. All drafts and photos deleted.");
        openDrafts(); 
    };
}

// --- 4. CORE ROUTING (Non-Blocking) ---
function goHome() {
    document.getElementById('draftsView').style.display = 'none';
    document.getElementById('appContainer').style.display = 'none';
    document.getElementById('inboxView').style.display = 'flex';
    document.getElementById('loginOverlay').classList.remove('active');
    
    // Ensure bottom nav is visible
    const bottomNav = document.getElementById('bottomNav');
    if (bottomNav) bottomNav.style.display = 'flex';

    // Switch Nav Mode
    document.getElementById('navGlobal').style.display = 'flex';
    if(document.getElementById('navForm')) document.getElementById('navForm').style.display = 'none';
    
    // FIRE AND FORGET: Do not wait for fetchInbox to finish before showing UI
    if (typeof fetchInbox === 'function') fetchInbox(); 
}

function startNewBlankReport() {
    currentDraftId = 'sif_' + Date.now();
    localStorage.setItem('sif_active_draft', currentDraftId); // Lock in the new file
    
    document.querySelectorAll('#appContainer input, #appContainer textarea, #appContainer select').forEach(input => {
        if (input.type !== 'button' && input.type !== 'submit' && input.type !== 'file') input.value = '';
    });
    
    // Clear chips
    document.querySelectorAll('#appContainer .chip').forEach(chip => chip.classList.remove('active'));

    // Set Defaults
    if (G('district')) G('district').value = 'Kottayam';

    openFormUI();
}

function closeForm() {
    saveDraftLocally(); // Force one last save
    currentDraftId = null;
    openDrafts(); // Send them back to the files menu
}

function openFormUI() {
    document.getElementById('inboxView').style.display = 'none';
    document.getElementById('draftsView').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    
    const bottomNav = document.getElementById('bottomNav');
    if (bottomNav) bottomNav.style.display = 'flex';

    // Switch Nav Mode to Form Controls
    document.getElementById('navGlobal').style.display = 'none';
    if(document.getElementById('navForm')) document.getElementById('navForm').style.display = 'flex';
    
    goTo(0);
}

function openFormUI_Resumed() {
    document.getElementById('inboxView').style.display = 'none';
    document.getElementById('draftsView').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    
    const bottomNav = document.getElementById('bottomNav');
    if (bottomNav) bottomNav.style.display = 'flex';

    // Switch Nav Mode to Form Controls
    document.getElementById('navGlobal').style.display = 'none';
    if(document.getElementById('navForm')) document.getElementById('navForm').style.display = 'flex';
    
    updateUI(); // Resumes on the correct step
}

// --- 5. NAVIGATION LOGIC (Prev/Next) ---
function updateUI() {
    document.querySelectorAll('.section').forEach((s, i) => s.classList.toggle('active', i === currentStep));
    const prevBtn = document.getElementById('prevBtn');
    if (prevBtn) prevBtn.style.visibility = currentStep === 0 ? 'hidden' : 'visible';
    const nextBtn = document.getElementById('nextBtn');
    if (nextBtn) nextBtn.innerText = currentStep === totalSteps - 1 ? 'Finish ✓' : 'Next ▶';
    const stepInd = document.getElementById('stepInd');
    if (stepInd) stepInd.innerText = `${currentStep + 1}/${totalSteps}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function nextStep() {
    if (currentStep < totalSteps - 1) {
        currentStep++;
        updateUI();
        saveDraftLocally();
    } else {
        // WE ARE ON THE LAST STEP - TRIGGER FINISH!
        saveDraftLocally();
        if (typeof showFinalReport === 'function') showFinalReport();
    }
}
function prevStep() { if (currentStep > 0) { currentStep--; updateUI(); saveDraftLocally(); } }
function goTo(index) { currentStep = index; updateUI(); }

// --- 6. INITIALIZATION & DATA HYDRATION ---
function hydrateForm() {
    // 1. Populate Bank Names
    const bankSelect = document.getElementById('bankName');
    if (bankSelect && typeof SIF_DATA !== 'undefined' && SIF_DATA.BANKS) {
        bankSelect.innerHTML = '<option value="">-- Choose Bank --</option>' + 
            SIF_DATA.BANKS.map(b => `<option value="${b}">${b}</option>`).join('') +
            '<option value="Other Bank (Manual Entry)">+ Other Bank (Manual Entry)</option>';
    }

    // 2. Populate Loan Types (Chips)
    if (typeof SIF_DATA !== 'undefined') {
        _populateSelectionChips('loanTypeContainer', 'loanType', SIF_DATA.LOAN_TYPES);
        _populateSelectionChips('occupancyContainer', 'occupiedBy', SIF_DATA.OCCUPANCY);
        _populateSelectionChips('landUsageContainer', 'nearbyLandUsage', SIF_DATA.LAND_USAGE);
        _populateSelectionChips('roofingContainer', 'roofing', SIF_DATA.ROOFING);
    }

    // 3. Populate Taluks (from location.js VD)
    const talukSelect = document.getElementById('taluk');
    if (talukSelect && typeof VD !== 'undefined') {
        talukSelect.innerHTML = '<option value="">-- Choose Taluk --</option>' + 
            Object.keys(VD).map(t => `<option value="${t}">${t}</option>`).join('');
        
        talukSelect.onchange = () => {
            if (typeof toggleLocalBody === 'function') toggleLocalBody('reset');
            saveDraftLocally();
        };
    }
}

// Internal helper for chip-based selection groups
function _populateSelectionChips(containerId, hiddenInputId, data) {
    const container = document.getElementById(containerId);
    const hidden = document.getElementById(hiddenInputId);
    if (!container || !hidden || !data) return;

    container.innerHTML = data.map(val => `<div class="chip">${val}</div>`).join('');
    
    container.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const val = chip.innerText.trim();
            const isActive = chip.classList.contains('active');
            
            container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            if (!isActive) {
                chip.classList.add('active');
                hidden.value = val;
            } else {
                hidden.value = '';
            }
            saveDraftLocally();
        });
    });
}

function buildNav() {
    // Sync the initial UI state
    updateUI();
}

function setupLightboxTouch() {
    // Stub for touch interactions
}

// --- BOOTSTRAP ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    
    // Attach "Input" listeners to everything to trigger auto-saving
    const inputs = Array.from(document.querySelectorAll('#appContainer input, #appContainer textarea, #appContainer select'));
    inputs.forEach((el, index) => {
        el.addEventListener('input', () => {
            // Debounce saving slightly so it doesn't fire on every single millisecond keystroke
            clearTimeout(window.draftTimer);
            window.draftTimer = setTimeout(saveDraftLocally, 800);
        });

        // Auto-transfer to next field on Enter
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && el.tagName.toLowerCase() !== 'textarea') {
                e.preventDefault();
                let nextIndex = index + 1;
                while (nextIndex < inputs.length) {
                    const nextEl = inputs[nextIndex];
                    if (nextEl && nextEl.type !== 'hidden' && nextEl.style.display !== 'none' && !nextEl.readOnly && !nextEl.disabled) {
                        nextEl.focus();
                        break;
                    }
                    nextIndex++;
                }
            }
        });
    });
    
    // Attach click listeners to chips so they also trigger auto-save
    document.querySelectorAll('#appContainer .chip').forEach(el => {
        el.addEventListener('click', () => {
            clearTimeout(window.draftTimer);
            window.draftTimer = setTimeout(saveDraftLocally, 800);
        });
    });
});
// ═══════════════════════════════════════════════════════════════════════════════
// 7. THE REVERSE PARSER (Auto-Import)
// ═══════════════════════════════════════════════════════════════════════════════

function processTextImport() {
    const rawText = G('importRawText').value;
    if (!rawText.trim()) return toast("⚠️ Please paste some text first.");

    // 1. Create a brand new file for this import
    currentDraftId = 'sif_' + Date.now();
    localStorage.setItem('sif_active_draft', currentDraftId);
    
    // Clear the form first
    document.querySelectorAll('#appContainer input, #appContainer textarea, #appContainer select').forEach(input => {
        if (input.type !== 'button' && input.type !== 'submit' && input.type !== 'file') input.value = '';
    });
    if (G('district')) G('district').value = 'Kottayam';

    // 2. The Extraction Dictionary: Maps Text Labels to HTML Element IDs
    const extractionMap = {
        "Bank Name": "bankName",
        "Loan Type": "loanType",
        "Applicant Name": "applicantName",
        "Owner Name": "ownerName",
        "Occupied by": "occupiedBy",
        "Site shown by": "siteShownBy",
        "Property Address": "address",
        "Phone number": "phoneNumber",
        "District": "district",
        "Taluk": "taluk",
        "Village": "villageInput",
        "Panchayat": "panchayatInput",
        "Municipality": "municipalityInput",
        "Locality": "locality",
        "Ward": "ward",
        "Door no": "doorNo",
        "Location": "locationCoords",
        "Nearest landmark": "nearLandmark",
        "Nearest Branch": "nearBranch",
        "Distance from office": "distFromOffice",
        "Nearest Police Station": "nearPolice",
        "Nearest Railway Station": "nearRailway",
        "Nearest Bus stop": "nearBus",
        "Nearest Town": "nearTown",
        "Nearest Hospital": "nearHospital",
        "Nearby Land usage": "nearbyLandUsage",
        "Access to site": "accessToSite",
        "Distance from Panchayat/PWD road": "distFromRoad",
        "Condition of Road": "conditionOfRoad",
        "Age": "buildingAge",
        "Area of Building": "areaOfBuilding",
        "Number of Floor": "numFloors",
        "Roofing": "roofing",
        "Flooring": "flooring",
        "Water source": "waterSource",
        "Land price": "landPrice",
        "Extent": "extent",
        "SYNO": "syNo",
        "File Recieved on": "fileReceivedOn",
        "Report sent": "reportSent",
        "Report sent to": "reportSentTo",
        "Remarks & comments": "remarks"
    };

    // 3. Scan line-by-line (More efficient than matching full text 50 times)
    const lines = rawText.split('\n');
    for (const [textLabel, htmlId] of Object.entries(extractionMap)) {
        const regex = new RegExp(`^${textLabel}\\s*:\\s*(.*)`, 'i');
        for (const line of lines) {
            const match = line.trim().match(regex);
            if (match && match[1]) {
                let val = match[1].trim();
                // Cleanups for numeric fields
                if (htmlId === 'buildingAge') val = val.replace(/years/i, '').trim();
                if (htmlId === 'areaOfBuilding') val = val.replace(/Sq\.Ft/i, '').trim();
                if (htmlId === 'landPrice') val = val.replace(/₹|,|\/ Cent/gi, '').trim();
                
                const el = G(htmlId);
                if (el) el.value = val;
                break;
            }
        }
    }

    // 4. Handle Complex Multi-line Extractions (Boundaries)
    const extractB = (section, dir) => {
        const reg = new RegExp(`${section}[\\s\\S]*?${dir}\\s*:\\s*(.*?)(?=\\n|$)`, 'i');
        const m = rawText.match(reg);
        return m ? m[1].trim() : '';
    };

    // Boundaries
    G('lsNorth').value = extractB('Boundaries as per LS', 'NORTH');
    G('lsSouth').value = extractB('Boundaries as per LS', 'SOUTH');
    G('lsEast').value = extractB('Boundaries as per LS', 'EAST');
    G('lsWest').value = extractB('Boundaries as per LS', 'WEST');

    G('actNorth').value = extractB('Boundaries as per actual site', 'NORTH');
    G('actSouth').value = extractB('Boundaries as per actual site', 'SOUTH');
    G('actEast').value = extractB('Boundaries as per actual site', 'EAST');
    G('actWest').value = extractB('Boundaries as per actual site', 'WEST');

    G('demNorth').value = extractB('Demarcation', 'NORTH');
    G('demSouth').value = extractB('Demarcation', 'SOUTH');
    G('demEast').value = extractB('Demarcation', 'EAST');
    G('demWest').value = extractB('Demarcation', 'WEST');

    // Documents
    const deedMatch = rawText.match(/Deed\s*-\s*(.*?)\s*Dated on\s*:\s*(.*?)\s*SRO\s*:\s*(.*)/i);
    if (deedMatch) {
        G('deedNo').value = deedMatch[1].trim();
        G('deedSRO').value = deedMatch[3].trim(); 
    }

    const routeMatch = rawText.match(/Route\s*:\s*(.*)/i);
    if (routeMatch && routeMatch[1]) G('routeText').value = routeMatch[1].trim();

    // 5. Visually Update Chips
    ['loanType', 'occupiedBy', 'nearbyLandUsage', 'roofing'].forEach(id => {
        const elId = G(id);
        const val = elId ? elId.value : null;
        if (val) {
            let containerId = id + 'Container';
            if (id === 'occupiedBy') containerId = 'occupancyContainer';
            if (id === 'nearbyLandUsage') containerId = 'landUsageContainer';
            
            const container = G(containerId);
            if (container) {
                container.querySelectorAll('.chip').forEach(c => {
                    c.classList.toggle('active', c.innerText.trim().toLowerCase() === val.toLowerCase());
                });
            }
        }
    });

    // 6. Close Modal, Save, and Open Form
    G('importOverlay').classList.remove('active');
    G('importRawText').value = '';
    
    saveDraftLocally().then(() => {
        toast("✨ Data Extracted Successfully!");
        openFormUI();
    });
}
