// === GLOBAL VARIABLES ===
let trucks = [];
let todaysRoutes = [];
let currentRouteNum = 1;
let detentionCounter = 0;
let yardCounter = 0;
let otherCounter = 0;

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

// === INITIALIZATION ===
window.onload = () => {
    const saved = localStorage.getItem('trucker_daily_data');
    if (saved) {
        const data = JSON.parse(saved);
        todaysRoutes = data.routes || [];
        currentRouteNum = data.currentRouteNum || 1;
        updateUI();
    }

    const savedBackhauls = localStorage.getItem('trucker_backhauls');
    if (!savedBackhauls) {
        localStorage.setItem('trucker_backhauls', JSON.stringify([]));
    }

    const dateInput = document.getElementById('shiftDate');
    if (dateInput) dateInput.valueAsDate = new Date();
    
    updateWeeklyTotals();
};

// === NAVIGATION ===
function showDashboard() {
    document.getElementById('settingsPage').classList.add('hidden');
    document.querySelector('.container').classList.remove('hidden');
    document.querySelector('.action-container').classList.remove('hidden');
}

function showSettingsPage() {
    document.querySelector('.container').classList.add('hidden');
    document.getElementById('settingsPage').classList.remove('hidden');
}

// === CORE CALCULATIONS ===
function calculateMileagePay(miles) {
    if (!miles || miles <= 0) return 0;
    for (let bracket of rates.miles) {
        if (miles <= bracket.max) return miles * bracket.rate;
    }
    return miles * rates.miles[rates.miles.length - 1].rate;
}

// === DATA PERSISTENCE ===
function persistData() {
    localStorage.setItem('trucker_daily_data', JSON.stringify({
        routes: todaysRoutes,
        currentRouteNum: currentRouteNum
    }));
    updateWeeklyTotals();
}

// === RESTORE LAST DAY BUTTON LOGIC ===
function restoreLastDay() {
    const lastDay = localStorage.getItem('trucker_last_day_backup');

    if (!lastDay) {
        alert('No backup found. A backup is created automatically when you tap "End Day".');
        return;
    }

    try {
        const dayData = JSON.parse(lastDay);
        const backupDate = dayData.date;
        
        const confirmed = confirm(`Restore completed day from ${backupDate}? This will add it back to your history.`);
        if (!confirmed) return;
        
        const history = JSON.parse(localStorage.getItem('trucker_history') || '{}');
        history[backupDate] = dayData;
        
        localStorage.setItem('trucker_history', JSON.stringify(history));
        alert(`Day restored: ${backupDate}. The app will now reload.`);
        location.reload();
        
    } catch (error) {
        alert('Error restoring backup. Data may be corrupted.');
    }
}

// Placeholder functions to prevent errors if HTML buttons are clicked
function saveRoute() { alert('Route logic active. Data saved.'); persistData(); }
function startNewRoute() { currentRouteNum++; updateUI(); persistData(); }
function endDay() { 
    localStorage.setItem('trucker_last_day_backup', JSON.stringify({
        routes: todaysRoutes,
        date: document.getElementById('shiftDate').value
    }));
    alert('Day finalized and backup created.'); 
}

function updateUI() {
    const display = document.getElementById('routeNumberDisplay');
    if (display) display.textContent = `Route #${currentRouteNum}`;
}

function updateWeeklyTotals() { console.log('Weekly totals updated'); }

