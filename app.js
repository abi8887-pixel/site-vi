// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 5: MAIN APP BOOTSTRAP & STATE MANAGER
// Initializes the app, handles event listeners, auto-saving, and network status
// ═══════════════════════════════════════════════════════════════════════════════
// Global State
// ── GLOBAL UTILITIES (CRITICAL FOR GIT) ──
// These must be defined first to avoid "ReferenceError: G is not defined"
const G = (id) => document.getElementById(id);
const V = (id) => G(id) ? G(id).value : '';

// Now your handleLogin can proceed safely
async function handleLogin() {
    const id = V('loginId');
    const pass = V('loginPass');
    const url = V('loginUrl');
    // ... rest of your code
}
let currentAssignedCaseId = null;




function logoutAgent() {
    localStorage.removeItem('sif_session_token');
    location.reload();
}

// --- LOGIN LOGIC ---
async function handleLogin() {
    const id = G('loginId').value.trim();
    const pass = G('loginPass').value.trim();
    let url = G('loginUrl').value.trim();

    if (!id || !pass || !url) {
        return toast('⚠️ Please fill all fields');
    }

    // 🚩 FIX 1: Ensure URL is HTTPS for GitHub Pages compatibility
    if (url.startsWith('http:')) {
        url = url.replace('http:', 'https:');
    }

    const btn = G('btnLogin');
    btn.innerHTML = 'Authenticating...';
    btn.disabled = true;

    // Save URL immediately so api.js can use it
    localStorage.setItem('sif_url', url);

    try {
        // 🚩 FIX 2: Timeout Protection
        // Google Apps Script can sometimes take 5-10 seconds to wake up
        const success = await loginAgent(id, pass); 
        
        if (success) {
            localStorage.setItem('sif_session_token', 'AUTH_' + Date.now());
            localStorage.setItem('sif_agent_id', id);
            
            G('loginOverlay').classList.remove('active');
            toast('🔓 Access Granted');
            goHome();
        } else {
            throw new Error("Invalid Credentials");
        }
    } catch (e) {
        console.error("Login Error:", e);
        btn.innerHTML = 'Secure Login';
        btn.disabled = false;
        toast('❌ Login Failed: Check URL or Credentials');
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COLLECT FORM DATA — Gathers all form values into a flat object
// ═══════════════════════════════════════════════════════════════════════════════
function collectFormData() {
    const formatDate = (val) => {
        if (!val) return '';
        const d = new Date(val + 'T00:00:00');
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    return {
        bankName: V('bankName'),
        loanType: V('loanType'),
        applicantName: V('applicantName'),
        ownerName: V('ownerName'),
        occupiedBy: V('occupiedBy'),
        siteShownBy: V('siteShownBy'),
        phoneNumber: V('phoneNumber'),
        address: V('address'),
        district: V('district'),
        taluk: V('taluk'),
        village: V('villageInput'),
        panchayat: V('panchayatInput'),
        municipality: V('municipalityInput'),
        locality: V('locality'),
        ward: V('ward'),
        doorNo: V('doorNo'),
        locationCoords: V('locationCoords'),
        nearLandmark: V('nearLandmark'),
        nearBranch: V('nearBranch'),
        distFromOffice: V('distFromOffice'),
        nearPolice: V('nearPolice'),
        nearRailway: V('nearRailway'),
        nearBus: V('nearBus'),
        nearTown: V('nearTown'),
        nearHospital: V('nearHospital'),
        nearbyLandUsage: V('nearbyLandUsage'),
        accessToSite: V('accessToSite'),
        distFromRoad: V('distFromRoad'),
        conditionOfRoad: V('conditionOfRoad'),
        lsNorth: V('lsNorth'),
        lsSouth: V('lsSouth'),
        lsEast: V('lsEast'),
        lsWest: V('lsWest'),
        actNorth: V('actNorth'),
        actSouth: V('actSouth'),
        actEast: V('actEast'),
        actWest: V('actWest'),
        demarcationNote: V('demarcationNote'),
        demNorth: V('demNorth'),
        demSouth: V('demSouth'),
        demEast: V('demEast'),
        demWest: V('demWest'),
        buildingAge: V('buildingAge'),
        areaOfBuilding: V('areaOfBuilding'),
        numFloors: V('numFloors'),
        roofing: V('roofing'),
        flooring: V('flooring'),
        waterSource: V('waterSource'),
        landPrice: V('landPrice'),
        extent: V('extent'),
        syNo: V('syNo'),
        deedNo: V('deedNo'),
        deedDate: formatDate(V('deedDate')),
        deedSRO: V('deedSRO'),
        lsNo: V('lsNo'),
        lsDate: formatDate(V('lsDate')),
        ltrNo: V('ltrNo'),
        ltrDate: formatDate(V('ltrDate')),
        possessionNo: V('possessionNo'),
        possessionDate: formatDate(V('possessionDate')),
        btrNo: V('btrNo'),
        btrDate: formatDate(V('btrDate')),
        ecNo: V('ecNo'),
        ecDate: formatDate(V('ecDate')),
        routeText: V('routeText'),
        remarks: V('remarks'),
        fileReceivedOn: formatDate(V('fileReceivedOn')),
        reportSent: formatDate(V('reportSent')),
        reportSentTo: V('reportSentTo'),
        // File number for submit
        fileNo: `SIF-${Date.now()}`
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENERATE REPORT — Produces the exact text format requested
// ═══════════════════════════════════════════════════════════════════════════════
function showFinalReport() {
    const d = collectFormData();

    const report = `Bank Name : ${d.bankName}
Loan Type   : ${d.loanType}
Applicant Name :   ${d.applicantName}
Owner Name      : ${d.ownerName}
Occupied by   : ${d.occupiedBy}
Site shown by : ${d.siteShownBy}


Property Address : ${d.address}


Phone number : ${d.phoneNumber}


District          :  ${d.district}
Taluk              :  ${d.taluk}
Village           :  ${d.village}
Panchayat    :  ${d.panchayat}
Municipality : ${d.municipality}
Locality         : ${d.locality}
Ward             : ${d.ward}
Door no        : ${d.doorNo}

Location       : ${d.locationCoords}

Nearest landmark :  ${d.nearLandmark}
Nearest Branch     : ${d.nearBranch}
Distance from office :   ${d.distFromOffice}
Nearest Police Station :     ${d.nearPolice}
Nearest Railway Station : ${d.nearRailway}
Nearest Bus stop          :      ${d.nearBus}
Nearest Town      :  ${d.nearTown}
Nearest Hospital : ${d.nearHospital}
Nearby Land usage : ${d.nearbyLandUsage}

Access to site :  ${d.accessToSite}
Distance from Panchayat/PWD road : ${d.distFromRoad}
Condition of Road : ${d.conditionOfRoad}

Boundaries as per LS : 
NORTH  : ${d.lsNorth}
SOUTH  :  ${d.lsSouth}
EAST      :  ${d.lsEast}
WEST     :   ${d.lsWest}

Boundaries as per actual site  : 
NORTH  : ${d.actNorth}
SOUTH  :  ${d.actSouth}
EAST      : ${d.actEast}
WEST     :  ${d.actWest}

Demarcation : ${d.demarcationNote}
NORTH  : ${d.demNorth}
SOUTH  :  ${d.demSouth}
EAST      : ${d.demEast}
WEST     : ${d.demWest}

Building Details : 
Age :  ${d.buildingAge} years
Area of Building : ${d.areaOfBuilding}
Number of Floor : ${d.numFloors}
Roofing : ${d.roofing}
Flooring : ${d.flooring}
Water source : ${d.waterSource}

Land price : ${d.landPrice}

Extent   : ${d.extent}
SYNO    : ${d.syNo}

Documents given : 
Deed -               ${d.deedNo} Dated on : ${d.deedDate}       SRO : ${d.deedSRO}
LS -               ${d.lsNo} Dated on : ${d.lsDate}
LTR  -       ${d.ltrNo} Dated on : ${d.ltrDate}
Possession -              ${d.possessionNo} Dated on : ${d.possessionDate}
BTR -               ${d.btrNo} Dated on : ${d.btrDate}
EC -                ${d.ecNo} Dated on : ${d.ecDate}

Route :  ${d.routeText}


Remarks & comments : ${d.remarks}


File Recieved on: ${d.fileReceivedOn}
Report sent : ${d.reportSent}
Report sent to : ${d.reportSentTo}
`;

    const reportText = report;
    
    const textOutput = document.getElementById('finalReportText');
    if (textOutput) textOutput.value = reportText;
    
    const overlay = document.getElementById('reportOverlay');
    if (overlay) overlay.classList.add('active');
    
    // Support legacy element if still in DOM
    const output = G('reportOutput');
    if (output) {
        output.value = reportText;
    }
    return reportText;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SAVE DRAFT — Persists form state to localStorage for crash recovery
// Called by location.js (village autocomplete, GPS, distances, route, post office)
// ═══════════════════════════════════════════════════════════════════════════════
function saveDraft() {
    try {
        const data = collectFormData();
        localStorage.setItem('sif_draft', JSON.stringify(data));
    } catch (e) {
        console.warn('Draft save failed:', e);
    }
}

function loadDraft() {
    try {
        const raw = localStorage.getItem('sif_draft');
        if (!raw) return;
        const d = JSON.parse(raw);
        
        // Restore simple text/select fields
        const fieldMap = {
            bankName: 'bankName', applicantName: 'applicantName', ownerName: 'ownerName',
            siteShownBy: 'siteShownBy', phoneNumber: 'phoneNumber', address: 'address',
            district: 'district', taluk: 'taluk', locality: 'locality', ward: 'ward',
            doorNo: 'doorNo', locationCoords: 'locationCoords',
            nearLandmark: 'nearLandmark', nearBranch: 'nearBranch', distFromOffice: 'distFromOffice',
            nearPolice: 'nearPolice', nearRailway: 'nearRailway', nearBus: 'nearBus',
            nearTown: 'nearTown', nearHospital: 'nearHospital',
            accessToSite: 'accessToSite', distFromRoad: 'distFromRoad', conditionOfRoad: 'conditionOfRoad',
            lsNorth: 'lsNorth', lsSouth: 'lsSouth', lsEast: 'lsEast', lsWest: 'lsWest',
            actNorth: 'actNorth', actSouth: 'actSouth', actEast: 'actEast', actWest: 'actWest',
            demarcationNote: 'demarcationNote', demNorth: 'demNorth', demSouth: 'demSouth', demEast: 'demEast', demWest: 'demWest',
            buildingAge: 'buildingAge', areaOfBuilding: 'areaOfBuilding', numFloors: 'numFloors',
            flooring: 'flooring', waterSource: 'waterSource',
            landPrice: 'landPrice', extent: 'extent', syNo: 'syNo',
            deedNo: 'deedNo', deedSRO: 'deedSRO', lsNo: 'lsNo', ltrNo: 'ltrNo',
            possessionNo: 'possessionNo', btrNo: 'btrNo', ecNo: 'ecNo',
            remarks: 'remarks', reportSentTo: 'reportSentTo'
        };
        
        Object.entries(fieldMap).forEach(([key, id]) => {
            if (d[key] && G(id)) G(id).value = d[key];
        });
        
        // Restore autocomplete text inputs
        if (d.village && G('villageInput')) G('villageInput').value = d.village;
        if (d.panchayat && G('panchayatInput')) G('panchayatInput').value = d.panchayat;
        if (d.municipality && G('municipalityInput')) G('municipalityInput').value = d.municipality;
        if (d.routeText && G('routeText')) G('routeText').value = d.routeText;
        
        toast('📂 Draft restored', 2000);
    } catch (e) {
        console.warn('Draft load failed:', e);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COPY REPORT TO CLIPBOARD
// ═══════════════════════════════════════════════════════════════════════════════
async function copyReport() {
    const text = document.getElementById('finalReportText').value;
    try {
        await navigator.clipboard.writeText(text);
        toast("📋 Copied to Clipboard!");
    } catch (err) {
        // Fallback
        document.getElementById('finalReportText').select();
        document.execCommand('copy');
        toast("📋 Copied to Clipboard!");
    }
}

async function shareReport() {
    const text = document.getElementById('finalReportText').value;
    const appInput = document.getElementById('applicantName');
    const applicant = (appInput ? appInput.value : null) || 'Client';
    
    if (navigator.share) {
        try {
            await navigator.share({
                title: `Valuation: ${applicant}`,
                text: text
            });
        } catch (err) {
            console.log("Share cancelled or failed");
        }
    } else {
        toast("⚠️ Web Share not supported, please copy.");
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function openDashboard() {
    const overlay = G('dashboardOverlay');
    if (overlay) overlay.style.display = 'flex';
}
function closeDashboard() {
    const overlay = G('dashboardOverlay');
    if (overlay) overlay.style.display = 'none';
}

// --- BOOTSTRAP ---
window.addEventListener('load', () => {
    const token = localStorage.getItem('sif_session_token');
    const savedUrl = localStorage.getItem('sif_url');

    if (savedUrl && G('loginUrl')) G('loginUrl').value = savedUrl;
    if (savedUrl && G('gasUrl')) G('gasUrl').value = savedUrl;

    // Force bottom nav to show correctly on boot
    const bottomNav = document.getElementById('bottomNav');
    if (bottomNav) bottomNav.style.display = token ? 'flex' : 'none';

    if (!token) {
        G('loginOverlay').classList.add('active');
        G('inboxView').style.display = 'none';
        G('appContainer').style.display = 'none';
    } else {
        // Instantly load the Home UI (No awaiting!)
        if(typeof goHome === 'function') goHome();
    }

    // Hydrate form data and build navigation
    if (typeof hydrateForm === 'function') hydrateForm();
    if (typeof buildNav === 'function') buildNav();
    if (typeof setupLightboxTouch === 'function') setupLightboxTouch();
    if (typeof loadPhotosFromDB === 'function') {
        loadPhotosFromDB().then(() => {
            if (typeof renderGallery === 'function') renderGallery();
        });
    }
});
