// --- FIREBASE CONFIGURATION ---
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

// --- APP STATE ---
let currentUser = null;
let currentGroupId = null; // Currently Selected Group
let userGroups = []; // List of groups user belongs to
let data = { members: [], expenses: [] }; // Data for the *selected* group
let userProfile = {}; // Current User Profile
let groupUnsubscribe = null; // Listener for active group
let userUnsubscribe = null; // Listener for user's group list

// --- AUTH ---
function toggleAuthMode() {
    const loginBtn = document.getElementById('btn-login');
    const signupBtn = document.getElementById('btn-signup');
    const authMsg = document.getElementById('auth-msg');
    authMsg.innerText = '';
    
    if (loginBtn.style.display === 'none') {
        loginBtn.style.display = 'block'; signupBtn.style.display = 'none';
    } else {
        loginBtn.style.display = 'none'; signupBtn.style.display = 'block';
    }
}

function validateUsername(username) { return /^[a-zA-Z0-9_]+$/.test(username); }

async function handleSignup() {
    const u = document.getElementById('auth-username').value.trim();
    const p = document.getElementById('auth-password').value.trim();
    const msg = document.getElementById('auth-msg');

    if (!u || !p) { msg.innerText = 'Fill all fields'; msg.style.color = 'var(--danger)'; return; }
    if (!validateUsername(u)) { msg.innerText = 'User ID: Letters, Numbers & _ only.'; msg.style.color = 'var(--danger)'; return; }

    msg.innerText = 'Creating account...';
    try {
        const userDoc = await db.collection("users").doc(u).get();
        if (userDoc.exists) {
            msg.innerText = 'User ID already taken!'; msg.style.color = 'var(--danger)';
        } else {
            // 1. Create Default Group for User
            const defaultGroupId = `group_${Date.now()}`;
            const groupRef = db.collection("groups").doc(defaultGroupId);
            await groupRef.set({
                name: "My Personal Expenses",
                members: [u],
                expenses: []
            });

            // 2. Create User Profile
            await db.collection("users").doc(u).set({
                password: p,
                profile: { displayName: u, avatar: '', bio: '' },
                groups: [defaultGroupId] // Add default group
            });
            
            msg.innerText = 'Success! Login now.'; msg.style.color = 'var(--success)';
            setTimeout(toggleAuthMode, 1500);
        }
    } catch (error) { console.error(error); msg.innerText = 'Error connecting.'; msg.style.color = 'var(--danger)'; }
}

async function handleLogin() {
    const u = document.getElementById('auth-username').value.trim();
    const p = document.getElementById('auth-password').value.trim();
    const msg = document.getElementById('auth-msg');
    
    msg.innerText = 'Verifying...';
    try {
        const userDoc = await db.collection("users").doc(u).get();
        if (userDoc.exists) {
            if (userDoc.data().password === p) {
                currentUser = u;
                document.getElementById('auth-screen').style.display = 'none';
                document.getElementById('app-dashboard').style.display = 'flex';
                initUserApp(u);
            } else { msg.innerText = 'Wrong password'; msg.style.color = 'var(--danger)'; }
        } else { msg.innerText = 'User not found'; msg.style.color = 'var(--danger)'; }
    } catch (error) { console.error(error); msg.innerText = 'Connection failed.'; msg.style.color = 'var(--danger)'; }
}

function handleLogout() {
    if(groupUnsubscribe) groupUnsubscribe();
    if(userUnsubscribe) userUnsubscribe();
    currentUser = null; currentGroupId = null;
    document.getElementById('app-dashboard').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('auth-username').value = '';
    document.getElementById('auth-password').value = '';
    document.getElementById('mainDropdown').classList.remove('active');
}

// --- APP INITIALIZATION ---
function initUserApp(username) {
    // 1. Listen to User Profile (to get list of Groups)
    userUnsubscribe = db.collection("users").doc(username).onSnapshot(async (doc) => {
        if(doc.exists) {
            const userData = doc.data();
            userProfile = userData.profile || {};
            userGroups = userData.groups || [];
            
            updateProfileUI(); // Update Avatar/Name in Menu
            renderSidebarGroups(); // Update Sidebar list
            
            // Auto-select first group if none selected
            if (!currentGroupId && userGroups.length > 0) {
                selectGroup(userGroups[0]);
            }
        }
    });
}

// --- GROUP MANAGEMENT ---
async function renderSidebarGroups() {
    const container = document.getElementById('groups-nav-list');
    container.innerHTML = ''; // Clear

    for (const gid of userGroups) {
        // Fetch Group Name (Once)
        const gDoc = await db.collection("groups").doc(gid).get();
        if(gDoc.exists) {
            const gName = gDoc.data().name;
            const div = document.createElement('div');
            div.className = `nav-group-item ${gid === currentGroupId ? 'active' : ''}`;
            div.innerHTML = `<div class="group-icon"><i class="fas fa-users"></i></div> ${gName}`;
            div.onclick = () => selectGroup(gid);
            container.appendChild(div);
        }
    }
}

function selectGroup(groupId) {
    if(groupUnsubscribe) groupUnsubscribe(); // Stop listening to old group
    currentGroupId = groupId;
    renderSidebarGroups(); // Refresh active state CSS

    // Listen to Selected Group Data
    groupUnsubscribe = db.collection("groups").doc(groupId).onSnapshot((doc) => {
        if(doc.exists) {
            const gData = doc.data();
            document.getElementById('page-title').innerText = gData.name;
            document.getElementById('display-group-id').innerText = groupId;
            
            data.members = gData.members || [];
            data.expenses = gData.expenses || [];
            
            renderRoommates(); // Show Members
            renderExpenses(); // Show Expenses
            calculateSplit(); // Update Math
        }
    });
}

async function createNewGroup() {
    const name = document.getElementById('newGroupName').value.trim();
    if(!name) return;
    
    closeModal('groupModal');
    const newGroupId = `group_${Date.now()}`;
    
    try {
        // 1. Create Group Doc
        await db.collection("groups").doc(newGroupId).set({
            name: name,
            members: [currentUser],
            expenses: []
        });

        // 2. Add Group ID to User's list
        await db.collection("users").doc(currentUser).update({
            groups: firebase.firestore.FieldValue.arrayUnion(newGroupId)
        });

        alert("Group Created!");
        document.getElementById('newGroupName').value = '';
    } catch(e) { alert("Error creating group"); }
}

async function addMemberToGroup() {
    const newMemberId = document.getElementById('newMemberID').value.trim();
    if(!newMemberId) return;
    if(!currentGroupId) return alert("No group selected!");

    // Check if user exists
    const userRef = db.collection("users").doc(newMemberId);
    const userSnap = await userRef.get();

    if(!userSnap.exists) return alert("User ID not found!");
    
    try {
        // 1. Add User to Group Doc
        await db.collection("groups").doc(currentGroupId).update({
            members: firebase.firestore.FieldValue.arrayUnion(newMemberId)
        });

        // 2. Add Group to User's Doc
        await userRef.update({
            groups: firebase.firestore.FieldValue.arrayUnion(currentGroupId)
        });

        alert(`Added ${newMemberId} to group!`);
        document.getElementById('newMemberID').value = '';
    } catch(e) { alert("Error adding member"); }
}

// --- EXPENSES ---
async function addExpense() {
    const amount = parseFloat(document.getElementById('exAmount').value);
    const payer = document.getElementById('exPayer').value;
    const desc = document.getElementById('exDesc').value;
    
    if(amount && payer && desc && currentGroupId) {
        const newExpense = { 
            id: Date.now(), 
            amount, 
            payerID: payer, 
            desc, 
            date: new Date().toLocaleDateString() 
        };
        closeModal('expenseModal');

        // Add to GROUP doc (Syncs to everyone in group)
        await db.collection("groups").doc(currentGroupId).update({
            expenses: firebase.firestore.FieldValue.arrayUnion(newExpense)
        });
    }
}

async function deleteExpense(expenseId) {
    if(!confirm("Delete for everyone?")) return;
    const expenseToDelete = data.expenses.find(e => e.id === expenseId);
    if (!expenseToDelete) return;

    await db.collection("groups").doc(currentGroupId).update({
        expenses: firebase.firestore.FieldValue.arrayRemove(expenseToDelete)
    });
}

// --- RENDER UI ---
async function getOtherUserData(userId) {
    try {
        const doc = await db.collection("users").doc(userId).get();
        if(doc.exists) {
            const p = doc.data().profile || {};
            return {
                displayName: p.displayName || userId,
                avatar: p.avatar || `https://ui-avatars.com/api/?name=${userId}&background=333&color=fff`
            };
        }
    } catch(e) { console.log(e); }
    return { displayName: userId, avatar: `https://ui-avatars.com/api/?name=${userId}&background=333&color=fff` };
}

function renderRoommates() {
    const list = document.getElementById('roommatesList');
    const select = document.getElementById('exPayer');
    let listHTML = '';
    let selectHTML = '';

    data.members.forEach(userId => {
        let isMe = userId === currentUser;
        listHTML += `<div class="chip verified" id="chip-${userId}">
            <img src="https://ui-avatars.com/api/?name=${userId}" id="img-${userId}"> 
            <span id="name-${userId}">${userId}</span>
        </div>`;
        selectHTML += `<option value="${userId}" id="opt-${userId}">${userId}</option>`;
        
        getOtherUserData(userId).then(u => {
            if(document.getElementById(`name-${userId}`)) document.getElementById(`name-${userId}`).innerText = u.displayName + (isMe ? " (Me)" : "");
            if(document.getElementById(`img-${userId}`)) document.getElementById(`img-${userId}`).src = u.avatar;
            if(document.getElementById(`opt-${userId}`)) document.getElementById(`opt-${userId}`).innerText = u.displayName;
        });
    });

    list.innerHTML = listHTML;
    select.innerHTML = selectHTML;
}

function renderExpenses() {
    const list = document.getElementById('expenseList');
    if(data.expenses.length === 0) { list.innerHTML = '<div style="text-align:center; padding: 40px; opacity:0.5;">No transactions</div>'; return; }
    
    list.innerHTML = data.expenses.slice().reverse().map(e => {
        return `<div class="expense-item">
            <div style="display:flex; align-items:center; gap: 15px;">
                <img src="" id="exp-img-${e.id}" style="width:40px; height:40px; border-radius:12px; object-fit:cover;">
                <div>
                    <div style="font-weight: 600;">${e.desc}</div>
                    <small style="color: var(--text-muted);"><span id="exp-name-${e.id}">...</span> • ${e.date}</small>
                </div>
            </div>
            <div style="text-align:right;"><div style="font-weight: 700; color: var(--text-main);">₹${e.amount}</div><i class="fas fa-trash" style="font-size: 0.8rem; color: var(--danger); cursor: pointer; opacity: 0.6;" onclick="deleteExpense(${e.id})"></i></div>
        </div>`;
    }).join('');

    data.expenses.forEach(e => {
        getOtherUserData(e.payerID).then(u => {
            if(document.getElementById(`exp-img-${e.id}`)) document.getElementById(`exp-img-${e.id}`).src = u.avatar;
            if(document.getElementById(`exp-name-${e.id}`)) document.getElementById(`exp-name-${e.id}`).innerText = u.displayName;
        });
    });
}

function calculateSplit() {
    if(!data.members.length) return;
    let balances = {}; 
    data.members.forEach(m => balances[m] = 0);
    
    const total = data.expenses.reduce((sum, e) => sum + e.amount, 0);
    const split = total / data.members.length;
    
    data.expenses.forEach(e => { if(balances[e.payerID] !== undefined) balances[e.payerID] += e.amount; });
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
            <span><span style="color:var(--danger)" id="db-${i}-${j}">...</span> pays <span style="color:var(--success)" id="cr-${i}-${j}">...</span></span>
            <strong>₹${val.toFixed(0)}</strong></li>`;
        
        // Resolve Names for Split
        getOtherUserData(d.p).then(u => { if(document.getElementById(`db-${i}-${j}`)) document.getElementById(`db-${i}-${j}`).innerText = u.displayName; });
        getOtherUserData(c.p).then(u => { if(document.getElementById(`cr-${i}-${j}`)) document.getElementById(`cr-${i}-${j}`).innerText = u.displayName; });

        d.amt += val; c.amt -= val;
        if(Math.abs(d.amt) < 0.1) i++;
        if(c.amt < 0.1) j++;
    }
    document.getElementById('settlementPlan').innerHTML = html + '</ul>';
    
    // AI Text Update
    const aiText = document.getElementById('aiText');
    if(aiText) aiText.innerHTML = `Total Group Spending: <strong style="color:var(--success)">₹${total}</strong>`;
}

// --- USER PROFILE & UTILS ---
function updateProfileUI() {
    const finalAvatar = userProfile.avatar || `https://ui-avatars.com/api/?name=${currentUser}&background=6366f1&color=fff`;
    const finalName = userProfile.displayName || currentUser;
    
    document.getElementById('header-avatar').querySelector('img').src = finalAvatar;
    document.getElementById('header-avatar').style.display = 'block';
    
    document.getElementById('menu-user-avatar').src = finalAvatar;
    document.getElementById('menu-user-name').innerText = finalName;
    document.getElementById('menu-user-id').innerText = '@' + currentUser;

    document.getElementById('profile-img-preview').src = finalAvatar;
    document.getElementById('profile-name-display').innerText = finalName;
    document.getElementById('profile-id-display').innerText = '@' + currentUser;
    
    document.getElementById('edit-display-name').value = finalName;
    document.getElementById('edit-bio').value = userProfile.bio || '';
    document.getElementById('edit-username').value = currentUser;
}

async function saveProfileChanges() {
    const newName = document.getElementById('edit-display-name').value.trim();
    const newPass = document.getElementById('edit-password').value.trim();
    const imgSrc = document.getElementById('profile-img-preview').src;
    
    let updates = {
        "profile.displayName": newName || currentUser,
        "profile.bio": document.getElementById('edit-bio').value.trim()
    };
    if(!imgSrc.includes('ui-avatars.com')) updates["profile.avatar"] = imgSrc;
    if(newPass) updates["password"] = newPass;

    try {
        await db.collection("users").doc(currentUser).update(updates);
        alert("Profile Updated!");
        switchView('expenses');
    } catch(e) { alert("Error updating profile"); }
}

// Utils
function openProfile() { switchView('profile'); }
function openPasswordChange() { openProfile(); setTimeout(() => { document.getElementById('security-section').scrollIntoView({ behavior: 'smooth' }); document.getElementById('edit-password').focus(); }, 300); }
function handleImageUpload(input) { if (input.files && input.files[0]) { const reader = new FileReader(); reader.onload = function(e) { if(e.total > 2000000) { alert("Image too large!"); return; } document.getElementById('profile-img-preview').src = e.target.result; }; reader.readAsDataURL(input.files[0]); } }
function setTheme(themeName) { document.body.setAttribute('data-theme', themeName); }
function toggleMenu(event) { event.stopPropagation(); document.getElementById('mainDropdown').classList.toggle('active'); }
document.addEventListener('click', (e) => { if(!e.target.closest('.menu-container')) document.getElementById('mainDropdown').classList.remove('active'); });
function switchView(v) { document.getElementById('view-expenses').style.display = 'none'; document.getElementById('view-summary').style.display = 'none'; document.getElementById('view-profile').style.display = 'none'; document.getElementById('fab-btn').style.display = 'flex'; if(v === 'expenses') { document.getElementById('view-expenses').style.display = 'grid'; } else if(v === 'summary') { document.getElementById('view-summary').style.display = 'grid'; renderChart(); } else if(v === 'profile') { document.getElementById('view-profile').style.display = 'block'; document.getElementById('fab-btn').style.display = 'none'; } document.getElementById('mainDropdown').classList.remove('active'); }
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
function openGroupModal() { openModal('groupModal'); }
function triggerAI(type) { const card = document.getElementById('aiCard'); card.classList.remove('show'); setTimeout(() => { card.classList.add('show'); }, 50); }
function exportCSV() { alert('CSV Export'); }
let chartInstance = null; function renderChart() { const ctx = document.getElementById('doughnutChart').getContext('2d'); let totals = {}; data.members.forEach(m => totals[m] = 0); data.expenses.forEach(e => { if(totals[e.payerID] !== undefined) totals[e.payerID] += e.amount; }); if(chartInstance) chartInstance.destroy(); chartInstance = new Chart(ctx, { type: 'doughnut', data: { labels: Object.keys(totals), datasets: [{ data: Object.values(totals), backgroundColor: ['#6366f1', '#a855f7', '#ec4899', '#10b981'], borderWidth:0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position:'right', labels:{color:'#fff'} } } } }); }
