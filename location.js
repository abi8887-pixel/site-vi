// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 3: LOCATION, GPS & MAPPING ENGINE
// Handles Maps, Reverse Geocoding, Postal APIs, and Overpass Distance calculations
// ═══════════════════════════════════════════════════════════════════════════════

// ── GLOBAL LOCATION STATE ──
let map, marker;
let _leafletLoaded = false;
let _lastReverseAddress = '';
let _secureGpsLock = 'GPS NOT LOCKED';

// ── 1. KERALA LOCATION DICTIONARIES ────────────────────────────────────────

const VD = {
    Changanassery: ["Changanassery", "Chethipuzha", "Kangazha", "Karukachal", "Kurichy", "Madappally", "Nedumkunnam", "Paippadu", "Thottakkadu", "Thrikkodithanam", "Vakathanam", "Vazhappally East", "Vazhappally West", "Vazhoor", "Vellavoor"],
    Kanjirappally: ["Cheruvally", "Chirakkadavu", "Edakkunnam", "Elamgulam", "Elikkulam", "Erumeli North", "Erumeli South", "Kanjirappally", "Koottickal", "Koovappally", "Koruthode", "Manimala", "Mundakayam"],
    Kottayam: ["Akalakunnam", "Anicadu", "Arpookara", "Athirampuzha", "Ayarkunnam", "Aymanam", "Chengalam East", "Chengalam South", "Ettumanoor", "Kaipuzha", "Kooroppada", "Kottayam", "Kumarakom", "Manarcadu", "Meenadom", "Muttambalam", "Nattakom", "Onamthuruthu", "Pampady", "Panachikkad", "Peroor", "Perumpaicadu", "Puthuppally", "Thiruvarppu", "Veloor", "Vijayapuram"],
    Meenachil: ["Bharananganam", "Elakkadu", "Kadanadu", "Kadaplamattom", "Kanakkary", "Kidangoor", "Kondoor", "Kuravilangadu", "Kurichithanam", "Lalam", "Meenachil", "Melukavu", "Monippally", "Moonnilavu", "Poonjar", "Poonjar Nadubhagam", "Poonjar Thekkekara", "Poovarany", "Puliyannoor", "Ramapuram", "Thalanadu", "Thalappalam", "Teekoy", "Uzhavoor", "Vallichira", "Veliyannoor", "Vellilappally"],
    Vaikom: ["Chempu", "Kaduthuruthy", "Kallara", "Kothanalloor", "Kulasekharamangalam", "Manjoor", "Mulakkulam", "Muttuchira", "Naduvila", "Njeezhoor", "T V Puram", "Thalayazham", "Udayanapuram", "Vadakkemuri", "Vadayar", "Vaikom", "Vechoor", "Velloor"]
};
const PD = {
    Changanassery: ["Kangazha", "Karukachal", "Kurichy", "Madappally", "Nedumkunnam", "Paippad", "Thottakkadu", "Thrikkodithanam", "Vakathanam", "Vazhappally", "Vazhoor", "Vellavoor"],
    Kanjirappally: ["Chirakkadavu", "Edakkunnam", "Elikkulam", "Erumeli", "Kanjirappally", "Koottickal", "Koruthode", "Manimala", "Mundakayam", "Parathodu"],
    Kottayam: ["Akalakunnam", "Arpookara", "Athirampuzha", "Ayarkunnam", "Aymanam", "Kaipuzha", "Kooroppada", "Kumarakom", "Manarcadu", "Meenadom", "Neendoor", "Pampady", "Panachikkad", "Puthuppally", "Thiruvarppu", "Vijayapuram"],
    Meenachil: ["Bharananganam", "Kadanadu", "Kadaplamattom", "Kanakkary", "Kidangoor", "Kozhuvanal", "Kuravilangadu", "Marangattupilly", "Melukavu", "Moonnilavu", "Mutholy", "Poonjar", "Poonjar Thekkekara", "Ramapuram", "Teekoy", "Thalanadu", "Thalappalam", "Uzhavoor", "Veliyannoor"],
    Vaikom: ["Chempu", "Kaduthuruthy", "Kallara", "Manjoor", "Maravanthuruthu", "Mulakkulam", "Njeezhoor", "T V Puram", "Thalayazham", "Udayanapuram", "Vechoor", "Velloor"]
};
const MD = {
    Changanassery: ["Changanassery Municipality"], Kanjirappally: [],
    Kottayam: ["Kottayam Municipality", "Ettumanoor Municipality"],
    Meenachil: ["Pala Municipality", "Erattupetta Municipality"],
    Vaikom: ["Vaikom Municipality"]
};

// ── 2. UPGRADED AUTOCOMPLETE LOGIC ─────────────────────────────────────────

// Smart Village Search (Auto-deduces Taluk)
let _villageDebounceTimer = null;
function globalVillageSearch(q) {
    clearTimeout(_villageDebounceTimer);
    _villageDebounceTimer = setTimeout(() => {
        const dd = G('acVillage');
        if (!dd) return;
        if (!q || q.length < 2) { dd.classList.remove('open'); return; }

        let allMatches = [];
        Object.keys(VD).forEach(talukName => {
            const matches = VD[talukName].filter(v => v.toLowerCase().includes(q.toLowerCase()));
            matches.forEach(match => allMatches.push({ village: match, taluk: talukName }));
        });

        if (allMatches.length > 0) {
            dd.innerHTML = allMatches.map(m => `
                <div class="ac-item" onmousedown="selectVillageAndTaluk('${m.village}', '${m.taluk}')">
                    <strong>${m.village}</strong> 
                    <span style="font-size:0.75rem; color:var(--text-2); float:right;">${m.taluk}</span>
                </div>
            `).join('');
            dd.classList.add('open');
        } else {
            dd.innerHTML = `<div class="ac-item" style="color:var(--text-2);">No matches found</div>`;
            dd.classList.add('open');
        }
    }, 300);
}

function selectVillageAndTaluk(villageName, talukName) {
    G('villageInput').value = villageName;
    G('acVillage').classList.remove('open');

    const talukDropdown = G('taluk');
    if (talukDropdown) {
        for (let i = 0; i < talukDropdown.options.length; i++) {
            if (talukDropdown.options[i].value === talukName) {
                talukDropdown.selectedIndex = i;
                break;
            }
        }
    }

    if (G('district')) G('district').value = "Kottayam";
    if (typeof saveDraft === 'function') saveDraft();
    toast(`📍 Auto-selected ${talukName} Taluk`, 2000);
}

// Standard Autocomplete for Panchayat/Municipality
function acShow(type, q) {
    const t = V('taluk');
    const dd = G('ac' + type.charAt(0).toUpperCase() + type.slice(1));
    if (!dd) return;
    if (!t || !q) { dd.classList.remove('open'); return; }

    const list = (type === 'panchayat' ? PD : MD)[t] || [];
    const matches = list.filter(x => x.toLowerCase().includes(q.toLowerCase()));

    if (matches.length > 0) {
        dd.innerHTML = matches.map(m => `<div class="ac-item" onmousedown="G('${type}Input').value='${m}'; G('ac${type.charAt(0).toUpperCase() + type.slice(1)}').classList.remove('open'); if(typeof saveDraft==='function') saveDraft();">${m}</div>`).join('');
        dd.classList.add('open');
    } else {
        dd.classList.remove('open');
    }
}

// Close dropdowns on outside click
document.addEventListener('mousedown', e => {
    if (!e.target.closest('.ac-wrap')) {
        document.querySelectorAll('.ac-dd').forEach(d => d.classList.remove('open'));
    }
});

function toggleLocalBody(active) {
    const panInput = G('panchayatInput');
    const munInput = G('municipalityInput');
    const panHint = G('panchayatHint');
    const munHint = G('municipalityHint');
    if (!panInput || !munInput) return;

    if (active === 'panchayat' && panInput.value.trim()) {
        munInput.value = ''; munInput.disabled = true; munInput.style.opacity = '0.4';
        munHint.textContent = '(locked — Panchayat selected)'; panHint.textContent = '';
        panInput.disabled = false; panInput.style.opacity = '1';
    } else if (active === 'municipality' && munInput.value.trim()) {
        panInput.value = ''; panInput.disabled = true; panInput.style.opacity = '0.4';
        panHint.textContent = '(locked — Municipality selected)'; munHint.textContent = '';
        munInput.disabled = false; munInput.style.opacity = '1';
    } else {
        panInput.disabled = false; panInput.style.opacity = '1'; panHint.textContent = '';
        munInput.disabled = false; munInput.style.opacity = '1'; munHint.textContent = '';
    }
}

// ── 3. POSTAL API LOGIC ────────────────────────────────────────────────────

let poTimer;
function searchPO(q) {
    clearTimeout(poTimer);
    if (q.length < 3) { G('acPostoffice').classList.remove('open'); return; }
    poTimer = setTimeout(async () => {
        try {
            const ep = /^\d+$/.test(q) ? 'pincode' : 'postoffice';
            const res = await fetch(`https://api.postalpincode.in/${ep}/${q}`);
            const data = await res.json();
            if (data && data[0].Status === 'Success') {
                G('acPostoffice').innerHTML = data[0].PostOffice.slice(0, 5).map(p =>
                    `<div class="ac-item" onmousedown="selectPostOffice('${p.Name}', '${p.Pincode}', '${p.Block || ''}')">
                        <strong>${p.Name}</strong> <span style="font-size:0.75rem; color:var(--text-2)">(${p.Pincode})</span>
                    </div>`
                ).join('');
                G('acPostoffice').classList.add('open');
            } else {
                G('acPostoffice').innerHTML = `<div class="ac-item" style="color:var(--text-2); cursor:default;">No results found</div>`;
                G('acPostoffice').classList.add('open');
            }
        } catch (e) { console.error("PO API Error:", e); }
    }, 500);
}

function selectPostOffice(name, pin, block) {
    G('postoffice').value = `${name} - ${pin}`;
    G('acPostoffice').classList.remove('open');

    const addr = G('address');
    const firstLine = addr.value.split('\n')[0] || '';
    addr.value = firstLine + '\n' + name + ' PO, ' + pin;

    if (typeof saveDraft === 'function') saveDraft();
    toast(`📬 Post Office added`, 2500);
}

// ── 4. MAP & GPS ENGINE (Leaflet) ──────────────────────────────────────────

function loadLeaflet() {
    return new Promise((resolve) => {
        if (_leafletLoaded) return resolve();
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => { _leafletLoaded = true; resolve(); };
        document.head.appendChild(script);
    });
}

async function initMap() {
    if (map) return;
    await loadLeaflet();
    map = L.map('mapPreview').setView([9.5916, 76.5222], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
    map.on('click', function (e) {
        placeMarker(e.latlng.lat, e.latlng.lng);
        G('locationCoords').value = `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`;
        if (typeof saveDraft === 'function') saveDraft();
        if (typeof updatePhotoGpsBar === 'function') updatePhotoGpsBar();
    });
}

function placeMarker(lat, lng) {
    if (marker) map.removeLayer(marker);
    marker = L.marker([lat, lng]).addTo(map);
    map.setView([lat, lng], 15);
}

function updateMapFromInput() {
    const rawValue = V('locationCoords');
    if (!rawValue || rawValue === 'GPS NOT LOCKED') return;

    const parts = rawValue.split(',');
    if (parts.length === 2) {
        const lat = parseFloat(parts[0].trim());
        const lng = parseFloat(parts[1].trim());

        if (!isNaN(lat) && !isNaN(lng)) {
            initMap().then(() => {
                placeMarker(lat, lng);
                G('mapPreview').style.display = 'block';
            });
            if (typeof saveDraft === 'function') saveDraft();
        }
    }
}

function getShortAddr() {
    if (!navigator.geolocation) return toast('❌ GPS unavailable');
    toast('📍 Locating…');
    const btn = event.target;
    btn.innerHTML = '<span class="spinner"></span>'; btn.disabled = true;

    navigator.geolocation.getCurrentPosition(async pos => {
        const lat = pos.coords.latitude; const lng = pos.coords.longitude;
        const secureCoords = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

        _secureGpsLock = secureCoords;
        G('locationCoords').value = secureCoords;

        initMap().then(() => { placeMarker(lat, lng); });
        if (typeof saveDraft === 'function') saveDraft();
        if (typeof updatePhotoGpsBar === 'function') updatePhotoGpsBar();

        toast('✅ Location locked! Fetching address…');
        btn.innerHTML = '📍 Auto GPS'; btn.disabled = false;

        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
            const data = await res.json();
            if (data && data.address) {
                const a = data.address;
                if (!V('address')) G('address').value = data.display_name?.split(',').slice(0, 3).join(', ') || '';
                if (!V('locality')) G('locality').value = a.suburb || a.neighbourhood || a.hamlet || '';
                if (!V('ward')) G('ward').value = a.county_district || '';
                toast('📝 Address auto-filled', 4000);
                _lastReverseAddress = data.display_name?.split(',').slice(0, 4).join(', ') || secureCoords;
            }
        } catch (e) { }
    }, () => {
        toast('❌ GPS Failed. Please enter coordinates manually.', 6000);
        const coords = G('locationCoords');
        if (coords) {
            coords.focus();
            coords.placeholder = 'Lat, Lng e.g. 9.5916, 76.5222';
            if (coords.value === 'GPS NOT LOCKED') coords.value = '';
        }
        btn.innerHTML = '📍 Auto GPS'; btn.disabled = false;
    },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 });
}

// ── 5. DISTANCE & ROUTE GENERATORS (Overpass & OSRM) ───────────────────────

function haversineDist(lat1, lon1, lat2, lon2) {
    const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function autoCalcDistances() {
    const coords = V('locationCoords');
    if (!coords || coords === 'GPS NOT LOCKED') {
        if (typeof goTo === 'function') goTo(3);
        return toast('⚠ Please get GPS location first!');
    }

    const [lat, lng] = coords.split(',').map(n => parseFloat(n.trim()));
    const btn = G('btnCalcDist');
    btn.innerHTML = '<span class="spinner"></span> Scanning…'; btn.disabled = true;

    toast('📡 Scanning 25km radius (Searching servers)…', 4000);

    const query = `[out:json][timeout:25];(node["amenity"="police"](around:15000,${lat},${lng});node["amenity"="hospital"](around:15000,${lat},${lng});node["railway"="station"](around:25000,${lat},${lng});node["amenity"="bus_station"](around:15000,${lat},${lng});node["place"~"town|city"](around:20000,${lat},${lng}););out center;`;

    const endpoints = [
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
        'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
    ];

    let success = false;

    for (const endpoint of endpoints) {
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'data=' + encodeURIComponent(query)
            });

            if (!res.ok) continue;

            const data = await res.json();
            const findClosest = (key, regex) => {
                let closest = null, minDist = Infinity;
                data.elements.forEach(e => {
                    if (e.tags?.[key]?.match(regex) && e.tags.name) {
                        const d = haversineDist(lat, lng, e.lat, e.lon);
                        if (d < minDist) { minDist = d; closest = `${e.tags.name} (${d.toFixed(1)} km)`; }
                    }
                });
                return closest;
            };

            const police = findClosest('amenity', /police/);
            const hospital = findClosest('amenity', /hospital/);
            const railway = findClosest('railway', /station/);
            const bus = findClosest('amenity', /bus_station/);
            const town = findClosest('place', /town|city/);

            if (police) G('nearPolice').value = police;
            if (hospital) G('nearHospital').value = hospital;
            if (railway) G('nearRailway').value = railway;
            if (bus) G('nearBus').value = bus;
            if (town) G('nearTown').value = town;

            if (typeof saveDraft === 'function') saveDraft();
            toast('✅ Distances filled!');
            success = true;
            break;

        } catch (e) {
            console.warn(`Overpass mirror failed: ${endpoint}`);
        }
    }

    if (!success) toast('❌ API error. All global servers are currently busy.');

    btn.innerHTML = '📡 Auto-Fill'; btn.disabled = false;
}

async function autoGenerateRoute() {
    const start = V('routeStartPoint'); const coords = V('locationCoords');
    if (!start) return toast('⚠ Please enter a start point.');
    if (!coords || coords === 'GPS NOT LOCKED') return toast('⚠ Please get GPS coordinates first (Step 3).');

    const [lat, lng] = coords.split(',').map(n => parseFloat(n.trim()));
    const btn = G('btnAutoRoute'); btn.innerHTML = '<span class="spinner"></span>'; btn.disabled = true;

    toast('🚗 Generating route…', 3000);
    try {
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(start)}`);
        const geoData = await geoRes.json();
        if (!geoData.length) { toast('❌ Start location not found.'); btn.innerHTML = '🚗 Auto-Route'; btn.disabled = false; return; }

        const sLat = parseFloat(geoData[0].lat), sLon = parseFloat(geoData[0].lon);
        const routeRes = await fetch(`https://router.project-osrm.org/route/v1/driving/${sLon},${sLat};${lng},${lat}?overview=false`);
        const routeData = await routeRes.json();

        if (routeData.code !== 'Ok') throw new Error('Route error');

        const distKm = (routeData.routes[0].distance / 1000).toFixed(1);
        const timeMin = Math.round(routeData.routes[0].duration / 60);
        G('routeText').value = `${start} → Site (GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)})\nTotal Distance: ${distKm} km | Est. Time: ~${timeMin} min`;

        if (typeof saveDraft === 'function') saveDraft();
        toast('✅ Route summary generated!');
    } catch (e) {
        toast('❌ Could not generate route.');
    } finally {
        btn.innerHTML = '🚗 Auto-Route'; btn.disabled = false;
    }
}
