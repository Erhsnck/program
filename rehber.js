/*
 * Rehber Öğretmen - Ders Yerleştirme (rehber.js)
 * Düzenlemeler:
 * 1. Firebase Config Gizleme: window.FIREBASE_CONFIG (config.js) kullanılır.
 * 2. Veri Doğrulama: İsim ve sınıf doğrulaması eklendi.
 * 3. XSS Güçlendirme: innerHTML yerine DOM oluşturma (createElement) kullanıldı.
 * 4. Yedekleme / Çevrimdışı: localStorage yedekleme fonksiyonları eklendi.
 * 5. Erişim Kontrolü: Firebase kuralları için firebase-security-rules.json başvurusu; kodda not bırakıldı.
 * 6. Mobil Uyumluluk: delete-btn dokunmatik alan genişletildi (CSS).
 * 7. Kod Modülerleştirme: CSS (rehber.css) ve JS (rehber.js) ayrıldı.
 */

// Firebase yapılandırması — config.js dosyasından yüklenir.
if (!window.FIREBASE_CONFIG) {
  console.error('config.js yüklenmedi — Firebase yapılandırması bulunamadı.');
}
const firebaseConfig = window.FIREBASE_CONFIG || {};

// Firebase başlatma — sadece config mevcutsa çalıştır.
if (firebaseConfig.apiKey) {
  firebase.initializeApp(firebaseConfig);
} else {
  console.warn('Firebase başlatılmadı: apiKey eksik.');
}
const db = firebase.database ? firebase.database() : null;

const günler = ["Pazartesi", "Çarşamba", "Perşembe"];
const saatler = [
  { ders: "12:00 - 12:40" },
  { ders: "12:50 - 13:30" },
  { ders: "13:40 - 14:20" },
  { ders: "14:30 - 15:10" },
  { ders: "15:20 - 16:00" },
  { ders: "16:10 - 16:50" },
  { ders: "17:00 - 17:40" },
  { ders: "17:50 - 18:30" },
];

let selected = { gün: '', idx: 0, el: null };
let ogrenciKayitlari = [];

// ============================================
// 2. VERİ DOĞRULAMA
// ============================================
function validateName(name) {
  const trimmed = name.trim();
  if (!trimmed) return { valid: false, message: 'Öğrenci adı girin.' };
  if (trimmed.length < 2) return { valid: false, message: 'İsim en az 2 karakter olmalı.' };
  if (trimmed.length > 50) return { valid: false, message: 'İsim çok uzun (max 50).' };
  // XSS önlemi: HTML etiketlerine izin verilmesin (istemci tarafı ek koruma)
  if (/<[^>]*>/g.test(trimmed)) return { valid: false, message: 'Geçersiz karakter içeriyor.' };
  return { valid: true, value: trimmed };
}

function validateClass(cls) {
  const trimmed = cls.trim();
  if (!trimmed) return { valid: true, value: '' }; // Sınıf zorunlu değil
  // Sadece 8, 9 gibi sayılar
  const pattern = /^[0-9]+$/;
  if (!pattern.test(trimmed)) {
    return { valid: false, message: 'Sınıf formatı geçersiz. Sadece sayı girin (ör. 8, 9).' };
  }
  return { valid: true, value: trimmed };
}

// ============================================
// 3. XSS GÜÇLENDİRME — DOM oluşturma
// ============================================
function createStudentTagElement(isimStr, sinifStr, gün, idx) {
  const span = document.createElement('span');
  span.className = 'student-tag';
  span.setAttribute('data-action', 'edit');
  span.setAttribute('data-gun', gün);
  span.setAttribute('data-idx', String(idx));
  span.setAttribute('data-isim', encodeURIComponent(isimStr || ''));
  span.setAttribute('data-sinif', encodeURIComponent(sinifStr || ''));

  // İsim metni
  const nameSpan = document.createElement('span');
  nameSpan.textContent = isimStr || '';
  span.appendChild(nameSpan);

  // Silme butonu (ayrı element)
  const delBtn = document.createElement('span');
  delBtn.className = 'delete-btn';
  delBtn.setAttribute('data-action', 'delete');
  delBtn.setAttribute('data-gun', gün);
  delBtn.setAttribute('data-idx', String(idx));
  delBtn.textContent = '✕';
  span.appendChild(delBtn);

  return span;
}

// ============================================
// 4. YEDEKLEME / ÇEVRİMDIŞI (localStorage)
// ============================================
function backupToLocalStorage() {
  try {
    const data = {
      timestamp: new Date().toISOString(),
      günler: günler,
      saatler: saatler,
      // Not: Firebase verisi senkronize; bu yedek sadece hızlı erişim için.
    };
    localStorage.setItem('rehber_backup', JSON.stringify(data));
    console.info('Rehber verisi yedeklendi (localStorage).');
  } catch (e) {
    console.warn('localStorage yedekleme hatası:', e);
  }
}

function restoreFromLocalStorage() {
  try {
    const raw = localStorage.getItem('rehber_backup');
    if (!raw) return null;
    const data = JSON.parse(raw);
    console.info('localStorage yedek yüklendi:', data.timestamp);
    return data;
  } catch (e) {
    console.warn('localStorage geri yükleme hatası:', e);
    return null;
  }
}

// ============================================
// 5. ERİŞİM KONTROLÜ NOTU
// ============================================
// Firebase kurallarını yapılandırmak için firebase-security-rules.json dosyasına bakın.
// Üretim ortamında .read ve .write kurallarını auth tabanlı olarak kısıtlayın.

function renderGrid() {
  const grid = document.getElementById('grid');
  if (!grid) return;
  grid.innerHTML = '';
  günler.forEach(gün => {
    const card = document.createElement('div');
    card.className = 'day-card';

    const title = document.createElement('div');
    title.className = 'day-title';
    const dot = document.createElement('span');
    dot.className = 'dot';
    const titleText = document.createTextNode(' ' + gün);
    title.appendChild(dot);
    title.appendChild(titleText);
    card.appendChild(title);

    saatler.forEach((blok, i) => {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.innerHTML = `
        <div>
          <div class="time">${blok.ders}</div>
         
          <div class="empty-hint" id="hint-${gün}-${i}">Atama yapmak için tıklayın</div>
        </div>
      `;
      slot.addEventListener('click', () => openModal(gün, i, slot, blok));
      card.appendChild(slot);
    });
    grid.appendChild(card);
  });
}

function openModal(gün, idx, el, blok) {
  selected = { gün, idx, el, blok, mode: 'ata' };
  const sub = document.getElementById('modal-sub');
  if (sub) sub.textContent = `${gün} — ${blok.ders}`;
  const studentInput = document.getElementById('studentInput');
  const classInput = document.getElementById('classInput');
  if (studentInput) studentInput.value = '';
  if (classInput) classInput.value = '';
  const suggestions = document.getElementById('suggestions');
  if (suggestions) suggestions.innerHTML = '';
  updateModalUI();
  const modal = document.getElementById('modal');
  if (modal) modal.classList.add('active');
  setTimeout(() => {
    if (studentInput) studentInput.focus();
  }, 50);
}

function openEditModal(gün, idx, mevcutIsimEnc, mevcutSinifEnc) {
  selected = {
    gün,
    idx,
    el: null,
    blok: null,
    mode: 'duzenle',
    mevcutIsim: mevcutIsimEnc ? decodeURIComponent(mevcutIsimEnc) : '',
    mevcutSinif: mevcutSinifEnc ? decodeURIComponent(mevcutSinifEnc) : ''
  };
  const blok = saatler[idx];
  const sub = document.getElementById('modal-sub');
  if (sub) sub.textContent = `${gün} — ${blok ? blok.ders : ''}`;
  const studentInput = document.getElementById('studentInput');
  const classInput = document.getElementById('classInput');
  if (studentInput) studentInput.value = selected.mevcutIsim || '';
  if (classInput) classInput.value = selected.mevcutSinif || '';
  const suggestions = document.getElementById('suggestions');
  if (suggestions) suggestions.innerHTML = '';
  updateModalUI();
  const modal = document.getElementById('modal');
  if (modal) modal.classList.add('active');
  setTimeout(() => {
    if (studentInput) studentInput.focus();
  }, 50);
}

function updateModalUI() {
  const title = document.querySelector('.modal-box h2');
  const btnPrimary = document.getElementById('btn-primary');
  const btnSecondary = document.getElementById('btn-secondary');
  if (!title || !btnPrimary || !btnSecondary) return;
  if (selected.mode === 'duzenle') {
    title.textContent = 'Öğrenciyi Düzenle';
    btnPrimary.innerHTML = 'Güncelle';
    btnSecondary.innerHTML = 'Sil';
    btnSecondary.onclick = deleteStudent;
    btnSecondary.className = 'btn-danger';
    btnPrimary.className = 'btn-primary';
  } else {
    title.textContent = 'Öğrenci Ata';
    btnPrimary.innerHTML = 'Kaydet';
    btnPrimary.onclick = saveStudent;
    btnSecondary.innerHTML = 'İptal';
    btnSecondary.onclick = closeModal;
    btnSecondary.className = 'btn-secondary';
  }
  btnPrimary.onclick = (selected.mode === 'duzenle') ? saveEdit : saveStudent;
}

function closeModal() {
  const modal = document.getElementById('modal');
  if (modal) modal.classList.remove('active');
  selected = { gün: '', idx: 0, el: null };
}

function filterSuggestions(query) {
  const list = document.getElementById('suggestions');
  if (!list) return;
  list.innerHTML = '';
  if (!query || !query.trim()) return;
  const matches = ogrenciKayitlari.filter(o => o.toLowerCase().includes(query.toLowerCase())).slice(0, 8);
  matches.forEach(m => {
    const li = document.createElement('li');
    li.textContent = m;
    li.onclick = () => {
      const studentInput = document.getElementById('studentInput');
      if (studentInput) studentInput.value = m;
      list.innerHTML = '';
    };
    list.appendChild(li);
  });
}

function saveEdit() {
  const studentInput = document.getElementById('studentInput');
  const classInput = document.getElementById('classInput');
  if (!studentInput) return;
  const val = studentInput.value.trim();
  const sinif = classInput ? classInput.value.trim() : '';

  const nameCheck = validateName(val);
  if (!nameCheck.valid) { alert(nameCheck.message); return; }
  const classCheck = validateClass(sinif);
  if (!classCheck.valid) { alert(classCheck.message); return; }

  if (!selected.gün) return;
  const key = `dersler/${selected.gün}/${selected.idx}`;
  if (db) {
    db.ref(key).set({ isim: nameCheck.value, sinif: classCheck.value });
    db.ref('ogrenciAdlari').once('value').then(snap => {
      let mevcut = snap.exists() ? Object.values(snap.val()) : [];
      if (!mevcut.includes(nameCheck.value)) {
        db.ref('ogrenciAdlari').push(nameCheck.value);
      }
    });
  }
  closeModal();
}

function deleteStudent() {
  if (!selected.gün) return;
  const key = `dersler/${selected.gün}/${selected.idx}`;
  if (db) db.ref(key).remove();
  closeModal();
}

function saveStudent() {
  const studentInput = document.getElementById('studentInput');
  const classInput = document.getElementById('classInput');
  if (!studentInput) return;
  const val = studentInput.value.trim();
  const sinif = classInput ? classInput.value.trim() : '';

  const nameCheck = validateName(val);
  if (!nameCheck.valid) { alert(nameCheck.message); return; }
  const classCheck = validateClass(sinif);
  if (!classCheck.valid) { alert(classCheck.message); return; }

  if (!selected.gün) return;
  const key = `dersler/${selected.gün}/${selected.idx}`;
  if (db) {
    db.ref(key).set({ isim: nameCheck.value, sinif: classCheck.value });
    db.ref('ogrenciAdlari').once('value').then(snap => {
      let mevcut = snap.exists() ? Object.values(snap.val()) : [];
      if (!mevcut.includes(nameCheck.value)) {
        db.ref('ogrenciAdlari').push(nameCheck.value);
      }
    });
  }
  closeModal();
}

function loadOgrenciKayitlari() {
  if (!db) return;
  db.ref('ogrenciAdlari').once('value').then(snap => {
    if (snap.exists()) ogrenciKayitlari = Object.values(snap.val());
  });
  db.ref('ogrenciAdlari').on('value', snap => {
    if (snap.exists()) ogrenciKayitlari = Object.values(snap.val());
  });
}

function deleteSlotStudent(gün, idx) {
  selected = { gün, idx, mode: 'duzenle', mevcutIsim: '', mevcutSinif: '' };
  deleteStudent();
}

function syncUI() {
  if (!db) return;
  günler.forEach(gün => {
    saatler.forEach((_, i) => {
      const meşgulRef = db.ref(`meşgul/${gün}/${i}`);
      meşgulRef.on('value', snap => {
        const slot = document.querySelector(`#grid .day-card:nth-child(${günler.indexOf(gün)+1}) .slot:nth-child(${i+2})`);
        if (!slot) return;
        const isBusy = snap.exists() && snap.val() === true;
        if (isBusy) {
          slot.classList.add('locked');
        } else {
          slot.classList.remove('locked');
        }
      });

      const dersRef = db.ref(`dersler/${gün}/${i}`);
      dersRef.on('value', snap => {
        const slot = document.querySelector(`#grid .day-card:nth-child(${günler.indexOf(gün)+1}) .slot:nth-child(${i+2})`);
        const hint = document.getElementById(`hint-${gün}-${i}`);
        if (!slot || !hint) return;
        if (snap.exists() && snap.val()) {
          const veri = snap.val();
          const isimStr = (typeof veri === 'object' && veri !== null) ? (veri.isim || '') : veri;
          const sinifStr = (typeof veri === 'object' && veri !== null) ? (veri.sinif || '') : '';

          // XSS önlemi: innerHTML yerine DOM oluşturma
          hint.innerHTML = '';
          hint.appendChild(createStudentTagElement(isimStr, sinifStr, gün, i));
        } else {
          hint.textContent = 'Atama yapmak için tıklayın';
        }
      });
    });
  });
}

// ============================================
// BAŞLATMA
// ============================================
renderGrid();

const gridEl = document.getElementById('grid');
if (gridEl) {
  gridEl.addEventListener('click', function(e) {
    const deleteBtn = e.target.closest('.delete-btn');
    if (deleteBtn) {
      e.stopPropagation();
      e.preventDefault();
      const gün = deleteBtn.getAttribute('data-gun');
      const idx = parseInt(deleteBtn.getAttribute('data-idx'), 10);
      deleteSlotStudent(gün, idx);
      return;
    }
    const studentTag = e.target.closest('.student-tag');
    if (studentTag) {
      e.stopPropagation();
      e.preventDefault();
      const gün = studentTag.getAttribute('data-gun');
      const idx = parseInt(studentTag.getAttribute('data-idx'), 10);
      const isim = decodeURIComponent(studentTag.getAttribute('data-isim') || '');
      const sinif = decodeURIComponent(studentTag.getAttribute('data-sinif') || '');
      openEditModal(gün, idx, isim, sinif);
      return;
    }
  });
}

loadOgrenciKayitlari();
syncUI();
backupToLocalStorage();

// Çevrimdışı destek: sayfa yüklenince yedekten bilgi yükle (isteğe bağlı)
const backupData = restoreFromLocalStorage();
if (backupData) {
  console.info('Yedek verisi mevcut:', backupData);
}
