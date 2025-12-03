let currentUser = null;
let data = { roommates: [], expenses: [], profile: { displayName: '', bio: '', avatar: '' } };

// --- Database Helpers ---
function getUsersDB() { return JSON.parse(localStorage.getItem('proUsers')) || {}; }
function saveUsersDB(db) { localStorage.setItem('proUsers', JSON.stringify(db)); }
function getOtherUserData(userId) {
    const raw = JSON.parse(localStorage.getItem(`proData_${userId}`)) || {};
    const profile = raw.profile || {};
    return {
        id: userId,
        displayName: profile.displayName || userId,
        avatar: profile.avatar || `https://ui-avatars.com/api/?name=${userId}&background=333&color=fff`
    };
}

// --- Auth & Strict Validation ---
function toggleAuthMode() {
    const loginBtn = document.getElementById('btn-login');
    const signupBtn = document.getElementById('btn-signup');
    document.getElementById('auth-msg').innerText = '';
    if (loginBtn.style.display === 'none') {
        loginBtn.style.display = 'block'; signupBtn.style.display = 'none';
    } else {
        loginBtn.style.display = 'none'; signupBtn.style.display = 'block';
    }
}

function validateUsername(username) {
    const regex = /^[a-zA-Z0-9_]+$/;
    return regex.test(username);
}

function handleSignup() {
    const u = document.getElementById('auth-username').value.trim();
    const p = document.getElementById('auth-password').value.trim();
    const msg = document.getElementById('auth-msg');

    if (!u || !p) { msg.innerText = 'Fill all fields'; msg.style.color = 'var(--danger)'; return; }
    if (!validateUsername(u)) { msg.innerText = 'User ID: Letters, Numbers & _ only.'; msg.style.color = 'var(--danger)'; return; }

    let db = getUsersDB();
    if (db[u]) { msg.innerText = 'User ID already taken!'; msg.style.color = 'var(--danger)'; return; }
    
    db[u] = p; saveUsersDB(db);
    localStorage.setItem(`proData_${u}`, JSON.stringify({ roommates: [u], expenses: [], profile: { displayName: u, avatar: '' } }));
    
    msg.innerText = 'Account created! Login now.'; msg.style.color = 'var(--success)';
    setTimeout(toggleAuthMode, 1500);
}

function handleLogin() {
    const u = document.getElementById('auth-username').value.trim();
    const p = document.getElementById('auth-password').value.trim();
    let db = getUsersDB();
    if (db[u] && db[u] === p) {
        currentUser = u;
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('app-dashboard').style.display = 'flex';
        loadUserData(u);
    } else {
        document.getElementById('auth-msg').innerText = 'Invalid credentials';
        document.getElementById('auth-msg').style.color = 'var(--danger)';
    }
}

function handleLogout() {
    currentUser = null;
    document.getElementById('app-dashboard').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('auth-username').value = '';
    document.getElementById('auth-password').value = '';
    document.getElementById('mainDropdown').classList.remove('active');
}

// --- Data Loading & Updates ---
function loadUserData(username) {
    const key = `proData_${username}`;
    let raw = JSON.parse(localStorage.getItem(key)) || {};
    data = {
        roommates: raw.roommates || [username],
        expenses: raw.expenses || [],
        profile: raw.profile || { displayName: username, bio: '', avatar: '' }
    };
    if(!data.roommates.includes(username)) data.roommates.push(username); 
    
    updateProfileUI();
    const savedTheme = localStorage.getItem(`proTheme_${username}`) || 'default';
    setTheme(savedTheme);
    renderRoommates(); 
    renderExpenses();
}

function saveData() {
    if(!currentUser) return;
    localStorage.setItem(`proData_${currentUser}`, JSON.stringify(data));
    renderRoommates(); renderExpenses(); updateProfileUI();
}

function updateProfileUI() {
    const finalAvatar = data.profile.avatar || `https://ui-avatars.com/api/?name=${currentUser}&background=6366f1&color=fff`;
    
    // Header Button Avatar
    document.getElementById('header-avatar').style.display = 'block';
    document.getElementById('header-avatar').querySelector('img').src = finalAvatar;
    document.getElementById('display-username').innerText = data.profile.displayName;
    
    // Menu Preview Avatar
    document.getElementById('menu-user-avatar').src = finalAvatar;
    document.getElementById('menu-user-name').innerText = data.profile.displayName;
    document.getElementById('menu-user-id').innerText = '@' + currentUser;

    // Profile Edit Page
    document.getElementById('profile-img-preview').src = finalAvatar;
    document.getElementById('profile-name-display').innerText = data.profile.displayName;
    document.getElementById('profile-id-display').innerText = '@' + currentUser;
    
    document.getElementById('edit-display-name').value = data.profile.displayName;
    document.getElementById('edit-bio').value = data.profile.bio;
    document.getElementById('edit-username').value = currentUser;
}

// --- Core Logic ---
function addVerifiedRoommate() {
    const inputID = document.getElementById('newRoommateID').value.trim();
    const usersDB = getUsersDB();
    if (!inputID) return;
    if (inputID === currentUser) { alert("You are already in the list!"); return; }

    if (usersDB.hasOwnProperty(inputID)) {
        if (!data.roommates.includes(inputID)) {
            data.roommates.push(inputID);
            document.getElementById('newRoommateID').value = '';
            saveData();
            alert(`Success! Friend '${inputID}' added.`);
        } else { alert("User already added."); }
    } else { alert(`Error: User ID '${inputID}' not found.`); }
}

function removeRoommate(id) {
    if(id === currentUser) { alert("You cannot remove yourself!"); return; }
    if(confirm(`Remove ${id}?`)) { data.roommates = data.roommates.filter(r => r !== id); saveData(); }
}

function renderRoommates() {
    const list = document.getElementById('roommatesList');
    const select = document.getElementById('exPayer');
    document.getElementById('emptyRoommateMsg').style.display = data.roommates.length <= 1 ? 'block' : 'none';

    list.innerHTML = data.roommates.map(userId => {
        const userData = getOtherUserData(userId);
        return `<div class="chip verified" title="${userId}">
            <img src="${userData.avatar}"> ${userData.displayName} ${userId === currentUser ? '(Me)' : ''}
            ${userId !== currentUser ? `<i class="fas fa-times" style="cursor:pointer; opacity:0.6; margin-left:5px;" onclick="removeRoommate('${userId}')"></i>` : ''}
        </div>`;
    }).join('');

    select.innerHTML = data.roommates.map(userId => `<option value="${userId}">${getOtherUserData(userId).displayName}</option>`).join('');
}

function addExpense() {
    const amount = parseFloat(document.getElementById('exAmount').value);
    const payer = document.getElementById('exPayer').value;
    const desc = document.getElementById('exDesc').value;
    if(amount && payer && desc) {
        data.expenses.unshift({ id: Date.now(), amount, payerID: payer, desc, date: new Date().toLocaleDateString() });
        saveData(); closeModal();
    }
}

function renderExpenses() {
    document.getElementById('expenseList').innerHTML = data.expenses.map(e => {
        const payerData = getOtherUserData(e.payerID);
        return `<div class="expense-item">
            <div style="display:flex; align-items:center; gap: 15px;">
                <img src="${payerData.avatar}" style="width:40px; height:40px; border-radius:12px; object-fit:cover;">
                <div><div style="font-weight: 600;">${e.desc}</div><small style="color: var(--text-muted);">${payerData.displayName} • ${e.date}</small></div>
            </div>
            <div style="text-align:right;"><div style="font-weight: 700; color: var(--text-main);">₹${e.amount}</div><i class="fas fa-trash" style="font-size: 0.8rem; color: var(--danger); cursor: pointer; opacity: 0.6;" onclick="deleteExpense(${e.id})"></i></div>
        </div>`;
    }).join('') || '<div style="text-align:center; padding: 40px; opacity:0.5;">No transactions</div>';
}

function deleteExpense(id) { data.expenses = data.expenses.filter(e => e.id !== id); saveData(); }

// --- Profile & Menu ---
function openProfile() { switchView('profile'); }
function openPasswordChange() {
    openProfile();
    setTimeout(() => { document.getElementById('security-section').scrollIntoView({ behavior: 'smooth' }); document.getElementById('edit-password').focus(); }, 300);
}
function handleImageUpload(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            if(e.total > 2000000) { alert("Image too large!"); return; }
            document.getElementById('profile-img-preview').src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
}
function saveProfileChanges() {
    const newName = document.getElementById('edit-display-name').value.trim();
    const newPass = document.getElementById('edit-password').value.trim();
    const imgSrc = document.getElementById('profile-img-preview').src;

    data.profile.displayName = newName || currentUser;
    data.profile.bio = document.getElementById('edit-bio').value.trim();
    if(!imgSrc.includes('ui-avatars.com')) data.profile.avatar = imgSrc;

    saveData();
    if(newPass) {
        let db = getUsersDB(); db[currentUser] = newPass; saveUsersDB(db);
        alert("Updated successfully!"); document.getElementById('edit-password').value = '';
    }
    switchView('expenses');
}

// --- Utils ---
function setTheme(themeName) { document.body.setAttribute('data-theme', themeName); if(currentUser) localStorage.setItem(`proTheme_${currentUser}`, themeName); }
function toggleMenu(event) { event.stopPropagation(); document.getElementById('mainDropdown').classList.toggle('active'); }
document.addEventListener('click', (e) => { if(!e.target.closest('.menu-container')) document.getElementById('mainDropdown').classList.remove('active'); });

function switchView(v, element) {
    document.getElementById('view-expenses').style.display = 'none';
    document.getElementById('view-summary').style.display = 'none';
    document.getElementById('view-profile').style.display = 'none';
    document.getElementById('fab-btn').style.display = 'flex';
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    
    if(v === 'expenses') {
        document.getElementById('view-expenses').style.display = 'grid';
        if(element) element.classList.add('active'); else document.querySelectorAll('.nav-item')[0].classList.add('active');
    } else if(v === 'summary') {
        document.getElementById('view-summary').style.display = 'grid';
        if(element) element.classList.add('active');
        calculateSplit(); renderChart();
    } else if(v === 'profile') {
        document.getElementById('view-profile').style.display = 'block';
        document.getElementById('fab-btn').style.display = 'none';
    }
    document.getElementById('mainDropdown').classList.remove('active');
}

// AI & Charts
function triggerAI(type) {
        const card = document.getElementById('aiCard');
        const text = document.getElementById('aiText');
        card.classList.remove('show');
        setTimeout(() => {
            card.classList.add('show');
            if(type === 'suggest') { const total = data.expenses.reduce((a,b) => a + b.amount, 0); text.innerHTML = `Total spending: <strong style="color:var(--success)">₹${total}</strong>`; } 
            else { calculateSplit(); text.innerHTML = `Check Analytics tab.`; }
        }, 50);
}
function calculateSplit() {
    let balances = {}; data.roommates.forEach(r => balances[r] = 0);
    const total = data.expenses.reduce((sum, e) => sum + e.amount, 0);
    const split = total / Math.max(1, data.roommates.length);
    data.expenses.forEach(e => { if(balances[e.payerID] !== undefined) balances[e.payerID] += e.amount; });
    for(let p in balances) balances[p] -= split;
    let debtors = [], creditors = []; for(const [p, amt] of Object.entries(balances)) { if(amt < -0.1) debtors.push({ p, amt }); else if(amt > 0.1) creditors.push({ p, amt }); }
    let html = '<ul style="list-style:none;">';
    let i=0, j=0;
    while(i < debtors.length && j < creditors.length) {
        let d = debtors[i], c = creditors[j]; let val = Math.min(Math.abs(d.amt), c.amt);
        html += `<li style="padding: 10px; border-bottom: 1px solid var(--glass-border); display:flex; justify-content:space-between;"><span><span style="color:var(--danger)">${getOtherUserData(d.p).displayName}</span> pays <span style="color:var(--success)">${getOtherUserData(c.p).displayName}</span></span><strong>₹${val.toFixed(0)}</strong></li>`;
        d.amt += val; c.amt -= val; if(Math.abs(d.amt) < 0.1) i++; if(c.amt < 0.1) j++;
    }
    document.getElementById('settlementPlan').innerHTML = html + '</ul>';
}
let chartInstance = null;
function renderChart() {
        const ctx = document.getElementById('doughnutChart').getContext('2d');
        let totals = {}; data.roommates.forEach(r => totals[getOtherUserData(r).displayName] = 0);
        data.expenses.forEach(e => { let pName = getOtherUserData(e.payerID).displayName; if(totals[pName] !== undefined) totals[pName] += e.amount; });
        if(chartInstance) chartInstance.destroy();
        chartInstance = new Chart(ctx, { type: 'doughnut', data: { labels: Object.keys(totals), datasets: [{ data: Object.values(totals), backgroundColor: ['#6366f1', '#a855f7', '#ec4899', '#10b981'], borderWidth:0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position:'right', labels:{color:'#fff'} } } } });
}
function openModal() { document.getElementById('expenseModal').classList.add('active'); }
function closeModal() { document.getElementById('expenseModal').classList.remove('active'); }
function exportCSV() { alert('CSV Export'); }
