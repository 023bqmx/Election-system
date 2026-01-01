// ดึงตัวแปรจาก Firebase
const { initializeApp, getDatabase, ref, push, onValue, remove, set } = window.firebaseModules;

// --- Config Firebase (อย่าลืมใส่ Key เดิมของคุณบอมนะ!) ---
const firebaseConfig = {
  apiKey: "AIzaSyA6vwT2urtZHEXRaCa3aw7hHtqq9XU9NEg", // ใส่ Key เดิมของคุณบอม
  authDomain: "evoting-c80ac.firebaseapp.com",
  databaseURL: "https://evoting-c80ac-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "evoting-c80ac",
  storageBucket: "evoting-c80ac.firebasestorage.app",
  messagingSenderId: "616160316636",
  appId: "1:616160316636:web:826aa279503ff64e4af819"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const dbRef = ref(db, 'votes');

// --- Splash Screen Logic (เพิ่มใหม่) ---
document.addEventListener('DOMContentLoaded', () => {
    // รอ 4000ms (4 วินาที) แล้วค่อยสั่งให้เฟดออก
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.classList.add('hidden');
        }
    }, 4000);
});

// --- Data Logic ---
const DEVICE_KEY = 'has_voted_device';
let currentSelection = null;
let deviceID = localStorage.getItem('device_id');

if (!deviceID) {
    deviceID = 'DEV-' + Math.floor(Math.random() * 10000);
    localStorage.setItem('device_id', deviceID);
}

let allVotes = [];

onValue(dbRef, (snapshot) => {
    const data = snapshot.val();
    allVotes = [];
    if (data) {
        Object.keys(data).forEach(key => {
            allVotes.push({ ...data[key], firebaseKey: key });
        });
    }
    if (document.getElementById('adminPanel').style.display === 'block') {
        renderCharts();
        renderHistory();
    }
});

// --- User Interaction ---
function checkRights() {
    if (localStorage.getItem(DEVICE_KEY) === 'true') {
        lockScreen();
    } else {
        unlockScreen();
    }
}

function lockScreen() {
    document.querySelectorAll('.party-card, .vote-no-btn').forEach(el => {
        el.style.opacity = '0.5';
        el.style.pointerEvents = 'none';
    });
    const headerP = document.querySelector('header p');
    if(headerP) {
        headerP.innerText = "คุณได้ใช้สิทธิลงคะแนนไปแล้ว";
        headerP.style.color = 'var(--accent)';
    }
}

function unlockScreen() {
    document.querySelectorAll('.party-card, .vote-no-btn').forEach(el => {
        el.style.opacity = '1';
        el.style.pointerEvents = 'auto';
    });
    const headerP = document.querySelector('header p');
    if(headerP) {
        headerP.innerText = "กรุณาเลือกผู้สมัครที่ท่านต้องการ";
        headerP.style.color = '#7f8c8d';
    }
}

window.selectParty = (num) => {
    document.querySelectorAll('.party-card').forEach(card => card.classList.remove('selected'));
    document.querySelectorAll('.party-card')[num-1].classList.add('selected');
    currentSelection = num;
    document.getElementById('confirmText').innerText = `คุณต้องการเลือก "พรรคหมายเลข ${num}" ใช่หรือไม่?`;
    window.openModal('confirmModal');
}

window.selectNoVote = () => {
    document.querySelectorAll('.party-card').forEach(card => card.classList.remove('selected'));
    currentSelection = 'no';
    document.getElementById('confirmText').innerText = `คุณต้องการ "ไม่ประสงค์ลงคะแนน" ใช่หรือไม่?`;
    window.openModal('confirmModal');
}

window.submitVote = () => {
    window.closeModal('confirmModal');
    push(dbRef, {
        choice: currentSelection,
        device: deviceID,
        timestamp: new Date().toLocaleString('th-TH')
    }).then(() => {
        localStorage.setItem(DEVICE_KEY, 'true');
        window.openModal('successModal');
        checkRights();
    }).catch((error) => {
        alert("เกิดข้อผิดพลาด: " + error.message);
    });
}

// --- Modals ---
window.openModal = (id) => document.getElementById(id).classList.add('active');
window.closeModal = (id) => {
    document.getElementById(id).classList.remove('active');
    if (id === 'adminLoginModal') document.getElementById('adminPin').value = '';
}

// --- Admin ---
window.openAdminLogin = () => window.openModal('adminLoginModal');
window.checkAdminPassword = () => {
    const pin = document.getElementById('adminPin').value;
    if (pin === '498471') {
        window.closeModal('adminLoginModal');
        window.showAdminPanel();
    } else {
        alert('รหัสผ่านไม่ถูกต้อง!');
    }
}
window.showAdminPanel = () => {
    document.getElementById('userView').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    renderCharts();
    renderHistory();
}
window.logoutAdmin = () => {
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('userView').style.display = 'block';
    checkRights();
}
window.deleteVote = (firebaseKey, targetDeviceID) => {
    if(confirm('ต้องการลบประวัติการโหวตนี้หรือไม่?')) {
        remove(ref(db, 'votes/' + firebaseKey));
        if (targetDeviceID === deviceID) {
            localStorage.removeItem(DEVICE_KEY);
            checkRights();
        }
    }
}
window.nukeAllData = () => {
    if(confirm('คำเตือน: ลบทุกคะแนนโหวตทั้งหมด! ยืนยัน?')) {
        set(dbRef, null);
        localStorage.removeItem(DEVICE_KEY);
        alert('ล้างข้อมูลเรียบร้อย');
    }
}

// --- Charts ---
let myPieChart = null;
let myBarChart = null;

function renderCharts() {
    let counts = { 1:0, 2:0, 3:0, 4:0, 'no':0 };
    allVotes.forEach(v => {
        if(counts[v.choice] !== undefined) counts[v.choice]++;
    });

    const dataValues = [counts[1], counts[2], counts[3], counts[4], counts['no']];
    const labels = ['พรรค 1', 'พรรค 2', 'พรรค 3', 'พรรค 4', 'ไม่ประสงค์'];
    const colors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#1A535C', '#95a5a6'];

    const ctxPie = document.getElementById('pieChart').getContext('2d');
    if(myPieChart) myPieChart.destroy();
    myPieChart = new Chart(ctxPie, {
        type: 'pie',
        data: { labels: labels, datasets: [{ data: dataValues, backgroundColor: colors }] }
    });

    const ctxBar = document.getElementById('barChart').getContext('2d');
    if(myBarChart) myBarChart.destroy();
    myBarChart = new Chart(ctxBar, {
        type: 'bar',
        data: { labels: labels, datasets: [{ label: 'คะแนน', data: dataValues, backgroundColor: colors, borderRadius: 5 }] },
        options: { scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
}

function renderHistory() {
    const list = document.getElementById('voteHistoryList');
    const reversedVotes = [...allVotes].reverse(); 
    list.innerHTML = '';
    reversedVotes.forEach(v => {
        const choiceText = v.choice === 'no' ? 'ไม่ประสงค์ลงคะแนน' : `พรรคเบอร์ ${v.choice}`;
        const li = document.createElement('li');
        li.className = 'history-item';
        li.innerHTML = `
            <div>
                <strong>${choiceText}</strong><br>
                <span style="font-size:0.8rem; color:#888;">${v.timestamp}</span>
                <span class="device-badge">${v.device}</span>
            </div>
            <button class="btn btn-danger" style="padding:5px 10px; width:auto; font-size:0.8rem;" 
                onclick="window.deleteVote('${v.firebaseKey}', '${v.device}')">ลบ</button>
        `;
        list.appendChild(li);
    });
}

checkRights();