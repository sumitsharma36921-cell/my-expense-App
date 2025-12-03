// --- FIREBASE CONFIGURATION (Verified) ---
const firebaseConfig = {
  apiKey: "AIzaSyBhGkFL6Rz6FUbDhS7bAMWlq0VYB0XMceE",
  authDomain: "splitpro-app.firebaseapp.com",
  projectId: "splitpro-app",
  storageBucket: "splitpro-app.firebasestorage.app",
  messagingSenderId: "781282859102",
  appId: "1:781282859102:web:fc0fc11a9c6d47246bfccf",
  measurementId: "G-YSWLQB4ZQB"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- APP LOGIC ---
let currentUser = null;
let data = { roommates: [], expenses: [], profile: { displayName: '', bio: '', avatar: '' } };
let unsubscribeListener = null;

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

// --- CLOUD AUTH FUNCTIONS ---
async function handleSignup() {
    const u = document.getElementById('auth-username').value.trim();
    const p = document.getElementById('auth-password').value.trim();
    const msg = document.getElementById('auth-msg');

    if (!u || !p) { msg.innerText = 'Fill all fields'; msg.style.color = 'var(--danger)'; return; }
    if (!validateUsername(u)) { msg.innerText = 'User ID: Letters, Numbers & _ only.'; msg.style.color = 'var(--danger)'; return; }

    msg.innerText = 'Checking availability...';
    try {
        const userDoc = await db.collection("users").doc(u).get();
        if (userDoc.exists) {
            msg.innerText = 'User ID already taken!'; msg.style.color = 'var(--danger)';
        } else {
            const newUser = {
                password: p, 
                roommates: [u],
                expenses: [],
                profile: { displayName: u, avatar: '', bio: '' }
            };
            await db.collection("users").doc(u).set(newUser);
            msg.innerText = 'Account created! Login now.'; msg.style.color = 'var(--success)';
            setTimeout(toggleAuthMode, 1500);
        }
    } catch (error) { console.error(error); msg.innerText = 'Error connecting to server.'; msg.style.color = 'var(--danger)'; }
}

async function handleLogin() {
    const u = document.getElementById('auth-username').value.trim();
    const p = document.getElementById('auth-password').value.trim();
    const msg = document.getElementById('auth-msg');
    
    msg.innerText = 'Verifying...';
    try {
        const userDoc = await db.collection("users").doc(u).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            if (userData.password === p) {
                currentUser = u;
                document.getElementById('auth-screen').style.display = 'none';
                document.getElementById('app-dashboard').style.display = 'flex';
                loadUserData(u);
            } else { msg.innerText = 'Wrong password'; msg.style.color = 'var(--danger)'; }
        } else { msg.innerText = 'User not found'; msg.style.color = 'var(--danger)'; }
    } catch (error) { console.error(error); msg.innerText = 'Connection failed.'; msg.style.color = 'var(--danger)'; }
}

function handleLogout() {
    if(unsubscribeListener) { unsubscribeListener(); }
    currentUser = null;
    document.getElementById('app-dashboard').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('auth-username').value = '';
    document.getElementById('auth-password').value = '';
    document.getElementById('mainDropdown').classList.remove('active');
}

// --- CLOUD DATA FUNCTIONS ---
function loadUserData(username) {
    unsubscribeListener = db.collection("users").doc(username).onSnapshot((doc) => {
        if (doc.exists) {
            let raw = doc.data();
            data = {
                roommates: raw.roommates || [username],
                expenses: raw.expenses || [],
                profile: raw.profile || { displayName: username, bio: '', avatar: '' }
            };
            updateProfileUI();
            renderRoommates(); 
            renderExpenses();
            calculateSplit(); 
        }
    });
}

async function getOtherUserData(userId) {
    try {
        const doc = await db.collection("users").doc(userId).get();
        if(doc.exists) {
            const p = doc.data().profile || {};
            return {
                id: userId,
                displayName: p.displayName || userId,
                avatar: p.avatar || `https://ui-avatars.com/api/?name=${userId}&background=333&color=fff`
            };
        }
    } catch(e) { console.log(e); }
    return { id: userId, displayName: userId, avatar: `https://ui-avatars.com/api/?name=${userId}&background=333&color=fff` };
}

async function saveData() {
    if(!currentUser) return;
    try {
        await db.collection("users").doc(currentUser).update({
            // We only save roommates locally if changed, but addVerifiedRoommate handles sync
            roommates: data.roommates, 
            // expenses are updated via sync logic mostly
            profile: data.profile
        });
    } catch (error) { console.error("Error saving data: ", error); }
}

// --- LOGIC (SYNC FIXES HERE) ---

async function addVerifiedRoommate() {
    const inputID = document.getElementById('newRoommateID').value.trim();
    if (!inputID) return;
    if (inputID === currentUser) { alert("Already added!"); return; }

    const btn = document.querySelector('button[onclick="addVerifiedRoommate()"]');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        const doc = await db.collection("users").doc(inputID).get();
        if (doc.exists) {
            if (!data.roommates.includes(inputID)) {
                // 1. Add to MY list
                await db.collection("users").doc(currentUser).update({
                    roommates: firebase.firestore.FieldValue.arrayUnion(inputID)
                });

                // 2. Add ME to THEIR list (SYNC FIX)
                await db.collection("users").doc(inputID).update({
                    roommates: firebase.firestore.FieldValue.arrayUnion(currentUser)
                });

                alert(`Success! You and '${inputID}' are connected.`);
                document.getElementById('newRoommateID').value = '';
            } else { alert("User already added."); }
        } else { alert(`User ID '${inputID}' not found.`); }
    } catch (e) { console.error(e); alert("Network Error"); }
    btn.innerHTML = '<i class="fas fa-user-plus"></i>';
}

function removeRoommate(id) {
    if(id === currentUser) { alert("Cannot remove self!"); return; }
    if(confirm(`Remove ${id}?`)) { 
        // Only removing locally for now to avoid accidental deletions for friend
        db.collection("users").doc(currentUser).update({
             roommates: firebase.firestore.FieldValue.arrayRemove(id)
        });
    }
}

async function addExpense() {
    const amount = parseFloat(document.getElementById('exAmount').value);
    const payer = document.getElementById('exPayer').value;
    const desc = document.getElementById('exDesc').value;
    
    if(amount && payer && desc) {
        const newExpense = { 
            id: Date.now(), 
            amount, 
            payerID: payer, 
            desc, 
            date: new Date().toLocaleDateString() 
        };
        closeModal();

        // SYNC FIX: Add to EVERYONE's list
        const updates = data.roommates.map(userId => {
            return db.collection("users").doc(userId).update({
                expenses: firebase.firestore.FieldValue.arrayUnion(newExpense)
            }).catch(err => console.log(`Error updating ${userId}:`, err));
        });

        try { await Promise.all(updates); } 
        catch (error) { alert("Error syncing expense."); }
    }
}

async function deleteExpense(expenseId) {
    if(!confirm("Delete for everyone?")) return;
    const expenseToDelete = data.expenses.find(e => e.id === expenseId);
    if (!expenseToDelete) return;

    // SYNC FIX: Remove from EVERYONE's list
    const updates = data.roommates.map(userId => {
        return db.collection("users").doc(userId).update({
            expenses: firebase.firestore.FieldValue.arrayRemove(expenseToDelete)
        }).catch(err => console.log(`Error deleting for ${userId}:`, err));
    });

    try { await Promise.all(updates); } 
    catch (error) { alert("Error deleting expense."); }
}

// --- UI RENDER (LAZY LOAD FIXES) ---

function renderRoommates() {
    const list = document.getElementById('roommatesList');
    const select = document.getElementById('exPayer');
    document.getElementById('emptyRoommateMsg').style.display = data.roommates.length <= 1 ? 'block' : 'none';

    let listHTML = '';
    let selectHTML = '';

    for (const userId of data.roommates) {
        let isMe = userId === currentUser;
        listHTML += `<div class="chip verified" id="chip-${userId}">
            <img src="https://ui-avatars.com/api/?name=${userId}&background=333&color=fff" id="img-chip-${userId}"> 
            <span id="name-chip-${userId}">${userId}</span> ${isMe ? '(Me)' : ''}
            ${!isMe ? `<i class="fas fa-times" style="cursor:pointer; opacity:0.6; margin-left:5px;" onclick="removeRoommate('${userId}')"></i>` : ''}
        </div>`;
        selectHTML += `<option value="${userId}" id="opt-${userId}">${userId}</option>`;
        
        getOtherUserData(userId).then(realUser => {
            const nameEl = document.getElementById(`name-chip-${userId}`);
            const imgEl = document.getElementById(`img-chip-${userId}`);
            const optEl = document.getElementById(`opt-${userId}`);
            if (nameEl) nameEl.innerText = realUser.displayName;
            if (imgEl) imgEl.src = realUser.avatar;
            if (optEl) optEl.innerText = realUser.displayName;
        });
    }
    list.innerHTML = listHTML;
    select.innerHTML = selectHTML;
}

function renderExpenses() {
    const list = document.getElementById('expenseList');
    if(data.expenses.length === 0) { list.innerHTML = '<div style="text-align:center; padding: 40px; opacity:0.5;">No transactions</div>'; return; }
    
    list.innerHTML = data.expenses.map(e => {
        return `<div class="expense-item">
            <div style="display:flex; align-items:center; gap: 15px;">
                <img src="https://ui-avatars.com/api/?name=${e.payerID}&background=333&color=fff" id="exp-img-${e.id}" style="width:40px; height:40px; border-radius:12px; object-fit:cover;">
                <div>
                    <div style="font-weight: 600;">${e.desc}</div>
                    <small style="color: var(--text-muted);"><span id="exp-name-${e.id}">${e.payerID}</span> • ${e.date}</small>
                </div>
            </div>
            <div style="text-align:right;"><div style="font-weight: 700; color: var(--text-main);">₹${e.amount}</div><i class="fas fa-trash" style="font-size: 0.8rem; color: var(--danger); cursor: pointer; opacity: 0.6;" onclick="deleteExpense(${e.id})"></i></div>
        </div>`;
    }).join('');

    data.expenses.forEach(e => {
        getOtherUserData(e.payerID).then(realUser => {
            const imgEl = document.getElementById(`exp-img-${e.id}`);
            const nameEl = document.getElementById(`exp-name-${e.id}`);
            if(imgEl) imgEl.src = realUser.avatar;
            if(nameEl) nameEl.innerText = realUser.displayName;
        });
    });
}

function updateProfileUI() {
    const finalAvatar = data.profile.avatar || `https://ui-avatars.com/api/?name=${currentUser}&background=6366f1&color=fff`;
    document.getElementById('header-avatar').style.display = 'block';
    document.getElementById('header-avatar').querySelector('img').src = finalAvatar;
    document.getElementById('display-username').innerText = data.profile.displayName;
    document.getElementById('menu-user-avatar').src = finalAvatar;
    document.getElementById('menu-user-name').innerText = data.profile.displayName;
    document.getElementById('menu-user-id').innerText = '@' + currentUser;
    document.getElementById('profile-img-preview').src = finalAvatar;
    document.getElementById('profile-name-display').innerText = data.profile.displayName;
    document.getElementById('profile-id-display').innerText = '@' + currentUser;
    document.getElementById('edit-display-name').value = data.profile.displayName;
    document.getElementById('edit-bio').value = data.profile.bio;
    document.getElementById('edit-username').value = currentUser;
}

// --- UTILS ---
function openProfile() { switchView('profile'); }
function openPasswordChange() { openProfile(); setTimeout(() => { document.getElementById('security-section').scrollIntoView({ behavior: 'smooth' }); document.getElementById('edit-password').focus(); }, 300); }
function handleImageUpload(input) { if (input.files && input.files[0]) { const reader = new FileReader(); reader.onload = function(e) { if(e.total > 2000000) { alert("Image too large!"); return; } document.getElementById('profile-img-preview').src = e.target.result; }; reader.readAsDataURL(input.files[0]); } }
function setTheme(themeName) { document.body.setAttribute('data-theme', themeName); }
function toggleMenu(event) { event.stopPropagation(); document.getElementById('mainDropdown').classList.toggle('active'); }
document.addEventListener('click', (e) => { if(!e.target.closest('.menu-container')) document.getElementById('mainDropdown').classList.remove('active'); });
function switchView(v, element) { document.getElementById('view-expenses').style.display = 'none'; document.getElementById('view-summary').style.display = 'none'; document.getElementById('view-profile').style.display = 'none'; document.getElementById('fab-btn').style.display = 'flex'; document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active')); if(v === 'expenses') { document.getElementById('view-expenses').style.display = 'grid'; if(element) element.classList.add('active'); else document.querySelectorAll('.nav-item')[0].classList.add('active'); } else if(v === 'summary') { document.getElementById('view-summary').style.display = 'grid'; if(element) element.classList.add('active'); calculateSplit(); renderChart(); } else if(v === 'profile') { document.getElementById('view-profile').style.display = 'block'; document.getElementById('fab-btn').style.display = 'none'; } document.getElementById('mainDropdown').classList.remove('active'); }
function triggerAI(type) { const card = document.getElementById('aiCard'); const text = document.getElementById('aiText'); card.classList.remove('show'); setTimeout(() => { card.classList.add('show'); if(type === 'suggest') { const total = data.expenses.reduce((a,b) => a + b.amount, 0); text.innerHTML = `Total spending: <strong style="color:var(--success)">₹${total}</strong>`; } else { calculateSplit(); text.innerHTML = `Check Analytics tab.`; } }, 50); }
function calculateSplit() { let balances = {}; data.roommates.forEach(r => balances[r] = 0); const total = data.expenses.reduce((sum, e) => sum + e.amount, 0); const split = total / Math.max(1, data.roommates.length); data.expenses.forEach(e => { if(balances[e.payerID] !== undefined) balances[e.payerID] += e.amount; }); for(let p in balances) balances[p] -= split; let debtors = [], creditors = []; for(const [p, amt] of Object.entries(balances)) { if(amt < -0.1) debtors.push({ p, amt }); else if(amt > 0.1) creditors.push({ p, amt }); } let html = '<ul style="list-style:none;">'; let i=0, j=0; while(i < debtors.length && j < creditors.length) { let d = debtors[i], c = creditors[j]; let val = Math.min(Math.abs(d.amt), c.amt); html += `<li style="padding: 10px; border-bottom: 1px solid var(--glass-border); display:flex; justify-content:space-between;"><span><span style="color:var(--danger)">${d.p}</span> pays <span style="color:var(--success)">${c.p}</span></span><strong>₹${val.toFixed(0)}</strong></li>`; d.amt += val; c.amt -= val; if(Math.abs(d.amt) < 0.1) i++; if(c.amt < 0.1) j++; } document.getElementById('settlementPlan').innerHTML = html + '</ul>'; }
let chartInstance = null; function renderChart() { const ctx = document.getElementById('doughnutChart').getContext('2d'); let totals = {}; data.roommates.forEach(r => totals[r] = 0); data.expenses.forEach(e => { if(totals[e.payerID] !== undefined) totals[e.payerID] += e.amount; }); if(chartInstance) chartInstance.destroy(); chartInstance = new Chart(ctx, { type: 'doughnut', data: { labels: Object.keys(totals), datasets: [{ data: Object.values(totals), backgroundColor: ['#6366f1', '#a855f7', '#ec4899', '#10b981'], borderWidth:0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position:'right', labels:{color:'#fff'} } } } }); }
function openModal() { document.getElementById('expenseModal').classList.add('active'); }
function closeModal() { document.getElementById('expenseModal').classList.remove('active'); }
function exportCSV() { alert('CSV Export'); }
