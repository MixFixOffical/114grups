/* =========================================================
   KURATOR — бета-режим (ядро)

   Чтение:  реальные данные Firestore + локальные правки поверх.
   Запись:  только в localStorage. В Firestore ничего не уходит.
   Правки переживают перезагрузку, пока включён бета-режим.

   Флаг kur_beta=1 ставит кнопка «Бета-тест» на login.html.
   Обычный вход выключает флаг, KBeta.reset() стирает правки.
========================================================= */
(function (global) {
    "use strict";

    var FLAG_KEY = "kur_beta";
    var OVL_KEY  = "kur_beta_overlay";
    var BLOCKED_MSG = "Недоступно в бета-режиме";

    var overlay   = null;   // { "коллекция/id": { d: данные } | { x: 1 } (удалено) }
    var listeners = [];     // подписки onSnapshot, которые нужно обновить после правки
    var real      = null;   // адаптер реальных вызовов (задаёт compat- или modular-обёртка)
    var realDocIdFn = null; // оригинальный FieldPath.documentId (compat)

    /* ---------- флаг и хранилище ---------- */

    function store() { try { return global.localStorage; } catch (e) { return null; } }

    function isOn() {
        var s = store();
        return !!s && s.getItem(FLAG_KEY) === "1";
    }
    function enable()  { var s = store(); if (s) s.setItem(FLAG_KEY, "1"); }
    function disable() { var s = store(); if (s) s.removeItem(FLAG_KEY); }

    function load() {
        if (overlay) return overlay;
        var s = store(), parsed = null;
        try { parsed = s ? JSON.parse(s.getItem(OVL_KEY)) : null; } catch (e) { parsed = null; }
        overlay = parsed && typeof parsed === "object" ? parsed : {};
        return overlay;
    }
    function save() {
        var s = store();
        try { if (s) s.setItem(OVL_KEY, JSON.stringify(overlay)); }
        catch (e) { console.warn("[beta] локальные правки не сохранились:", e); }
    }
    function reset() { overlay = {}; save(); notify(); }

    /* ---------- типы значений ---------- */

    // Аналог Timestamp: toDate(), toMillis(), seconds
    function BetaTs(ms) { this._ms = ms; }
    BetaTs.prototype.toMillis = function () { return this._ms; };
    BetaTs.prototype.toDate = function () { return new Date(this._ms); };
    Object.defineProperty(BetaTs.prototype, "seconds", {
        get: function () { return Math.floor(this._ms / 1000); }
    });
    Object.defineProperty(BetaTs.prototype, "nanoseconds", {
        get: function () { return (this._ms % 1000) * 1e6; }
    });

    function isTsLike(v) { return v instanceof Date || (!!v && typeof v.toMillis === "function"); }
    function isPlain(v)  { return !!v && typeof v === "object" && !Array.isArray(v) && !isTsLike(v); }
    function millis(v)   { return v instanceof Date ? v.getTime() : v.toMillis(); }
    function norm(v)     { return isTsLike(v) ? millis(v) : v; }

    // Для хранения в localStorage: даты -> {$ts: ms}
    function encode(v) {
        if (v === undefined) return null;
        if (v === null || typeof v !== "object") return v;
        if (isTsLike(v)) return { $ts: millis(v) };
        if (Array.isArray(v)) return v.map(encode);
        var out = {};
        Object.keys(v).forEach(function (k) { if (v[k] !== undefined) out[k] = encode(v[k]); });
        return out;
    }
    function decode(v) {
        if (v === null || typeof v !== "object") return v;
        if (Array.isArray(v)) return v.map(decode);
        if (typeof v.$ts === "number" && Object.keys(v).length === 1) return new BetaTs(v.$ts);
        var out = {};
        Object.keys(v).forEach(function (k) { out[k] = decode(v[k]); });
        return out;
    }

    /* ---------- значения для записи (serverTimestamp, increment, deleteField) ---------- */

    // Возвращает значение, которое нужно записать; undefined = поле удалить.
    function resolveValue(v, base) {
        if (v && typeof v === "object" && !Array.isArray(v) && v.__sbop) {
            if (v.__sbop === "ts")  return new BetaTs(Date.now());
            if (v.__sbop === "inc") return (typeof base === "number" ? base : 0) + v.n;
            return undefined; // "del"
        }
        if (Array.isArray(v)) return v.map(function (x) { return resolveValue(x, undefined); });
        if (isPlain(v)) {
            var out = {};
            Object.keys(v).forEach(function (k) {
                var r = resolveValue(v[k], isPlain(base) ? base[k] : undefined);
                if (r !== undefined) out[k] = r;
            });
            return out;
        }
        return v;
    }

    function copy(o) {
        var c = {};
        Object.keys(o).forEach(function (k) { c[k] = o[k]; });
        return c;
    }
    function getIn(obj, segs) {
        var cur = obj;
        for (var i = 0; i < segs.length; i++) {
            if (cur === null || typeof cur !== "object") return undefined;
            cur = cur[segs[i]];
        }
        return cur;
    }
    function deepMerge(base, add) {
        var out = copy(base || {});
        Object.keys(add).forEach(function (k) {
            out[k] = (isPlain(add[k]) && isPlain(out[k])) ? deepMerge(out[k], add[k]) : add[k];
        });
        return out;
    }

    // pairs: [[["a","b"], значение], ...]  (поле a.b)
    function applyUpdate(base, pairs) {
        var out = copy(base);
        pairs.forEach(function (p) {
            var segs = p[0], raw = p[1], parent = out;
            for (var i = 0; i < segs.length - 1; i++) {
                parent[segs[i]] = isPlain(parent[segs[i]]) ? copy(parent[segs[i]]) : {};
                parent = parent[segs[i]];
            }
            var last = segs[segs.length - 1];
            var val = resolveValue(raw, getIn(base, segs));
            if (val === undefined) delete parent[last]; else parent[last] = val;
        });
        return out;
    }
    function buildSet(base, data, merge) {
        var resolved = resolveValue(data, base) || {};
        return merge ? deepMerge(base, resolved) : resolved;
    }

    // Аргументы updateDoc/update: (объект) или (поле, значение, поле, значение...)
    function segsOf(f) {
        if (typeof f === "string") return f.split(".");
        if (f && f.__segs) return f.__segs;
        return [String(f)];
    }
    function pairsFromArgs(args) {
        if (args.length === 1 && isPlain(args[0])) {
            return Object.keys(args[0]).map(function (k) { return [k.split("."), args[0][k]]; });
        }
        var pairs = [];
        for (var i = 0; i + 1 < args.length; i += 2) pairs.push([segsOf(args[i]), args[i + 1]]);
        return pairs;
    }

    /* ---------- фильтры, сортировка, лимит (для запросов) ---------- */

    function fieldOf(item, field) {
        if (field === "__id") return item.id;
        return getIn(item.data, field.split("."));
    }
    function eqv(a, b) {
        a = norm(a); b = norm(b);
        if (a && b && typeof a === "object" && typeof b === "object") return JSON.stringify(a) === JSON.stringify(b);
        return a === b;
    }
    function cmp(a, b) {
        a = norm(a); b = norm(b);
        if (typeof a !== typeof b) return null;
        if (typeof a === "string" || typeof a === "number" || typeof a === "boolean") {
            return a < b ? -1 : (a > b ? 1 : 0);
        }
        return null;
    }
    function matchWhere(item, c) {
        var v = fieldOf(item, c.field), w = c.value;
        switch (c.op) {
            case "==": return eqv(v, w);
            case "!=": return v !== undefined && !eqv(v, w);
            case "<":
            case "<=":
            case ">":
            case ">=": {
                if (v === undefined) return false;
                var r = cmp(v, w);
                if (r === null) return false;
                if (c.op === "<")  return r < 0;
                if (c.op === "<=") return r <= 0;
                if (c.op === ">")  return r > 0;
                return r >= 0;
            }
            case "array-contains":
                return Array.isArray(v) && v.some(function (x) { return eqv(x, w); });
            case "array-contains-any":
                return Array.isArray(v) && Array.isArray(w) &&
                    v.some(function (x) { return w.some(function (y) { return eqv(x, y); }); });
            case "in":
                return Array.isArray(w) && w.some(function (x) { return eqv(v, x); });
            case "not-in":
                return v !== undefined && Array.isArray(w) && !w.some(function (x) { return eqv(v, x); });
            default: return true;
        }
    }
    function applyConstraints(list, cs) {
        var out = list.filter(function (item) {
            return cs.every(function (c) { return c.kind !== "where" || matchWhere(item, c); });
        });
        var orders = cs.filter(function (c) { return c.kind === "orderBy"; });
        if (orders.length) {
            out = out.filter(function (item) {
                return orders.every(function (o) { return fieldOf(item, o.field) !== undefined; });
            });
            out.sort(function (a, b) {
                for (var i = 0; i < orders.length; i++) {
                    var o = orders[i];
                    var r = cmp(fieldOf(a, o.field), fieldOf(b, o.field)) || 0;
                    if (r) return o.dir === "desc" ? -r : r;
                }
                return 0;
            });
        }
        var lim = null;
        cs.forEach(function (c) { if (c.kind === "limit") lim = c.n; });
        if (lim !== null) out = out.slice(0, lim);
        return out;
    }

    /* ---------- слияние реальных данных с локальными правками ---------- */

    function mergeOne(path, realData) {
        var o = load()[path];
        if (!o) return realData;
        return o.x ? null : decode(o.d);
    }
    function mergeList(path, realItems, cs) {
        var ov = load(), prefix = path + "/";
        var byId = {}, order = [];
        realItems.forEach(function (it) { byId[it.id] = it; order.push(it.id); });
        Object.keys(ov).forEach(function (k) {
            if (k.indexOf(prefix) !== 0) return;
            var id = k.slice(prefix.length);
            if (id.indexOf("/") !== -1) return;          // только прямые дочерние документы
            if (ov[k].x) { delete byId[id]; return; }
            if (!byId[id]) order.push(id);
            byId[id] = { id: id, data: decode(ov[k].d) };
        });
        var list = [], seen = {};
        order.forEach(function (id) {
            if (byId[id] && !seen[id]) { seen[id] = true; list.push(byId[id]); }
        });
        return applyConstraints(list, cs);
    }

    /* ---------- чтение ---------- */

    function readDoc(path) {
        var o = load()[path];
        if (o) return Promise.resolve(o.x ? null : decode(o.d));
        return real.getDoc(path);
    }
    function readList(path, cs) {
        return real.getList(path, cs).then(function (items) { return mergeList(path, items, cs); });
    }

    /* ---------- запись (только локально) ---------- */

    function notify() {
        listeners.slice().forEach(function (l) { l.refresh(); });
    }
    function commit(path, state) {
        var ov = load();
        ov[path] = state === null ? { x: 1 } : { d: encode(state) };
        save();
        notify();
    }
    function genId() {
        return "beta" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    }
    function writeSet(path, data, merge) {
        return readDoc(path).then(function (base) { commit(path, buildSet(base, data, merge)); });
    }
    function writeUpdate(path, pairs) {
        return readDoc(path).then(function (base) {
            if (base === null) {
                var e = new Error("No document to update: " + path);
                e.code = "not-found";
                throw e;
            }
            commit(path, applyUpdate(base, pairs));
        });
    }
    function writeDelete(path) {
        commit(path, null);
        return Promise.resolve();
    }
    function writeAdd(collPath, data) {
        var id = genId();
        return writeSet(collPath + "/" + id, data, false).then(function () { return id; });
    }

    /* ---------- подписки (onSnapshot) ---------- */

    // Реальная подписка отдаёт сырые данные; при любой локальной правке
    // подписка пересчитывает результат и вызывает cb заново.
    function watch(subscribe, merge, cb, err) {
        var last = null, ready = false;
        function deliver() {
            try { cb(merge(last)); } catch (e) { console.error("[beta] callback:", e); }
        }
        var entry = { refresh: function () { if (ready) deliver(); } };
        listeners.push(entry);
        var unsub = subscribe(function (raw) { last = raw; ready = true; deliver(); },
                              function (e) { if (err) err(e); });
        return function () {
            listeners = listeners.filter(function (x) { return x !== entry; });
            if (unsub) unsub();
        };
    }
    function watchDoc(path, cb, err) {
        return watch(function (next, onErr) { return real.subDoc(path, next, onErr); },
                     function (raw) { return mergeOne(path, raw); }, cb, err);
    }
    function watchList(path, cs, cb, err) {
        return watch(function (next, onErr) { return real.subList(path, cs, next, onErr); },
                     function (raw) { return mergeList(path, raw, cs); }, cb, err);
    }

    /* ---------- транзакции ---------- */

    // Чтения идут сразу, записи копятся и применяются после fn().
    function runTx(fn) {
        var ops = [];
        var tx = {
            get: function (path) { return readDoc(path); },
            set: function (path, data, merge) {
                ops.push(function () { return writeSet(path, data, merge); }); return tx;
            },
            update: function (path, pairs) {
                ops.push(function () { return writeUpdate(path, pairs); }); return tx;
            },
            del: function (path) {
                ops.push(function () { return writeDelete(path); }); return tx;
            }
        };
        return Promise.resolve(fn(tx)).then(function (res) {
            return ops.reduce(function (p, op) { return p.then(op); }, Promise.resolve())
                      .then(function () { return res; });
        });
    }

    /* ---------- compat SDK (db.collection(...)) ---------- */

    function compatDocSnap(ref, data) {
        return {
            id: ref.id,
            ref: ref,
            exists: data !== null,
            data: function () { return data === null ? undefined : data; }
        };
    }
    function compatDocRef(db, path) {
        var ref = {
            id: path.split("/").pop(),
            path: path,
            firestore: db,
            collection: function (name) { return compatColl(db, path + "/" + name); },
            get: function () { return readDoc(path).then(function (d) { return compatDocSnap(ref, d); }); },
            set: function (data, opts) { return writeSet(path, data, !!(opts && opts.merge)); },
            update: function () { return writeUpdate(path, pairsFromArgs(Array.prototype.slice.call(arguments))); },
            "delete": function () { return writeDelete(path); },
            onSnapshot: function (next, err) {
                return watchDoc(path, function (d) { next(compatDocSnap(ref, d)); }, err);
            }
        };
        return ref;
    }
    function compatQuerySnap(db, path, items) {
        var docs = items.map(function (it) {
            return compatDocSnap(compatDocRef(db, path + "/" + it.id), it.data);
        });
        return {
            docs: docs,
            empty: docs.length === 0,
            size: docs.length,
            forEach: function (cb) { docs.forEach(cb); },
            docChanges: function () { return []; }
        };
    }
    function compatQuery(db, path, cs) {
        return {
            where: function (f, op, v) {
                return compatQuery(db, path, cs.concat([{ kind: "where", field: f, op: op, value: v }]));
            },
            orderBy: function (f, dir) {
                return compatQuery(db, path, cs.concat([{ kind: "orderBy", field: f, dir: dir || "asc" }]));
            },
            limit: function (n) {
                return compatQuery(db, path, cs.concat([{ kind: "limit", n: n }]));
            },
            get: function () {
                return readList(path, cs).then(function (items) { return compatQuerySnap(db, path, items); });
            },
            onSnapshot: function (next, err) {
                return watchList(path, cs, function (items) { next(compatQuerySnap(db, path, items)); }, err);
            }
        };
    }
    function compatColl(db, path) {
        var q = compatQuery(db, path, []);
        q.doc = function (id) { return compatDocRef(db, path + "/" + (id || genId())); };
        q.add = function (data) {
            var id = genId();
            return writeSet(path + "/" + id, data, false).then(function () { return compatDocRef(db, path + "/" + id); });
        };
        return q;
    }
    function compatTx(db, fn) {
        return runTx(function (tx) {
            var t = {
                get: function (ref) { return tx.get(ref.path).then(function (d) { return compatDocSnap(ref, d); }); },
                set: function (ref, data, opts) { tx.set(ref.path, data, !!(opts && opts.merge)); return t; },
                update: function (ref) { tx.update(ref.path, pairsFromArgs(Array.prototype.slice.call(arguments, 1))); return t; },
                "delete": function (ref) { tx.del(ref.path); return t; }
            };
            return fn(t);
        });
    }
    function compatBatch() {
        var ops = [];
        var b = {
            set: function (ref, data, opts) {
                ops.push(function () { return writeSet(ref.path, data, !!(opts && opts.merge)); }); return b;
            },
            update: function (ref) {
                var args = Array.prototype.slice.call(arguments, 1);
                ops.push(function () { return writeUpdate(ref.path, pairsFromArgs(args)); }); return b;
            },
            "delete": function (ref) {
                ops.push(function () { return writeDelete(ref.path); }); return b;
            },
            commit: function () {
                return ops.reduce(function (p, op) { return p.then(op); }, Promise.resolve());
            }
        };
        return b;
    }
    function buildCompatQuery(q, cs) {
        cs.forEach(function (c) {
            if (c.kind === "where")   q = q.where(c.field === "__id" ? realDocIdFn() : c.field, c.op, c.value);
            else if (c.kind === "orderBy") q = q.orderBy(c.field === "__id" ? realDocIdFn() : c.field, c.dir);
            else if (c.kind === "limit")   q = q.limit(c.n);
        });
        return q;
    }
    function guardCompatAuth() {
        try {
            var a = global.firebase && global.firebase.auth ? global.firebase.auth() : null;
            if (a && !a.__kbGuard) {
                a.__kbGuard = true;
                a.sendPasswordResetEmail = function () {
                    return Promise.reject(new Error(BLOCKED_MSG));
                };
            }
        } catch (e) { /* auth-compat не загружен на этой странице */ }
    }

    // Возвращает обёртку над firebase.firestore() в бета-режиме, иначе сам объект.
    function compatWrap(realDb) {
        if (!realDb || realDb.__kbBeta || !isOn()) return realDb;

        var FS = global.firebase && global.firebase.firestore;
        if (FS && FS.FieldValue) {
            FS.FieldValue.serverTimestamp = function () { return { __sbop: "ts" }; };
            FS.FieldValue.increment = function (n) { return { __sbop: "inc", n: n }; };
            FS.FieldValue["delete"] = function () { return { __sbop: "del" }; };
        }
        if (FS && FS.FieldPath && !realDocIdFn) {
            realDocIdFn = FS.FieldPath.documentId.bind(FS.FieldPath);
            FS.FieldPath.documentId = function () { return "__id"; };
        }
        guardCompatAuth();

        setReal({
            getDoc: function (p) {
                return realDb.doc(p).get().then(function (s) { return s.exists ? s.data() : null; });
            },
            getList: function (p, cs) {
                return buildCompatQuery(realDb.collection(p), cs).get().then(function (qs) {
                    return qs.docs.map(function (d) { return { id: d.id, data: d.data() }; });
                });
            },
            subDoc: function (p, next, err) {
                return realDb.doc(p).onSnapshot(function (s) { next(s.exists ? s.data() : null); }, err);
            },
            subList: function (p, cs, next, err) {
                return buildCompatQuery(realDb.collection(p), cs).onSnapshot(function (qs) {
                    next(qs.docs.map(function (d) { return { id: d.id, data: d.data() }; }));
                }, err);
            }
        });

        var api = {
            collection: function (name) { return compatColl(realDb, name); },
            doc: function (path) { return compatDocRef(realDb, path); },
            runTransaction: function (fn) { return compatTx(realDb, fn); },
            batch: function () { return compatBatch(); }
        };
        return new Proxy(realDb, {
            get: function (target, prop) {
                if (prop === "__kbBeta") return true;
                if (Object.prototype.hasOwnProperty.call(api, prop)) return api[prop];
                var v = target[prop];
                return typeof v === "function" ? v.bind(target) : v;
            }
        });
    }

    function setReal(adapter) { real = adapter; }

    global.KBeta = {
        BLOCKED_MSG: BLOCKED_MSG,
        isOn: isOn,
        enable: enable,
        disable: disable,
        reset: reset,
        compat: compatWrap,
        setReal: setReal,
        readDoc: readDoc,
        readList: readList,
        watchDoc: watchDoc,
        watchList: watchList,
        writeSet: writeSet,
        writeUpdate: writeUpdate,
        writeDelete: writeDelete,
        writeAdd: writeAdd,
        runTx: runTx,
        pairsFromArgs: pairsFromArgs,
        genId: genId,
        BetaTs: BetaTs
    };
})(window);
