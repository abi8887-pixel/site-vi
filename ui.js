// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 4: UI ENGINE — Navigation, Form Hydration, Toasts
// ═══════════════════════════════════════════════════════════════════════════════

let currentStep = 0;
const totalSteps = 12;
const STEP_LABELS = ['Bank', 'People', 'Address', 'Location', 'Distances', 'Road', 'Boundaries', 'Building', 'Land', 'Documents', 'Route', 'Report'];

// --- STEP NAVIGATION ---
function buildNav() {
    const nav = G('stepsNav');
    if (!nav) return;
    nav.innerHTML = STEP_LABELS.map((label, i) =>
        `<button class="step-btn ${i === currentStep ? 'active' : ''}" onclick="goTo(${i})">${label}</button>`
    ).join('');
}

function updateUI() {
    document.querySelectorAll('.section').forEach((s, i) => {
        s.classList.toggle('active', i === currentStep);
    });

    // Update step nav
    document.querySelectorAll('.step-btn').forEach((btn, i) => {
        btn.classList.toggle('active', i === currentStep);
    });

    // Scroll active step button into view
    const activeBtn = document.querySelector('.step-btn.active');
    if (activeBtn) activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

    // Footer progress
    const stepInd = G('stepInd');
    if (stepInd) stepInd.innerText = `${currentStep + 1} / ${totalSteps}`;

    const progressBar = G('progressBar');
    if (progressBar) progressBar.style.width = `${((currentStep + 1) / totalSteps) * 100}%`;

    // Prev button
    const prevBtn = G('prevBtn');
    if (prevBtn) prevBtn.style.visibility = currentStep === 0 ? 'hidden' : 'visible';

    // Next/Submit button
    const nextBtn = G('nextBtn');
    if (nextBtn) {
        nextBtn.innerText = currentStep === totalSteps - 1 ? '✅ Finish' : 'Next ▶';
    }

    // Auto-scroll to top of card
    const card = document.querySelector('.card');
    if (card) card.scrollTop = 0;

    // Auto-generate report on final step
    if (currentStep === totalSteps - 1 && typeof generateReport === 'function') {
        generateReport();
    }
}

function nextStep() {
    if (currentStep < totalSteps - 1) {
        currentStep++;
        updateUI();
    }
}

function prevStep() {
    if (currentStep > 0) {
        currentStep--;
        updateUI();
    }
}

function goTo(index) {
    currentStep = index;
    updateUI();
}

// --- CHIP SELECTION ---
function selectChip(chipEl, hiddenInputId, value) {
    const container = chipEl.parentElement;
    container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chipEl.classList.add('active');
    const input = G(hiddenInputId);
    if (input) input.value = value;
}

// --- FORM MANAGEMENT ---
function resetApp() {
    const inputs = document.querySelectorAll('#appContainer input, #appContainer textarea, #appContainer select');
    inputs.forEach(input => {
        if (input.type !== 'button' && input.type !== 'submit' && input.type !== 'hidden' && input.id !== 'gasUrl' && input.id !== 'loginUrl') {
            if (input.tagName === 'SELECT') {
                input.selectedIndex = 0;
            } else {
                input.value = '';
            }
        }
    });
    
    // Reset specific defaults
    if (G('district')) G('district').value = 'Kottayam';
    if (G('locationCoords')) G('locationCoords').value = 'GPS NOT LOCKED';
    if (G('conditionOfRoad')) G('conditionOfRoad').value = 'Good';
    
    // Reset chips to first option
    document.querySelectorAll('.selection-group').forEach(group => {
        const chips = group.querySelectorAll('.chip');
        chips.forEach((c, i) => c.classList.toggle('active', i === 0));
    });
    
    // Reset hidden chip inputs
    if (G('loanType') && SIF_DATA) G('loanType').value = SIF_DATA.LOAN_TYPES[0];
    if (G('occupiedBy') && SIF_DATA) G('occupiedBy').value = SIF_DATA.OCCUPANCY[0];
    if (G('roofing') && SIF_DATA) G('roofing').value = SIF_DATA.ROOFING[0];
    if (G('nearbyLandUsage') && SIF_DATA) G('nearbyLandUsage').value = SIF_DATA.LAND_USAGE[0];
    
    // Clear Photo Gallery
    const gallery = G('photoGallery');
    if (gallery) gallery.innerHTML = '';
    
    // Clear report
    if (G('reportOutput')) G('reportOutput').value = '';
    
    // Reset Navigation
    currentStep = 0;
    updateUI();
}

// --- TOAST NOTIFICATIONS ---
function toast(msg, duration = 3000) {
    const t = G('toast');
    if (!t) return;
    t.innerText = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), duration);
}

// --- FORM HYDRATION ---
function hydrateForm() {
    // 1. Inject Banks
    const bankSelect = G('bankName');
    if (bankSelect) {
        bankSelect.innerHTML = '<option value="">Select Bank...</option>' + 
            SIF_DATA.BANKS.map(b => `<option value="${b}">${b}</option>`).join('');
    }

    // 2. Inject Taluks
    const talukSelect = G('taluk');
    if (talukSelect) {
        const taluks = typeof SIF_DATA.KOTTAYAM_TALUKS !== 'undefined' 
            ? Object.keys(SIF_DATA.KOTTAYAM_TALUKS) 
            : Object.keys(VD);
        talukSelect.innerHTML = '<option value="">Select Taluk...</option>' + 
            taluks.map(t => `<option value="${t}">${t}</option>`).join('');
    }

    // 3. Inject Chips
    renderChips('loanTypeContainer', 'loanType', SIF_DATA.LOAN_TYPES);
    renderChips('occupancyContainer', 'occupiedBy', SIF_DATA.OCCUPANCY);
    renderChips('roofingContainer', 'roofing', SIF_DATA.ROOFING);
    renderChips('landUsageContainer', 'nearbyLandUsage', SIF_DATA.LAND_USAGE);
}

function renderChips(containerId, hiddenInputId, dataArray) {
    const container = G(containerId);
    if (!container) return;

    container.innerHTML = dataArray.map((item, index) => `
        <div class="chip ${index === 0 ? 'active' : ''}" 
             onclick="selectChip(this, '${hiddenInputId}', '${item}')">
             ${item}
        </div>
    `).join('');
    
    const input = G(hiddenInputId);
    if (input) input.value = dataArray[0];
}

// Initialize on Load
document.addEventListener('DOMContentLoaded', updateUI);