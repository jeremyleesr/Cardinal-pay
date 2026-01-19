// === GLOBAL VARIABLES ===
let trucks = [];
let currentEditingTruckId = null;
let selectedTruckType = null;
let selectedSleeperStatus = null;
let selectedLocalStatus = null;
let selectedDistanceStatus = null;

let currentTruckFilter = 'all';
let currentSearchText = '';

const rates = {
    miles: [
        { max: 50, rate: 1.415 },
        { max: 100, rate: 1.080 },
        { max: 200, rate: 0.87 },
        { max: 300, rate: 0.72 },
        { max: 400, rate: 0.69 },
        { max: Infinity, rate: 0.67 }
    ],
    stop: 25.50,
    backhaul: 29.50,
    detention: 26.50,
    yard: 26.50,
    perDiem: 50.00,
    yardBonus: 75.00
};

let savedBackhauls = [
    { id: 1, storeNumber: 'A123', storeName: 'Walmart DC Portland', pay: 29.50, notes: 'Regular pickup route. Dock on east side.' },
    { id: 2, storeNumber: 'B045', storeName: 'Target Distribution', pay: 29.50, notes: 'Tire pressure: 110 PSI. Road temp < 40°F. Use dock 3-5.' },
    { id: 3, storeNumber: 'DC12', storeName: 'Amazon Fulfillment', pay: 29.50, notes: 'Check in at gate. Special documentation required for hazmat.' }
];

let currentRouteNum = 1;
let todaysRoutes = [];
let detentionCounter = 0;
let yardCounter = 0;
let otherCounter = 0;
let currentEditingStoreId = null;

// === INITIALIZATION ===
window.onload = () => {
    const saved = localStorage.getItem('trucker_daily_data');
    if (saved) {
        const data = JSON.parse(saved);
        todaysRoutes = data.routes || [];
        currentRouteNum = data.currentRouteNum || 1;
        updateUI();
    }
    
    const savedStores = localStorage.getItem('trucker_backhauls');
    if (savedStores) {
        savedBackhauls = JSON.parse(savedStores);
    } else {
        saveBackhaulsData();
    }
    
    document.getElementById('shiftDate').valueAsDate = new Date();
    updateWeeklyTotals();
};

// === PAGE NAVIGATION ===
function showDashboard() {
    document.getElementById('trucksPage').classList.add('hidden');
    document.getElementById('settingsPage').classList.add('hidden');
    document.querySelector('.container').classList.remove('hidden');
    document.querySelector('.action-container').classList.remove('hidden');
    document.querySelectorAll('.nav-button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.nav-button')[0].classList.add('active');
}

function showTrucksPage() {
    document.querySelector('.container').classList.add('hidden');
    document.querySelector('.action-container').classList.add('hidden');
    document.getElementById('settingsPage').classList.add('hidden');
    document.getElementById('trucksPage').classList.remove('hidden');
    document.querySelectorAll('.nav-button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.nav-button')[2].classList.add('active');
    loadTrucks();
    displayTrucks();
}

function showSettingsPage() {
    document.querySelector('.container').classList.add('hidden');
    document.querySelector('.action-container').classList.add('hidden');
    document.getElementById('trucksPage').classList.add('hidden');
    document.getElementById('settingsPage').classList.remove('hidden');
    document.querySelectorAll('.nav-button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.nav-button')[3].classList.add('active');
}

// === CALCULATION FUNCTIONS ===
function calculateMileagePay(miles) {
    if (!miles || miles <= 0) return 0;
    for (let bracket of rates.miles) {
        if (miles <= bracket.max) return miles * bracket.rate;
    }
    return miles * rates.miles[rates.miles.length - 1].rate;
}

function calculateTimeDifference(start, end) {
    if (!start || !end) return 0;
    
    start = start.trim().replace(/[^\d:]/g, '');
    end = end.trim().replace(/[^\d:]/g, '');
    
    let startParts = start.includes(':') ? start.split(':') : [start.slice(0, 2), start.slice(2)];
    let endParts = end.includes(':') ? end.split(':') : [end.slice(0, 2), end.slice(2)];
    
    const startHour = parseInt(startParts[0]) || 0;
    const startMin = parseInt(startParts[1]) || 0;
    const endHour = parseInt(endParts[0]) || 0;
    const endMin = parseInt(endParts[1]) || 0;
    
    if (startHour > 23 || endHour > 23 || startMin > 59 || endMin > 59) return 0;
    
    let startMinutes = startHour * 60 + startMin;
    let endMinutes = endHour * 60 + endMin;
    
    if (endMinutes < startMinutes) endMinutes += 24 * 60;
    
    return endMinutes - startMinutes;
}

function formatTimeDisplay(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, '0')} (${minutes} min)`;
}

// === EVENT LISTENERS ===
document.getElementById('miles').addEventListener('input', function() {
    const miles = parseFloat(this.value) || 0;
    const pay = calculateMileagePay(miles);
    document.getElementById('milesCalc').textContent = `$${pay.toFixed(2)}`;
    updateRouteTotal();
});

document.getElementById('stops').addEventListener('input', function() {
    const stops = parseFloat(this.value) || 0;
    const pay = stops * rates.stop;
    document.getElementById('stopsCalc').textContent = `$${pay.toFixed(2)}`;
    updateRouteTotal();
});

// === BACKHAUL FUNCTIONS ===
function saveBackhaulsData() {
    localStorage.setItem('trucker_backhauls', JSON.stringify(savedBackhauls));
}

function openBackhaulModal() {
    const modal = document.getElementById('backhaulModal');
    const list = document.getElementById('backhaulList');
    
    const sorted = [...savedBackhauls].sort((a, b) => a.storeNumber.localeCompare(b.storeNumber));
    
    list.innerHTML = sorted.map(b => `
        <div class="backhaul-select-row">
            <div class="backhaul-select-main" onclick="selectBackhaul(${b.id})">
                <div class="backhaul-store-number">#${b.storeNumber}</div>
                <div class="backhaul-store-name">${b.storeName}</div>
            </div>
            <button class="backhaul-info-button" onclick="event.stopPropagation(); viewStoreNotes(${b.id})">ⓘ</button>
        </div>
    `).join('');
    
    modal.classList.add('active');
}

function closeBackhaulModal() {
    document.getElementById('backhaulModal').classList.remove('active');
}

function selectBackhaul(id) {
    const backhaul = savedBackhauls.find(b => b.id === id);
    const container = document.getElementById('backhaulsContainer');
    
    const div = document.createElement('div');
    div.className = 'line-item';
    div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="font-weight: 600;">#${backhaul.storeNumber} - ${backhaul.storeName}</div>
            <div style="display: flex; gap: 10px; align-items: center;">
                <button class="backhaul-info-button" style="width: 32px; height: 32px; font-size: 16px;" onclick="viewStoreNotes(${backhaul.id})">ⓘ</button>
                <div style="color: #667eea; font-weight: 600;">$${backhaul.pay.toFixed(2)}</div>
            </div>
        </div>
        <button class="remove-button" onclick="this.parentElement.remove(); updateRouteTotal()">Remove</button>
    `;
    
    container.appendChild(div);
    closeBackhaulModal();
    updateRouteTotal();
}

function openAddStoreForm() {
    closeBackhaulModal();
    document.getElementById('newStoreNumber').value = '';
    document.getElementById('newStoreName').value = '';
    document.getElementById('newStoreNotes').value = '';
    document.getElementById('addStoreModal').classList.add('active');
}

function closeAddStoreForm() {
    document.getElementById('addStoreModal').classList.remove('active');
}

function saveNewStore() {
    const storeNumber = document.getElementById('newStoreNumber').value.trim();
    const storeName = document.getElementById('newStoreName').value.trim();
    const notes = document.getElementById('newStoreNotes').value.trim();
    
    if (!storeNumber || !storeName) {
        alert('Please enter both store number and store name');
        return;
    }
    
    const newBackhaul = {
        id: savedBackhauls.length > 0 ? Math.max(...savedBackhauls.map(b => b.id)) + 1 : 1,
        storeNumber: storeNumber,
        storeName: storeName,
        pay: rates.backhaul,
        notes: notes || ''
    };
    
    savedBackhauls.push(newBackhaul);
    saveBackhaulsData();
    closeAddStoreForm();
    alert('Store saved!');
    openBackhaulModal();
}

function viewStoreNotes(id) {
    const backhaul = savedBackhauls.find(b => b.id === id);
    currentEditingStoreId = id;
    
    document.getElementById('notesModalTitle').textContent = backhaul.storeName;
    document.getElementById('notesStoreNumber').textContent = `#${backhaul.storeNumber}`;
    document.getElementById('editStoreNotes').value = backhaul.notes || '';
    
    closeBackhaulModal();
    document.getElementById('notesModal').classList.add('active');
}

function closeNotesModal() {
    document.getElementById('notesModal').classList.remove('active');
    currentEditingStoreId = null;
}

function saveEditedNotes() {
    if (currentEditingStoreId) {
        const backhaul = savedBackhauls.find(b => b.id === currentEditingStoreId);
        if (backhaul) {
            backhaul.notes = document.getElementById('editStoreNotes').value.trim();
            saveBackhaulsData();
            alert('Notes saved!');
            closeNotesModal();
        }
    }
}

// === DETENTION FUNCTIONS ===
function addDetention() {
    const id = detentionCounter++;
    const container = document.getElementById('detentionContainer');
    const div = document.createElement('div');
    div.className = 'line-item';
    div.id = `detention-${id}`;
    div.innerHTML = `
        <div class="time-inputs">
            <div>
                <label style="font-size: 13px; color: #666; margin-bottom: 5px; display: block;">Start (24hr)</label>
                <input type="text" class="detention-start" placeholder="23:30" maxlength="5" oninput="updateDetention(${id})" onchange="updateDetention(${id})">
            </div>
            <span style="color: #666;">→</span>
            <div>
                <label style="font-size: 13px; color: #666; margin-bottom: 5px; display: block;">End (24hr)</label>
                <input type="text" class="detention-end" placeholder="02:00" maxlength="5" oninput="updateDetention(${id})" onchange="updateDetention(${id})">
            </div>
        </div>
        <div class="checkbox-group">
            <input type="checkbox" id="detention-deduct-${id}" class="detention-deduct" onchange="updateDetention(${id})">
            <label for="detention-deduct-${id}">Deduct 60 min</label>
        </div>
        <div class="calculated-display">
            <div class="time-breakdown" id="detention-time-${id}">Enter times above</div>
            <div class="pay-amount" id="detention-calc-${id}">$0.00</div>
        </div>
        <button class="remove-button" onclick="removeItem('detention-${id}')">Remove</button>
    `;
    container.appendChild(div);
}

function updateDetention(id) {
    const item = document.getElementById(`detention-${id}`);
    if (!item) return;
    
    const start = item.querySelector('.detention-start').value;
    const end = item.querySelector('.detention-end').value;
    const deduct = item.querySelector('.detention-deduct').checked;
    
    const minutes = calculateTimeDifference(start, end);
    
    if (minutes > 0) {
        const adjustedMinutes = deduct ? Math.max(0, minutes - 60) : minutes;
        const hours = adjustedMinutes / 60;
        const pay = hours * rates.detention;
        
        document.getElementById(`detention-time-${id}`).textContent = formatTimeDisplay(minutes);
        document.getElementById(`detention-calc-${id}`).textContent = `$${pay.toFixed(2)}`;
    } else {
        document.getElementById(`detention-time-${id}`).textContent = 'Enter times above';
        document.getElementById(`detention-calc-${id}`).textContent = '$0.00';
    }
    
    updateRouteTotal();
}

// === YARD FUNCTIONS ===
function addYard() {
    const id = yardCounter++;
    const container = document.getElementById('yardContainer');
    const div = document.createElement('div');
    div.className = 'line-item';
    div.id = `yard-${id}`;
    div.innerHTML = `
        <div class="time-inputs">
            <div>
                <label style="font-size: 13px; color: #666; margin-bottom: 5px; display: block;">Start (24hr)</label>
                <input type="text" class="yard-start" placeholder="06:00" maxlength="5" oninput="updateYard(${id})" onchange="updateYard(${id})">
            </div>
            <span style="color: #666;">→</span>
            <div>
                <label style="font-size: 13px; color: #666; margin-bottom: 5px; display: block;">End (24hr)</label>
                <input type="text" class="yard-end" placeholder="14:30" maxlength="5" oninput="updateYard(${id})" onchange="updateYard(${id})">
            </div>
        </div>
        <div class="checkbox-group">
            <input type="checkbox" id="yard-deduct-${id}" class="yard-deduct" onchange="updateYard(${id})">
            <label for="yard-deduct-${id}">Deduct 0.5 hour for lunch</label>
        </div>
        <div class="calculated-display">
            <div class="time-breakdown" id="yard-time-${id}">Enter times above</div>
            <div class="pay-amount" id="yard-calc-${id}">$0.00</div>
        </div>
        <button class="remove-button" onclick="removeItem('yard-${id}')">Remove</button>
    `;
    container.appendChild(div);
}

function updateYard(id) {
    const item = document.getElementById(`yard-${id}`);
    if (!item) return;
    
    const start = item.querySelector('.yard-start').value;
    const end = item.querySelector('.yard-end').value;
    const deduct = item.querySelector('.yard-deduct').checked;
    
    const minutes = calculateTimeDifference(start, end);
    
    if (minutes > 0) {
        const hours = minutes / 60;
        const adjustedHours = deduct ? Math.max(0, hours - 0.5) : hours;
        let pay = adjustedHours * rates.yard;
        
        let bonusText = '';
        if (hours >= 9) {
            pay += rates.yardBonus;
            bonusText = '<span class="bonus-badge">+$75 Bonus!</span>';
        }
        
        const hoursDisplay = `${Math.floor(hours)}:${Math.round((hours % 1) * 60).toString().padStart(2, '0')}`;
        const adjustedDisplay = `${Math.floor(adjustedHours)}:${Math.round((adjustedHours % 1) * 60).toString().padStart(2, '0')}`;
        
        if (deduct && hours !== adjustedHours) {
            document.getElementById(`yard-time-${id}`).textContent = 
                `${hoursDisplay} worked (${adjustedDisplay} paid = ${adjustedHours.toFixed(2)} hrs)`;
        } else {
            document.getElementById(`yard-time-${id}`).textContent = 
                `${hoursDisplay} (${hours.toFixed(2)} hrs)`;
        }
        
        document.getElementById(`yard-calc-${id}`).innerHTML = `$${pay.toFixed(2)} ${bonusText}`;
    } else {
        document.getElementById(`yard-time-${id}`).textContent = 'Enter times above';
        document.getElementById(`yard-calc-${id}`).innerHTML = '$0.00';
    }
    
    updateRouteTotal();
}

// === OTHER FUNCTIONS ===
function addOther() {
    const id = otherCounter++;
    const container = document.getElementById('otherContainer');
    const div = document.createElement('div');
    div.className = 'line-item';
    div.id = `other-${id}`;
    div.innerHTML = `
        <div style="margin-bottom: 10px;">
            <label style="font-size: 13px; color: #666; margin-bottom: 5px; display: block;">Description</label>
            <input type="text" class="other-desc" placeholder="e.g., Vacation Pay, Bonus">
        </div>
        <div>
            <label style="font-size: 13px; color: #666; margin-bottom: 5px; display: block;">Amount</label>
            <input type="number" class="other-amount" placeholder="0.00" step="0.01" onchange="updateRouteTotal()">
        </div>
        <button class="remove-button" onclick="removeItem('other-${id}')">Remove</button>
    `;
    container.appendChild(div);
}

function removeItem(id) {
    const element = document.getElementById(id);
    if (element) {
        element.remove();
        updateRouteTotal();
    }
}

// === UPDATE ROUTE TOTAL ===
function updateRouteTotal() {
    let total = 0;
    
    const miles = parseFloat(document.getElementById('miles').value) || 0;
    total += calculateMileagePay(miles);
    
    const stops = parseFloat(document.getElementById('stops').value) || 0;
    total += stops * rates.stop;
    
    const backhaulItems = document.querySelectorAll('#backhaulsContainer .line-item');
    total += backhaulItems.length * rates.backhaul;
    
    for (let i = 0; i < detentionCounter; i++) {
        const calcEl = document.getElementById(`detention-calc-${i}`);
        if (calcEl && calcEl.textContent) {
            const pay = parseFloat(calcEl.textContent.replace(/[^0-9.]/g, '')) || 0;
            total += pay;
        }
    }
    
    for (let i = 0; i < yardCounter; i++) {
        const calcEl = document.getElementById(`yard-calc-${i}`);
        if (calcEl && calcEl.textContent) {
            const pay = parseFloat(calcEl.textContent.replace(/[^0-9.]/g, '')) || 0;
            total += pay;
        }
    }
    
    if (document.getElementById('perDiem').checked) {
        total += rates.perDiem;
    }
    
    document.querySelectorAll('.other-amount').forEach(input => {
        const amount = parseFloat(input.value) || 0;
        total += amount;
    });
    
    document.getElementById('routeTotal').textContent = `$${total.toFixed(2)}`;
    persistData();
}

// === SAVE ROUTE ===
function saveRoute() {
    const total = parseFloat(document.getElementById('routeTotal').textContent.replace('$', ''));
    
    const routeData = {
        id: currentRouteNum,
        total: total,
        date: document.getElementById('shiftDate').value,
        miles: parseFloat(document.getElementById('miles').value) || 0,
        stops: parseFloat(document.getElementById('stops').value) || 0,
        perDiem: document.getElementById('perDiem').checked,
        backhauls: Array.from(document.querySelectorAll('#backhaulsContainer .line-item')).map(item => {
            return { html: item.innerHTML };
        }),
        detention: [],
        yard: [],
        other: []
    };
    
    for (let i = 0; i < detentionCounter; i++) {
        const item = document.getElementById(`detention-${i}`);
        if (item) {
            routeData.detention.push({
                start: item.querySelector('.detention-start')?.value || '',
                end: item.querySelector('.detention-end')?.value || '',
                deduct: item.querySelector('.detention-deduct')?.checked || false
            });
        }
    }
    
    for (let i = 0; i < yardCounter; i++) {
        const item = document.getElementById(`yard-${i}`);
        if (item) {
            routeData.yard.push({
                start: item.querySelector('.yard-start')?.value || '',
                end: item.querySelector('.yard-end')?.value || '',
                deduct: item.querySelector('.yard-deduct')?.checked || false
            });
        }
    }
    
    for (let i = 0; i < otherCounter; i++) {
        const item = document.getElementById(`other-${i}`);
        if (item) {
            routeData.other.push({
                desc: item.querySelector('.other-desc')?.value || '',
                amount: parseFloat(item.querySelector('.other-amount')?.value) || 0
            });
        }
    }

    todaysRoutes = todaysRoutes.filter(r => r.id !== currentRouteNum);
    todaysRoutes.push(routeData);
    
    persistData();
    updateUI();
    alert(`Route #${currentRouteNum} saved! You can continue editing or start a new route.`);
}

// === START NEW ROUTE ===
function startNewRoute() {
    currentRouteNum++;
    document.getElementById('routeNumberDisplay').textContent = `Route #${currentRouteNum}`;
    
    document.getElementById('miles').value = '';
    document.getElementById('stops').value = '';
    document.getElementById('perDiem').checked = false;
    document.getElementById('backhaulsContainer').innerHTML = '';
    document.getElementById('detentionContainer').innerHTML = '';
    document.getElementById('yardContainer').innerHTML = '';
    document.getElementById('otherContainer').innerHTML = '';
    
    detentionCounter = 0;
    yardCounter = 0;
    otherCounter = 0;
    
    updateRouteTotal();
    persistData();
}

// === END DAY ===
function endDay() {
    if (confirm("Finalize day? This will save today's routes and start fresh for tomorrow.")) {
        const today = document.getElementById('shiftDate').value;
        const dailyHistory = JSON.parse(localStorage.getItem('trucker_history') || '{}');
        
        dailyHistory[today] = {
            routes: todaysRoutes,
            total: todaysRoutes.reduce((sum, r) => sum + r.total, 0),
            date: today
        };
        
        localStorage.setItem('trucker_history', JSON.stringify(dailyHistory));
        localStorage.removeItem('trucker_daily_data');
        
        todaysRoutes = [];
        currentRouteNum = 1;
        
        const nextDate = new Date(today);
        nextDate.setDate(nextDate.getDate() + 1);
        document.getElementById('shiftDate').valueAsDate = nextDate;
        
        document.getElementById('miles').value = '';
        document.getElementById('stops').value = '';
        document.getElementById('perDiem').checked = false;
        document.getElementById('backhaulsContainer').innerHTML = '';
        document.getElementById('detentionContainer').innerHTML = '';
        document.getElementById('yardContainer').innerHTML = '';
        document.getElementById('otherContainer').innerHTML = '';
        
        detentionCounter = 0;
        yardCounter = 0;
        otherCounter = 0;
        
        updateUI();
        updateWeeklyTotals();
        
        alert('Day finalized! Ready for next shift.');
    }
}

// === WEEKLY TOTALS ===
function updateWeeklyTotals() {
    const history = JSON.parse(localStorage.getItem('trucker_history') || '{}');
    const today = new Date();
    
    const dayOfWeek = today.getDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - daysFromMonday);
    currentWeekStart.setHours(0, 0, 0, 0);
    
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
    currentWeekEnd.setHours(23, 59, 59, 999);
    
    const lastWeekStart = new Date(currentWeekStart);
    lastWeekStart.setDate(currentWeekStart.getDate() - 7);
    
    const lastWeekEnd = new Date(currentWeekEnd);
    lastWeekEnd.setDate(currentWeekEnd.getDate() - 7);
    
    let thisWeekTotal = 0;
    let lastWeekTotal = 0;
    
    Object.keys(history).forEach(dateStr => {
        const date = new Date(dateStr);
        
        if (date >= currentWeekStart && date <= currentWeekEnd) {
            thisWeekTotal += history[dateStr].total || 0;
        }
        
        if (date >= lastWeekStart && date <= lastWeekEnd) {
            lastWeekTotal += history[dateStr].total || 0;
        }
    });
    
    thisWeekTotal += todaysRoutes.reduce((sum, r) => sum + r.total, 0);
    
    document.getElementById('thisWeekTotal').textContent = `$${thisWeekTotal.toFixed(2)}`;
    
    const summaryDiv = document.querySelector('.week-totals');
    const lastWeekSpan = summaryDiv.querySelector('div:first-of-type span:last-child');
    if (lastWeekSpan) {
        lastWeekSpan.textContent = `$${lastWeekTotal.toFixed(2)}`;
    }
}

// === PERSIST DATA ===
function persistData() {
    localStorage.setItem('trucker_daily_data', JSON.stringify({
        routes: todaysRoutes,
        currentRouteNum: currentRouteNum
    }));
    updateWeeklyTotals();
}

// === UPDATE UI ===
function updateUI() {
    document.getElementById('routeNumberDisplay').textContent = `Route #${currentRouteNum}`;
    
    let dayTotal = 0;
    const list = document.getElementById('savedRoutesList');
    list.innerHTML = '';
    
    todaysRoutes.forEach(r => {
        dayTotal += r.total;
        const btn = document.createElement('div');
        btn.className = 'route-button';
        btn.textContent = `Route #${r.id}: $${r.total.toFixed(2)}`;
        btn.onclick = () => loadRouteForEdit(r.id);
        btn.style.cursor = 'pointer';
        list.appendChild(btn);
    });

    document.getElementById('dailyTotal').textContent = `$${dayTotal.toFixed(2)}`;
    document.getElementById('routeCount').textContent = 
        todaysRoutes.length === 0 ? 'No routes saved today' :
        todaysRoutes.length === 1 ? '1 route saved' :
        `${todaysRoutes.length} routes saved`;
    
    if (todaysRoutes.length > 0) {
        document.getElementById('savedRoutesDisplay').classList.remove('hidden');
    }
}

// === LOAD ROUTE FOR EDIT ===
function loadRouteForEdit(routeId) {
    const route = todaysRoutes.find(r => r.id === routeId);
    if (!route) {
        alert('Route not found');
        return;
    }
    
    currentRouteNum = routeId;
    document.getElementById('routeNumberDisplay').textContent = `Route #${currentRouteNum}`;
    
    document.getElementById('miles').value = '';
    document.getElementById('stops').value = '';
    document.getElementById('perDiem').checked = false;
    document.getElementById('backhaulsContainer').innerHTML = '';
    document.getElementById('detentionContainer').innerHTML = '';
    document.getElementById('yardContainer').innerHTML = '';
    document.getElementById('otherContainer').innerHTML = '';
    
    document.getElementById('shiftDate').value = route.date;
    document.getElementById('miles').value = route.miles || '';
    document.getElementById('stops').value = route.stops || '';
    document.getElementById('perDiem').checked = route.perDiem || false;
    
    if (route.backhauls) {
        route.backhauls.forEach(b => {
            const div = document.createElement('div');
            div.className = 'line-item';
            div.innerHTML = b.html;
            document.getElementById('backhaulsContainer').appendChild(div);
        });
    }
    
    detentionCounter = 0;
    if (route.detention) {
        route.detention.forEach(d => {
            addDetention();
            const id = detentionCounter - 1;
            const item = document.getElementById(`detention-${id}`);
            if (item) {
                item.querySelector('.detention-start').value = d.start;
                item.querySelector('.detention-end').value = d.end;
                item.querySelector('.detention-deduct').checked = d.deduct;
                updateDetention(id);
            }
        });
    }
    
    yardCounter = 0;
    if (route.yard) {
        route.yard.forEach(y => {
            addYard();
            const id = yardCounter - 1;
            const item = document.getElementById(`yard-${id}`);
            if (item) {
                item.querySelector('.yard-start').value = y.start;
                item.querySelector('.yard-end').value = y.end;
                item.querySelector('.yard-deduct').checked = y.deduct;
                updateYard(id);
            }
        });
    }
    
    otherCounter = 0;
    if (route.other) {
        route.other.forEach(o => {
            addOther();
            const id = otherCounter - 1;
            const item = document.getElementById(`other-${id}`);
            if (item) {
                item.querySelector('.other-desc').value = o.desc;
                item.querySelector('.other-amount').value = o.amount;
            }
        });
    }
    
    updateRouteTotal();
    document.querySelector('.entry-form').scrollIntoView({ behavior: 'smooth' });
    alert(`Loaded Route #${routeId} for editing. Make changes and hit Save to update.`);
}

// === TRUCK MANAGEMENT ===
function loadTrucks() {
    const saved = localStorage.getItem('trucker_trucks');
    if (saved) {
        trucks = JSON.parse(saved);
    }
}

function saveTrucksData() {
    localStorage.setItem('trucker_trucks', JSON.stringify(trucks));
}

function openAddTruckModal() {
    currentEditingTruckId = null;
    selectedTruckType = null;
    selectedSleeperStatus = null;
    selectedLocalStatus = null;
    selectedDistanceStatus = null;
    
    document.getElementById('truckModalTitle').textContent = 'Add New Truck';
    document.getElementById('truckNumber').value = '';
    document.getElementById('truckNotes').value = '';
    document.getElementById('sleeperStatus').classList.add('hidden');
    document.getElementById('dayCabStatus').classList.add('hidden');
    document.getElementById('deleteTruckBtn').classList.add('hidden');
    
    document.getElementById('typeSleeper').style.background = '';
    document.getElementById('typeSleeper').style.color = '';
    document.getElementById('typeDayCab').style.background = '';
    document.getElementById('typeDayCab').style.color = '';
    
    document.querySelectorAll('.status-btn').forEach(btn => btn.style.opacity = '1');
    document.querySelectorAll('.local-status-btn').forEach(btn => btn.style.opacity = '1');
    document.querySelectorAll('.distance-status-btn').forEach(btn => btn.style.opacity = '1');
    
    document.getElementById('truckModal').classList.add('active');
}

function closeTruckModal() {
    document.getElementById('truckModal').classList.remove('active');
}

function selectTruckType(type) {
    selectedTruckType = type;
    
    document.getElementById('typeSleeper').style.background = '';
    document.getElementById('typeSleeper').style.color = '';
    document.getElementById('typeDayCab').style.background = '';
    document.getElementById('typeDayCab').style.color = '';
    
    if (type === 'sleeper') {
        document.getElementById('typeSleeper').style.background = '#667eea';
        document.getElementById('typeSleeper').style.color = 'white';
        document.getElementById('sleeperStatus').classList.remove('hidden');
        document.getElementById('dayCabStatus').classList.add('hidden');
    } else {
        document.getElementById('typeDayCab').style.background = '#667eea';
        document.getElementById('typeDayCab').style.color = 'white';
        document.getElementById('sleeperStatus').classList.add('hidden');
        document.getElementById('dayCabStatus').classList.remove('hidden');
    }
}

function setSleeperStatus(status) {
    selectedSleeperStatus = status;
    document.querySelectorAll('.status-btn').forEach(btn => {
        btn.style.opacity = btn.dataset.status === status ? '1' : '0.5';
    });
}

function setLocalStatus(status) {
    selectedLocalStatus = status;
    document.querySelectorAll('.local-status-btn').forEach(btn => {
        btn.style.opacity = btn.dataset.status === status ? '1' : '0.5';
    });
}

function setDistanceStatus(status) {
    selectedDistanceStatus = status;
    document.querySelectorAll('.distance-status-btn').forEach(btn => {
        btn.style.opacity = btn.dataset.status === status ? '1' : '0.5';
    });
}

function saveTruck() {
    const number = document.getElementById('truckNumber').value.trim();
    const notes = document.getElementById('truckNotes').value.trim();
    
    if (!number) {
        alert('Please enter a truck number');
        return;
    }
    
    if (!selectedTruckType) {
        alert('Please select truck type (Sleeper or Day Cab)');
        return;
    }
    
    const truckData = {
        id: currentEditingTruckId || Date.now(),
        number: number,
        type: selectedTruckType,
        notes: notes
    };
    
    if (selectedTruckType === 'sleeper') {
        if (!selectedSleeperStatus) {
            alert('Please select a status');
            return;
        }
        truckData.status = selectedSleeperStatus;
    } else {
        if (!selectedLocalStatus || !selectedDistanceStatus) {
            alert('Please select both local and distance status');
            return;
        }
        truckData.localStatus = selectedLocalStatus;
        truckData.distanceStatus = selectedDistanceStatus;
    }
    
    trucks = trucks.filter(t => t.id !== truckData.id);
    trucks.push(truckData);
    
    saveTrucksData();
    displayTrucks();
    closeTruckModal();
    alert('Truck saved!');
}

function editTruck(id) {
    const truck = trucks.find(t => t.id === id);
    if (!truck) return;
    
    currentEditingTruckId = id;
    selectedTruckType = truck.type;
    
    document.getElementById('truckModalTitle').textContent = `Edit Truck #${truck.number}`;
    document.getElementById('truckNumber').value = truck.number;
    document.getElementById('truckNotes').value = truck.notes || '';
    document.getElementById('deleteTruckBtn').classList.remove('hidden');
    
    selectTruckType(truck.type);
    
    if (truck.type === 'sleeper') {
        setSleeperStatus(truck.status);
    } else {
        setLocalStatus(truck.localStatus);
        setDistanceStatus(truck.distanceStatus);
    }
    
    document.getElementById('truckModal').classList.add('active');
}

function deleteTruck() {
    if (confirm('Delete this truck?')) {
        trucks = trucks.filter(t => t.id !== currentEditingTruckId);
        saveTrucksData();
        displayTrucks();
        closeTruckModal();
    }
}

function createTruckCard(truck) {
    let bgColor, statusText, statusIcon, textColor, overallStatus;
    
    if (truck.type === 'sleeper') {
        if (truck.status === 'green') {
            bgColor = 'rgba(76, 175, 80, 0.15)';
            statusIcon = '🟢';
            statusText = '';
            textColor = '#1b5e20';
            overallStatus = 'green';
        } else if (truck.status === 'yellow') {
            bgColor = 'rgba(255, 193, 7, 0.15)';
            statusIcon = '🟡';
            statusText = '';
            textColor = '#f57f17';
            overallStatus = 'yellow';
        } else {
            bgColor = 'rgba(244, 67, 54, 0.15)';
            statusIcon = '🔴';
            statusText = '';
            textColor = '#b71c1c';
            overallStatus = 'red';
        }
    } else {
        if (truck.localStatus === 'green' && truck.distanceStatus === 'green') {
            bgColor = 'rgba(76, 175, 80, 0.15)';
            statusIcon = '🟢';
            statusText = '';
            textColor = '#1b5e20';
            overallStatus = 'green';
        } else if (truck.localStatus === 'green' && truck.distanceStatus !== 'green') {
            bgColor = 'rgba(76, 175, 80, 0.15)';
            statusIcon = '🟢';
            statusText = '* Good for local only';
            textColor = '#1b5e20';
            overallStatus = 'green';
        } else if (truck.distanceStatus === 'red' || truck.localStatus === 'red') {
            bgColor = 'rgba(244, 67, 54, 0.15)';
            statusIcon = truck.localStatus === 'green' ? '🟢' : '🔴';
            if (truck.localStatus === 'green') statusText = '* Good for local only';
            textColor = '#b71c1c';
            overallStatus = 'red';
        } else {
            bgColor = 'rgba(255, 193, 7, 0.15)';
            statusIcon = '🟡';
            statusText = '';
            textColor = '#f57f17';
            overallStatus = 'yellow';
        }
    }
    
    return `
        <div class="truck-card" data-truck-number="${truck.number.toLowerCase()}" data-truck-status="${overallStatus}" style="background: ${bgColor}; border: 2px solid ${bgColor.replace('0.15', '0.3')}; padding: 15px; border-radius: 12px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
            <div style="flex: 1;">
                <div style="font-size: 20px; font-weight: 700; color: ${textColor}; margin-bottom: 4px;">
                    ${statusIcon} Truck #${truck.number}
                </div>
                ${statusText ? `<div style="font-size: 13px; color: ${textColor}; font-weight: 600; opacity: 0.8;">${statusText}</div>` : ''}
            </div>
            <button class="backhaul-info-button" onclick="editTruck(${truck.id})">ⓘ</button>
        </div>
    `;
}

function displayTrucks() {
    const sleepers = trucks.filter(t => t.type === 'sleeper').sort((a, b) => {
        const aNum = a.number.replace(/\D/g, '');
        const bNum = b.number.replace(/\D/g, '');
        return aNum.localeCompare(bNum, undefined, { numeric: true });
    });
    
    const dayCabs = trucks.filter(t => t.type === 'daycab').sort((a, b) => {
        const aNum = a.number.replace(/\D/g, '');
        const bNum = b.number.replace(/\D/g, '');
        return aNum.localeCompare(bNum, undefined, { numeric: true });
    });
    
    const sleepersList = document.getElementById('sleeperTrucksList');
    const noSleepers = document.getElementById('noSleepers');
    
    if (sleepers.length === 0) {
        sleepersList.innerHTML = '';
        noSleepers.style.display = 'block';
        noSleepers.textContent = 'No sleeper trucks added yet';
    } else {
        sleepersList.innerHTML = sleepers.map(truck => createTruckCard(truck)).join('');
    }
    
    const dayCabsList = document.getElementById('dayCabsList');
    const noDayCabs = document.getElementById('noDayCabs');
    
    if (dayCabs.length === 0) {
        dayCabsList.innerHTML = '';
        noDayCabs.style.display = 'block';
        noDayCabs.textContent = 'No day cabs added yet';
    } else {
        dayCabsList.innerHTML = dayCabs.map(truck => createTruckCard(truck)).join('');
    }
    
    filterTrucks();
}

function setTruckFilter(filter) {
    currentTruckFilter = filter;
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.style.background = '#eee';
        btn.style.color = '#666';
    });
    
    const activeBtn = document.getElementById(`filter${filter.charAt(0).toUpperCase() + filter.slice(1)}`);
    if (activeBtn) {
        activeBtn.style.background = '#667eea';
        activeBtn.style.color = 'white';
    }
    
    filterTrucks();
}

function filterTrucks() {
    currentSearchText = document.getElementById('truckSearch')?.value.toLowerCase() || '';
    
    const allCards = document.querySelectorAll('.truck-card');
    let visibleSleeperCount = 0;
    let visibleDayCabCount = 0;
    
    allCards.forEach(card => {
        const truckNumber = card.getAttribute('data-truck-number');
        const truckStatus = card.getAttribute('data-truck-status');
        
        const searchMatch = !currentSearchText || truckNumber.includes(currentSearchText);
        const filterMatch = currentTruckFilter === 'all' || truckStatus === currentTruckFilter;
        
        if (searchMatch && filterMatch) {
            card.style.display = 'flex';
            
            if (card.closest('#sleeperTrucksList')) {
                visibleSleeperCount++;
            } else if (card.closest('#dayCabsList')) {
                visibleDayCabCount++;
            }
        } else {
            card.style.display = 'none';
        }
    });
    
    const noSleepers = document.getElementById('noSleepers');
    const noDayCabs = document.getElementById('noDayCabs');
    
    if (trucks.filter(t => t.type === 'sleeper').length === 0) {
        noSleepers.textContent = 'No sleeper trucks added yet';
    } else {
        noSleepers.textContent = 'No sleeper trucks match your filters';
    }
    
    if (trucks.filter(t => t.type === 'daycab').length === 0) {
        noDayCabs.textContent = 'No day cabs added yet';
    } else {
        noDayCabs.textContent = 'No day cabs match your filters';
    }
    
    noSleepers.style.display = visibleSleeperCount === 0 ? 'block' : 'none';
    noDayCabs.style.display = visibleDayCabCount === 0 ? 'block' : 'none';
}

// === EXPORT/IMPORT FUNCTIONS ===
function exportBackup() {
    const backup = {
        version: "1.0",
        exportDate: new Date().toISOString(),
        appName: "Trucker Pay Tracker",
        data: {
            history: localStorage.getItem('trucker_history') || '{}',
            daily: localStorage.getItem('trucker_daily_data') || '{}',
            backhauls: localStorage.getItem('trucker_backhauls') || '[]',
            trucks: localStorage.getItem('trucker_trucks') || '[]'
        }
    };
    
    const jsonString = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const today = new Date().toISOString().split('T')[0];
    const filename = `Trucker-Pay-Backup-${today}.json`;
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    
    URL.revokeObjectURL(url);
    
    alert(`Backup created: ${filename}\n\nSave to Google Drive, email yourself, or AirDrop to computer.`);
}

function importBackup() {
    const confirmed = confirm(
        "⚠️ WARNING ⚠️\n\n" +
        "This will REPLACE all current data with the backup file.\n\n" +
        "Current data will be LOST unless you export it first.\n\n" +
        "Continue?"
    );
    
    if (!confirmed) {
        return;
    }
    
    // Create automatic safety backup before importing
    const safetyBackup = {
        version: "1.0",
        exportDate: new Date().toISOString(),
        appName: "Trucker Pay Tracker (Auto-Safety-Backup)",
        data: {
            history: localStorage.getItem('trucker_history') || '{}',
            daily: localStorage.getItem('trucker_daily_data') || '{}',
            backhauls: localStorage.getItem('trucker_backhauls') || '[]',
            trucks: localStorage.getItem('trucker_trucks') || '[]'
        }
    };

    const safetyJson = JSON.stringify(safetyBackup, null, 2);
    const safetyBlob = new Blob([safetyJson], { type: 'application/json' });
    const safetyUrl = URL.createObjectURL(safetyBlob);
    const safetyFilename = `Trucker-Pay-SAFETY-${new Date().toISOString().split('T')[0]}.json`;
    const safetyLink = document.createElement('a');
    safetyLink.href = safetyUrl;
    safetyLink.download = safetyFilename;
    safetyLink.click();
    URL.revokeObjectURL(safetyUrl);
    
    // Small delay to let safety backup complete, then show instructions
    setTimeout(() => {
        alert('✅ Safety backup created!\n\nNext: Select your backup file to restore.');
        
        // Create file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json,.json';
        input.style.display = 'none';
        document.body.appendChild(input);
        
        // Handle file selection
        input.addEventListener('change', function(event) {
            const file = event.target.files[0];
            
            if (!file) {
                document.body.removeChild(input);
                return;
            }
            
            console.log('File selected:', file.name);
            
            const reader = new FileReader();
            
            reader.onload = function(e) {
                try {
                    const backup = JSON.parse(e.target.result);
                    
                    if (!backup.data || !backup.appName || !backup.appName.includes('Trucker Pay')) {
                        alert('❌ Invalid backup file.\n\nPlease select a valid Trucker Pay backup.');
                        document.body.removeChild(input);
                        return;
                    }
                    
                    const backupDate = new Date(backup.exportDate).toLocaleDateString();
                    const confirmed2 = confirm(
                        `Restore backup from ${backupDate}?\n\n` +
                        `This will replace all current data.`
                    );
                    
                    if (!confirmed2) {
                        document.body.removeChild(input);
                        return;
                    }
                    
                    // Restore the data
                    if (backup.data.history) {
                        localStorage.setItem('trucker_history', backup.data.history);
                    }
                    if (backup.data.daily) {
                        localStorage.setItem('trucker_daily_data', backup.data.daily);
                    }
                    if (backup.data.backhauls) {
                        localStorage.setItem('trucker_backhauls', backup.data.backhauls);
                    }
                    if (backup.data.trucks) {
                        localStorage.setItem('trucker_trucks', backup.data.trucks);
                    }
                    
                    document.body.removeChild(input);
                    
                    alert('✅ Backup restored successfully!\n\nThe app will now reload.');
                    location.reload();
                    
                } catch (error) {
                    alert('❌ Error reading backup file.\n\nError: ' + error.message);
                    document.body.removeChild(input);
                }
            };
            
            reader.onerror = function() {
                alert('❌ Error reading file.');
                document.body.removeChild(input);
            };
            
            // Read the file
            reader.readAsText(file);
        });
        
        // Trigger the file picker
        input.click();
        
    }, 800);
}

function clearAllData() {
    const confirmed = confirm(
        "⚠️⚠️⚠️ DANGER ⚠️⚠️⚠️\n\n" +
        "This will permanently DELETE:\n" +
        "• All saved routes\n" +
        "• All daily data\n" +
        "• All backhaul stores\n" +
        "• All trucks\n\n" +
        "This CANNOT be undone!\n\n" +
        "Export a backup first if you haven't already!\n\n" +
        "Are you SURE?"
    );
    
    if (!confirmed) return;
    
    const doubleConfirm = confirm(
        "Last chance!\n\n" +
        "Delete everything?\n\n" +
        "This is permanent!"
    );
    
    if (doubleConfirm) {
        localStorage.removeItem('trucker_history');
        localStorage.removeItem('trucker_daily_data');
        localStorage.removeItem('trucker_backhauls');
        localStorage.removeItem('trucker_trucks');
        
        alert('All data cleared.\n\nThe app will now reload.');
        location.reload();
    }
}
