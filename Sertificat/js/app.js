import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, setDoc, getDoc, updateDoc, getDocs, deleteDoc,
  query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { firebaseConfig } from "./firebase-config.js";
import { renderCertificatePdf } from "./certificate.js";

/* ---------------- Инициализация ---------------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const WORK_KEY = "certgen.workId";
let user = null;
// work = { id, title, subject, groups: [{ id, name, students: [{ id, name, grade }] }] }
let work = null;

if (firebaseConfig.apiKey.startsWith("YOUR")) {
  console.warn("Заполните js/firebase-config.js");
}

/* ---------------- UI-помощники ---------------- */
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 3000);
}

function show(id) {
  if (["groups", "grades"].includes(id) && !work) {
    toast("Сначала укажите тему и предмет на главной");
    id = "home";
  }
  document.querySelectorAll(".section").forEach(s => s.classList.toggle("active", s.id === id));
  document.querySelectorAll(".nav-link").forEach(a => a.classList.toggle("active", a.dataset.target === id));
  history.replaceState(null, "", "#" + id);
}

document.querySelectorAll(".nav-link").forEach(a =>
  a.addEventListener("click", e => { e.preventDefault(); show(a.dataset.target); })
);

function renderWorkInfo() {
  const box = $("#currentWorkInfo");
  if (!work) return box.classList.add("hidden");
  box.classList.remove("hidden");
  box.innerHTML = `Текущая работа: <b>${esc(work.title)}</b> · ${esc(work.subject)}`;
}

function renderAll() {
  renderWorkInfo();
  renderGroups();
  renderGrades();
}

/* ---------------- Авторизация (анонимная) ---------------- */
onAuthStateChanged(auth, async u => {
  if (!u) {
    signInAnonymously(auth).catch(e => ($("#userStatus").textContent = "Ошибка входа: " + e.message));
    return;
  }
  user = u;
  $("#userStatus").textContent = "Подключено ✓";
  await loadWork();
  renderAll();
  loadHistory();
  show(location.hash.slice(1) || "home");
});

/* ---------------- Работа ---------------- */
async function loadWork() {
  const id = localStorage.getItem(WORK_KEY);
  work = null;
  if (!id) return;
  try {
    const snap = await getDoc(doc(db, "works", id));
    if (snap.exists() && snap.data().ownerId === user.uid) {
      const d = snap.data();
      work = { id, title: d.title, subject: d.subject, groups: d.groups || [] };
      $("#workTitle").value = work.title;
      $("#workSubject").value = work.subject;
    } else {
      localStorage.removeItem(WORK_KEY);
    }
  } catch (e) {
    toast("Не удалось загрузить работу: " + e.message);
  }
}

async function saveWork() {
  await updateDoc(doc(db, "works", work.id), {
    title: work.title,
    subject: work.subject,
    groups: work.groups,
    updatedAt: serverTimestamp()
  });
}

// Главная: «Настроить»
$("#workForm").addEventListener("submit", async e => {
  e.preventDefault();
  const title = $("#workTitle").value.trim();
  const subject = $("#workSubject").value.trim();
  try {
    if (!work) {
      const ref = doc(collection(db, "works"));
      work = { id: ref.id, title, subject, groups: [] };
      await setDoc(ref, {
        ownerId: user.uid, title, subject, groups: [], createdAt: serverTimestamp()
      });
      localStorage.setItem(WORK_KEY, work.id);
    } else {
      work.title = title;
      work.subject = subject;
      await saveWork();
    }
    renderAll();
    show("groups");
    toast("Работа сохранена");
  } catch (err) {
    toast("Ошибка сохранения: " + err.message);
  }
});

$("#newWorkBtn").addEventListener("click", () => {
  work = null;
  localStorage.removeItem(WORK_KEY);
  $("#workForm").reset();
  renderAll();
  toast("Создайте новую работу");
});

/* ---------------- Группы и студенты ---------------- */
$("#groupForm").addEventListener("submit", async e => {
  e.preventDefault();
  const name = $("#groupName").value.trim();
  const students = $("#studentsInput").value
    .split("\n").map(s => s.trim()).filter(Boolean)
    .map(n => ({ id: crypto.randomUUID(), name: n, grade: "" }));
  if (!students.length) return toast("Добавьте хотя бы одного студента");

  work.groups.push({ id: crypto.randomUUID(), name, students });
  try {
    await saveWork();
    e.target.reset();
    renderAll();
    toast(`Группа «${name}» добавлена`);
  } catch (err) {
    toast("Ошибка: " + err.message);
  }
});

function renderGroups() {
  if (!work) return;
  $("#groupsList").innerHTML = work.groups.map((g, gi) => `
    <div class="group-card">
      <div class="group-head">
        <h3>${esc(g.name)} <span class="muted">(${g.students.length})</span></h3>
        <button class="btn small danger" data-action="del-group" data-gi="${gi}">Удалить группу</button>
      </div>
      <ul>
        ${g.students.map((s, si) => `
          <li>${esc(s.name)}
            <button class="link" data-action="del-student" data-gi="${gi}" data-si="${si}">✕</button>
          </li>`).join("")}
      </ul>
      <div class="row">
        <input data-add-input="${gi}" placeholder="Новый студент (ФИО)">
        <button class="btn small" data-action="add-student" data-gi="${gi}">+ Добавить</button>
      </div>
    </div>`).join("") || `<p class="muted">Групп пока нет. Добавьте первую группу выше.</p>`;
}

$("#groupsList").addEventListener("click", async e => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const gi = +b.dataset.gi;
  const si = +b.dataset.si;

  if (b.dataset.action === "del-group") {
    if (!confirm("Удалить группу вместе со студентами?")) return;
    work.groups.splice(gi, 1);
  } else if (b.dataset.action === "del-student") {
    work.groups[gi].students.splice(si, 1);
  } else if (b.dataset.action === "add-student") {
    const input = $(`[data-add-input="${gi}"]`);
    const name = input.value.trim();
    if (!name) return;
    work.groups[gi].students.push({ id: crypto.randomUUID(), name, grade: "" });
  } else {
    return;
  }
  try {
    await saveWork();
    renderAll();
  } catch (err) {
    toast("Ошибка: " + err.message);
  }
});

/* ---------------- Оценки ---------------- */
// Принимает "5/3", "5 / 3", "4,5/5", "5" и т.п. Возвращает строку, '' или null (ошибка).
function normalizeGrade(value) {
  const t = value.trim().replace(/\s+/g, "").replace(",", ".");
  if (!t) return "";
  if (!/^\d+(\.\d+)?(\/\d+(\.\d+)?)?$/.test(t)) return null;
  return t;
}

function renderGrades() {
  if (!work) return;
  $("#gradesList").innerHTML = work.groups.map((g, gi) => `
    <div class="group-card">
      <h3>${esc(g.name)}</h3>
      <table class="grades-table">
        <thead><tr><th>#</th><th>ФИО</th><th>Оценка</th></tr></thead>
        <tbody>
          ${g.students.map((s, si) => `
            <tr>
              <td>${si + 1}</td>
              <td>${esc(s.name)}</td>
              <td><input class="grade-input" data-gi="${gi}" data-si="${si}"
                         value="${esc(s.grade)}" placeholder="5/3"></td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`).join("") || `<p class="muted">Сначала добавьте группы.</p>`;
}

/** Читает оценки из полей в work. Возвращает null, если всё ок, иначе строку с ошибкой. */
function collectGrades() {
  let bad = null;
  document.querySelectorAll(".grade-input").forEach(inp => {
    const gi = +inp.dataset.gi, si = +inp.dataset.si;
    const g = normalizeGrade(inp.value);
    if (g === null) {
      bad ??= `${work.groups[gi].students[si].name} («${inp.value}»)`;
      return;
    }
    work.groups[gi].students[si].grade = g;
  });
  return bad;
}

async function saveGrades() {
  if (!work) return false;
  const bad = collectGrades();
  if (bad) {
    toast("Неверный формат оценки: " + bad);
    return false;
  }
  await saveWork();
  toast("Оценки сохранены");
  return true;
}

$("#saveGradesBtn").addEventListener("click", () => saveGrades().catch(e => toast(e.message)));

/* ---------------- Генерация сертификатов ---------------- */
function log(msg) {
  const el = $("#genLog");
  el.innerHTML += `<div>${esc(msg)}</div>`;
  el.scrollTop = el.scrollHeight;
}

$("#generateBtn").addEventListener("click", async () => {
  if (!(await saveGrades().catch(() => false))) return;

  const items = [];
  work.groups.forEach(g => g.students.forEach(s => {
    if (s.grade) items.push({ group: g, student: s });
  }));
  if (!items.length) return toast("Нет студентов с оценками");

  const btn = $("#generateBtn");
  btn.disabled = true;
  $("#progress").classList.remove("hidden");
  $("#progressBar").style.width = "0%";
  $("#genLog").innerHTML = "";

  let done = 0;
  for (const { group, student } of items) {
    try {
      const certRef = doc(collection(db, "certificates"));
      const certId = certRef.id;
      const number = certId.slice(0, 8).toUpperCase();
      const date = new Date().toLocaleDateString("ru-RU");

      const blob = await renderCertificatePdf({
        studentName: student.name,
        groupName: group.name,
        grade: student.grade,
        workTitle: work.title,
        subject: work.subject,
        date,
        number
      });

      const path = `certificates/${user.uid}/${certId}.pdf`;
      await uploadBytes(ref(storage, path), blob, { contentType: "application/pdf" });
      const url = await getDownloadURL(ref(storage, path));

      await setDoc(certRef, {
        ownerId: user.uid,
        workId: work.id,
        workTitle: work.title,
        subject: work.subject,
        groupName: group.name,
        studentName: student.name,
        grade: student.grade,
        number,
        storagePath: path,
        pdfUrl: url,
        createdAt: serverTimestamp()
      });
      log(`✔ ${student.name} — ${student.grade}`);
    } catch (err) {
      log(`✖ ${student.name}: ${err.message}`);
    }
    done++;
    $("#progressBar").style.width = `${(done / items.length) * 100}%`;
  }

  btn.disabled = false;
  toast(`Готово: ${done} сертификатов`);
  loadHistory();
});

/* ---------------- История ---------------- */
async function loadHistory() {
  if (!user) return;
  const list = $("#historyList");
  try {
    const snap = await getDocs(query(collection(db, "certificates"), where("ownerId", "==", user.uid)));
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const time = x => x?.toMillis?.() ?? Date.now();
    items.sort((a, b) => time(b.createdAt) - time(a.createdAt));

    if (!items.length) {
      list.innerHTML = `<p class="muted">Сертификатов пока нет.</p>`;
      return;
    }

    list.innerHTML = `
      <table class="grades-table">
        <thead><tr>
          <th>Студент</th><th>Группа</th><th>Работа</th><th>Оценка</th><th>Дата</th><th></th>
        </tr></thead>
        <tbody>
          ${items.map(it => `
            <tr>
              <td>${esc(it.studentName)}</td>
              <td>${esc(it.groupName)}</td>
              <td>${esc(it.workTitle)}</td>
              <td><b>${esc(it.grade)}</b></td>
              <td>${it.createdAt?.toDate ? it.createdAt.toDate().toLocaleDateString("ru-RU") : "сейчас"}</td>
              <td>
                <button class="btn small" data-action="download"
                  data-path="${esc(it.storagePath)}" data-name="${esc(it.studentName)}">⬇ PDF</button>
                <button class="btn small danger" data-action="delete"
                  data-id="${esc(it.id)}" data-path="${esc(it.storagePath)}">Удалить</button>
              </td>
            </tr>`).join("")}
        </tbody>
      </table>`;
  } catch (err) {
    list.innerHTML = `<p class="muted">Ошибка загрузки истории: ${esc(err.message)}</p>`;
  }
}

$("#historyList").addEventListener("click", async e => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const { id, path, name } = b.dataset;
  b.disabled = true;
  try {
    if (b.dataset.action === "download") {
      // Ссылка берётся заново из Storage по пути — работает и через полгода
      const url = await getDownloadURL(ref(storage, path));
      const blob = await (await fetch(url)).blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `Сертификат — ${name}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } else if (b.dataset.action === "delete") {
      if (!confirm("Удалить сертификат?")) return;
      await deleteObject(ref(storage, path)).catch(() => {});
      await deleteDoc(doc(db, "certificates", id));
      toast("Сертификат удалён");
      loadHistory();
    }
  } catch (err) {
    toast("Ошибка: " + err.message);
  } finally {
    b.disabled = false;
  }
});
