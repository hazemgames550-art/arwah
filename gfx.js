/* الأربع أرواح — محرك رسم 3D صغير (WebGL) معمول للعبة دي بس
   جزر عايمة في السما، ضباب، إضاءة ناعمة، نور حوالين الأرواح، وجزيئات طايرة. */
(function (root) {
  const L = root.LOGIC;
  /* ---------- رياضيات ---------- */
  const M4 = {
    id: () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    mul(a, b) { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; },
    persp(fov, asp, n, f) { const t = 1 / Math.tan(fov / 2); return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]; },
    look(e, c, u) { const z = norm(sub(e, c)), x = norm(cross(u, z)), y = cross(z, x); return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1]; },
    trs(tx, ty, tz, ry, sx, sy, sz, rx) { const c = Math.cos(ry || 0), s = Math.sin(ry || 0); sx = sx == null ? 1 : sx; sy = sy == null ? sx : sy; sz = sz == null ? sx : sz; let m = [c * sx, 0, -s * sx, 0, 0, sy, 0, 0, s * sz, 0, c * sz, 0, tx, ty, tz, 1]; if (rx) { const a = Math.cos(rx), b = Math.sin(rx); m = M4.mul(m, [1, 0, 0, 0, 0, a, b, 0, 0, -b, a, 0, 0, 0, 0, 1]); } return m; },
    xf(m, v) { const x = v[0], y = v[1], z = v[2]; const w = m[3] * x + m[7] * y + m[11] * z + m[15]; return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w, w]; },
  };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const hash = (x, y, k) => { let h = (x * 374761393 + y * 668265263 + (k || 0) * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  /* ---------- بناء أشكال low-poly ---------- */
  class Geo {
    constructor() { this.d = []; }
    tri(a, b, c, ca, cb, cc) { const n = norm(cross(sub(b, a), sub(c, a))); cb = cb || ca; cc = cc || ca; this.d.push(...a, ...n, ...ca, ...b, ...n, ...cb, ...c, ...n, ...cc); }
    quad(a, b, c, d, ca, cb, cc, cd) { this.tri(a, b, c, ca, cb, cc); this.tri(a, c, d, ca, cc, cd || ca); }
    box(x0, y0, z0, x1, y1, z1, top, side, bot) {
      side = side || top; bot = bot || side;
      this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], top);
      this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], side); this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], side);
      this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], side); this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], side);
      this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], bot);
    }
    // منشور مدبب (للجذور والأشجار والصخور)
    prism(cx, cz, y0, y1, r0, r1, n, c0, c1, rot, jit, seed) {
      const pts0 = [], pts1 = []; rot = rot || 0;
      for (let i = 0; i < n; i++) { const a = rot + i / n * Math.PI * 2, j0 = 1 + (jit ? (hash(i, seed || 0, 1) - .5) * jit : 0), j1 = 1 + (jit ? (hash(i, seed || 0, 2) - .5) * jit : 0); pts0.push([cx + Math.cos(a) * r0 * j0, y0, cz + Math.sin(a) * r0 * j0]); pts1.push([cx + Math.cos(a) * r1 * j1, y1, cz + Math.sin(a) * r1 * j1]); }
      for (let i = 0; i < n; i++) { const k = (i + 1) % n; if (r1 > 0.0001) this.quad(pts0[i], pts0[k], pts1[k], pts1[i], c0, c0, c1, c1); else this.tri(pts0[i], pts0[k], [cx, y1, cz], c0, c0, c1); }
      if (r1 > 0.0001) for (let i = 1; i < n - 1; i++) this.tri(pts1[0], pts1[i + 1], pts1[i], c1);
      for (let i = 1; i < n - 1; i++) this.tri(pts0[0], pts0[i], pts0[i + 1], c0);
    }
    ico(cx, cy, cz, r, sub, col, jit, seed, sy) {
      const t = (1 + Math.sqrt(5)) / 2; let v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(norm);
      let f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
      for (let s = 0; s < sub; s++) { const nf = [], cache = {}; const mid = (a, b) => { const k = a < b ? a + '_' + b : b + '_' + a; if (cache[k] == null) { cache[k] = v.length; v.push(norm(v[a].map((x, i) => (x + v[b][i]) / 2))); } return cache[k]; }; for (const [a, b, c] of f) { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); } f = nf; }
      const P = v.map((p, i) => { const j = 1 + (jit ? (hash(i, seed || 3, 7) - .5) * jit : 0); return [cx + p[0] * r * j, cy + p[1] * r * j * (sy || 1), cz + p[2] * r * j]; });
      for (const [a, b, c] of f) this.tri(P[a], P[b], P[c], typeof col === 'function' ? col(P[a]) : col);
    }
    ring(cx, cy, cz, r, w, h, n, col) {
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
        const o = (c, s, rr, y) => [cx + c * rr, cy + y, cz + s * rr];
        this.quad(o(ca, sa, r - w, h), o(cb, sb, r - w, h), o(cb, sb, r + w, h), o(ca, sa, r + w, h), col);
        this.quad(o(ca, sa, r + w, 0), o(ca, sa, r + w, h), o(cb, sb, r + w, h), o(cb, sb, r + w, 0), col);
        this.quad(o(cb, sb, r - w, 0), o(cb, sb, r - w, h), o(ca, sa, r - w, h), o(ca, sa, r - w, 0), col); }
    }
  }

  /* ---------- ألوان كل مرحلة (من الصبح للغروب) ---------- */
  const SKY = [
    { top: [.42, .62, .93], hor: [.98, .80, .78], sun: [1, .93, .82], sunDir: [-.35, .75, -.55], amb: [.78, .86, 1], gnd: [.62, .52, .5], grass: [.54, .80, .48], grass2: [.66, .86, .5], leaf: [[.42, .74, .45], [.98, .70, .78], [.40, .72, .62]] },
    { top: [.30, .58, .95], hor: [.84, .93, 1], sun: [1, .98, .9], sunDir: [.3, .85, -.45], amb: [.8, .9, 1], gnd: [.6, .55, .5], grass: [.50, .80, .52], grass2: [.62, .88, .55], leaf: [[.38, .72, .45], [.55, .80, .40], [1, .76, .82]] },
    { top: [.36, .50, .86], hor: [1, .86, .66], sun: [1, .9, .72], sunDir: [.5, .6, -.5], amb: [.85, .85, .95], gnd: [.66, .5, .42], grass: [.62, .78, .44], grass2: [.74, .82, .46], leaf: [[.58, .76, .40], [.96, .66, .40], [.45, .70, .50]] },
    { top: [.52, .52, .76], hor: [.86, .82, .92], sun: [.95, .92, 1], sunDir: [-.2, .8, -.5], amb: [.82, .82, .95], gnd: [.55, .5, .6], grass: [.52, .72, .62], grass2: [.62, .78, .68], leaf: [[.45, .65, .62], [.78, .66, .90], [.50, .70, .70]] },
    { top: [.30, .26, .55], hor: [1, .62, .46], sun: [1, .80, .60], sunDir: [-.5, .6, -.6], amb: [1, .84, .92], gnd: [.62, .45, .48], grass: [.66, .74, .46], grass2: [.80, .78, .48], leaf: [[.62, .58, .38], [1, .55, .55], [.55, .45, .65]] },
  ];

  /* ---------- شيدرز ---------- */
  const VS = `attribute vec3 aP,aN,aC;uniform mat4 uM,uVP;uniform vec3 uTint;varying vec3 vC,vN,vW;
  void main(){vec4 w=uM*vec4(aP,1.);vW=w.xyz;vN=mat3(uM)*aN;vC=aC*uTint;gl_Position=uVP*w;}`;
  const FS = `precision mediump float;varying vec3 vC,vN,vW;
  uniform vec3 uSun,uSunC,uAmb,uGnd,uFog,uCam,uPL,uPLc;uniform float uEmi,uAlpha,uFogK,uFogR;uniform vec4 uVis[4];uniform float uVisN;
  float vis(){if(uVisN<.5)return 1.;float d=99.;for(int i=0;i<4;i++){if(float(i)<uVisN){d=min(d,length(vW.xz-uVis[i].xy));}}return smoothstep(3.4,2.3,d);}
  void main(){vec3 n=normalize(vN);float h=n.y*.5+.5;vec3 amb=mix(uGnd,uAmb,h);float d=max(dot(n,uSun),0.);
  vec3 L=uPL-vW;float dl=length(L);float pl=max(dot(n,L/dl),.25)/(1.+dl*dl*.9);
  vec3 col=vC*(amb*.55+d*uSunC*.75+uPLc*pl*1.3)+vC*uEmi;
  vec3 V=normalize(uCam-vW);float rim=pow(1.-max(dot(n,V),0.),3.);col+=rim*uAmb*.18;
  float f=clamp(smoothstep(-2.,-11.,vW.y)*.6+smoothstep(uFogR+2.,uFogR+22.,length(vW.xz))*uFogK,0.,1.);col=mix(col,uFog,f);
  float v=vis();col=mix(uFog*.35,col,v);gl_FragColor=vec4(col,uAlpha*(.25+.75*v));}`;
  const SVS = `attribute vec2 aQ;uniform mat4 uVP;uniform vec3 uC,uAx,uAy;varying vec2 vQ;varying vec3 vW;
  void main(){vQ=aQ;vec3 w=uC+uAx*aQ.x+uAy*aQ.y;vW=w;gl_Position=uVP*vec4(w,1.);}`;
  const SFS = `precision mediump float;varying vec2 vQ;varying vec3 vW;uniform vec4 uCol;uniform float uSoft;uniform vec4 uVis[4];uniform float uVisN;
  void main(){float r=length(vQ);if(r>1.)discard;float a=pow(1.-r,uSoft);
  float v=1.;if(uVisN>.5){float d=99.;for(int i=0;i<4;i++){if(float(i)<uVisN){d=min(d,length(vW.xz-uVis[i].xy));}}v=smoothstep(3.4,2.3,d);}
  gl_FragColor=vec4(uCol.rgb,uCol.a*a*v);}`;
  const PVS = `attribute vec4 aS;uniform mat4 uVP;uniform float uT,uPx;uniform vec3 uBox;varying float vA;
  void main(){vec3 p=vec3(aS.x*uBox.x,aS.y*3.-1.5+sin(uT*.4+aS.w*6.)*.5,aS.z*uBox.z);p.x+=sin(uT*.23+aS.w*9.)*.6;p.z+=cos(uT*.19+aS.w*7.)*.6;
  vec4 c=uVP*vec4(p,1.);gl_Position=c;gl_PointSize=uPx*(1.+aS.w)/c.w;vA=.35+.35*sin(uT*1.3+aS.w*20.);}`;
  const PFS = `precision mediump float;varying float vA;uniform vec3 uCol;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;gl_FragColor=vec4(uCol,pow(1.-r,2.)*vA);}`;
  const KVS = `attribute vec2 aQ;varying vec2 vQ;void main(){vQ=aQ;gl_Position=vec4(aQ,.999,1.);}`;
  const KFS = `precision mediump float;varying vec2 vQ;uniform vec3 uTop,uHor,uSunC;uniform vec2 uSunP;uniform float uAsp;
  void main(){float t=clamp(vQ.y*.5+.5,0.,1.);vec3 c=mix(uHor,uTop,pow(t,.8));vec2 d=vQ-uSunP;d.x*=uAsp;float s=length(d);
  c+=uSunC*(exp(-s*s*40.)*.9+exp(-s*3.)*.18);gl_FragColor=vec4(c,1.);}`;

  let gl, cv, P, PS, PP, PK, quadB, skyB, ptB, ptN = 0, cam = {}, VP, raf = 0, t0 = performance.now(), T = 0;
  let lvDef = null, sky = SKY[0], staticM = null, meshes = {}, st = null, dv = null, opts = {}, W = 0, H = 0, cx = 0, cz = 0;
  let insets = { top: 70, bottom: 200 };
  const anim = { sp: [], bo: {}, door: {}, plate: {}, crys: {}, lit: {}, tiles: {}, fx: [], win: 0, shake: [0, 0, 0, 0] };
  let onLabels = null;

  function sh(t, s) { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; }
  function prog(v, f) { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, v)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, f)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i), nm = a.name.replace('[0]', ''); u[nm] = gl.getUniformLocation(p, a.name); } const at = {}, na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES); for (let i = 0; i < na; i++) { const a = gl.getActiveAttrib(p, i); at[a.name] = gl.getAttribLocation(p, a.name); } return { p, u, a: at }; }
  function upload(g) { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(g.d), gl.STATIC_DRAW); return { b, n: g.d.length / 9 }; }

  function init(canvas) {
    cv = canvas;
    gl = cv.getContext('webgl', { antialias: true, alpha: false, powerPreference: 'high-performance' }) || cv.getContext('experimental-webgl');
    if (!gl) return false;
    P = prog(VS, FS); PS = prog(SVS, SFS); PP = prog(PVS, PFS); PK = prog(KVS, KFS);
    quadB = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quadB); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
    const pts = []; for (let i = 0; i < 140; i++) pts.push(Math.random() * 2 - 1, Math.random(), Math.random() * 2 - 1, Math.random()); ptN = 140;
    ptB = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ptB); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pts), gl.STATIC_DRAW);
    buildPrims();
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    window.addEventListener('resize', resize); resize();
    const loop = () => { raf = requestAnimationFrame(loop); frame(); }; loop();
    return true;
  }
  function resize() { const dpr = Math.min(window.devicePixelRatio || 1, 2), w = cv.clientWidth || innerWidth, h = cv.clientHeight || innerHeight; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); fit(); }

  /* ---------- أشكال جاهزة ---------- */
  function buildPrims() {
    const g = () => new Geo();
    let a;
    a = g(); a.ico(0, .3, 0, .3, 1, [.66, .64, .7], .35, 5); meshes.boulder = upload(a);
    a = g(); a.prism(0, 0, 0, .07, .34, .3, 10, [.95, .95, .95], [1, 1, 1]); meshes.plate = upload(a);
    a = g(); a.prism(0, 0, 0, .05, .42, .4, 10, [.55, .5, .55], [.62, .58, .62]); meshes.plateBase = upload(a);
    a = g(); a.box(-.46, 0, -.11, .46, 1.05, .11, [1, 1, 1]); a.box(-.5, 1.0, -.14, .5, 1.12, .14, [1, 1, 1]); meshes.door = upload(a);
    a = g(); a.prism(0, 0, 0, .12, .24, .18, 6, [.55, .5, .6], [.65, .6, .7]); meshes.pedestal = upload(a);
    a = g(); { const top = [0, 1.05, 0], bot = [0, .2, 0], r = .2, mid = .62, pts = []; for (let i = 0; i < 6; i++) { const an = i / 6 * Math.PI * 2; pts.push([Math.cos(an) * r, mid, Math.sin(an) * r]); } for (let i = 0; i < 6; i++) { const k = (i + 1) % 6; a.tri(top, pts[k], pts[i], [1, 1, 1]); a.tri(bot, pts[i], pts[k], [.85, .85, .9]); } } meshes.crystal = upload(a);
    a = g(); a.ring(0, .02, 0, .38, .05, .06, 18, [1, 1, 1]); meshes.portal = upload(a);
    a = g(); a.box(-.5, -.3, -.5, .5, 0, .5, [.62, .62, .66], [.5, .5, .55]); meshes.stone = upload(a);
    a = g(); for (let i = 0; i < 4; i++) { const z0 = -.48 + i * .245; a.box(-.46, -.12, z0, .46, 0, z0 + .2, [.80, .62, .44], [.62, .46, .32]); } a.box(-.5, -.02, -.5, -.42, .22, .5, [.6, .44, .3]); a.box(.42, -.02, -.5, .5, .22, .5, [.6, .44, .3]); meshes.bridge = upload(a);
    a = g(); a.box(-.47, -.08, -.47, .47, 0, .47, [1, 1, 1]); meshes.lightTile = upload(a);
    a = g(); a.box(-.42, 0, -.03, .42, .95, .03, [1, 1, 1]); meshes.film = upload(a);
    // الأرواح
    a = g(); a.ico(0, 0, 0, .34, 2, [1, 1, 1], .0, 1, 1.05); meshes.body = upload(a);
    a = g(); a.ico(0, 0, 0, .055, 1, [.12, .1, .16]); meshes.eye = upload(a);
    a = g(); a.ico(0, 0, 0, .018, 0, [1, 1, 1]); meshes.glint = upload(a);
    a = g(); a.ring(0, 0, 0, .16, .025, .03, 14, [1, 1, 1]); meshes.halo = upload(a);
    a = g(); a.ico(0, 0, 0, .11, 0, [.62, .5, .45], .4, 9); a.ico(.09, -.03, .05, .07, 0, [.7, .56, .5], .4, 4); meshes.horn = upload(a);
    a = g(); a.tri([0, 0, 0], [.18, .16, .02], [.02, .22, 0], [.4, .78, .4]); a.tri([0, 0, 0], [.02, .22, 0], [.18, .16, .02], [.3, .66, .32]); a.tri([0, 0, 0], [-.15, .13, .02], [-.02, .19, 0], [.45, .82, .42]); a.tri([0, 0, 0], [-.02, .19, 0], [-.15, .13, .02], [.32, .68, .34]); a.prism(0, 0, -.02, 0, .02, .015, 4, [.45, .35, .25], [.45, .35, .25]); meshes.leaf = upload(a);
    a = g(); { const p0 = [0, 0, 0], p1 = [.06, .14, 0], p2 = [0, .34, 0], p3 = [-.06, .14, 0]; a.tri(p0, p1, p2, [.85, .95, 1]); a.tri(p0, p2, p3, [.7, .85, 1]); a.tri(p0, p2, p1, [.7, .85, 1]); a.tri(p0, p3, p2, [.85, .95, 1]); } meshes.feather = upload(a);
    a = g(); a.box(-.5, -.3, -.5, .5, 0, .5, [1, 1, 1], [.8, .8, .8]); meshes.tile = upload(a);
  }

  /* ---------- بناء المرحلة الثابتة ---------- */
  function setLevel(lv) {
    lvDef = L.LEVELS[lv]; sky = SKY[lvDef.sky % SKY.length];
    const s0 = L.init(lv); W = s0.W; H = s0.H; cx = (W - 1) / 2; cz = (H - 1) / 2;
    const g = new Geo(), wx = x => x - cx, wz = y => y - cz;
    const grassC = (x, y) => mix(sky.grass, sky.grass2, hash(x, y, 11));
    const rootTop = [.62, .48, .42], rootBot = mix([.36, .28, .42], sky.gnd, .3);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = s0.t[y * W + x]; if (c === ' ' || c === '~') continue;
      const X = wx(x), Z = wz(y), top = c === 'G' ? mix([.95, .9, .78], sky.hor, .25) : '=S'.includes(c) ? null : grassC(x, y);
      if (top) {
        const lip = mix(top, [.4, .32, .28], .35);
        g.box(X - .47, -.28, Z - .47, X + .47, 0, Z + .47, top, lip); g.box(X - .5, -.34, Z - .5, X + .5, -.06, Z + .5, lip, lip);
        const dep = 1.1 + hash(x, y, 3) * 1.8;
        g.prism(X, Z, -.28, -.28 - dep, .62, .12 + hash(x, y, 4) * .12, 6, rootTop, rootBot, hash(x, y, 5) * 3, .35, x * 31 + y);
      }
      // زينة: حشيش وورد
      if (c === '.') {
        const k = hash(x, y, 8);
        if (k < .55) for (let i = 0; i < 3; i++) { const ox = (hash(x, y, 20 + i) - .5) * .7, oz = (hash(x, y, 30 + i) - .5) * .7; g.prism(X + ox, Z + oz, 0, .1 + hash(x, y, 40 + i) * .08, .04, 0, 3, mix(top, [.3, .55, .3], .3), mix(top, [.9, 1, .8], .2), hash(x, y, i)); }
        if (k > .82) { const fc = [[1, .72, .82], [1, 1, .9], [1, .86, .5], [.8, .75, 1]][Math.floor(hash(x, y, 9) * 4)]; const ox = (hash(x, y, 50) - .5) * .6, oz = (hash(x, y, 51) - .5) * .6; g.prism(X + ox, Z + oz, 0, .12, .012, .012, 3, [.3, .6, .3], [.3, .6, .3]); g.ico(X + ox, .15, Z + oz, .05, 0, fc); }
      }
      if (c === 'T') {
        const lc = sky.leaf[Math.floor(hash(x, y, 12) * sky.leaf.length)], s = .85 + hash(x, y, 13) * .3, r0 = hash(x, y, 14) * 3;
        g.prism(X, Z, 0, .45 * s, .1, .07, 6, [.48, .36, .28], [.55, .42, .32], r0);
        g.prism(X, Z, .3 * s, .95 * s, .42 * s, .0, 7, mix(lc, [.2, .3, .2], .2), lc, r0, .2, x + y * 7);
        g.prism(X, Z, .7 * s, 1.3 * s, .32 * s, .0, 7, lc, mix(lc, [1, 1, 1], .15), r0 + .4, .2, x * 3 + y);
      }
      if (c === 'R') { g.prism(X, Z, 0, .9 + hash(x, y, 15) * .4, .38, .22, 6, [.58, .55, .65], [.72, .7, .8], hash(x, y, 16) * 3, .3, x + y); }
      if ('1234'.includes(c)) { const sc = mix(L.SP[+c - 1].color, [1, 1, 1], .25); g.box(X - .48, 0, Z - .06, X - .38, 1.05, Z + .06, sc); g.box(X + .38, 0, Z - .06, X + .48, 1.05, Z + .06, sc); g.box(X - .5, 1.0, Z - .08, X + .5, 1.12, Z + .08, sc); }
    }
    // جزر بعيدة للزينة
    const R = Math.max(W, H);
    for (let i = 0; i < 12; i++) {
      const a = Math.PI * (1.05 + i / 11 * .9) + (hash(i, 2, 60) - .5) * .2, d = R * .7 + 4 + hash(i, 3, 61) * 10, X = Math.cos(a) * d, Z = Math.sin(a) * d - 1, Y = -2 - hash(i, 4, 62) * 4, s = .45 + hash(i, 5, 63) * .9;
      g.prism(X, Z, Y, Y - .25 * s, 1.2 * s, 1.1 * s, 7, sky.grass, mix(sky.grass, [.4, .3, .3], .3), a, .3, i);
      g.prism(X, Z, Y - .25 * s, Y - 2.4 * s, 1.1 * s, .15, 7, rootTop, rootBot, a, .4, i + 9);
      if (hash(i, 6, 64) > .35) { const lc = sky.leaf[i % sky.leaf.length]; g.prism(X + .2 * s, Z, Y - .1, Y + .3 * s, .1 * s, .08 * s, 5, [.48, .36, .28], [.48, .36, .28]); g.prism(X + .2 * s, Z, Y + .2 * s, Y + 1.1 * s, .45 * s, 0, 7, lc, mix(lc, [1, 1, 1], .2), a, .2, i); }
    }
    staticM = upload(g);
    anim.sp = s0.sp.map(p => ({ x: p.x, y: p.y, fx: p.x, fy: p.y, t: 1, dur: .2, h: .2, rot: 0, sq: 0 }));
    anim.bo = {}; anim.door = {}; anim.plate = {}; anim.crys = {}; anim.lit = {}; anim.tiles = {}; anim.fx = []; anim.win = 0; anim.falling = [];
    s0.bo.forEach(b => anim.bo[b.id] = { x: b.x, y: b.y, fx: b.x, fy: b.y, t: 1, roll: 0 });
    st = s0; dv = L.derive(s0);
    fit();
  }

  function fit() {
    if (!cv || !W) return;
    const cw = cv.width, ch = cv.height, dpr = cw / (cv.clientWidth || cw);
    const top = insets.top * dpr, bot = insets.bottom * dpr, rh = Math.max(ch - top - bot, ch * .35);
    cam.asp = cw / rh; cam.sy = rh / ch; cam.oy = ((bot - top) / ch);
    const fov = 38 * Math.PI / 180, el = 58 * Math.PI / 180;
    cam.tgt = [0, -.2, .25]; let d = 12;
    const corners = [[-W / 2, 0, -H / 2], [W / 2, 0, -H / 2], [-W / 2, 0, H / 2], [W / 2, 0, H / 2], [-W / 2, 1.2, -H / 2], [W / 2, 1.2, -H / 2]];
    for (let it = 0; it < 30; it++) {
      const e = [0, cam.tgt[1] + Math.sin(el) * d, cam.tgt[2] + Math.cos(el) * d], V = M4.look(e, cam.tgt, [0, 1, 0]), Pm = M4.persp(fov, cam.asp, .1, 120), m = M4.mul(Pm, V);
      let mx = 0; for (const c of corners) { const p = M4.xf(m, c); mx = Math.max(mx, Math.abs(p[0]) / .94, Math.abs(p[1]) / .94); }
      d *= Math.pow(mx, .7);
    }
    cam.d = d; cam.el = el; cam.fov = fov;
  }
  function setInsets(t, b) { insets = { top: t, bottom: b }; fit(); }

  /* ---------- تحديث الحالة (من اللعبة) ---------- */
  function update(state, events, o) {
    const prev = st; st = state; dv = L.derive(state); opts = o || {};
    if (!prev || prev.lv !== state.lv) return;
    const now = T;
    state.sp.forEach((p, i) => { const a = anim.sp[i]; if (a.x !== p.x || a.y !== p.y) { const jump = Math.abs(a.x - p.x) + Math.abs(a.y - p.y) > 1; a.fx = curX(a); a.fy = curY(a); a.x = p.x; a.y = p.y; a.t0 = now; a.t = 0; a.dur = jump ? .36 : .18; a.h = jump ? .9 : .18; } a.face = p.f; });
    const ids = new Set(state.bo.map(b => b.id));
    state.bo.forEach(b => { const a = anim.bo[b.id] || (anim.bo[b.id] = { x: b.x, y: b.y, fx: b.x, fy: b.y, t: 1, roll: 0 }); if (a.x !== b.x || a.y !== b.y) { a.fx = a.x; a.fy = a.y; a.x = b.x; a.y = b.y; a.t0 = now; a.t = 0; a.dir = [b.x - a.fx, b.y - a.fy]; } });
    for (const e of events || []) {
      if (e.t === 'fall') { const a = anim.bo[e.id]; anim.falling.push({ x: e.x, y: e.y, fx: e.fx, fy: e.fy, t0: now }); anim.tiles[e.y * W + e.x] = { t0: now + .35, k: 'S' }; delete anim.bo[e.id]; }
      if (e.t === 'build') anim.tiles[e.y * W + e.x] = { t0: now, k: '=' };
      if (e.t === 'win') { anim.win = now; burst(); }
    }
    for (const k of Object.keys(anim.bo)) if (!ids.has(+k)) delete anim.bo[k];
  }
  function blocked(i) { anim.shake[i] = T; }
  function burst() { for (let i = 0; i < 70; i++) { const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3; anim.fx.push({ x: 0, y: .5, z: 0, vx: Math.cos(a) * s, vy: 3 + Math.random() * 4, vz: Math.sin(a) * s, t0: T, c: L.SP[i % 4].color }); } }
  const curX = a => a.fx + (a.x - a.fx) * ease(clamp(a.t, 0, 1)), curY = a => a.fy + (a.y - a.fy) * ease(clamp(a.t, 0, 1));

  /* ---------- الرسم ---------- */
  let U = {};
  function use(p) { for (let i = 0; i < 4; i++) gl.disableVertexAttribArray(i); gl.useProgram(p.p); U = p.u; }
  function common(p) {
    gl.uniformMatrix4fv(p.u.uVP, false, VP);
    if (p.u.uVisN) { const v = visPts(); gl.uniform1f(p.u.uVisN, v.length / 4); if (v.length) gl.uniform4fv(p.u.uVis, new Float32Array(v.concat(new Array(16 - v.length).fill(0)))); }
  }
  function visPts() { if (!lvDef || !lvDef.fog || !st || !opts.mine || !opts.mine.size || anim.win) return []; const o = []; for (const i of opts.mine) { const a = anim.sp[i]; o.push(curX(a) - cx, curY(a) - cz, 0, 0); } return o; }
  function drawM(m, M, tint, emi, alpha) {
    gl.uniformMatrix4fv(U.uM, false, M); gl.uniform3fv(U.uTint, tint || [1, 1, 1]); gl.uniform1f(U.uEmi, emi || 0); gl.uniform1f(U.uAlpha, alpha == null ? 1 : alpha);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.b); const A = P.a;
    gl.enableVertexAttribArray(A.aP); gl.vertexAttribPointer(A.aP, 3, gl.FLOAT, false, 36, 0);
    gl.enableVertexAttribArray(A.aN); gl.vertexAttribPointer(A.aN, 3, gl.FLOAT, false, 36, 12);
    gl.enableVertexAttribArray(A.aC); gl.vertexAttribPointer(A.aC, 3, gl.FLOAT, false, 36, 24);
    gl.drawArrays(gl.TRIANGLES, 0, m.n);
  }
  function sprite(c, size, col, soft, flat) {
    let ax, ay; if (flat) { ax = [size, 0, 0]; ay = [0, 0, size]; } else { ax = cam.right.map(v => v * size); ay = cam.up.map(v => v * size); }
    gl.uniform3fv(PS.u.uC, c); gl.uniform3fv(PS.u.uAx, ax); gl.uniform3fv(PS.u.uAy, ay); gl.uniform4fv(PS.u.uCol, col); gl.uniform1f(PS.u.uSoft, soft || 2);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function frame() {
    const now = performance.now(), dt = Math.min(.05, (now - t0) / 1000); t0 = now; T += dt;
    if (!gl || !staticM || !st) { if (gl) { gl.clearColor(.1, .12, .2, 1); gl.clear(gl.COLOR_BUFFER_BIT); } return; }
    gl.viewport(0, 0, cv.width, cv.height);
    // كاميرا: تتمايل شوية عشان الدنيا تبان حية
    const sway = Math.sin(T * .15) * .35, e = [sway, cam.tgt[1] + Math.sin(cam.el) * cam.d, cam.tgt[2] + Math.cos(cam.el) * cam.d], V = M4.look(e, cam.tgt, [0, 1, 0]);
    const Pm = M4.persp(cam.fov, cam.asp, .1, 140), adj = [1, 0, 0, 0, 0, cam.sy, 0, 0, 0, 0, 1, 0, 0, cam.oy, 0, 1];
    VP = M4.mul(adj, M4.mul(Pm, V)); cam.eye = e; cam.right = [V[0], V[4], V[8]]; cam.up = [V[1], V[5], V[9]];
    gl.clearColor(...sky.hor, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // سما
    gl.disable(gl.DEPTH_TEST); use(PK); gl.bindBuffer(gl.ARRAY_BUFFER, quadB); gl.enableVertexAttribArray(PK.a.aQ); gl.vertexAttribPointer(PK.a.aQ, 2, gl.FLOAT, false, 0, 0);
    const sp = M4.xf(VP, [sky.sunDir[0] * 60, sky.sunDir[1] * 40, sky.sunDir[2] * 60]);
    gl.uniform3fv(PK.u.uTop, sky.top); gl.uniform3fv(PK.u.uHor, sky.hor); gl.uniform3fv(PK.u.uSunC, sky.sun); gl.uniform2f(PK.u.uSunP, clamp(sp[0], -1.5, 1.5), clamp(sp[1], -.2, 1.4)); gl.uniform1f(PK.u.uAsp, cv.width / cv.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6); gl.enable(gl.DEPTH_TEST);
    // سحاب بعيد
    use(PS); common(PS); gl.bindBuffer(gl.ARRAY_BUFFER, quadB); gl.enableVertexAttribArray(PS.a.aQ); gl.vertexAttribPointer(PS.a.aQ, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + T * .006, d = 16 + (i % 3) * 6; sprite([Math.cos(a) * d, -6 - (i % 4) * 1.5, Math.sin(a) * d * .7 - 6], 5 + (i % 3) * 2, [1, 1, 1, .32], 1.6); }
    gl.depthMask(true); gl.disable(gl.BLEND);
    // الأرض والحاجات
    use(P); common(P);
    const sd = norm(sky.sunDir); gl.uniform3fv(U.uSun, sd); gl.uniform3fv(U.uSunC, sky.sun); gl.uniform3fv(U.uAmb, sky.amb); gl.uniform3fv(U.uGnd, sky.gnd); gl.uniform3fv(U.uFog, sky.hor); gl.uniform3fv(U.uCam, e); gl.uniform1f(U.uFogK, .75); gl.uniform1f(U.uFogR, Math.max(W, H) * .6);
    const nA = anim.sp[0]; gl.uniform3fv(U.uPL, [curX(nA) - cx, .9, curY(nA) - cz]); gl.uniform3fv(U.uPLc, L.SP[0].color.map(v => v * .55));
    drawM(staticM, M4.id());
    const X = x => x - cx, Z = y => y - cz, D = dv;
    // خانات بتتغير (جسر خشب، صخر)
    for (let i = 0; i < st.t.length; i++) {
      const c = st.t[i]; if (c !== '=' && c !== 'S') continue; const x = i % W, y = (i / W) | 0, a = anim.tiles[i];
      const k = a ? clamp((T - a.t0) / .45, 0, 1) : 1; if (k <= 0) continue;
      const yy = (1 - ease(k)) * (c === 'S' ? -1.2 : -.4);
      drawM(c === '=' ? meshes.bridge : meshes.stone, M4.trs(X(x), yy, Z(y), 0, c === '=' ? .3 + .7 * ease(k) : 1));
    }
    // أزرار وأبواب وكريستالات وبوابات
    const sm = (o, k, v, sp) => { const c = o[k] == null ? v : o[k]; return o[k] = c + (v - c) * Math.min(1, dt * (sp || 8)); };
    for (let i = 0; i < st.t.length; i++) {
      const c = st.t[i], x = i % W, y = (i / W) | 0, wx = X(x), wz = Z(y);
      if ('abc'.includes(c)) { const col = L.LINK_COL[L.LINK[c]], on = sm(anim.plate, i, D.act[L.LINK[c]] && occ(x, y) ? 1 : 0); drawM(meshes.plateBase, M4.trs(wx, 0, wz)); drawM(meshes.plate, M4.trs(wx, .02 - on * .05, wz), col, .25 + on * .6); }
      if ('xyz'.includes(c)) { const col = L.LINK_COL[L.LINK[c]], on = sm(anim.crys, i, D.crys.has(i) ? 1 : 0, 5); drawM(meshes.pedestal, M4.trs(wx, 0, wz)); drawM(meshes.crystal, M4.trs(wx, .05 + Math.sin(T * 1.5 + i) * .05 * (1 + on), wz, T * (.3 + on * 1.2), 1), mix(col, [1, 1, 1], .1), .15 + on * .9); }
      if (c === 'G') { const who = L.spAt(st, x, y), col = who >= 0 ? L.SP[who].color : [1, .95, .8]; drawM(meshes.portal, M4.trs(wx, 0, wz, T * .4), col, .6 + (who >= 0 ? .6 : .2 * Math.sin(T * 2 + i))); }
    }
    // صخور
    for (const k in anim.bo) { const a = anim.bo[k]; if (a.t < 1) { a.t = clamp((T - a.t0) / .22, 0, 1); a.roll += dt * 9; } const bx = curX(a), by = curY(a), r = a.dir ? (a.dir[0] ? -a.roll * Math.sign(a.dir[0]) : 0) : 0; drawM(meshes.boulder, M4.mul(M4.trs(X(bx), 0, Z(by)), M4.trs(0, .3, 0, 0, 1, 1, 1, a.dir && a.dir[1] ? a.roll * Math.sign(a.dir[1]) : 0)), [1, 1, 1], 0); }
    for (let j = anim.falling.length - 1; j >= 0; j--) { const f = anim.falling[j], k = (T - f.t0) / .45; if (k > 1) { anim.falling.splice(j, 1); continue; } const xx = f.fx + (f.x - f.fx) * Math.min(1, k * 2), yy = f.fy + (f.y - f.fy) * Math.min(1, k * 2), dy = k > .5 ? -Math.pow((k - .5) * 2, 2) * 2 : 0; drawM(meshes.boulder, M4.trs(X(xx), dy, Z(yy), k * 5)); }
    // الأرواح
    for (let i = 0; i < 4; i++) drawSpirit(i);
    // شفاف: أبواب، جسور نور، أغشية البوابات
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    for (let i = 0; i < st.t.length; i++) {
      const c = st.t[i], x = i % W, y = (i / W) | 0, wx = X(x), wz = Z(y);
      if ('ABC'.includes(c)) { const col = L.LINK_COL[L.LINK[c]], o = sm(anim.door, i, D.open(i) ? 1 : 0, 6); drawM(meshes.door, M4.trs(wx, -o * 1.02, wz), col, .45, .72 - o * .45); }
      if (c === '~') { const on = sm(anim.lit, i, D.lit.has(i) ? 1 : 0, 7); drawM(meshes.lightTile, M4.trs(wx, -.02, wz, 0, .92 + on * .08, 1, .92 + on * .08), mix([.7, .8, 1], L.SP[0].color, on), .5 + on * .7, .12 + on * .55); }
      if ('1234'.includes(c)) drawM(meshes.film, M4.trs(wx, 0, wz), L.SP[+c - 1].color, .6, .22 + .06 * Math.sin(T * 2 + i));
    }
    // ضل تحت الأرواح والصخور
    use(PS); common(PS); gl.bindBuffer(gl.ARRAY_BUFFER, quadB); gl.enableVertexAttribArray(PS.a.aQ); gl.vertexAttribPointer(PS.a.aQ, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -1);
    for (let i = 0; i < 4; i++) { const a = anim.sp[i], hop = spH(a); sprite([X(curX(a)), .012, Z(curY(a))], .34 - hop * .08, [.05, .05, .12, .32 - hop * .12], 1.4, true); }
    for (const k in anim.bo) { const a = anim.bo[k]; sprite([X(curX(a)), .012, Z(curY(a))], .38, [.05, .05, .12, .3], 1.4, true); }
    gl.disable(gl.POLYGON_OFFSET_FILL);
    // توهج (إضافي)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    for (let i = 0; i < 4; i++) { const a = anim.sp[i], c = L.SP[i].color; sprite([X(curX(a)), .45 + spH(a), Z(curY(a))], i === 0 ? 1.5 : .85, [...c, i === 0 ? .42 : .3], 2.2); }
    for (let i = 0; i < st.t.length; i++) {
      const c = st.t[i], x = i % W, y = (i / W) | 0;
      if ('xyz'.includes(c) && (anim.crys[i] || 0) > .05) sprite([X(x), .7, Z(y)], 1.2, [...L.LINK_COL[L.LINK[c]], .55 * anim.crys[i]], 2.2);
      if (c === 'G') sprite([X(x), .15, Z(y)], .7, [1, .95, .8, .22 + .08 * Math.sin(T * 2 + i)], 2);
      if (c === '~' && (anim.lit[i] || 0) > .05) sprite([X(x), .05, Z(y)], .75, [...L.SP[0].color, .3 * anim.lit[i]], 2, true);
    }
    // شرارات الفوز
    for (let j = anim.fx.length - 1; j >= 0; j--) { const f = anim.fx[j], k = T - f.t0; if (k > 2.4) { anim.fx.splice(j, 1); continue; } sprite([f.x + f.vx * k, f.y + f.vy * k - 4.9 * k * k * .5, f.z + f.vz * k], .14, [...f.c, 1 - k / 2.4], 1.5); }
    // جزيئات نور طايرة
    use(PP); gl.uniformMatrix4fv(PP.u.uVP, false, VP); gl.uniform1f(PP.u.uT, T); gl.uniform1f(PP.u.uPx, cv.height * .012); gl.uniform3f(PP.u.uBox, W * .7 + 2, 0, H * .7 + 2); gl.uniform3fv(PP.u.uCol, mix(sky.sun, [1, 1, 1], .3));
    gl.bindBuffer(gl.ARRAY_BUFFER, ptB); gl.enableVertexAttribArray(PP.a.aS); gl.vertexAttribPointer(PP.a.aS, 4, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.POINTS, 0, ptN);
    gl.disableVertexAttribArray(PP.a.aS);
    gl.depthMask(true); gl.disable(gl.BLEND);
    // أسامي فوق الأرواح (HTML)
    if (onLabels) { const out = []; for (let i = 0; i < 4; i++) { const a = anim.sp[i], p = M4.xf(VP, [X(curX(a)), .95 + spH(a), Z(curY(a))]); out.push({ x: (p[0] * .5 + .5) * cv.clientWidth, y: (.5 - p[1] * .5) * cv.clientHeight, hidden: visHidden(curX(a), curY(a)) }); } onLabels(out); }
  }
  function visHidden(x, y) { const v = visPts(); if (!v.length) return false; let d = 99; for (let i = 0; i < v.length; i += 4) d = Math.min(d, Math.hypot(x - cx - v[i], y - cz - v[i + 1])); return d > 2.9; }
  const occ = (x, y) => L.spAt(st, x, y) >= 0 || L.boAt(st, x, y) >= 0;
  const spH = a => a.t < 1 ? Math.sin(Math.PI * clamp(a.t, 0, 1)) * a.h : 0;
  function drawSpirit(i) {
    const a = anim.sp[i]; if (a.t < 1) a.t = clamp((T - a.t0) / a.dur, 0, 1);
    const target = [Math.PI, Math.PI / 2, 0, -Math.PI / 2][a.face == null ? 2 : a.face];
    let dr = target - a.rot; while (dr > Math.PI) dr -= Math.PI * 2; while (dr < -Math.PI) dr += Math.PI * 2; a.rot += dr * Math.min(1, 1 / 60 * 14 * 1.5);
    const sh = T - anim.shake[i] < .25 ? Math.sin((T - anim.shake[i]) * 60) * .06 * (1 - (T - anim.shake[i]) / .25) : 0;
    const bob = Math.sin(T * 2.4 + i * 1.7) * .04, hop = spH(a), win = anim.win ? Math.abs(Math.sin((T - anim.win) * 6 + i)) * .4 * Math.max(0, 1 - (T - anim.win) / 3) : 0;
    const x = curX(a) - cx + sh, z = curY(a) - cz, y = .37 + bob + hop + win, sq = a.t < 1 ? 1 + Math.sin(Math.PI * a.t) * .12 : 1 - bob * .6;
    const base = M4.trs(x, y, z, a.rot), sel = opts.sel === i && opts.mine && opts.mine.has(i);
    const c = L.SP[i].color;
    drawM(meshes.body, M4.mul(base, M4.trs(0, 0, 0, 0, 1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq))), c, .38 + (sel ? .12 : 0));
    const blink = (Math.sin(T * .9 + i * 3) > .985) ? .15 : 1;
    for (const s of [-1, 1]) { drawM(meshes.eye, M4.mul(base, M4.trs(s * .12, .06, .3, 0, 1.1, blink * 1.1, 1.1)), [1, 1, 1], 0); drawM(meshes.glint, M4.mul(base, M4.trs(s * .12 + .022, .095, .355, 0, 1, blink, 1)), [1, 1, 1], 1); }
    if (i === 0) drawM(meshes.halo, M4.mul(base, M4.trs(0, .42 + Math.sin(T * 3) * .02, 0, T)), [1, .92, .6], 1.2);
    if (i === 1) drawM(meshes.horn, M4.mul(base, M4.trs(.02, .3, -.02)), [1, 1, 1], .1);
    if (i === 2) drawM(meshes.leaf, M4.mul(base, M4.trs(0, .29, 0, Math.sin(T * 2) * .2)), [1, 1, 1], .15);
    if (i === 3) drawM(meshes.feather, M4.mul(base, M4.trs(.04, .25, -.04, 0, 1, 1, 1, -.35 + Math.sin(T * 3) * .1)), [1, 1, 1], .3);
    if (sel) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); drawM(meshes.portal, M4.trs(x, .03, z, -T, .95 + Math.sin(T * 4) * .05), c, 1, .85); gl.disable(gl.BLEND); }
  }

  // لمسة على الشاشة: أنهي روح؟
  function pick(px, py) {
    if (!VP || !st) return -1; let best = -1, bd = 1e9;
    for (let i = 0; i < 4; i++) { const a = anim.sp[i], p = M4.xf(VP, [curX(a) - cx, .4, curY(a) - cz]); const sx = (p[0] * .5 + .5) * cv.clientWidth, sy = (.5 - p[1] * .5) * cv.clientHeight, d = Math.hypot(sx - px, sy - py); if (d < bd) { bd = d; best = i; } }
    const cell = Math.abs(M4.xf(VP, [1, 0, 0])[0] - M4.xf(VP, [0, 0, 0])[0]) * .5 * cv.clientWidth;
    return bd < Math.max(36, cell * .8) ? best : -1;
  }

  root.GFX = { init, setLevel, update, blocked, pick, setInsets, set onLabels(f) { onLabels = f; }, get ok() { return !!gl; }, SKY };
})(this);
