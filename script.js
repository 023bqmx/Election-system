// ดึงตัวแปรจาก Firebase ที่เรา Import ไว้ใน HTML
const { initializeApp, getDatabase, ref, push, onValue, remove, set } = window.firebaseModules;

// --- 1. การตั้งค่า Firebase (เอา Config จากหน้าเว็บ Firebase มาใส่ตรงนี้) ---
const firebaseConfig = {
  apiKey: "AIzaSyA6vwT2urtZHEXRaCa3aw7hHtqq9XU9NEg",
  authDomain: "evoting-c80ac.firebaseapp.com",
  databaseURL: "https://evoting-c80ac-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "evoting-c80ac",
  storageBucket: "evoting-c80ac.firebasestorage.app",
  messagingSenderId: "616160316636",
  appId: "1:616160316636:web:826aa279503ff64e4af819"
};

// เริ่มต้นระบบ
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const dbRef = ref(db, 'votes'); // ชื่อตารางใน Database คือ 'votes'

// --- Data Logic ---
const DEVICE_KEY = 'has_voted_device';
let currentSelection = null;
let deviceID = localStorage.getItem('device_id');

if (!deviceID) {
    deviceID = 'DEV-' + Math.floor(Math.random() * 10000);
    localStorage.setItem('device_id', deviceID);
}

// Global variable เก็บข้อมูลโหวตเพื่อใช้ทำกราฟ
let allVotes = [];

// --- Real-time Listener (หัวใจสำคัญ) ---
// ฟังก์ชันนี้จะทำงานเองทุกครั้งที่มีใครกดโหวต (ไม่ว่าจากเครื่องไหน)
onValue(dbRef, (snapshot) => {
    const data = snapshot.val();
    allVotes = []; // เคลียร์ค่าเก่า
    
    if (data) {
        // แปลง Object ของ Firebase ให้เป็น Array
        Object.keys(data).forEach(key => {
            allVotes.push({
                ...data[key],
                firebaseKey: key // เก็บ Key ไว้สำหรับลบ
            });
        });
    }

    // ถ้าหน้า Admin เปิดอยู่ ให้อัปเดตกราฟทันที
    if (document.getElementById('adminPanel').style.display === 'block') {
        renderCharts();
        renderHistory();
    }
});


// --- User Interaction ---

function checkRights() {
    // เช็คสิทธิ์จาก LocalStorage (Client Side Check)
    // หมายเหตุ: การเช็ค Real-time ว่าเครื่องนี้เคยโหวตหรือยังจาก Database จะซับซ้อนกว่า
    // สำหรับโปรเจกต์นี้ ใช้ LocalStorage เช็คก็เพียงพอครับ
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

// ต้องเอาฟังก์ชันไปผูกกับ window เพราะเราใช้ type="module"
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

    // ส่งข้อมูลขึ้น Firebase Realtime Database
    push(dbRef, {
        choice: currentSelection,
        device: deviceID,
        timestamp: new Date().toLocaleString('th-TH')
    }).then(() => {
        // สำเร็จ
        localStorage.setItem(DEVICE_KEY, 'true');
        window.openModal('successModal');
        checkRights();
    }).catch((error) => {
        alert("เกิดข้อผิดพลาด: " + error.message);
    });
}

// --- Modal Helpers ---
window.openModal = (id) => {
    document.getElementById(id).classList.add('active');
}
window.closeModal = (id) => {
    document.getElementById(id).classList.remove('active');
    if (id === 'adminLoginModal') document.getElementById('adminPin').value = '';
}

// --- Admin System ---
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
        // ลบข้อมูลจาก Firebase
        const itemRef = ref(db, 'votes/' + firebaseKey);
        remove(itemRef);

        // ถ้าลบของเครื่องตัวเอง ให้ปลดล็อคเครื่องตัวเองด้วย
        if (targetDeviceID === deviceID) {
            localStorage.removeItem(DEVICE_KEY);
            checkRights();
        }
    }
}

window.nukeAllData = () => {
    if(confirm('คำเตือน: ลบทุกคะแนนโหวตบน Database ทั้งหมด! ยืนยัน?')) {
        set(dbRef, null); // ล้างข้อมูลใน path 'votes' ทั้งหมด
        localStorage.removeItem(DEVICE_KEY); // ล้างเครื่องตัวเอง
        alert('ล้างข้อมูลเรียบร้อย');
    }
}

// --- Charts Logic ---
let myPieChart = null;
let myBarChart = null;

function renderCharts() {
    // นับคะแนนจาก allVotes (ที่อัปเดตมาจาก Firebase แล้ว)
    let counts = { 1:0, 2:0, 3:0, 4:0, 'no':0 };
    allVotes.forEach(v => {
        if(counts[v.choice] !== undefined) counts[v.choice]++;
    });

    const dataValues = [counts[1], counts[2], counts[3], counts[4], counts['no']];
    const labels = ['พรรค 1', 'พรรค 2', 'พรรค 3', 'พรรค 4', 'ไม่ประสงค์'];
    const colors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#1A535C', '#95a5a6'];

    // Pie Chart
    const ctxPie = document.getElementById('pieChart').getContext('2d');
    if(myPieChart) myPieChart.destroy();
    myPieChart = new Chart(ctxPie, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{ data: dataValues, backgroundColor: colors }]
        }
    });

    // Bar Chart
    const ctxBar = document.getElementById('barChart').getContext('2d');
    if(myBarChart) myBarChart.destroy();
    myBarChart = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'คะแนน',
                data: dataValues,
                backgroundColor: colors,
                borderRadius: 5
            }]
        },
        options: {
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

function renderHistory() {
    const list = document.getElementById('voteHistoryList');
    // เรียงเอาล่าสุดขึ้นก่อน
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

// เริ่มต้นเช็คสิทธิ์
checkRights();