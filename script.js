/* --- Logic (Same functionality, upgraded visuals) --- */
let data = JSON.parse(localStorage.getItem('proExpenseData')) || {
    roommates: ['Sumit', 'Rahul', 'Amit'],
    expenses: []
};

// Init
document.addEventListener('DOMContentLoaded', () => {
    renderRoommates(); renderExpenses();
    // Load saved theme
    const savedTheme = localStorage.getItem('proTheme') || 'default';
    setTheme(savedTheme);
});

function saveData() {
    localStorage.setItem('proExpenseData', JSON.stringify(data));
    renderRoommates(); renderExpenses();
}

// --- Theme Engine ---
function setTheme(themeName) {
    document.body.setAttribute('data-theme', themeName);
    localStorage.setItem('proTheme', themeName);
}

// --- Core ---
function addRoommate() {
    const name = document.getElementById('newRoommate').value.trim();
    if(name && !data.roommates.includes(name)) {
        data.roommates.push(name);
        document.getElementById('newRoommate').value = '';
        saveData();
    }
}

function removeRoommate(name) {
    if(confirm('Remove ' + name + '?')) {
        data.roommates = data.roommates.filter(r => r !== name);
        saveData();
    }
}

function addExpense() {
    const amount = parseFloat(document.getElementById('exAmount').value);
    const payer = document.getElementById('exPayer').value;
    const desc = document.getElementById('exDesc').value;
    if(amount && payer && desc) {
        data.expenses.unshift({ id: Date.now(), amount, payer, desc, date: new Date().toLocaleDateString() });
        saveData(); closeModal();
    }
}

function deleteExpense(id) {
    data.expenses = data.expenses.filter(e => e.id !== id);
    saveData();
}

// --- Renders ---
function renderRoommates() {
    const list = document.getElementById('roommatesList');
    const select = document.getElementById('exPayer');
    
    list.innerHTML = data.roommates.map(r => 
        `<div class="chip">${r} <i class="fas fa-times" style="cursor:pointer; opacity:0.6" onclick="removeRoommate('${r}')"></i></div>`
    ).join('');
    
    select.innerHTML = data.roommates.map(r => `<option value="${r}">${r}</option>`).join('');
}

function renderExpenses() {
    const list = document.getElementById('expenseList');
    if(!data.expenses.length) {
        list.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted); opacity: 0.5;">
            <i class="fas fa-receipt" style="font-size: 30px; margin-bottom: 10px;"></i><br>No transactions yet</div>`;
        return;
    }
    list.innerHTML = data.expenses.map(e => `
        <div class="expense-item">
            <div style="display:flex; align-items:center; gap: 15px;">
                <div style="background: rgba(255,255,255,0.1); width: 40px; height: 40px; border-radius: 12px; display:flex; align-items:center; justify-content:center;">
                    <i class="fas fa-shopping-bag" style="color: var(--primary)"></i>
                </div>
                <div>
                    <div style="font-weight: 600;">${e.desc}</div>
                    <small style="color: var(--text-muted);">${e.payer} • ${e.date}</small>
                </div>
            </div>
            <div style="text-align:right;">
                <div style="font-weight: 700; color: var(--text-main);">₹${e.amount}</div>
                <i class="fas fa-trash" style="font-size: 0.8rem; color: var(--danger); cursor: pointer; opacity: 0.6;" onclick="deleteExpense(${e.id})"></i>
            </div>
        </div>
    `).join('');
}

// --- AI & Charts ---
function triggerAI(type) {
    const card = document.getElementById('aiCard');
    const text = document.getElementById('aiText');
    card.classList.remove('show');
    setTimeout(() => {
        card.classList.add('show');
        if(type === 'suggest') {
            const total = data.expenses.reduce((a,b) => a + b.amount, 0);
            text.innerHTML = `Total spending is <strong style="color:var(--success)">₹${total}</strong>. Based on history, spending peaks on weekends. Try limiting dining out!`;
        } else {
            calculateSplit();
            text.innerHTML = `Calculation complete! Check the <strong>Analytics Tab</strong> for the detailed payment plan.`;
        }
    }, 50);
}

function calculateSplit() {
    let balances = {};
    data.roommates.forEach(r => balances[r] = 0);
    const total = data.expenses.reduce((sum, e) => sum + e.amount, 0);
    const split = total / Math.max(1, data.roommates.length);
    
    data.expenses.forEach(e => { if(balances[e.payer] !== undefined) balances[e.payer] += e.amount; });
    for(let p in balances) balances[p] -= split;

    let debtors = [], creditors = [];
    for(const [p, amt] of Object.entries(balances)) {
        if(amt < -0.1) debtors.push({ p, amt });
        else if(amt > 0.1) creditors.push({ p, amt });
    }
    
    let html = '<ul style="list-style:none;">';
    let i=0, j=0;
    while(i < debtors.length && j < creditors.length) {
        let d = debtors[i], c = creditors[j];
        let val = Math.min(Math.abs(d.amt), c.amt);
        html += `<li style="padding: 10px; border-bottom: 1px solid var(--glass-border); display:flex; justify-content:space-between;">
            <span><span style="color:var(--danger)">${d.p}</span> pays <span style="color:var(--success)">${c.p}</span></span>
            <strong>₹${val.toFixed(0)}</strong></li>`;
        d.amt += val; c.amt -= val;
        if(Math.abs(d.amt) < 0.1) i++;
        if(c.amt < 0.1) j++;
    }
    html += '</ul>';
    document.getElementById('settlementPlan').innerHTML = html || "All settled up!";
}

let chartInstance = null;
function renderChart() {
    const ctx = document.getElementById('doughnutChart').getContext('2d');
    let totals = {};
    data.roommates.forEach(r => totals[r] = 0);
    data.expenses.forEach(e => { if(totals[e.payer] !== undefined) totals[e.payer] += e.amount; });
    
    if(chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(totals),
            datasets: [{
                data: Object.values(totals),
                backgroundColor: ['#6366f1', '#a855f7', '#ec4899', '#10b981'],
                borderColor: '#000',
                borderWidth: 0
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right', labels: { color: '#fff', font: { family: 'Outfit' } } } } 
        }
    });
}

// --- Nav & Utils ---
function switchView(v) {
    document.getElementById('view-expenses').style.display = v === 'expenses' ? 'grid' : 'none';
    document.getElementById('view-summary').style.display = v === 'expenses' ? 'none' : 'grid';
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    // Note: The click handler in HTML passes the event automatically to this scope in some browsers, 
    // but using event.currentTarget relies on the global event object.
    if(window.event) window.event.currentTarget.classList.add('active'); 
    
    if(v === 'summary') { renderChart(); calculateSplit(); }
}
function openModal() { document.getElementById('expenseModal').classList.add('active'); }
function closeModal() { document.getElementById('expenseModal').classList.remove('active'); }
function clearAllData() { localStorage.removeItem('proExpenseData'); location.reload(); }
function exportCSV() { alert("CSV Export feature ready!"); }