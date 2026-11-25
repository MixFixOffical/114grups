/* =========================================================
   KURATOR — бета-режим для страниц с modular SDK.
   Подменяет функции Firestore, когда KBeta.isOn() === true.
   Вне беты все функции работают как обычные вызовы SDK.
========================================================= */
import * as R from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

export * from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const on = () => !!(window.KBeta && window.KBeta.isOn());
let lastDb = null;

// Снимает обёртку с аргумента, если это наш объект
const ru = x => (x && (x.__sbq || x.__sbc || x.__sbid || x.__sbfp)) ? x.real : x;
const track = x => {
    if (x && x.type === "firestore") lastDb = x;
    else if (x && x.firestore) lastDb = x.firestore;
    return x;
};
const normField = f => {
    if (typeof f === "string") return f;
    if (f && f.__sbid) return "__id";
    if (f && f.__sbfp) return f.__segs.join(".");
    return String(f);
};
const realField = f => (f && (f.__sbid || f.__sbfp)) ? f.real : f;

// Реальные вызовы, которыми пользуется ядро
function listQuery(p, cs) {
    return R.query(R.collection(lastDb, p), ...cs.filter(c => c.real).map(c => c.real));
}
window.KBeta && window.KBeta.setReal({
    getDoc: p => R.getDoc(R.doc(lastDb, p)).then(s => (s.exists() ? s.data() : null)),
    getList: (p, cs) => R.getDocs(listQuery(p, cs)).then(s => s.docs.map(d => ({ id: d.id, data: d.data() }))),
    subDoc: (p, next, err) => R.onSnapshot(R.doc(lastDb, p), s => next(s.exists() ? s.data() : null), err),
    subList: (p, cs, next, err) => R.onSnapshot(listQuery(p, cs),
        s => next(s.docs.map(d => ({ id: d.id, data: d.data() }))), err)
});

// Снимки в формате SDK: exists() и data() — функции
function docSnap(ref, data) {
    return { id: ref.id, ref, exists: () => data !== null, data: () => (data === null ? undefined : data) };
}
function querySnap(items, path) {
    const docs = items.map(it => docSnap(R.doc(lastDb, path + "/" + it.id), it.data));
    return { docs, empty: docs.length === 0, size: docs.length, forEach: cb => docs.forEach(cb), docChanges: () => [] };
}

/* ---------- обёртки над API ---------- */

export function getFirestore(...args) {
    const fs = R.getFirestore(...args);
    lastDb = fs;
    return fs;
}
export function doc(db, ...segs) { return R.doc(track(ru(db)), ...segs); }
export function collection(db, ...segs) { return R.collection(track(ru(db)), ...segs); }

export function where(field, op, value) {
    return { __sbc: 1, kind: "where", field: normField(field), op, value, real: R.where(realField(field), op, value) };
}
export function orderBy(field, dir) {
    return { __sbc: 1, kind: "orderBy", field: normField(field), dir: dir || "asc", real: R.orderBy(realField(field), dir) };
}
export function limit(n) {
    return { __sbc: 1, kind: "limit", n, real: R.limit(n) };
}
export function documentId() {
    return { __sbid: 1, real: R.documentId() };
}
export function FieldPath(...segs) {
    return { __sbfp: 1, __segs: segs, real: new R.FieldPath(...segs) };
}
export function query(base, ...cs) {
    const isSb = !!(base && base.__sbq);
    const mine = cs.filter(c => c && c.__sbc);
    return {
        __sbq: 1,
        path: base.path,
        cs: (isSb ? base.cs : []).concat(mine),
        real: R.query(isSb ? base.real : base, ...cs.map(c => (c && c.__sbc ? c.real : c)))
    };
}

export async function getDocs(q) {
    if (!on()) return R.getDocs(ru(q));
    const items = await window.KBeta.readList(q.path, q.__sbq ? q.cs : []);
    return querySnap(items, q.path);
}
export async function getDoc(ref) {
    if (!on()) return R.getDoc(ru(ref));
    track(ref);
    return docSnap(ref, await window.KBeta.readDoc(ref.path));
}
export async function setDoc(ref, data, opts) {
    if (!on()) return R.setDoc(ru(ref), data, opts);
    return window.KBeta.writeSet(ref.path, data, !!(opts && opts.merge));
}
export async function updateDoc(ref, ...args) {
    if (!on()) return R.updateDoc(ru(ref), ...args.map(ru));
    return window.KBeta.writeUpdate(ref.path, window.KBeta.pairsFromArgs(args));
}
export async function deleteDoc(ref) {
    if (!on()) return R.deleteDoc(ru(ref));
    return window.KBeta.writeDelete(ref.path);
}
export async function addDoc(coll, data) {
    if (!on()) return R.addDoc(ru(coll), data);
    const id = await window.KBeta.writeAdd(coll.path, data);
    return R.doc(coll.firestore, coll.path + "/" + id);
}
export function onSnapshot(target, ...rest) {
    if (!on()) return R.onSnapshot(ru(target), ...rest);
    const fns = rest.filter(f => typeof f === "function");
    const next = fns[0], err = fns[1];
    if (target.__sbq || target.type === "collection" || target.type === "query") {
        return window.KBeta.watchList(target.path, target.__sbq ? target.cs : [],
            items => next(querySnap(items, target.path)), err);
    }
    return window.KBeta.watchDoc(target.path, data => next(docSnap(target, data)), err);
}
export async function runTransaction(db, fn) {
    if (!on()) return R.runTransaction(ru(db), fn);
    return window.KBeta.runTx(tx => {
        const t = {
            get: ref => tx.get(ref.path).then(d => docSnap(ref, d)),
            set: (ref, data, opts) => { tx.set(ref.path, data, !!(opts && opts.merge)); return t; },
            update: (ref, ...args) => { tx.update(ref.path, window.KBeta.pairsFromArgs(args)); return t; },
            delete: ref => { tx.del(ref.path); return t; }
        };
        return fn(t);
    });
}

// Значения-метки: в бете resolve делает ядро, вне беты — настоящие SDK-значения
export function serverTimestamp() { return on() ? { __sbop: "ts" } : R.serverTimestamp(); }
export function deleteField() { return on() ? { __sbop: "del" } : R.deleteField(); }
export function increment(n) { return on() ? { __sbop: "inc", n } : R.increment(n); }
