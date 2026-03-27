// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 5: MAIN APP BOOTSTRAP & STATE MANAGER
// Initializes the app, handles event listeners, auto-saving, and network status
// ═══════════════════════════════════════════════════════════════════════════════
// Global State
let currentAssignedCaseId = null;

// Utility for selecting elements
const G = (id) => document.getElementById(id);
const V = (id) => G(id) ? (G(id).value || '') : '';

// --- NAVIGATION ROUTING ---
function goHome() {
    G('appContainer').style.display = 'none';
    G('inboxView').style.display = 'flex';
    G('loginOverlay').classList.remove('active');
    
    if (typeof fetchInbox === 'function') fetchInbox();
}

function startNewBlankReport() {
    currentAssignedCaseId = null;
    G('inboxView').style.display = 'none';
    G('appContainer').style.display = 'block';
    
    if (typeof resetApp === 'function') resetApp();
}

function logoutAgent() {
    localStorage.removeItem('sif_session_token');
    location.reload();
}

// --- LOGIN LOGIC ---
async function handleLogin() {
    const id = V('loginId');
    const pass = V('loginPass');
    const url = V('loginUrl');

    if (!id || !pass || !url) {
        toast('⚠️ All fields are required.');
        return;
    }

    const btn = G('btnLogin');
    const originalText = btn.innerText;
    btn.innerHTML = '<span class="spinner"></span> Authenticating...';
    btn.disabled = true;

    localStorage.setItem('sif_url', url);

    try {
        const success = await loginAgent(id, pass);
        if (success) {
            goHome();
        } else {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    } catch (err) {
        console.error(err);
        btn.innerText = originalText;
        btn.disabled = false;
        toast('❌ Connection Failed');
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
function generateReport() {
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
SOUTH  : ${d.demSouth}
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

    const output = G('reportOutput');
    if (output) {
        output.value = report;
        toast('📄 Report generated!');
    }
    return report;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COPY REPORT TO CLIPBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function copyReport() {
    const output = G('reportOutput');
    if (!output || !output.value) {
        generateReport();
    }
    navigator.clipboard.writeText(G('reportOutput').value).then(() => {
        toast('📋 Report copied to clipboard!');
    }).catch(() => {
        // Fallback
        G('reportOutput').select();
        document.execCommand('copy');
        toast('📋 Copied!');
    });
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

    if (!token) {
        G('loginOverlay').classList.add('active');
        G('inboxView').style.display = 'none';
        G('appContainer').style.display = 'none';
    } else {
        goHome();
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