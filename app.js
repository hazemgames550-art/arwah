/* الأربع أرواح — الواجهة والأوض والصوت */
(function () {
  const VER = 2, MAXP = 4, GAME = 'arwah';
  const L = window.LOGIC, SP = L.SP;
  const $ = id => document.getElementById(id);
  function el(tag, attrs, ...kids) { const e = document.createElement(tag); if (attrs) for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else if (k === 'style') e.setAttribute('style', v); else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v); } for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k))); return e; }
  const LS = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } } };
  const rid = () => Math.random().toString(36).slice(2, 10);
  let myId = LS.get('arwah_id'); if (!myId) { myId = 'p' + rid(); LS.set('arwah_id', myId); }
  const SITE = /github\.io$/.test(location.hostname) ? location.href.split('#')[0] : (window.SITE_URL || location.href.split('#')[0]);

  /* ===================== Firebase ===================== */
  let db = null, online = true;
  try { firebase.initializeApp(window.FIREBASE_CONFIG); db = firebase.database(); db.ref('.info/connected').on('value', s => { online = !!s.val(); if (online && code) { presence(); if (V.sid) renewSid(); } renderDock(); }); } catch (e) { db = null; }

  /* ===================== الحالة ===================== */
  let view = 'home', code = null, room = null, live = {}, unsub = null, busy = false, err = '';
  const form = { name: LS.get('arwah_name') || '', voice: true, react: true, sfx: true, music: true, lv: 0 };
  try { Object.assign(form, JSON.parse(LS.get('arwah_form') || '{}')); } catch (e) { }
  const S = () => (room && room.settings) || {};
  const on = k => !!room && S()[k] !== false;
  // اللعب
  let gLv = -1, gAtt = 0, pending = [], shown = new Set(), cur = null, canUndo = false, sel = 0, tipShown = {}, winShown = '';
  let present = [], own = [null, null, null, null], mine = new Set();

  /* ===================== اللاعبين وتوزيع الأرواح ===================== */
  function players() { const p = (room && room.players) || {}; return Object.entries(p).filter(([, v]) => v && v.on).map(([id, v]) => ({ id, n: v.n || 'لاعب', at: v.at || 0 })).sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1)); }
  function distribute() {
    present = players(); const n = present.length;
    own = [0, 1, 2, 3].map(i => n ? present[i % n].id : null);
    mine = new Set([0, 1, 2, 3].filter(i => own[i] === myId));
    if (!mine.has(sel)) sel = mine.size ? [...mine][0] : 0;
  }
  const pname = id => { const p = room && room.players && room.players[id]; return p ? p.n : ''; };

  /* ===================== أوض ===================== */
  function flashErr(t) { err = t; renderScreen(); setTimeout(() => { if (err === t) { err = ''; renderScreen(); } }, 5000); }
  function saveForm() { LS.set('arwah_form', JSON.stringify({ voice: form.voice, react: form.react, sfx: form.sfx, music: form.music, lv: form.lv })); LS.set('arwah_name', form.name); }
  const myName = () => (form.name || '').trim().slice(0, 16) || 'لاعب';
  async function createRoom() {
    if (busy || !db) return; if (!form.name.trim()) return flashErr('اكتب اسمك الأول 🙂');
    busy = true; saveForm(); renderScreen();
    const settings = { game: GAME, voice: form.voice, react: form.react, sfx: form.sfx, music: form.music };
    try {
      let c = null;
      for (let t = 0; t < 8 && !c; t++) {
        const cand = String(1000 + Math.floor(Math.random() * 9000));
        const r = await db.ref('rooms/' + cand).transaction(x => x === null ? { host: myId, gid: 'a' + Date.now().toString(36), createdAt: Date.now(), settings, players: { [myId]: { n: myName(), at: Date.now(), on: true } } } : undefined);
        if (r.committed) c = cand;
      }
      if (!c) throw new Error('nocode');
      busy = false; await openRoom(c);
    } catch (e) { busy = false; flashErr('ما قدرناش نعمل الأوضة. اتأكد إن النت شغال.'); }
  }
  async function openRoom(c) {
    if (!db) return; c = String(c).replace(/\D/g, '').slice(0, 4);
    if (c.length !== 4) return flashErr('الكود 4 أرقام.');
    if (!form.name.trim()) { form.pendingCode = c; return flashErr('اكتب اسمك الأول، وبعدين ادخل.'); }
    busy = true; saveForm(); renderScreen();
    try {
      const snap = await db.ref('rooms/' + c).get();
      if (!snap.exists()) { busy = false; return flashErr('مفيش أوضة بالكود ده.'); }
      const r = snap.val();
      if (!r.settings || r.settings.game !== GAME) { busy = false; return flashErr('الكود ده مش للعبة دي.'); }
      const t = await db.ref('rooms/' + c + '/players').transaction(p => {
        p = p || {}; const n = Object.entries(p).filter(([id, v]) => v && v.on && id !== myId).length;
        if (n >= MAXP && !(p[myId] && p[myId].on)) return undefined;
        p[myId] = { n: myName(), at: (p[myId] && p[myId].at) || Date.now(), on: true }; return p;
      });
      if (!t.committed) { busy = false; return flashErr('الأوضة دي فيها 4 خلاص.'); }
      code = c; LS.set('arwah_last', c); view = 'room';
      if (unsub) unsub();
      voiceStop(); rxSeen = null; gLv = -1;
      let lastKey = '';
      const ref = db.ref('rooms/' + c);
      const h = s => {
        const v = s.val(), lv = v && v.live; if (v) delete v.live;
        live = lv || {};
        const k = JSON.stringify(v);
        if (k !== lastKey) { lastKey = k; const before = present.map(p => p.id).join(); room = v; distribute(); onRoom(before); }
        if (room && !V.sid) voiceStart();
        handleLive();
      };
      ref.on('value', h); unsub = () => ref.off('value', h);
      presence();
      history.replaceState(null, '', '#' + c);
    } catch (e) { flashErr('حصلت مشكلة في الاتصال. جرّب تاني.'); }
    busy = false; renderScreen();
  }
  function presence() { if (!code || !db) return; const r = db.ref(`rooms/${code}/players/${myId}`); r.update({ on: true, n: myName() }).catch(() => { }); try { r.child('on').onDisconnect().set(false); } catch (e) { } }
  function leave() {
    if (code && db) db.ref(`rooms/${code}/players/${myId}/on`).set(false).catch(() => { });
    voiceStop(); if (unsub) unsub(); unsub = null; room = null; code = null; view = 'home'; gLv = -1; cur = null;
    history.replaceState(null, '', location.pathname); closeModal(); $('hud').hidden = true; syncMusic(); demo(); renderScreen(); renderDock();
  }
  const gRef = () => db.ref(`rooms/${code}/g`);
  function startLevel(lv) { gRef().set({ lv, att: Date.now() }).catch(() => toast('ما اتبعتش. جرّب تاني.')); }
  function changeLevel(lv) { const from = gLv; gRef().transaction(g => (g === null || g.lv === from) ? { lv, att: Date.now() } : undefined).catch(() => { }); }

  /* ===================== لما الأوضة تتغير ===================== */
  function onRoom(beforeIds) {
    if (!room) return;
    const nowIds = present.map(p => p.id);
    if (beforeIds && beforeIds !== nowIds.join() && room.g) {
      const b = beforeIds.split(',').filter(Boolean); nowIds.filter(id => !b.includes(id) && id !== myId).forEach(id => toast(pname(id) + ' دخل اللعبة ✨'));
      b.filter(id => !nowIds.includes(id) && id !== myId).forEach(id => toast((pname(id) || 'حد') + ' خرج، والأرواح اتوزعت من جديد'));
      sfx('join');
    }
    const g = room.g;
    if (!g) { if (view !== 'lobby') { view = 'lobby'; $('hud').hidden = true; } renderScreen(); demo(); return; }
    if (view !== 'game') { view = 'game'; renderScreen(); buildHud(); }
    if (g.lv !== gLv || g.att !== gAtt) {
      const newLv = g.lv !== gLv; gLv = g.lv; gAtt = g.att; pending = []; shown = new Set(); winShown = '';
      GFX.setLevel(gLv); cur = null;
      if (newLv && !tipShown[gLv + ':' + code]) { tipShown[gLv + ':' + code] = 1; showTip(); }
      else if (!newLv) { closeModal(); toast('المرحلة بدأت من الأول'); }
    }
    recompute();
  }
  const logArr = () => { const g = room && room.g; if (!g || !g.log) return []; return Array.isArray(g.log) ? g.log.filter(Boolean) : Object.keys(g.log).sort((a, b) => a - b).map(k => g.log[k]); };
  function recompute() {
    if (gLv < 0) return;
    const lg = logArr(), ids = new Set(lg.map(e => e && e.i));
    pending = pending.filter(e => !ids.has(e.i));
    const ents = lg.concat(pending), stack = [L.init(gLv)], evs = [];
    for (const e of ents) {
      const fresh = !shown.has(e.i); shown.add(e.i);
      if (e.u) { if (stack.length > 1) { stack.pop(); if (fresh) evs.push({ t: 'undo' }); } continue; }
      const n = L.clone(stack[stack.length - 1]), ev = L.step(n, e.s, e.d);
      if (ev) { stack.push(n); if (fresh) evs.push(...ev); }
    }
    cur = stack[stack.length - 1]; canUndo = stack.length > 1;
    GFX.update(cur, evs, { mine, sel });
    playEvents(evs); updateHud();
    if (cur.won && winShown !== gLv + ':' + gAtt) { winShown = gLv + ':' + gAtt; setTimeout(showWin, 1100); }
  }

  /* ===================== حركات ===================== */
  function pushEntry(e) {
    if (!code || pending.length >= 4) return;
    e.i = rid(); e.p = myId; pending.push(e); recompute();
    const lv = gLv, att = gAtt;
    gRef().transaction(g => {
      if (g === null) return null;
      if (g.lv !== lv || g.att !== att) return undefined;
      const log = Array.isArray(g.log) ? g.log.filter(Boolean) : (g.log ? Object.keys(g.log).sort((a, b) => a - b).map(k => g.log[k]) : []);
      log.push(e); g.log = log; return g;
    }, null, false).then(r => { if (!r || !r.committed) { pending = pending.filter(x => x.i !== e.i); recompute(); } else setTimeout(() => { if (pending.some(x => x.i === e.i)) { pending = pending.filter(x => x.i !== e.i); recompute(); } }, 8000); })
      .catch(() => { pending = pending.filter(x => x.i !== e.i); recompute(); toast('الحركة ما اتبعتتش، اتأكد من النت'); });
  }
  function move(d) {
    if (!cur || cur.won || !mine.has(sel) || !$('modal').hidden) return;
    const t = L.clone(cur);
    if (!L.step(t, sel, d)) { GFX.blocked(sel); sfx('bump'); return; }
    pushEntry({ s: sel, d });
  }
  function undo() { if (!canUndo || !cur || cur.won) return; pushEntry({ u: 1 }); }
  function selectSpirit(i) { if (!mine.has(i)) { if (own[i]) toast('دي روح ' + pname(own[i])); return; } sel = i; sfx('sel'); updateHud(); GFX.update(cur, [], { mine, sel }); }
  function cycle() { const m = [...mine]; if (m.length < 2) return; selectSpirit(m[(m.indexOf(sel) + 1) % m.length]); }

  /* ===================== تحكم ===================== */
  let rep = null;
  document.querySelectorAll('#pad button').forEach(b => {
    const d = +b.dataset.d;
    const stop = () => { clearInterval(rep); clearTimeout(rep); rep = null; b.classList.remove('down'); };
    b.addEventListener('pointerdown', e => { e.preventDefault(); unlock(); b.classList.add('down'); move(d); stop(); b.classList.add('down'); rep = setTimeout(() => { rep = setInterval(() => move(d), 190); }, 330); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, stop));
  });
  window.addEventListener('keydown', e => {
    if (view !== 'game' || e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase(), map = { arrowup: 0, w: 0, arrowright: 1, d: 1, arrowdown: 2, s: 2, arrowleft: 3, a: 3 };
    if (k in map) { e.preventDefault(); move(map[k]); }
    else if ('1234'.includes(k)) selectSpirit(+k - 1);
    else if (k === 'tab') { e.preventDefault(); cycle(); }
    else if (k === 'z' || k === 'backspace') undo();
  });
  // سحب على الشاشة = حركة، لمسة = اختيار روح
  let sw0 = null;
  $('cv').addEventListener('pointerdown', e => { sw0 = { x: e.clientX, y: e.clientY, t: Date.now() }; });
  $('cv').addEventListener('pointerup', e => {
    if (!sw0 || view !== 'game') return; const dx = e.clientX - sw0.x, dy = e.clientY - sw0.y, dist = Math.hypot(dx, dy); sw0 = null;
    if (dist > 28) { move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0)); }
    else { const i = GFX.pick(e.clientX, e.clientY); if (i >= 0) selectSpirit(i); }
  });
  $('b-undo').onclick = undo;
  $('b-reset').onclick = () => confirmBox('تبدأوا المرحلة من الأول؟ ده هيرجّع كل حاجة للأول عند الكل.', 'أيوه، من الأول', () => changeLevel(gLv));
  $('b-menu').onclick = showMenu;

  /* ===================== الواجهة ===================== */
  function toast(t) { const b = $('toast'); b.textContent = t; b.hidden = false; b.style.opacity = 1; clearTimeout(b._t); b._t = setTimeout(() => { b.style.opacity = 0; setTimeout(() => b.hidden = true, 300); }, 2600); }
  function seg(id, options, curv, set) { return el('div', { class: 'seg', role: 'group' }, options.map(([v, t], k) => el('button', { id: id + '-' + k, class: curv === v ? 'on' : '', 'aria-pressed': curv === v ? 'true' : 'false', onclick: () => { set(v); renderScreen(); } }, t))); }
  const dots = () => el('div', { class: 'dots', 'aria-hidden': 'true' }, SP.map(s => el('i', { style: `background:${s.hex};color:${s.hex}` })));
  function renderScreen() {
    const sc = $('screen');
    if (view === 'game') { sc.hidden = true; return; }
    sc.hidden = false;
    const fid = document.activeElement && document.activeElement.id, nameDraft = ($('nm') || {}).value, codeDraft = ($('jcode') || {}).value;
    let body;
    if (!db) body = el('div', { class: 'card' }, el('h2', null, 'اللعبة مش متوصلة بالسيرفر'), el('p', { class: 'muted' }, 'إعدادات Firebase ناقصة في config.js.'));
    else if (view === 'home') body = home();
    else if (view === 'create') body = createView();
    else body = lobby();
    sc.replaceChildren(el('div', { class: 'col' }, body, err ? el('p', { class: 'err', role: 'alert' }, err) : null));
    if (nameDraft != null && $('nm')) $('nm').value = nameDraft;
    if (codeDraft != null && $('jcode')) $('jcode').value = codeDraft;
    if (fid && $(fid)) $(fid).focus();
  }
  function home() {
    const last = LS.get('arwah_last');
    return el('div', { class: 'grid' },
      el('div', { class: 'logo' }, el('h1', null, 'الأربع أرواح'), el('p', null, 'ألغاز في جزر السما، من 1 لـ4 لاعبين'), dots()),
      el('div', { class: 'card grid' }, el('div', { class: 'field' }, el('label', { for: 'nm' }, 'اسمك'), el('input', { type: 'text', id: 'nm', maxlength: '16', placeholder: 'اكتب اسمك', value: form.name, autocomplete: 'off', oninput: e => { form.name = e.target.value; } }))),
      el('div', { class: 'card grid' }, el('h3', null, 'هتعمل أوضة جديدة؟'), el('button', { class: 'btn wide', id: 'go-create', onclick: () => { if (!form.name.trim()) return flashErr('اكتب اسمك الأول 🙂'); saveForm(); view = 'create'; err = ''; renderScreen(); } }, '＋ أوضة جديدة')),
      el('div', { class: 'card grid' }, el('h3', null, 'معاك كود؟'), el('div', { class: 'row' }, el('input', { type: 'tel', id: 'jcode', inputmode: 'numeric', maxlength: '4', placeholder: 'مثلاً 4827', value: form.pendingCode || '', style: 'flex:1;min-width:0;direction:ltr;text-align:center;font-size:20px;letter-spacing:4px', onkeydown: e => { if (e.key === 'Enter') openRoom(e.target.value); } }), el('button', { class: 'btn', id: 'go-join', disabled: busy || null, onclick: () => openRoom($('jcode').value) }, 'ادخل'))),
      last ? el('button', { class: 'btn ghost wide', id: 'go-last', onclick: () => openRoom(last) }, 'ارجع لأوضتك ' + last) : null,
      el('p', { class: 'ver' }, 'نسخة ' + VER));
  }
  function createView() {
    const f = form;
    return el('div', { class: 'grid' },
      el('div', { class: 'card grid' }, el('h2', null, 'أوضة جديدة'),
        el('div', { class: 'field' }, el('label', null, 'تبدأوا من مرحلة'), el('div', { class: 'lvls' }, L.LEVELS.map((lv, i) => el('button', { id: 'lv-' + i, class: f.lv === i ? 'on' : '', 'aria-label': 'مرحلة ' + (i + 1) + ': ' + lv.name, onclick: () => { f.lv = i; renderScreen(); } }, String(i + 1)))), el('p', { class: 'muted' }, (f.lv + 1) + '. ' + L.LEVELS[f.lv].name))),
      el('div', { class: 'card grid' }, el('h3', null, 'الصوت والجو'),
        el('div', { class: 'field' }, el('label', null, '🎤 مايك وسماعة بينكم'), seg('vo', [[true, 'أيوه'], [false, 'لأ']], f.voice, v => { f.voice = v; })),
        el('div', { class: 'field' }, el('label', null, '😂 ردود فعل على الشاشة'), seg('rx', [[true, 'أيوه'], [false, 'لأ']], f.react, v => { f.react = v; })),
        el('div', { class: 'field' }, el('label', null, '🔔 مؤثرات صوتية هادية'), seg('fx', [[true, 'أيوه'], [false, 'لأ']], f.sfx, v => { f.sfx = v; })),
        el('div', { class: 'field' }, el('label', null, '🎵 موسيقى هادية في الخلفية'), seg('mu', [[true, 'أيوه'], [false, 'لأ']], f.music, v => { f.music = v; })),
        el('p', { class: 'muted' }, 'كل واحد يقدر يقفل المايك أو الموسيقى عنده وهو بيلعب.')),
      el('div', { class: 'row' }, el('button', { class: 'btn', id: 'do-create', disabled: busy || null, onclick: createRoom }, busy ? 'بيعمل الأوضة…' : 'اعمل الأوضة'), el('button', { class: 'btn ghost', id: 'back', onclick: () => { view = 'home'; renderScreen(); } }, 'رجوع')));
  }
  function distRow(id) { const idx = [0, 1, 2, 3].filter(i => own[i] === id); return el('div', { class: 'sdots', 'aria-label': idx.map(i => SP[i].name).join('، ') }, idx.map(i => el('i', { style: `background:${SP[i].hex}`, title: SP[i].name }))); }
  function lobby() {
    if (!room) return el('div', { class: 'card' }, el('p', { class: 'muted' }, 'بيفتح الأوضة…'));
    const link = SITE + '#' + code, msg = 'يلا نلعب «الأربع أرواح» ✨\n' + link + '\nالكود: ' + code, isHost = room.host === myId;
    const slots = []; for (let i = 0; i < MAXP; i++) { const p = present[i]; slots.push(p ? el('div', { class: 'pl' }, el('span', { class: 'nm' }, p.n + (p.id === myId ? ' (إنت)' : '') + (p.id === room.host ? ' 👑' : '')), distRow(p.id)) : el('div', { class: 'pl empty' }, el('span', { class: 'nm' }, 'مكان فاضي'))); }
    return el('div', { class: 'grid' },
      el('div', { class: 'logo' }, el('h1', { style: 'font-size:32px' }, 'الأربع أرواح'), dots()),
      el('div', { class: 'card grid' }, el('h3', null, 'ابعت الكود لصحابك'), el('div', { class: 'code' }, code), el('div', { class: 'link' }, link),
        el('div', { class: 'row' }, el('a', { class: 'btn', href: 'https://wa.me/?text=' + encodeURIComponent(msg), target: '_blank', rel: 'noopener', style: 'text-decoration:none' }, 'ابعت واتساب'), el('button', { class: 'btn ghost', id: 'copy', onclick: async e => { try { await navigator.clipboard.writeText(msg); e.target.textContent = 'اتنسخ ✓'; } catch (x) { e.target.textContent = 'انسخ الكود يدوي'; } } }, 'انسخ'))),
      el('div', { class: 'card grid' }, el('h3', null, 'اللاعبين (' + present.length + ' من ' + MAXP + ')'), el('div', { class: 'plist' }, slots),
        el('p', { class: 'muted' }, 'الأرواح الأربعة بتتوزع عليكم لوحدها: لو اتنين كل واحد ليه روحين، ولو واحد بس يلعب بالأربعة.')),
      isHost ? el('div', { class: 'card grid' }, el('div', { class: 'field' }, el('label', null, 'تبدأوا من مرحلة'), el('div', { class: 'lvls' }, L.LEVELS.map((lv, i) => el('button', { id: 'slv-' + i, class: form.lv === i ? 'on' : '', 'aria-label': 'مرحلة ' + (i + 1), onclick: () => { form.lv = i; saveForm(); renderScreen(); } }, String(i + 1))))),
        el('button', { class: 'btn wide', id: 'start', onclick: () => { unlock(); startLevel(form.lv); } }, present.length > 1 ? 'يلا نبدأ 🚀' : 'ابدأ لوحدك دلوقتي 🚀'),
        present.length < 2 ? el('p', { class: 'muted' }, 'تقدر تبدأ لوحدك، واللي يدخل بعدين هياخد أرواح من عندك على طول.') : null)
        : el('div', { class: 'card' }, el('p', null, 'مستنيين ' + pname(room.host) + ' يبدأ اللعبة… ⏳')),
      el('button', { class: 'btn ghost wide', id: 'leave', onclick: leave }, 'خروج'));
  }

  function buildHud() { $('hud').hidden = false; requestAnimationFrame(() => { const top = $('dock').getBoundingClientRect().bottom + 6, bot = innerHeight - $('pad').getBoundingClientRect().top + 8; GFX.setInsets(top, bot); }); renderDock(); }
  function updateHud() {
    if (view !== 'game' || gLv < 0 || !cur) return;
    const lv = L.LEVELS[gLv];
    $('lv-name').textContent = (gLv + 1) + '. ' + lv.name;
    $('lv-sub').textContent = 'خطوات: ' + cur.moves + (L.LEVELS[gLv].planks || cur.planks ? ' · 🪵 ' + cur.planks : '') + (lv.fog ? ' · 🌫 ضباب' : '');
    $('b-undo').disabled = !canUndo || cur.won;
    const ch = $('chips'), kids = [];
    for (const i of [0, 1, 2, 3]) {
      const s = SP[i], m = mine.has(i), owner = own[i];
      if (m) kids.push(el('button', { class: 'chip' + (sel === i ? ' sel' : ''), id: 'chip-' + i, style: sel === i ? `border-color:${s.hex};box-shadow:0 0 0 2px ${s.hex}55` : '', 'aria-pressed': sel === i ? 'true' : 'false', 'aria-label': s.name + ': ' + s.ab, onclick: () => selectSpirit(i) }, el('i', { style: `background:${s.hex};color:${s.hex}` }), el('span', null, el('b', null, s.name), (sel === i || mine.size <= 2) ? el('small', null, s.ab) : null)));
      else kids.push(el('div', { class: 'chip other' + (talkSet.has(owner) ? ' talk' : ''), id: 'chip-' + i }, el('i', { style: `background:${s.hex};color:${s.hex}` }), el('span', null, el('b', null, s.name), ' ', el('small', { style: 'display:inline' }, owner ? '· ' + pname(owner) : ''))));
    }
    ch.replaceChildren(...kids);
    $('pad-c').textContent = mine.size ? SP[sel].name : '';
    $('pad').style.opacity = mine.size ? 1 : .4;
  }
  // أسامي فوق الأرواح
  const labs = SP.map((s, i) => { const d = el('div', { class: 'lab', style: `color:${s.hex}` }); $('labels').append(d); return d; });
  GFX.onLabels = pos => {
    const show = view === 'game';
    pos.forEach((p, i) => { const d = labs[i], o = own[i]; if (!show || p.hidden || present.length < 2 || !o || o === myId) { d.style.opacity = 0; return; } d.style.opacity = 1; d.style.left = p.x + 'px'; d.style.top = p.y + 'px'; const txt = pname(o); if (d._t !== txt) { d._t = txt; d.textContent = txt; } d.classList.toggle('talk', talkSet.has(o)); });
  };

  /* ---------- نوافذ ---------- */
  function modal(content) { const m = $('modal'); m.replaceChildren(el('div', { class: 'card grid', role: 'dialog', 'aria-modal': 'true' }, content)); m.hidden = false; const b = m.querySelector('button'); if (b) b.focus(); }
  function closeModal() { $('modal').hidden = true; $('modal').replaceChildren(); }
  function confirmBox(text, yes, fn) { modal([el('p', null, text), el('div', { class: 'row' }, el('button', { class: 'btn', id: 'm-yes', onclick: () => { closeModal(); fn(); } }, yes), el('button', { class: 'btn ghost', id: 'm-no', onclick: closeModal }, 'لأ'))]); }
  const abilList = () => el('div', { class: 'abil' }, SP.map(s => el('div', null, el('i', { style: `background:${s.hex};color:${s.hex}` }), el('span', null, el('b', null, s.name + ': '), s.ab))));
  function showTip() {
    const lv = L.LEVELS[gLv];
    modal([el('div', { class: 'muted' }, 'جزر السما · مرحلة ' + (gLv + 1) + ' من ' + L.LEVELS.length), el('h2', null, lv.name), el('p', null, lv.tip), gLv === 0 ? abilList() : null,
      el('p', { class: 'muted' }, mine.size ? 'إنت بتلعب بـ: ' + [...mine].map(i => SP[i].name).join(' و') + '. اسحب على الشاشة أو استخدم الأسهم.' : ''),
      el('button', { class: 'btn wide', id: 'm-go', onclick: () => { unlock(); closeModal(); } }, 'يلا ✨')]);
  }
  function showWin() {
    if (!cur || !cur.won) return;
    const last = gLv >= L.LEVELS.length - 1;
    modal([el('div', { class: 'big' }, last ? '🌅' : '🎉'), el('h2', { style: 'text-align:center' }, last ? 'خلّصتوا جزر السما كلها!' : 'خلّصتوا «' + L.LEVELS[gLv].name + '»'),
      el('p', { class: 'muted', style: 'text-align:center' }, 'في ' + cur.moves + ' خطوة' + (present.length > 1 ? '، مع بعض 💛' : '')),
      last ? el('p', { style: 'text-align:center' }, 'عوالم جديدة جاية قريب ✨') : null,
      el('div', { class: 'row', style: 'justify-content:center' },
        last ? el('button', { class: 'btn', id: 'm-first', onclick: () => { closeModal(); changeLevel(0); } }, 'من الأول') : el('button', { class: 'btn', id: 'm-next', onclick: () => { closeModal(); changeLevel(gLv + 1); } }, 'المرحلة الجاية ←'),
        el('button', { class: 'btn ghost', id: 'm-again', onclick: () => { closeModal(); changeLevel(gLv); } }, 'نعيدها'))]);
  }
  function showMenu() {
    const pl = el('div', { class: 'plist' }, present.map(p => el('div', { class: 'pl' }, el('span', { class: 'nm' }, p.n + (p.id === myId ? ' (إنت)' : '')), distRow(p.id))));
    modal([el('h2', null, 'القائمة'), el('div', { class: 'muted' }, 'الأوضة ' + code + ' · ابعت الكود لأي حد يدخل (لحد 4)'), pl,
      el('h3', null, 'روح لمرحلة'), el('div', { class: 'lvls' }, L.LEVELS.map((lv, i) => el('button', { id: 'mlv-' + i, class: gLv === i ? 'on' : '', 'aria-label': 'مرحلة ' + (i + 1), onclick: () => { closeModal(); if (i !== gLv) confirmBox('تروحوا لمرحلة ' + (i + 1) + ' «' + lv.name + '»؟', 'أيوه', () => changeLevel(i)); } }, String(i + 1)))),
      el('h3', null, 'الأرواح'), abilList(),
      el('p', { class: 'muted' }, 'التحكم: اسحب على الشاشة، أو الأسهم. المس روحك عشان تختارها. على الكمبيوتر: الأسهم، و1-4 للاختيار، وZ لرجوع خطوة.'),
      el('div', { class: 'row' }, el('button', { class: 'btn', id: 'm-close', onclick: closeModal }, 'رجوع للعب'), el('button', { class: 'btn ghost', id: 'm-share', onclick: () => { const msg = 'يلا نلعب «الأربع أرواح» ✨\n' + SITE + '#' + code + '\nالكود: ' + code; window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank'); } }, 'ادعي حد'), el('button', { class: 'btn ghost', id: 'm-leave', onclick: () => confirmBox('تخرج من الأوضة؟', 'أيوه، اخرج', leave) }, 'خروج')),
      el('p', { class: 'ver' }, 'نسخة ' + VER)]);
  }

  /* ===================== الصوت ===================== */
  const PREF = { mic: false, spk: LS.get('aw_spk') !== '0', mus: LS.get('aw_mus') !== '0', sfx: LS.get('aw_sfx') !== '0' };
  const savePref = () => { LS.set('aw_spk', PREF.spk ? '1' : '0'); LS.set('aw_mus', PREF.mus ? '1' : '0'); LS.set('aw_sfx', PREF.sfx ? '1' : '0'); };
  let AC = null, sfxBus = null, musBus = null, master = null, musLevel = 0, mus = null, noiseB = null, talking = false;
  function ac() {
    if (AC) return AC; const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
    // «playback» = مساحة أكبر للصوت، فمايقطّعش والموبايل مشغول بالرسم
    try { AC = new C({ latencyHint: 'playback' }); } catch (e) { try { AC = new C(); } catch (x) { return null; } }
    master = AC.createGain(); master.gain.value = .85;
    const lim = AC.createDynamicsCompressor(); lim.threshold.value = -6; lim.knee.value = 6; lim.ratio.value = 6; lim.attack.value = .003; lim.release.value = .25;
    master.connect(lim); lim.connect(AC.destination);
    // صدى خفيف بيخلّي الصوت ناعم ونضيف
    const conv = AC.createConvolver(); conv.buffer = impulse(2.6); const wet = AC.createGain(); wet.gain.value = .8; conv.connect(wet); wet.connect(master);
    sfxBus = AC.createGain(); sfxBus.gain.value = .55; sfxBus.connect(master); const s1 = AC.createGain(); s1.gain.value = .12; sfxBus.connect(s1); s1.connect(conv);
    musBus = AC.createGain(); musBus.gain.value = 0; musBus.connect(master); const s2 = AC.createGain(); s2.gain.value = .5; musBus.connect(s2); s2.connect(conv);
    AC.onstatechange = () => { syncMusic(); renderDock(); };
    return AC;
  }
  function impulse(sec) {
    const r = AC.sampleRate, n = Math.floor(r * sec), b = AC.createBuffer(2, n, r);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let lp = 0; for (let i = 0; i < n; i++) { lp = lp * .55 + (Math.random() * 2 - 1) * .45; d[i] = lp * Math.pow(1 - i / n, 3.2) * .6; } }
    return b;
  }
  const audioOn = () => !!AC && AC.state === 'running';
  function unlock() {
    const c = ac(); if (c && c.state !== 'running') c.resume().then(() => { syncMusic(); renderDock(); }).catch(() => { }); else if (c && !mus) syncMusic();
    document.querySelectorAll('audio.peer').forEach(a => { if (a.paused && a.srcObject) a.play().catch(() => { }); });
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, unlock, { capture: true, passive: true }));
  function tone(f, t0, dur, vol, type, f2, bus, att) {
    const o = AC.createOscillator(), g = AC.createGain(); o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur * .8);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + (att || .012)); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    o.connect(g); g.connect(bus || sfxBus); o.start(t0); o.stop(t0 + dur + .05);
  }
  function noise(t0, dur, vol, f, q, type) { const b = AC.createBufferSource(); b.buffer = brown(); const bf = AC.createBiquadFilter(); bf.type = type || 'bandpass'; bf.frequency.value = f; bf.Q.value = q || 1; const g = AC.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + .02); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur); b.connect(bf); bf.connect(g); g.connect(sfxBus); b.start(t0, Math.random() * 2, dur + .1); }
  const SFX = {
    move: t => tone(560 + Math.random() * 40, t, .14, .03, 'sine', 520),
    sel: t => tone(988, t, .2, .035),
    bump: t => tone(160, t, .18, .05, 'sine', 120),
    push: t => { tone(120, t, .3, .08, 'sine', 85); noise(t, .18, .03, 260, .8); },
    fall: t => { noise(t, .35, .03, 700, .7, 'lowpass'); tone(95, t + .33, .45, .1, 'sine', 60); },
    build: t => { tone(820, t, .08, .05, 'sine', 520); tone(900, t + .13, .08, .045, 'sine', 560); },
    jump: t => tone(420, t, .32, .045, 'sine', 880, null, .03),
    on: t => { tone(784, t, .7, .05); tone(1175, t + .09, .8, .04); },
    off: t => tone(587, t, .45, .04, 'sine', 466),
    undo: t => tone(660, t, .16, .035, 'sine', 440),
    join: t => { tone(523, t, .7, .055); tone(784, t + .15, .9, .05); },
    pop: t => tone(740, t, .22, .05, 'sine', 1050),
    win: t => [523.3, 659.3, 784, 1046.5, 1318.5].forEach((f, i) => tone(f, t + i * .15, 1.8, .055)),
  };
  function sfx(k) { if (!PREF.sfx || !on('sfx') || !audioOn() || !SFX[k]) return; try { SFX[k](AC.currentTime + .02); } catch (e) { } }
  function playEvents(evs) { const seen = new Set(); for (const e of evs) { const k = e.t; if (seen.has(k)) continue; seen.add(k); sfx(k); } }
  function brown() {
    if (noiseB) return noiseB; const n = AC.sampleRate * 3, b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0); let l = 0, pk = 0;
    for (let i = 0; i < n; i++) { l = (l + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l; pk = Math.max(pk, Math.abs(l)); }
    for (let i = 0; i < n; i++) d[i] = d[i] / pk * .8; return noiseB = b;
  }
  // موسيقى السما: كوردات بتدخل في بعض بهدوء (من غير ما النغمة تزحلق) + أجراس، كلها نغمات صافية
  const CHORDS = [[[261.6, 329.6, 392], [220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7]], [[293.7, 370, 440], [246.9, 293.7, 370], [196, 246.9, 293.7], [220, 277.2, 329.6]]];
  const BELLS = [523.3, 587.3, 659.3, 784, 880, 1046.5];
  function pad(out, freqs, t0) {
    const len = 13, nodes = [];
    freqs.forEach((f, i) => {
      for (const [mul, vol] of [[.5, .024], [1, .014]]) {
        const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.value = f * mul; o.detune.value = (i - 1) * 3;
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 3); g.gain.setValueAtTime(vol, t0 + len - 4); g.gain.linearRampToValueAtTime(0, t0 + len);
        o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + len + .1); nodes.push(o);
      }
    });
    return nodes;
  }
  function startMusic() {
    stopMusic(); const c = AC, timers = [], set = CHORDS[Math.max(0, gLv) % 2];
    const out = c.createGain(); out.gain.value = 0; out.gain.setTargetAtTime(1, c.currentTime, 1.5);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; lp.Q.value = .5; out.connect(lp); lp.connect(musBus);
    let ci = 0; const step = () => { if (!mus) return; pad(out, set[ci++ % set.length], c.currentTime + .05); };
    const bell = () => { if (!mus) return; const n = c.currentTime + .05, f = BELLS[Math.floor(Math.random() * BELLS.length)]; tone(f, n, 3.2, .018, 'sine', null, out, .02); tone(f * 2, n, 1.6, .004, 'sine', null, out, .02); timers.push(setTimeout(bell, 2600 + Math.random() * 4200)); };
    mus = { out, timers };
    step(); timers.push(setInterval(step, 10000)); timers.push(setTimeout(bell, 1500));
  }
  function stopMusic() { if (!mus) return; const m = mus; mus = null; m.timers.forEach(t => { clearInterval(t); clearTimeout(t); }); try { m.out.gain.setTargetAtTime(0, AC.currentTime, .4); } catch (e) { } setTimeout(() => { try { m.out.disconnect(); } catch (e) { } }, 2000); }
  function syncMusic() {
    const want = !!code && on('music') && PREF.mus && audioOn();
    if (want) { if (!mus) startMusic(); duck(talking, true); }
    else { if (musBus) musBus.gain.setTargetAtTime(0, AC.currentTime, .4); musLevel = 0; if (mus) stopMusic(); }
  }
  function duck(t, force) { talking = t; if (!musBus || !mus) return; const target = t ? .3 : .75; if (force || Math.abs(target - musLevel) > .01) { musLevel = target; musBus.gain.setTargetAtTime(target, AC.currentTime, t ? .2 : 1.2); } }

  /* ===================== المايك (من موبايل لموبايل، لحد 4) ===================== */
  var V = { sid: null, mic: null, la: null, peers: {}, state: 'off' };
  const ICE = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }].concat(window.TURN_SERVERS || []) };
  const lref = p => db.ref(`rooms/${code}/live/${p}`);
  let talkSet = new Set(), dockMsg = '', dockMsgT = null, rxOpen = false;
  function voiceStart() { if (!on('voice') || V.sid || !code) return; if (!window.RTCPeerConnection) { V.state = 'nosup'; return; } V.sid = 's' + rid(); V.code = code; register(); levelLoop(); }
  function register() { const r = lref('v/' + myId); r.set({ sid: V.sid, mic: PREF.mic, at: Date.now() }).catch(() => { }); try { r.onDisconnect().remove(); } catch (e) { } }
  function renewSid() { if (!V.sid) return; V.sid = 's' + rid(); for (const q in V.peers) closePeer(q); register(); }
  function closePeer(q) { const p = V.peers[q]; if (!p) return; try { p.pc && p.pc.close(); } catch (e) { } if (p.au) p.au.remove(); delete V.peers[q]; }
  function voiceStop() {
    for (const q in V.peers) closePeer(q);
    if (V.mic) V.mic.getTracks().forEach(t => t.stop());
    if (V.sid && V.code && db) db.ref(`rooms/${V.code}/live/v/${myId}`).remove().catch(() => { });
    Object.assign(V, { sid: null, mic: null, la: null, peers: {}, state: 'off' }); PREF.mic = false; talkSet = new Set(); rxOpen = false;
  }
  const gathered = pc => new Promise(res => { if (pc.iceGatheringState === 'complete') return res(); const t = setTimeout(res, 2500); pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } }); });
  function makePC(q, offerer) {
    const p = V.peers[q] || (V.peers[q] = { n: 0 }); if (p.pc) try { p.pc.close(); } catch (e) { }
    const pc = new RTCPeerConnection(ICE); p.pc = pc; p.state = 'conn';
    if (offerer) pc.addTransceiver('audio', { direction: 'sendrecv' });
    pc.ontrack = e => { const st = e.streams && e.streams[0] ? e.streams[0] : new MediaStream([e.track]); if (!p.au) { p.au = el('audio', { class: 'peer', autoplay: '', playsinline: '' }); document.body.append(p.au); } p.au.srcObject = st; p.au.muted = !PREF.spk; p.au.play().catch(() => { }); p.an = analyser(st); };
    pc.onconnectionstatechange = () => { if (p.pc !== pc) return; const s = pc.connectionState; p.state = s === 'connected' ? 'on' : s === 'failed' ? 'fail' : 'conn'; if (s === 'failed' && offerer && p.n < 3) setTimeout(() => { if (p.pc === pc) { p.n++; p.pair = ''; handleLive(); } }, 2000); renderDock(); };
    return pc;
  }
  function micToPC(p) { const t = p.pc && p.pc.getTransceivers()[0]; if (!t) return; try { t.direction = 'sendrecv'; } catch (e) { } if (V.mic) t.sender.replaceTrack(V.mic.getAudioTracks()[0]).catch(() => { }); }
  async function handleLive() {
    handleRx(live.rx || {});
    if (V.sid) {
      const v = live.v || {}, sig = live.s || {};
      for (const q in V.peers) if (!v[q] || !v[q].sid || !present.find(p => p.id === q)) closePeer(q);
      for (const q in v) {
        if (q === myId || !v[q] || !v[q].sid || !present.find(p => p.id === q)) continue;
        const theirs = v[q].sid, key = [myId, q].sort().join('~'), offerer = myId < q, sg = sig[key] || {}, p = V.peers[q] || (V.peers[q] = { n: 0 });
        if (offerer) {
          const pair = V.sid + '|' + theirs + '|' + p.n;
          if (p.pair !== pair) {
            p.pair = pair; const pc = makePC(q, true); micToPC(p);
            try { await pc.setLocalDescription(await pc.createOffer()); await gathered(pc); if (p.pc === pc) await lref('s/' + key + '/o').set({ h: V.sid, g: theirs, n: p.n, sdp: pc.localDescription.sdp }); } catch (e) { if (p.pc === pc) p.state = 'fail'; }
          }
          const a = sg.a; if (a && a.h === V.sid && a.g === theirs && a.n === p.n && p.pc && p.pc.signalingState === 'have-local-offer') { try { await p.pc.setRemoteDescription({ type: 'answer', sdp: a.sdp }); } catch (e) { } }
        } else {
          const o = sg.o;
          if (o && o.g === V.sid && o.h === theirs && p.answered !== o.h + '|' + o.n) {
            p.answered = o.h + '|' + o.n; const pc = makePC(q, false);
            try { await pc.setRemoteDescription({ type: 'offer', sdp: o.sdp }); micToPC(p); await pc.setLocalDescription(await pc.createAnswer()); await gathered(pc); if (p.pc === pc) await lref('s/' + key + '/a').set({ h: o.h, g: o.g, n: o.n, sdp: pc.localDescription.sdp }); } catch (e) { if (p.pc === pc) p.state = 'fail'; }
          }
        }
      }
    }
    renderDock();
  }
  function analyser(stream) { if (!ac()) return null; try { const an = AC.createAnalyser(); an.fftSize = 512; AC.createMediaStreamSource(stream).connect(an); return an; } catch (e) { return null; } }
  async function toggleMic() {
    if (!V.sid) return;
    if (!V.mic) {
      try { V.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
      catch (e) { flashDock('المايك مقفول. اسمح للعبة تستخدم المايك من إعدادات الموبايل.'); return; }
      V.la = analyser(V.mic); for (const q in V.peers) micToPC(V.peers[q]);
    }
    PREF.mic = !PREF.mic; V.mic.getAudioTracks().forEach(t => { t.enabled = PREF.mic; });
    lref('v/' + myId + '/mic').set(PREF.mic).catch(() => { }); renderDock();
  }
  function toggleSpk() { PREF.spk = !PREF.spk; savePref(); document.querySelectorAll('audio.peer').forEach(a => { a.muted = !PREF.spk; if (PREF.spk && a.paused) a.play().catch(() => { }); }); renderDock(); }
  let lvT = null;
  function rms(an) { if (!an) return 0; const d = new Uint8Array(an.fftSize); an.getByteTimeDomainData(d); let s = 0; for (let i = 0; i < d.length; i++) { const y = (d[i] - 128) / 128; s += y * y; } return Math.sqrt(s / d.length); }
  function levelLoop() {
    if (lvT) return;
    lvT = setInterval(() => {
      if (!V.sid) { clearInterval(lvT); lvT = null; return; }
      const ts = new Set(); if (PREF.mic && rms(V.la) > .04) ts.add(myId);
      for (const q in V.peers) { const p = V.peers[q]; if (PREF.spk && p.state === 'on' && rms(p.an) > .03) ts.add(q); }
      const changed = [...ts].join() !== [...talkSet].join(); talkSet = ts;
      const m = $('d-mic'); if (m) m.classList.toggle('talk', ts.has(myId));
      if (changed) updateHud();
      duck(ts.size > 0);
    }, 150);
  }

  /* ---------- ردود الفعل ---------- */
  const RX = ['😂', '❤️', '😱', '🤔', '👏', '🔥'];
  let rxSeen = null, rxLast = 0;
  function handleRx(rx) {
    if (!rxSeen) { rxSeen = {}; for (const k in rx) rxSeen[k] = (rx[k] || {}).at || 0; return; }
    for (const k in rx) { const x = rx[k]; if (!x || !(x.at > (rxSeen[k] || 0))) continue; rxSeen[k] = x.at; if (k !== myId && on('react') && RX.includes(x.e)) { fly(x.e, pname(k)); sfx('pop'); } }
  }
  function sendRx(e) { if (Date.now() - rxLast < 600) return; rxLast = Date.now(); fly(e, myName()); sfx('pop'); lref('rx/' + myId).set({ e, at: Date.now() }).catch(() => { }); }
  function fly(e, who) { const f = el('div', { class: 'fly', 'aria-hidden': 'true', style: `left:${10 + Math.random() * 70}%` }, e, el('small', null, who)); document.body.append(f); setTimeout(() => f.remove(), 2700); }

  /* ---------- شريط الصوت ---------- */
  function flashDock(t) { dockMsg = t; clearTimeout(dockMsgT); renderDock(); dockMsgT = setTimeout(() => { dockMsg = ''; renderDock(); }, 6000); }
  function renderDock() {
    const d = $('dock'); if (!d) return;
    if (view !== 'game' || !room) { d.replaceChildren(); $('rxbar').hidden = true; return; }
    const kids = [];
    if (on('voice')) kids.push(el('button', { class: 'ib ' + (PREF.mic ? 'on' : 'off'), id: 'd-mic', 'aria-label': PREF.mic ? 'اقفل المايك' : 'افتح المايك', 'aria-pressed': PREF.mic ? 'true' : 'false', onclick: toggleMic }, '🎤'), el('button', { class: 'ib' + (PREF.spk ? '' : ' off'), id: 'd-spk', 'aria-label': PREF.spk ? 'اكتم الصوت' : 'شغّل الصوت', onclick: toggleSpk }, '🔈'));
    let l1 = '', retry = null;
    const others = present.filter(p => p.id !== myId), v = live.v || {};
    if (dockMsg) l1 = dockMsg;
    else if (!audioOn() && (on('music') || on('sfx') || on('voice'))) l1 = '🔊 المس الشاشة عشان الصوت يشتغل';
    else if (on('voice')) {
      if (V.state === 'nosup') l1 = 'الجهاز ده مش بيدعم المايك';
      else if (!others.length) l1 = 'لوحدك دلوقتي';
      else {
        const conn = others.filter(p => V.peers[p.id] && V.peers[p.id].state === 'on').length, fail = others.some(p => V.peers[p.id] && V.peers[p.id].state === 'fail');
        l1 = conn === others.length ? '🟢 الصوت متوصل' + (others.length > 1 ? ' بالكل' : '') : conn ? '🟢 متوصل بـ' + conn + ' من ' + others.length : 'بيوصّل الصوت…';
        const micOn = others.filter(p => v[p.id] && v[p.id].mic).map(p => p.n);
        if (micOn.length) l1 += ' · 🎤 ' + micOn.join('، ');
        if (fail) retry = el('button', { id: 'd-retry', onclick: () => renewSid() }, 'جرّب تاني');
      }
    }
    kids.push(el('div', { class: 'vs', 'aria-live': 'polite' }, l1, retry));
    if (on('music')) kids.push(el('button', { class: 'ib' + (PREF.mus ? '' : ' off'), id: 'd-mus', 'aria-label': PREF.mus ? 'اقفل الموسيقى' : 'شغّل الموسيقى', onclick: () => { PREF.mus = !PREF.mus; savePref(); syncMusic(); renderDock(); } }, '🎵'));
    if (on('sfx')) kids.push(el('button', { class: 'ib' + (PREF.sfx ? '' : ' off'), id: 'd-sfx', 'aria-label': PREF.sfx ? 'اقفل المؤثرات' : 'شغّل المؤثرات', onclick: () => { PREF.sfx = !PREF.sfx; savePref(); renderDock(); } }, '🔔'));
    if (on('react')) kids.push(el('button', { class: 'ib' + (rxOpen ? ' on' : ''), id: 'd-rx', 'aria-label': 'ردود الفعل', 'aria-expanded': rxOpen ? 'true' : 'false', onclick: () => { rxOpen = !rxOpen; renderDock(); } }, '😊'));
    const fid = document.activeElement && d.contains(document.activeElement) && document.activeElement.id;
    d.replaceChildren(...kids); if (fid && $(fid)) $(fid).focus();
    const rb = $('rxbar'); rb.hidden = !(rxOpen && on('react')); if (!rb.hidden && !rb.childNodes.length) rb.append(...RX.map((e, i) => el('button', { id: 'rx-' + i, 'aria-label': 'رد فعل ' + e, onclick: () => sendRx(e) }, e)));
  }

  /* ===================== تشغيل ===================== */
  function demo() { if (!GFX.ok) return; GFX.setInsets(0, 0); GFX.setLevel(0); GFX.update(L.init(0), [], { mine: new Set(), sel: -1 }); }
  const okGfx = GFX.init($('cv'));
  if (!okGfx) { document.body.style.background = 'linear-gradient(#3d5ea8,#f0c8b8)'; }
  const h0 = (location.hash || '').replace(/\D/g, '');
  if (h0.length === 4 && !form.name.trim()) form.pendingCode = h0;
  demo(); renderScreen();
  if (h0.length === 4 && form.name.trim()) openRoom(h0);
  window.__A = { get cur() { return cur; }, get mine() { return mine; }, get sel() { return sel; }, get present() { return present; }, get V() { return V; }, get pending() { return pending; }, move, undo, selectSpirit, get gLv() { return gLv; }, get code() { return code; }, get mus() { return !!mus; }, rms, get talk() { return talkSet; } };
})();
