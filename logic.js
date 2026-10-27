/* الأربع أرواح — منطق اللعبة (من غير رسم ولا نت)
   الخريطة حروف:
   .  أرض        (مسافة) فراغ      G  بوابة الوصول     T  شجرة     R  عمود صخر
   O  صخرة بتتزق a b c  زراير أرض   A B C  أبواب (بتفتح بالزرار أو الكريستالة اللي بنفس اللون)
   x y z  كريستالات (بتنوّر لما «نور» يقف جنبها)   ~  جسر نور (بيظهر حوالين «نور»)
   =  جسر خشب    S  أرض صخر (صخرة وقعت في فراغ)   1 2 3 4  بوابة لروح واحدة بس (نور، صخر، جسر، ريشة) */
(function (root) {
  const SP = [
    { id: 'noor', name: 'نور', color: [1.0, 0.82, 0.38], hex: '#ffd36b', ab: 'بتنوّر الكريستالات وجسور النور اللي حواليها' },
    { id: 'sakhr', name: 'صخر', color: [0.95, 0.55, 0.36], hex: '#f08c5c', ab: 'بيزق الصخور، ولو وقعت في فراغ بتسدّه' },
    { id: 'jisr', name: 'جسر', color: [0.47, 0.84, 0.58], hex: '#78d694', ab: 'بيبني جسر خشب فوق الفراغ اللي قدامه' },
    { id: 'risha', name: 'ريشة', color: [0.55, 0.78, 1.0], hex: '#8cc8ff', ab: 'بتنط فوق خانة واحدة (فراغ أو صخرة أو حد)' },
  ];
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // فوق، يمين، تحت، شمال
  const LINK = { a: 0, b: 1, c: 2, A: 0, B: 1, C: 2, x: 0, y: 1, z: 2 };
  const LINK_COL = [[0.95, 0.42, 0.55], [0.62, 0.48, 0.98], [0.32, 0.86, 0.85]];
  const LINK_HEX = ['#f26b8c', '#9e7bfa', '#52dbd9'];

  /* ===================== المراحل ===================== */
  const LEVELS = [];

  function parse(def) {
    const rows = def.map, H = rows.length, W = Math.max(...rows.map(r => r.length));
    const tiles = [], bo = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let c = rows[y][x] || ' ';
      if (c === 'O') { bo.push({ id: bo.length, x, y }); c = '.'; }
      tiles.push(c);
    }
    return { W, H, tiles, bo, start: def.start, planks: def.planks || 0 };
  }

  function init(lv) {
    const p = parse(LEVELS[lv]);
    return { lv, W: p.W, H: p.H, t: p.tiles.slice(), sp: p.start.map(([x, y]) => ({ x, y, f: 2 })), bo: p.bo.map(b => ({ ...b })), planks: p.planks, moves: 0, won: false };
  }
  const clone = s => ({ lv: s.lv, W: s.W, H: s.H, t: s.t.slice(), sp: s.sp.map(p => ({ ...p })), bo: s.bo.map(b => ({ ...b })), planks: s.planks, moves: s.moves, won: s.won });
  const at = (s, x, y) => (x < 0 || y < 0 || x >= s.W || y >= s.H) ? '#' : s.t[y * s.W + x];
  const spAt = (s, x, y) => s.sp.findIndex(p => p.x === x && p.y === y);
  const boAt = (s, x, y) => s.bo.findIndex(b => b.x === x && b.y === y);
  const occupied = (s, x, y) => spAt(s, x, y) >= 0 || boAt(s, x, y) >= 0;

  // حالة الأزرار والأبواب والنور
  function derive(s) {
    const n = s.sp[0], lit = new Set(), crys = new Set(), act = [false, false, false];
    for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) {
      const c = at(s, x, y), d = Math.abs(x - n.x) + Math.abs(y - n.y);
      if (c === '~' && d <= 2) lit.add(y * s.W + x);
      if ('xyz'.includes(c) && d === 1) { crys.add(y * s.W + x); act[LINK[c]] = true; }
      if ('abc'.includes(c) && occupied(s, x, y)) act[LINK[c]] = true;
    }
    const open = i => { const c = s.t[i]; if (!'ABC'.includes(c)) return false; const x = i % s.W, y = (i / s.W) | 0; return act[LINK[c]] || occupied(s, x, y); };
    return { lit, crys, act, open };
  }

  function walkable(s, D, x, y, who) {
    const c = at(s, x, y), i = y * s.W + x;
    if ('.Gabc=S'.includes(c)) return true;
    if ('ABC'.includes(c)) return D.open(i);
    if (c === '~') return D.lit.has(i);
    if ('1234'.includes(c)) return who === +c - 1;
    return false;
  }
  const boulderOk = (s, D, x, y) => { const c = at(s, x, y); return ('.Gabc=S'.includes(c) || ('ABC'.includes(c) && D.open(y * s.W + x))) && !occupied(s, x, y); };
  const tall = (s, D, x, y) => { const c = at(s, x, y); return 'TRxyz1234#'.includes(c) || ('ABC'.includes(c) && !D.open(y * s.W + x)); };

  // خطوة واحدة: بترجع الأحداث (للأصوات والحركة) أو null لو مش مسموحة
  function step(s, who, d) {
    if (s.won) return null;
    const D = derive(s), p = s.sp[who], [dx, dy] = DIRS[d], tx = p.x + dx, ty = p.y + dy, ev = [];
    p.f = d;
    const free = (x, y) => !occupied(s, x, y);
    let moved = false;
    if (walkable(s, D, tx, ty, who) && free(tx, ty)) { p.x = tx; p.y = ty; moved = true; ev.push({ t: 'move', s: who }); }
    else if (who === 1 && boAt(s, tx, ty) >= 0) {                       // صخر بيزق
      const b = s.bo[boAt(s, tx, ty)], nx = tx + dx, ny = ty + dy, nc = at(s, nx, ny);
      if (nc === ' ' && !occupied(s, nx, ny)) { s.t[ny * s.W + nx] = 'S'; s.bo.splice(s.bo.indexOf(b), 1); p.x = tx; p.y = ty; moved = true; ev.push({ t: 'fall', id: b.id, x: nx, y: ny, fx: tx, fy: ty }); }
      else if (boulderOk(s, D, nx, ny)) { b.x = nx; b.y = ny; p.x = tx; p.y = ty; moved = true; ev.push({ t: 'push', id: b.id }); }
    }
    else if (who === 2 && at(s, tx, ty) === ' ' && s.planks > 0) {      // جسر بيبني
      s.t[ty * s.W + tx] = '='; s.planks--; moved = true; ev.push({ t: 'build', x: tx, y: ty });
    }
    else if (who === 3) {                                                // ريشة بتنط
      const mc = at(s, tx, ty), lx = tx + dx, ly = ty + dy;
      const gap = mc === ' ' || (mc === '~' && !D.lit.has(ty * s.W + tx)) || occupied(s, tx, ty);
      if (gap && !tall(s, D, tx, ty) && walkable(s, D, lx, ly, who) && free(lx, ly)) { p.x = lx; p.y = ly; moved = true; ev.push({ t: 'jump', s: who }); }
    }
    if (!moved) return null;
    // «نور» ما ينفعش يبعد ويسيب حد واقف على جسر نور طفى
    const D2 = derive(s);
    for (const q of s.sp) if (at(s, q.x, q.y) === '~' && !D2.lit.has(q.y * s.W + q.x)) return null;
    for (let i = 0; i < 3; i++) if (D.act[i] !== D2.act[i]) ev.push({ t: D2.act[i] ? 'on' : 'off', k: i });
    s.moves++;
    if (s.sp.every(q => at(s, q.x, q.y) === 'G')) { s.won = true; ev.push({ t: 'win' }); }
    return ev;
  }

  // تشغيل سجل الحركات كله (كل الأجهزة بتوصل لنفس النتيجة بالظبط)
  function replay(lv, log) {
    const stack = [init(lv)];
    for (const e of log || []) {
      if (!e) continue;
      if (e.u) { if (stack.length > 1) stack.pop(); continue; }
      const n = clone(stack[stack.length - 1]);
      if (step(n, e.s, e.d)) stack.push(n);
    }
    return stack;
  }

  /* ===================== العالم الأول: جزر السما ===================== */
  LEVELS.push({
    name: 'أول خطوة', tip: '«جسر» يبني جسر فوق الفراغ، و«صخر» يزق الصخرة في الحفرة، و«نور» يقف جنب الكريستالة يفتح الباب. ووصّلوا الأربعة للبوابات المنوّرة.',
    sky: 0, planks: 1,
    map: [
      '..GG.GG..',
      '.........',
      'TTTTATTTT',
      '.....x...',
      '...T.....',
      'TTT.O TTT',
      '.........',
      '         ',
      '.........',
      '.........',
    ],
    start: [[2, 8], [3, 8], [4, 8], [5, 8]],
  });
  LEVELS.push({
    name: 'الريشة', tip: 'الزرار البنفسجي بيفتح الباب البنفسجي طول ما حد واقف عليه. «ريشة» بس اللي تقدر توصل للجزيرة الصغيرة. وفكّروا إزاي الباب يفضل مفتوح للآخر.',
    sky: 1, planks: 1,
    map: [
      '.GG...GG.',
      '.........',
      '..O...b..',
      'TTTTBTTTT',
      '......   ',
      '......  b',
      '......   ',
      '.........',
      '.........',
    ],
    start: [[2, 7], [3, 7], [4, 7], [5, 7]],
  });
  LEVELS.push({
    name: 'جسر النور', tip: 'جسر النور بيظهر بس قريب من «نور» (خانتين حواليه)، ومحدش يقدر يقف عليه وهو طافي. وفي النص حتة مقطوعة: «جسر» يبني فيها. والباب بيفتح بالكريستالة.',
    sky: 2, planks: 1,
    map: [
      '..GG.GG..',
      '.........',
      'TTTTCTTTT',
      '.....z...',
      '.........',
      '    ~    ',
      '    ~    ',
      '         ',
      '    ~    ',
      '    ~    ',
      '.........',
      '.........',
    ],
    start: [[3, 10], [5, 10], [4, 10], [6, 10]],
  });
  LEVELS.push({
    name: 'الضباب', tip: 'هنا كل واحد شايف بس اللي حوالين أرواحه، فاتكلموا ووصفوا لبعض. وكل روح ليها بوابة بلونها فوق، محدش يعدّي منها غيرها.',
    sky: 3, planks: 1, fog: true,
    map: [
      'TGTGTGTGT',
      'T1T2T3T4T',
      '.........',
      'TTTTATTTT',
      '.........',
      '.y.......',
      '.....TTBT',
      '     T.O.',
      '.....T...',
      '.....T.a.',
      '.....TTTT',
    ],
    start: [[1, 9], [2, 9], [3, 9], [4, 9]],
  });
  LEVELS.push({
    name: 'القمة', tip: 'آخر مرحلة في جزر السما، وفيها كل اللي اتعلمتوه مع بعض. «جسر» معاه لوحين خشب بس، فاستخدموهم صح. ولو حد غلط فيه زرار «رجّع خطوة».',
    sky: 4, planks: 2,
    map: [
      '..G...G..',
      '...G.G...',
      'TTTTATTTT',
      '.....x...',
      '.........',
      '   ~~~   ',
      '   ~~~   ',
      '.b.O.....',
      'TTTTBTTTT',
      '......  b',
      '.........',
      '         ',
      '.........',
      '.........',
    ],
    start: [[2, 12], [3, 12], [5, 12], [6, 12]],
  });

  const API = { SP, DIRS, LEVELS, LINK, LINK_COL, LINK_HEX, init, clone, step, replay, derive, at, spAt, boAt, walkable };
  if (typeof module !== 'undefined') module.exports = API; else root.LOGIC = API;
})(this);
