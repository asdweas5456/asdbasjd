// ====== TERMINAL SIMULADO (un subconjunto real de bash en memoria) ======
const Shell = (function () {
  const USER = "alumno", HOME = "/home/alumno";
  let fs, cwd, oldpwd, env, aliases, hist = [];
  const mkf = (t, m) => ({ t: "f", txt: t, mode: m || "644" });
  const mkd = () => ({ t: "d", c: {}, mode: "755" });
  const R = (s, note) => ({ o: s ? (s.endsWith("\n") ? s : s + "\n") : "", e: "", c: 0, note: note || "" });
  const E = (s, c) => ({ o: "", e: s.endsWith("\n") ? s : s + "\n", c: c === undefined ? 1 : c });

  const LOG = ["2026-10-26 08:01:12 INFO Servidor iniciado en puerto 8080", "2026-10-26 08:01:15 INFO Conexión aceptada desde 10.0.0.21", "2026-10-26 08:02:03 WARNING Memoria al 78%", "2026-10-26 08:03:44 ERROR No se pudo conectar a la base de datos", "2026-10-26 08:03:50 INFO Reintentando conexión", "2026-10-26 08:04:10 ERROR Timeout en /api/pagos", "2026-10-26 08:05:31 INFO Conexión aceptada desde 10.0.0.35", "2026-10-26 08:06:02 error disco casi lleno"].join("\n") + "\n";
  const CSV = "nombre,precio,cantidad\nteclado,120,3\nmouse,45,10\nmonitor,890,2\ncable,15,50\n";
  const NOTAS = "# Notas del curso de Linux\nLinux es el sistema operativo de los servidores\n\n# Comandos que debo practicar\nls, cd, grep, awk, sed\n";
  const PASSWD = "root:x:0:0:root:/root:/bin/bash\nalumno:x:1000:1000::/home/alumno:/bin/bash\nwww-data:x:33:33::/var/www:/usr/sbin/nologin\n";
  const JSON_ = { nombre: "api-pagos", version: "1.4.2", puerto: 8080, activo: true, servidor: { host: "10.0.0.5", region: "us-east-1" }, usuarios: [{ id: 1, nombre: "Ana", rol: "admin" }, { id: 2, nombre: "Luis", rol: "dev" }] };
  const SYSLOG = "Oct 26 08:00:01 ubuntu CRON[1201]: (alumno) CMD (/home/alumno/backup.sh)\nOct 26 08:05:01 ubuntu CRON[1260]: (alumno) CMD (/home/alumno/backup.sh)\nOct 26 08:07:44 ubuntu systemd[1]: Started Session 4 of User alumno.\nOct 26 08:10:01 ubuntu CRON[1302]: (alumno) CMD (/home/alumno/backup.sh)\n";

  function reset() {
    fs = mkd();
    const put = (p, node) => { const a = p.split("/").filter(Boolean); const nm = a.pop(); let n = fs; for (const s of a) { if (!n.c[s]) n.c[s] = mkd(); n = n.c[s]; } n.c[nm] = node; };
    put("/home/alumno/notas.txt", mkf(NOTAS)); put("/home/alumno/servidor.log", mkf(LOG)); put("/home/alumno/datos.csv", mkf(CSV));
    put("/home/alumno/usuarios.txt", mkf(PASSWD)); put("/home/alumno/config.json", mkf(JSON.stringify(JSON_, null, 2) + "\n"));
    put("/home/alumno/config.yaml", mkf("nombre: api-pagos\nversion: 1.4.2\npuerto: 8080\nservidor:\n  host: 10.0.0.5\n"));
    put("/home/alumno/.bashrc", mkf("# ~/.bashrc\nexport PATH=$PATH:$HOME/bin\n")); put("/home/alumno/.profile", mkf(""));
    put("/var/log/syslog", mkf(SYSLOG)); put("/etc/hostname", mkf("ubuntu\n")); put("/etc/passwd", mkf(PASSWD)); put("/tmp/.keep", mkf(""));
    cwd = HOME; oldpwd = HOME; aliases = {}; hist = [];
    env = { USER: "alumno", HOME: HOME, SHELL: "/bin/bash", PATH: "/usr/local/bin:/usr/bin:/bin", LANG: "es_PE.UTF-8", PWD: HOME };
  }
  reset();

  function norm(p) { if (p === "~" || p.startsWith("~/")) p = HOME + p.slice(1); if (!p.startsWith("/")) p = cwd + "/" + p; const out = []; for (const s of p.split("/")) { if (!s || s === ".") continue; if (s === "..") out.pop(); else out.push(s); } return out; }
  function node(p) { let n = fs; for (const s of norm(p)) { if (n.t !== "d" || !(s in n.c)) return null; n = n.c[s]; } return n; }
  function parent(p) { const a = norm(p); const name = a.pop(); let n = fs; for (const s of a) { if (n.t !== "d" || !(s in n.c)) return [null, name]; n = n.c[s]; } return [n.t === "d" ? n : null, name]; }
  const clone = n => JSON.parse(JSON.stringify(n));
  const lines = t => { const a = t.split("\n"); if (a.length && a[a.length - 1] === "") a.pop(); return a; };
  const ND = (cmd, p) => E(`${cmd}: no se puede acceder a '${p}': No existe el archivo o el directorio`);
  function writeFile(p, txt, append) {
    if (p === "/dev/null") return null;
    const n = node(p);
    if (n && n.t === "d") return `bash: ${p}: Es un directorio`;
    if (n) { n.txt = append ? n.txt + txt : txt; return null; }
    const [pa, nm] = parent(p); if (!pa) return `bash: ${p}: No existe el archivo o el directorio`;
    pa.c[nm] = mkf(txt); return null;
  }
  function readText(files, inp, cmd) {
    if (!files.length) return { t: inp || "", e: "" };
    let t = "", e = "";
    for (const f of files) { const n = node(f); if (!n) { e += `${cmd}: ${f}: No existe el archivo o el directorio\n`; continue; } if (n.t === "d") { e += `${cmd}: ${f}: Es un directorio\n`; continue; } t += n.txt; }
    return { t, e };
  }
  const perm = m => m.padStart(3, "0").split("").map(d => { d = +d; return (d & 4 ? "r" : "-") + (d & 2 ? "w" : "-") + (d & 1 ? "x" : "-"); }).join("");
  const human = n => n < 1024 ? String(n) : n < 1048576 ? (n / 1024).toFixed(1).replace(/\.0$/, "") + "K" : (n / 1048576).toFixed(1) + "M";
  const size = n => n.t === "d" ? 4096 : n.txt.length;
  function walk(p, n, cb) { if (n.t === "f") { cb(p, n); return; } for (const k of Object.keys(n.c).sort()) walk(p.replace(/\/$/, "") + "/" + k, n.c[k], cb); }

  // ---------- comandos ----------
  const cmds = {};
  cmds.pwd = () => R(cwd);
  cmds.whoami = () => R(USER);
  cmds.uname = a => R(a.some(x => /a/.test(x)) ? "Linux ubuntu 6.8.0-45-generic #45-Ubuntu SMP PREEMPT_DYNAMIC x86_64 GNU/Linux" : "Linux");
  cmds.id = () => R("uid=1000(alumno) gid=1000(alumno) grupos=1000(alumno),27(sudo),100(users)");
  cmds.groups = () => R("alumno sudo users");
  cmds.date = () => R("lun 26 oct 2026 12:54:00 -05");
  cmds.hostname = () => R("ubuntu");
  cmds.clear = () => ({ o: "", e: "", c: 0, clear: true });
  cmds.history = () => R(hist.map((h, i) => `${String(i + 1).padStart(4)}  ${h}`).join("\n"));
  cmds.which = a => R(a.map(x => cmds[x] ? "/usr/bin/" + x : "").filter(Boolean).join("\n"));
  cmds.echo = a => { let nl = true; if (a[0] === "-n") { nl = false; a = a.slice(1); } const s = a.join(" "); return { o: s + (nl ? "\n" : ""), e: "", c: 0 }; };
  cmds.cd = a => {
    let t = a[0]; if (t === undefined || t === "~") t = HOME; else if (t === "-") { t = oldpwd; }
    const n = node(t); if (!n) return E(`bash: cd: ${a[0]}: No existe el archivo o el directorio`);
    if (n.t !== "d") return E(`bash: cd: ${a[0]}: No es un directorio`);
    const np = "/" + norm(t).join("/"); const r = a[0] === "-" ? R(np) : R(""); oldpwd = cwd; cwd = np === "/" ? "/" : np; env.PWD = cwd; return r;
  };
  cmds.ls = a => {
    const fl = a.filter(x => x[0] === "-").join("").replace(/-/g, ""); const paths = a.filter(x => x[0] !== "-"); const Lf = fl.includes("l"), Af = fl.includes("a"), Hf = fl.includes("h");
    if (!paths.length) paths.push("."); let o = "", e = "";
    const row = (nm, n) => { const sz = size(n); return `${n.t === "d" ? "d" : "-"}${perm(n.mode)} 1 alumno alumno ${String(Hf ? human(sz) : sz).padStart(5)} oct 26 12:54 ${nm}\n`; };
    paths.forEach((p, i) => {
      const n = node(p); if (!n) { e += `ls: no se puede acceder a '${p}': No existe el archivo o el directorio\n`; return; }
      if (paths.length > 1) o += (i ? "\n" : "") + p + ":\n";
      if (n.t === "f") { o += Lf ? row(p, n) : p + "\n"; return; }
      let names = Object.keys(n.c).sort(); if (!Af) names = names.filter(k => k[0] !== "."); else names = [".", ".."].concat(names);
      if (Lf) { o += `total ${Math.max(4, names.length * 4)}\n`; names.forEach(k => { o += row(k, k === "." || k === ".." ? n : n.c[k]); }); } else o += names.length ? names.join("  ") + "\n" : "";
    });
    return { o, e, c: e ? 2 : 0 };
  };
  cmds.cat = (a, inp) => {
    let num = false; const f = a.filter(x => { if (x === "-n") { num = true; return false; } return true; });
    const r = readText(f, inp, "cat"); let t = r.t;
    if (num) t = lines(t).map((l, i) => `${String(i + 1).padStart(6)}\t${l}`).join("\n") + (t ? "\n" : "");
    return { o: t, e: r.e, c: r.e ? 1 : 0 };
  };
  cmds.less = (a, inp) => cmds.cat(a, inp);
  function headTail(name) {
    return (a, inp) => {
      let n = 10, follow = false; const f = [];
      for (let k = 0; k < a.length; k++) { const x = a[k]; if (x === "-n") n = parseInt(a[++k], 10) || 0; else if (/^-n\d+$/.test(x)) n = parseInt(x.slice(2), 10); else if (/^-\d+$/.test(x)) n = parseInt(x.slice(1), 10); else if (x === "-f") follow = true; else f.push(x); }
      const r = readText(f, inp, name); const ls = lines(r.t); const sel = name === "head" ? ls.slice(0, n) : (n ? ls.slice(-n) : []);
      return { o: sel.length ? sel.join("\n") + "\n" : "", e: r.e, c: r.e ? 1 : 0, note: follow ? "tail -f seguiría esperando líneas nuevas (en un terminal real saldrías con Ctrl+C)." : "" };
    };
  }
  cmds.head = headTail("head"); cmds.tail = headTail("tail");
  cmds.wc = (a, inp) => {
    const fl = a.filter(x => x[0] === "-").join(""); const f = a.filter(x => x[0] !== "-"); const r = readText(f, inp, "wc"); const t = r.t;
    const l = lines(t).length, w = t.split(/\s+/).filter(Boolean).length, c = t.length; const nm = f.length === 1 ? " " + f[0] : "";
    let out = fl.includes("l") ? `${l}${nm}` : fl.includes("w") ? `${w}${nm}` : fl.includes("c") ? `${c}${nm}` : `${l} ${w} ${c}${nm}`;
    return { o: out + "\n", e: r.e, c: 0 };
  };
  cmds.mkdir = a => {
    let p = false; const ds = a.filter(x => { if (x === "-p") { p = true; return false; } return true; }); let e = "";
    for (const d of ds) {
      const parts = norm(d); let n = fs; let created = false;
      for (let i = 0; i < parts.length; i++) {
        const s = parts[i]; const last = i === parts.length - 1;
        if (n.c[s]) { if (last && !p) { e += `mkdir: no se puede crear el directorio '${d}': El archivo ya existe\n`; } n = n.c[s]; continue; }
        if (!last && !p) { e += `mkdir: no se puede crear el directorio '${d}': No existe el archivo o el directorio\n`; break; }
        n.c[s] = mkd(); n = n.c[s];
      }
    }
    return { o: "", e, c: e ? 1 : 0 };
  };
  cmds.touch = a => { let e = ""; for (const f of a) { if (f[0] === "-") continue; if (node(f)) continue; const [pa, nm] = parent(f); if (!pa) { e += `touch: no se puede efectuar 'touch' sobre '${f}': No existe el archivo o el directorio\n`; continue; } pa.c[nm] = mkf(""); } return { o: "", e, c: e ? 1 : 0 }; };
  cmds.cp = a => {
    let r = false; const p = []; a.forEach(x => { if (/^-[rRaf]+$/.test(x)) r = true; else p.push(x); });
    if (p.length < 2) return E("cp: falta el operando archivo de destino");
    const dst = p.pop(); const dn = node(dst); let e = "";
    for (const s of p) {
      const sn = node(s); if (!sn) { e += `cp: no se puede efectuar 'stat' sobre '${s}': No existe el archivo o el directorio\n`; continue; }
      if (sn.t === "d" && !r) { e += `cp: se omite el directorio '${s}' (use -r)\n`; continue; }
      const base = norm(s).pop();
      if (dn && dn.t === "d") dn.c[base] = clone(sn);
      else { if (p.length > 1) { e += `cp: el objetivo '${dst}' no es un directorio\n`; continue; } const [pa, nm] = parent(dst); if (!pa) { e += `cp: no se puede crear el fichero regular '${dst}': No existe el archivo o el directorio\n`; continue; } pa.c[nm] = clone(sn); }
    }
    return { o: "", e, c: e ? 1 : 0 };
  };
  cmds.mv = a => {
    const p = a.filter(x => x[0] !== "-"); if (p.length < 2) return E("mv: falta el operando archivo de destino");
    const dst = p.pop(); const dn = node(dst); let e = "";
    for (const s of p) {
      const sn = node(s); if (!sn) { e += `mv: no se puede efectuar 'stat' sobre '${s}': No existe el archivo o el directorio\n`; continue; }
      const [sp, sname] = parent(s); let tp, tn;
      if (dn && dn.t === "d" && dn !== sn) { tp = dn; tn = sname; }
      else { if (p.length > 1) { e += `mv: el objetivo '${dst}' no es un directorio\n`; continue; } [tp, tn] = parent(dst); if (!tp) { e += `mv: no se puede mover '${s}' a '${dst}': No existe el archivo o el directorio\n`; continue; } }
      if (tp === sp && tn === sname) continue;
      delete sp.c[sname]; tp.c[tn] = sn;
    }
    return { o: "", e, c: e ? 1 : 0 };
  };
  cmds.rm = a => {
    const fl = a.filter(x => x[0] === "-").join(""); const r = /[rR]/.test(fl), f = fl.includes("f"); let e = "";
    for (const t of a.filter(x => x[0] !== "-")) {
      const n = node(t); if (!n) { if (!f) e += `rm: no se puede borrar '${t}': No existe el archivo o el directorio\n`; continue; }
      if (n.t === "d" && !r) { e += `rm: no se puede borrar '${t}': Es un directorio\n`; continue; }
      const [pa, nm] = parent(t); delete pa.c[nm];
    }
    return { o: "", e, c: e ? 1 : 0 };
  };
  cmds.rmdir = a => { let e = ""; for (const t of a) { const n = node(t); if (!n) { e += `rmdir: fallo al borrar '${t}': No existe el archivo o el directorio\n`; continue; } if (n.t !== "d") { e += `rmdir: fallo al borrar '${t}': No es un directorio\n`; continue; } if (Object.keys(n.c).length) { e += `rmdir: fallo al borrar '${t}': El directorio no está vacío\n`; continue; } const [pa, nm] = parent(t); delete pa.c[nm]; } return { o: "", e, c: e ? 1 : 0 }; };
  cmds.grep = (a, inp) => {
    const fl = { i: 0, v: 0, n: 0, c: 0, r: 0, E: 0 }; let A = 0, B = 0; const rest = [];
    for (let k = 0; k < a.length; k++) {
      const x = a[k];
      if (/^-[ABC]$/.test(x)) { const n = +a[++k] || 0; if (x === "-A") A = n; else if (x === "-B") B = n; else A = B = n; }
      else if (/^-[A-Za-z]+$/.test(x)) { for (const ch of x.slice(1)) if (ch in fl) fl[ch] = 1; }
      else rest.push(x);
    }
    const pat = rest.shift(); if (pat === undefined) return E("Uso: grep [OPCIÓN]... PATRONES [ARCHIVO]...", 2);
    let re; try { re = new RegExp(fl.E ? pat : pat.replace(/[|+?(){}]/g, "\\$&"), fl.i ? "i" : ""); } catch (x) { return E("grep: expresión regular inválida", 2); }
    const src = []; let e = "";
    if (!rest.length) src.push({ name: null, text: inp || "" });
    else for (const f of rest) {
      const n = node(f); if (!n) { e += `grep: ${f}: No existe el archivo o el directorio\n`; continue; }
      if (n.t === "d") { if (fl.r) walk(f.replace(/\/$/, ""), n, (p, nn) => src.push({ name: p, text: nn.txt })); else e += `grep: ${f}: Es un directorio\n`; }
      else src.push({ name: f, text: n.txt });
    }
    const multi = src.length > 1 || (fl.r && src.length && src[0].name !== null && rest.some(f => { const n = node(f); return n && n.t === "d"; }));
    let o = ""; let any = false;
    for (const s of src) {
      const ls = lines(s.text); const m = ls.map(l => re.test(l) !== !!fl.v); const pre = multi && s.name ? s.name : null;
      if (fl.c) { const cnt = m.filter(Boolean).length; o += (pre ? pre + ":" : "") + cnt + "\n"; if (cnt) any = true; continue; }
      const show = new Set(); m.forEach((x, i) => { if (x) { any = true; for (let j = i - B; j <= i + A; j++) if (j >= 0 && j < ls.length) show.add(j); } });
      let prev = -2; [...show].sort((x, y) => x - y).forEach(i => {
        if ((A || B) && prev >= 0 && i > prev + 1) o += "--\n"; prev = i;
        const sep = m[i] ? ":" : "-"; o += (pre ? pre + sep : "") + (fl.n ? (i + 1) + sep : "") + ls[i] + "\n";
      });
    }
    return { o, e, c: any ? 0 : 1 };
  };
  cmds.awk = (a, inp) => {
    let sep = null; const rest = [];
    for (let k = 0; k < a.length; k++) { if (a[k] === "-F") sep = a[++k]; else if (/^-F./.test(a[k])) sep = a[k].slice(2); else rest.push(a[k]); }
    const prog = rest.shift(); if (prog === undefined) return E("Uso: awk [-F sep] 'programa' [archivo]", 2);
    const r = readText(rest, inp, "awk"); const ls = lines(r.t);
    const F = l => sep == null ? l.trim().split(/\s+/).filter(Boolean) : l.split(sep.length > 1 ? new RegExp(sep) : sep);
    const val = (tok, f, l) => { tok = tok.trim(); if (tok === "$0") return l; if (tok === "$NF") return f.length ? f[f.length - 1] : ""; let m = tok.match(/^\$(\d+)$/); if (m) return f[+m[1] - 1] === undefined ? "" : f[+m[1] - 1]; m = tok.match(/^"(.*)"$/); if (m) return m[1]; return tok; };
    let m = prog.match(/^\s*\{\s*(\w+)\s*\+=\s*(\$\d+|\$NF)\s*\}\s*END\s*\{\s*print\s+(\w+)\s*\}\s*$/);
    if (m) { let s = 0; for (const l of ls) s += parseFloat(val(m[2], F(l), l)) || 0; return { o: s + "\n", e: r.e, c: 0 }; }
    m = prog.match(/^\s*(?:\/(.*?)\/|(\$\d+|\$NF)\s*(>=|<=|==|!=|>|<)\s*(\S+?))?\s*(?:\{\s*print\s*(.*?)\s*\})?\s*$/);
    if (!m) return E("awk: este programa no está soportado en el simulador (pruébalo en tu terminal real)", 2);
    let o = "";
    for (const l of ls) {
      const f = F(l); let ok = true;
      if (m[1] !== undefined) { try { ok = new RegExp(m[1]).test(l); } catch (x) { ok = false; } }
      else if (m[2]) { const Lv = val(m[2], f, l), Rv = m[4].replace(/^"|"$/g, ""); const num = Lv !== "" && !isNaN(Lv) && !isNaN(Rv); const x = num ? +Lv : Lv, y = num ? +Rv : Rv; ok = ({ ">": x > y, "<": x < y, ">=": x >= y, "<=": x <= y, "==": x == y, "!=": x != y })[m[3]]; }
      if (!ok) continue;
      if (prog.indexOf("print") < 0) o += l + "\n"; else { const items = m[5] === "" ? ["$0"] : m[5].split(","); o += items.map(t => val(t, f, l)).join(" ") + "\n"; }
    }
    return { o, e: r.e, c: 0 };
  };
  cmds.sed = (a, inp) => {
    let inplace = null; const ex = []; const rest = [];
    for (let k = 0; k < a.length; k++) { const x = a[k]; if (x === "-e") ex.push(a[++k]); else if (/^-i/.test(x)) inplace = x.slice(2); else if (x === "-n") continue; else rest.push(x); }
    if (!ex.length) { const s = rest.shift(); if (s === undefined) return E("Uso: sed [OPCIÓN]... {guion} [archivo]", 1); ex.push(s); }
    const apply = text => {
      let ls = lines(text);
      for (const e of ex) {
        let m;
        if ((m = e.match(/^\/(.*)\/d$/))) { const re = new RegExp(m[1]); ls = ls.filter(l => !re.test(l)); }
        else if ((m = e.match(/^(\d+)d$/))) { ls = ls.filter((l, i) => i !== +m[1] - 1); }
        else if ((m = e.match(/^(?:\/(.*?)\/)?s(.)(.*?)\2(.*?)\2([gi]*)$/))) {
          const addr = m[1] ? new RegExp(m[1]) : null; const re = new RegExp(m[3], (m[5].includes("g") ? "g" : "") + (m[5].includes("i") ? "i" : "")); const rep = m[4].replace(/\$/g, "$$$$");
          ls = ls.map(l => (!addr || addr.test(l)) ? l.replace(re, rep) : l);
        } else throw new Error("expresión de sed no soportada en el simulador: " + e);
      }
      return ls.length ? ls.join("\n") + "\n" : "";
    };
    try {
      if (inplace !== null) {
        let e = ""; for (const f of rest) { const n = node(f); if (!n || n.t !== "f") { e += `sed: no se puede leer ${f}: No existe el archivo o el directorio\n`; continue; } if (inplace) writeFile(f + inplace, n.txt, false); n.txt = apply(n.txt); }
        return { o: "", e, c: e ? 1 : 0 };
      }
      const r = readText(rest, inp, "sed"); return { o: apply(r.t), e: r.e, c: 0 };
    } catch (x) { return E("sed: " + x.message, 1); }
  };
  cmds.sort = (a, inp) => { const f = a.filter(x => x[0] !== "-"); const fl = a.filter(x => x[0] === "-").join(""); const r = readText(f, inp, "sort"); let ls = lines(r.t); ls.sort(fl.includes("n") ? (x, y) => parseFloat(x) - parseFloat(y) : (x, y) => x < y ? -1 : x > y ? 1 : 0); if (fl.includes("r")) ls.reverse(); if (fl.includes("u")) ls = ls.filter((l, i) => i === 0 || l !== ls[i - 1]); return { o: ls.length ? ls.join("\n") + "\n" : "", e: r.e, c: 0 }; };
  cmds.uniq = (a, inp) => { const cnt = a.includes("-c"); const f = a.filter(x => x[0] !== "-"); const r = readText(f, inp, "uniq"); const out = []; lines(r.t).forEach(l => { const last = out[out.length - 1]; if (last && last.l === l) last.n++; else out.push({ l, n: 1 }); }); return { o: out.length ? out.map(x => cnt ? `${String(x.n).padStart(7)} ${x.l}` : x.l).join("\n") + "\n" : "", e: r.e, c: 0 }; };
  cmds.cut = (a, inp) => { let d = "\t", fi = 1; const f = []; for (let k = 0; k < a.length; k++) { if (a[k] === "-d") d = a[++k]; else if (/^-d./.test(a[k])) d = a[k].slice(2); else if (a[k] === "-f") fi = +a[++k]; else if (/^-f\d+/.test(a[k])) fi = +a[k].slice(2); else f.push(a[k]); } const r = readText(f, inp, "cut"); return { o: lines(r.t).map(l => l.split(d)[fi - 1] ?? "").join("\n") + "\n", e: r.e, c: 0 }; };
  cmds.chmod = a => {
    let rec = false; const rest = []; a.forEach(x => { if (x === "-R") rec = true; else rest.push(x); });
    const mode = rest.shift(); if (!mode || !rest.length) return E("chmod: falta un operando");
    const octal = /^[0-7]{3,4}$/.test(mode); const s = mode.match(/^([ugoa]*)([+\-=])([rwx]+)$/);
    if (!octal && !s) return E(`chmod: modo inválido: '${mode}'`);
    const set = n => { if (octal) { n.mode = mode.slice(-3); return; } let who = s[1] || "a"; if (who.includes("a")) who = "ugo"; const val = [...s[3]].reduce((t, c) => t + ({ r: 4, w: 2, x: 1 })[c], 0); const m = n.mode.padStart(3, "0").split("").map(Number); ["u", "g", "o"].forEach((w, i) => { if (!who.includes(w)) return; if (s[2] === "+") m[i] |= val; else if (s[2] === "-") m[i] &= ~val & 7; else m[i] = val; }); n.mode = m.join(""); };
    let e = "";
    for (const f of rest) { const n = node(f); if (!n) { e += `chmod: no se puede acceder a '${f}': No existe el archivo o el directorio\n`; continue; } set(n); if (rec && n.t === "d") walk(f, n, (p, nn) => set(nn)); }
    return { o: "", e, c: e ? 1 : 0 };
  };
  cmds.chown = a => { const f = a.filter(x => x[0] !== "-").slice(1); let e = ""; f.forEach(x => { if (!node(x)) e += `chown: no se puede acceder a '${x}': No existe el archivo o el directorio\n`; }); return { o: "", e, c: e ? 1 : 0, note: e ? "" : "chown corre (en un sistema real necesitas sudo para cambiar de dueño)." }; };
  cmds.env = () => R(Object.keys(env).map(k => `${k}=${env[k]}`).join("\n"));
  cmds.printenv = cmds.env;
  cmds.export = a => { for (const x of a) { const m = x.match(/^(\w+)=(.*)$/s); if (m) env[m[1]] = m[2]; } return R(""); };
  cmds.unset = a => { a.forEach(x => delete env[x]); return R(""); };
  cmds.alias = a => {
    if (!a.length) return R(Object.keys(aliases).map(k => `alias ${k}='${aliases[k]}'`).join("\n"));
    let o = "", e = ""; for (const x of a) { const m = x.match(/^(\w+)=(.*)$/s); if (m) aliases[m[1]] = m[2]; else if (aliases[x]) o += `alias ${x}='${aliases[x]}'\n`; else e += `bash: alias: ${x}: no encontrado\n`; } return { o, e, c: e ? 1 : 0 };
  };
  cmds.unalias = a => { let e = ""; a.forEach(x => { if (aliases[x]) delete aliases[x]; else e += `bash: unalias: ${x}: no encontrado\n`; }); return { o: "", e, c: e ? 1 : 0 }; };
  function runScript(text, keepState) {
    const saved = keepState ? null : { env: { ...env }, cwd, oldpwd, aliases: { ...aliases } };
    let o = "", e = "";
    for (const l of lines(text)) { if (/^\s*(#|$)/.test(l)) continue; const r = execLine(l, null, true); o += r.o; e += r.e; }
    if (saved) { env = saved.env; cwd = saved.cwd; oldpwd = saved.oldpwd; aliases = saved.aliases; }
    return { o, e, c: 0 };
  }
  cmds.source = a => { const n = a[0] && node(a[0]); if (!a[0]) return E("bash: source: falta el nombre del archivo"); if (!n) return E(`bash: ${a[0]}: No existe el archivo o el directorio`); return runScript(n.txt, true); };
  cmds["."] = cmds.source;
  cmds.bash = cmds.sh = a => { const f = a.filter(x => x[0] !== "-")[0]; if (!f) return R("", "bash abriría una subshell interactiva."); const n = node(f); if (!n) return E(`bash: ${f}: No existe el archivo o el directorio`, 127); return runScript(n.txt, false); };
  cmds.sudo = (a, inp) => {
    if (a[0] === "-l") return R("El usuario alumno puede ejecutar los siguientes comandos en ubuntu:\n    (ALL : ALL) ALL");
    if (a[0] === "-i" || a[0] === "su") return R("", "Esto abriría un shell de root (prompt #). Escribe exit para salir. Evita trabajar como root directamente.");
    let rest = a; if (rest[0] === "-u") rest = rest.slice(2); if (!rest.length) return E("uso: sudo [-l] [-i] [-u usuario] comando");
    return runArgv(rest, inp);
  };
  cmds.time = (a, inp) => { const r = runArgv(a, inp); r.e += "\nreal\t0m0,004s\nuser\t0m0,002s\nsys\t0m0,002s\n"; return r; };
  cmds.watch = a => { const rest = a.slice(); while (rest[0] && rest[0][0] === "-") { if (rest[0] === "-n") rest.shift(); rest.shift(); } const r = runArgv(rest, ""); r.note = "watch repetiría esto cada 2 s hasta Ctrl+C. Aquí ves una iteración."; return r; };
  cmds.jq = (a, inp) => {
    let raw = false; const rest = []; a.forEach(x => { if (x === "-r") raw = true; else rest.push(x); });
    const filt = rest.shift(); if (filt === undefined) return E("Uso: jq [opciones] filtro [archivo]", 2);
    const r = readText(rest, inp, "jq"); let data; try { data = JSON.parse(r.t); } catch (x) { return E("jq: error: JSON inválido", 2); }
    const getPath = (v, f) => {
      f = f.trim(); if (f === ".") return [v];
      if (!/^\.[\w.\[\]]*$/.test(f)) return null;
      const toks = [...f.matchAll(/\.?([A-Za-z_]\w*)|\[(\d*)\]/g)];
      let cur = [v];
      for (const t of toks) { const nx = []; for (const c of cur) { if (t[1] !== undefined) nx.push(c == null ? null : c[t[1]] === undefined ? null : c[t[1]]); else if (t[2] === "") { if (Array.isArray(c)) nx.push(...c); } else nx.push(Array.isArray(c) ? c[+t[2]] ?? null : null); } cur = nx; }
      return cur;
    };
    const fmt = v => typeof v === "string" ? (raw ? v : JSON.stringify(v)) : JSON.stringify(v, null, 2);
    let o = "";
    for (const part of filt.split(",")) {
      const p = part.trim(); let m;
      if ((m = p.match(/^(.*?)\s*\|\s*length$/))) { const res = getPath(data, m[1]); if (!res) return E("jq: filtro no soportado en el simulador (pruébalo en tu terminal real)", 3); o += res.map(x => Array.isArray(x) ? x.length : (x && typeof x === "object") ? Object.keys(x).length : String(x).length).join("\n") + "\n"; continue; }
      const res = getPath(data, p); if (!res) return E("jq: filtro no soportado en el simulador (pruébalo en tu terminal real)", 3);
      res.forEach(x => { o += fmt(x) + "\n"; });
    }
    return { o, e: r.e, c: 0 };
  };

  // ---------- comandos con salida de ejemplo ----------
  const SIM = "Salida de ejemplo: este terminal no ejecuta el programa real. Practícalo en tu Linux, WSL o servidor.";
  function canned(name, a) {
    const J = a.join(" ");
    switch (name) {
      case "ping": { const n = (J.match(/-c\s*(\d+)/) || [0, 4])[1]; const h = a.filter(x => x[0] !== "-" && !/^\d+$/.test(x))[0] || "servidor"; let o = `PING ${h} (93.184.216.34) 56(84) bytes of data.\n`; for (let i = 1; i <= +n; i++) o += `64 bytes from 93.184.216.34: icmp_seq=${i} ttl=56 time=${(11 + i * 0.7).toFixed(1)} ms\n`; o += `\n--- ${h} ping statistics ---\n${n} packets transmitted, ${n} received, 0% packet loss`; return R(o, SIM); }
      case "curl": if (/169\.254\.169\.254/.test(J)) return R(/instance-id/.test(J)?"i-0abc1234def567890":/user-data/.test(J)?"#!/bin/bash\nyum -y install httpd\nsystemctl start httpd":"ami-id\ninstance-id\ninstance-type\nlocal-ipv4\npublic-ipv4\niam/", SIM); if (/-I/.test(J)) return R("HTTP/2 200\ncontent-type: text/html; charset=UTF-8\ncontent-length: 1256\nserver: nginx\ndate: Mon, 26 Oct 2026 17:54:00 GMT", SIM); if (/-v/.test(J)) return R("*   Trying 93.184.216.34:443...\n* Connected to example.com (93.184.216.34) port 443\n> GET / HTTP/2\n> Host: example.com\n< HTTP/2 200\n< content-type: text/html\n<!doctype html><html>...</html>", SIM); return R("<!doctype html>\n<html><head><title>Example Domain</title></head>...</html>", SIM);
      case "nc": return R(`Connection to ${a.filter(x => x[0] !== "-")[0] || "servidor"} ${a.filter(x => x[0] !== "-")[1] || ""} port [tcp/*] succeeded!`, SIM);
      case "telnet": return R(`Trying 198.51.100.25...\nConnected to ${a[0] || "servidor"}.\nEscape character is '^]'.\nSSH-2.0-OpenSSH_9.6p1 Ubuntu`, SIM);
      case "ss": return R("Netid State  Recv-Q Send-Q Local Address:Port  Peer Address:Port Process\ntcp   LISTEN 0      128    0.0.0.0:22          0.0.0.0:*     users:((\"sshd\",pid=702))\ntcp   LISTEN 0      511    0.0.0.0:80          0.0.0.0:*     users:((\"nginx\",pid=1190))\ntcp   LISTEN 0      151    127.0.0.1:3306      0.0.0.0:*     users:((\"mysqld\",pid=980))", SIM);
      case "traceroute": return R("traceroute to destino (93.184.216.34), 30 hops max\n 1  _gateway (192.168.1.1)  1.2 ms\n 2  10.20.0.1  8.4 ms\n 3  ae-1.core.isp.net (190.41.0.1)  12.9 ms\n 4  93.184.216.34  18.3 ms", SIM);
      case "dig": case "nslookup": case "host": {
        const isNs = name === "nslookup", isH = name === "host";
        const pos = a.filter(x => !/^[-+]/.test(x)); const srvArg = (a.find(x => x[0] === "@") || "").slice(1);
        const typeOpt = (a.find(x => /^-type=/i.test(x)) || "").replace(/^-type=/i, "").toUpperCase();
        const TY = /^(A|AAAA|MX|NS|TXT|CNAME|SOA|SRV|PTR)$/i;
        let t = typeOpt || ((pos.filter(x => x[0] !== "@").find(x => TY.test(x)) || "A").toUpperCase());
        const dom = (pos.filter(x => x[0] !== "@" && !(TY.test(x) && pos.filter(y => y[0] !== "@").length > 1))[0]) || "dominio.com";
        const server = srvArg || (isNs ? (pos[1] || "") : "") || "8.8.8.8";
        const d = dom.replace(/\.$/, "");
        const ans = { A: "93.184.216.34", AAAA: "2606:2800:220:1:248:1893:25c8:1946", MX: "10 aspmx.l.google.com.", NS: "ns-123.awsdns-12.com.\nns-456.awsdns-45.net.\nns-789.awsdns-78.org.\nns-012.awsdns-01.co.uk.", TXT: "\"v=spf1 include:_spf.google.com ~all\"", CNAME: d, SOA: "ns-123.awsdns-12.com. awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400", SRV: "10 60 5060 sip." + d.replace(/^_[^.]*\._[^.]*\./, "") + ".", PTR: "ec2-93-184-216-34.compute.amazonaws.com." };
        if (/-x/.test(J) && !isNs) return R(ans.PTR, SIM);
        if (isNs) return R(`Server:\t\t${server}\nAddress:\t${server}#53\n\nNon-authoritative answer:\n` + (t === "A" ? `Name:\t${d}\nAddress: ${ans.A}` : t === "MX" ? `${d}\tmail exchanger = ${ans.MX}` : t === "NS" ? ans.NS.split("\n").map(x => `${d}\tnameserver = ${x}`).join("\n") : `${d}\ttext = ${ans.TXT}`), SIM);
        if (isH) return R(t === "MX" ? `${d} mail is handled by ${ans.MX}` : `${d} has address ${ans.A}`, SIM);
        if (/\+trace/.test(J)) return R(`.\t\t518400\tIN\tNS\ta.root-servers.net.\n;; Received 811 bytes from 8.8.8.8#53\n\ncom.\t\t172800\tIN\tNS\ta.gtld-servers.net.\n;; Received 1173 bytes from a.root-servers.net#53\n\n${d}.\t172800\tIN\tNS\tns-123.awsdns-12.com.\n;; Received 645 bytes from a.gtld-servers.net#53\n\n${d}.\t300\tIN\tA\t${ans.A}\n;; Received 87 bytes from ns-123.awsdns-12.com#53`, SIM);
        if (/\+short/.test(J)) return R(ans[t] || ans.A, SIM);
        const tcp = /\+tcp/.test(J) ? " (TCP)" : "";
        return R(`;; QUESTION SECTION:\n;${d}.\t\tIN\t${t}\n\n;; ANSWER SECTION:\n` + (ans[t] || ans.A).split("\n").map(x => `${d}.\t300\tIN\t${t}\t${x}`).join("\n") + `\n\n;; Query time: 24 msec\n;; SERVER: ${server}#53(${server})${tcp}`, SIM);
      }
      case "ipcalc": {
        const m = (a.find(x => /^\d+\.\d+\.\d+\.\d+(\/\d+)?$/.test(x)) || "").match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)(?:\/(\d+))?$/);
        if (!m) return E("uso: ipcalc <ip>/<prefijo>   (ejemplo: ipcalc 192.168.1.0/26)", 1);
        const o = m.slice(1, 5).map(Number), p = m[5] === undefined ? 24 : +m[5];
        if (o.some(x => x > 255) || p > 32) return E("ipcalc: dirección o prefijo inválido", 1);
        const ip = ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0, mask = p === 0 ? 0 : (0xFFFFFFFF << (32 - p)) >>> 0, net = (ip & mask) >>> 0, bc = (net | (~mask >>> 0)) >>> 0;
        const f = n => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join("."), tot = Math.pow(2, 32 - p), hosts = p >= 31 ? tot : tot - 2;
        return R(`Address:   ${f(ip)}\nNetmask:   ${f(mask)} = ${p}\nNetwork:   ${f(net)}/${p}\nHostMin:   ${f(p >= 31 ? net : net + 1)}\nHostMax:   ${f(p >= 31 ? bc : bc - 1)}\nBroadcast: ${f(bc)}\nHosts/Net: ${hosts}${p >= 24 || true ? "   (en AWS: " + Math.max(tot - 5, 0) + " útiles)" : ""}`, SIM);
      }
      case "ip": { const sub = a[0] || ""; if (/^(a|addr|address)$/.test(sub)) return R("1: lo: <LOOPBACK,UP> mtu 65536\n    inet 127.0.0.1/8 scope host lo\n2: eth0: <BROADCAST,MULTICAST,UP> mtu 9001\n    inet 10.0.1.15/24 brd 10.0.1.255 scope global eth0", SIM); if (/^(r|route)$/.test(sub)) return R("default via 10.0.1.1 dev eth0\n10.0.1.0/24 dev eth0 proto kernel scope link src 10.0.1.15", SIM); return R("uso: ip a | ip route", SIM); }
      case "aws": {
        const J = a.join(" "), svc = a[0] || "", op = a[1] || "";
        if (/--version/.test(J)) return R("aws-cli/2.15.30 Python/3.11.8 Linux/5.10.0 exe/x86_64.amzn.2", SIM);
        if (svc === "configure") return R("AWS Access Key ID [None]: AKIAEXAMPLE\nAWS Secret Access Key [None]: ****************\nDefault region name [None]: us-east-1\nDefault output format [None]: json", SIM);
        if (svc === "help" || !svc) return R("AWS()\n\nNAME\n       aws -\n\nSYNOPSIS\n          aws [options] <command> <subcommand> [parameters]", SIM);
        if (svc === "ec2" && /--dry-run/.test(J)) return R("An error occurred (DryRunOperation) when calling the " + op.replace(/-(\w)/g, (m, c) => c.toUpperCase()).replace(/^./, c => c.toUpperCase()) + " operation: Request would have succeeded, but DryRun flag is set.", SIM);
        if (svc === "ec2" && op === "describe-instances") {
          if (/--query/.test(J) && /State\.Name/.test(J)) return R('[\n    "running",\n    "stopped"\n]', SIM);
          if (/--output\s+table/.test(J)) return R("---------------------------------\n|       DescribeInstances       |\n+------------+------------------+\n|  i-0abc123 |  t2.micro        |\n+------------+------------------+", SIM);
          return R('{\n  "Reservations": [{\n    "Instances": [{ "InstanceId": "i-0abc123", "InstanceType": "t2.micro",\n      "State": { "Name": "running" } }]\n  }]\n}', SIM);
        }
        if (svc === "ec2" && op === "stop-instances") return R('{ "StoppingInstances": [{ "InstanceId": "i-1234567890abcdef0",\n  "CurrentState": { "Name": "stopping" } }] }', SIM);
        if (svc === "ec2" && op === "run-instances") return R('{ "Instances": [{ "InstanceId": "i-0def456", "State": { "Name": "pending" } }] }', SIM);
        if (svc === "ec2" && op === "create-vpc") return R('{ "Vpc": { "VpcId": "vpc-0a1b2c3d", "CidrBlock": "10.0.0.0/16", "State": "pending" } }', SIM);
        if (svc === "ec2" && op === "create-volume") return R('{ "VolumeId": "vol-0123abcd", "Size": 8, "State": "creating" }', SIM);
        if (svc === "s3" && op === "ls") return R("2026-10-01 10:12:44 mi-bucket-datos\n2026-10-05 08:30:02 mi-bucket-logs", SIM);
        if (svc === "s3") return R("upload: ./archivo.txt to s3://mi-bucket-datos/archivo.txt", SIM);
        if (svc === "iam" && /list-users/.test(op)) return R('{ "Users": [{ "UserName": "sofia" }, { "UserName": "nicolas" }] }', SIM);
        if (svc === "iam") return R('{ "User": { "UserName": "sofia", "Arn": "arn:aws:iam::123456789012:user/sofia" } }', SIM);
        if (svc === "rds") return R('{ "DBSnapshot": { "DBSnapshotIdentifier": "mi-snap", "Status": "creating" } }', SIM);
        return R("(salida simulada de aws " + svc + " " + op + ")", SIM);
      }
      case "docker": {
        const pos = a.filter(x => x[0] !== "-"), sub = a[0] || "", sub2 = a[1] || "";
        const nm = (() => { const i = a.indexOf("--name"); return i >= 0 && a[i + 1] ? a[i + 1] : ""; })();
        const img = pos.slice(1).filter(x => /[:\/]|^[a-z][a-z0-9._-]*$/.test(x)).pop() || "nginx";
        const cid = "c7d2f9a1b3e5";
        if (sub === "compose") {
          const cs = sub2;
          if (cs === "up") return R(" ✔ Network app_default   Created\n ✔ Volume app_pg-data    Created\n ✔ Container app-db-1       Healthy\n ✔ Container app-backend-1  Started", SIM);
          if (cs === "down") return R(" ✔ Container app-backend-1  Removed\n ✔ Container app-db-1       Removed\n ✔ Network app_default      Removed" + (a.includes("-v") ? "\n ✔ Volume app_pg-data       Removed" : ""), SIM);
          if (cs === "ps") return R("NAME           IMAGE                STATUS                  PORTS\napp-backend-1  flaskapp:latest      Up 2 minutes (healthy)  0.0.0.0:5000->5000/tcp\napp-db-1       postgres:18-alpine   Up 2 minutes (healthy)  5432/tcp", SIM);
          if (cs === "logs") return R("backend-1  |  * Running on all addresses (0.0.0.0)\nbackend-1  |  * Running on http://127.0.0.1:5000\ndb-1       | database system is ready to accept connections", SIM);
          if (cs === "config") return R("name: app\nservices:\n  backend:\n    image: flaskapp:latest\n    ports:\n      - mode: ingress\n        target: 5000\n        published: \"5000\"", SIM);
          if (cs === "build") return R("[+] Building 4.2s (9/9) FINISHED\n => naming to docker.io/library/flaskapp:latest", SIM);
          if (cs === "exec") return R("psql (18.0)\nType \"help\" for help.\n\nmyapp=#", SIM);
          if (cs === "stop") return R(" ✔ Container app-backend-1  Stopped\n ✔ Container app-db-1       Stopped", SIM);
          if (cs === "version") return R("Docker Compose version v5.1.0", SIM);
          return R("docker compose: prueba up -d, ps, logs -f, exec, stop, down, down -v, config", SIM);
        }
        if (sub === "network") { if (sub2 === "create") return R("3f1c9a7b2d84e6a05b1c", SIM); if (sub2 === "ls") return R("NETWORK ID     NAME      DRIVER    SCOPE\n1a2b3c4d5e6f   bridge    bridge    local\n9f8e7d6c5b4a   host      host      local\n0a1b2c3d4e5f   none      null      local\n3f1c9a7b2d84   app-net   bridge    local", SIM); if (sub2 === "inspect") return R(`[{ "Name": "${pos[2] || "app-net"}", "Driver": "bridge",\n  "IPAM": { "Config": [{ "Subnet": "172.18.0.0/16", "Gateway": "172.18.0.1" }] },\n  "Containers": { "db": { "IPv4Address": "172.18.0.3/16" }, "web": { "IPv4Address": "172.18.0.2/16" } } }]`, SIM); if (sub2 === "rm") return R(pos[2] || "app-net", SIM); return R("uso: docker network create|ls|inspect|rm", SIM); }
        if (sub === "volume") { if (sub2 === "create") return R(pos[2] || "pg-data", SIM); if (sub2 === "ls") return R("DRIVER    VOLUME NAME\nlocal     pg-data\nlocal     mysql-data", SIM); if (sub2 === "rm") return R(pos[2] || "pg-data", SIM); return R("uso: docker volume create|ls|rm|inspect", SIM); }
        if (sub === "run") { const bg = a.includes("-d"); return R(bg ? cid + "f4a1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1" : "Unable to find image '" + img + "' locally\nlatest: Pulling from library/nginx\nDigest: sha256:9a3f...\nStatus: Downloaded newer image for " + img + "\n/docker-entrypoint.sh: Configuration complete; ready for start up", SIM); }
        if (sub === "ps") { const all = a.includes("-a") || a.includes("--all"); if (a.includes("-q")) return R(cid + "\n5b6a7c8d9e0f", SIM); return R("CONTAINER ID   IMAGE         COMMAND                  STATUS         PORTS                  NAMES\n" + cid + "   nginx         \"/docker-entrypoint.…\"   Up 2 minutes   0.0.0.0:8080->80/tcp   web\n5b6a7c8d9e0f   postgres:18   \"docker-entrypoint.s…\"   Up 2 minutes   5432/tcp               db" + (all ? "\n9d8c7b6a5f4e   alpine        \"sh\"                     Exited (0) 1 hour ago                         old" : ""), SIM); }
        if (sub === "images" || (sub === "image" && sub2 === "ls")) return R("REPOSITORY      TAG        IMAGE ID       SIZE\nflaskapp        1.0        a1b2c3d4e5f6   142MB\nnginx           alpine     e4f5a6b7c8d9   52MB\npython          3.14-slim  7c8d9e0f1a2b   131MB", SIM);
        if (sub === "pull") return R("Using default tag: latest\nlatest: Pulling from library/" + (pos[1] || "nginx") + "\nDigest: sha256:9a3f...\nStatus: Downloaded newer image for " + (pos[1] || "nginx") + ":latest", SIM);
        if (sub === "build") return R("[+] Building 6.8s (10/10) FINISHED\n => [1/5] FROM python:3.14-slim\n => [2/5] WORKDIR /app\n => [3/5] COPY requirements.txt .\n => [4/5] RUN pip install --no-cache-dir -r requirements.txt\n => [5/5] COPY . .\n => naming to docker.io/library/" + ((a[a.indexOf("-t") + 1]) || "flaskapp:1.0"), SIM);
        if (sub === "tag") return R("", SIM);
        if (sub === "push") return R("The push refers to repository [docker.io/" + (pos[1] || "usuario/mi-app:1.0") + "]\n5f70bf18a086: Pushed\n1.0: digest: sha256:4b1c... size: 1573", SIM);
        if (sub === "login") return R("Login Succeeded", SIM);
        if (sub === "logs") return R("172.17.0.1 - - [26/Oct/2026:23:06:01] \"GET / HTTP/1.1\" 200 615\n172.17.0.1 - - [26/Oct/2026:23:06:04] \"GET /favicon.ico HTTP/1.1\" 404 153", SIM);
        if (sub === "exec") return R(a.includes("-it") || a.includes("-ti") ? "/ # " : "nginx.conf\nconf.d\nmime.types", SIM);
        if (sub === "stats") return R("CONTAINER ID   NAME   CPU %   MEM USAGE / LIMIT   MEM %   NET I/O       BLOCK I/O\n" + cid + "   web    0.02%   8.5MiB / 7.6GiB     0.11%   1.2kB / 0B    0B / 0B", SIM);
        if (sub === "stop" || sub === "start" || sub === "restart" || sub === "kill" || sub === "rm") return R(pos[1] || "web", SIM);
        if (sub === "rmi") return R("Untagged: " + (pos[1] || "nginx:latest") + "\nDeleted: sha256:e4f5a6b7c8d9...", SIM);
        if (sub === "inspect") return R("[{ \"Id\": \"" + cid + "...\", \"State\": { \"Status\": \"running\" }, \"NetworkSettings\": { \"Networks\": { \"app-net\": { \"IPAddress\": \"172.18.0.2\" } } } }]", SIM);
        if (sub === "system" || sub === "container" || sub === "image") return R(sub2 === "df" ? "TYPE            TOTAL   ACTIVE   SIZE     RECLAIMABLE\nImages          4       2        412MB    210MB (50%)\nContainers      3       2        1.2kB    0B\nLocal Volumes   2       1        180MB    90MB (50%)" : "Total reclaimed space: 210MB", SIM);
        if (sub === "version" || sub === "--version") return R("Docker version 29.5.0, build a1b2c3d", SIM);
        return R("Docker simulado: prueba run, ps, images, pull, build, logs, exec, stop, rm, network, volume y compose", SIM);
      }
      case "apt": case "apt-get": {
        const sub = a.find(x => x[0] !== "-"); const pk = a.filter(x => x[0] !== "-")[1] || "paquete";
        const o = { update: "Hit:1 http://archive.ubuntu.com/ubuntu noble InRelease\nGet:2 http://archive.ubuntu.com/ubuntu noble-updates InRelease [126 kB]\nReading package lists... Done\n12 packages can be upgraded. Run 'apt list --upgradable' to see them.", upgrade: "Reading package lists... Done\nCalculating upgrade... Done\n12 upgraded, 0 newly installed, 0 to remove.", install: `Reading package lists... Done\nThe following NEW packages will be installed:\n  ${pk}\nSetting up ${pk} ...`, remove: `Removing ${pk} ...\n(la configuración se conserva)`, purge: `Removing ${pk} ...\nPurging configuration files for ${pk} ...`, autoremove: "Reading package lists... Done\n0 upgraded, 0 newly installed, 3 to remove.", clean: "", search: `${pk}/noble 1.24.0 amd64\n  servidor web de alto rendimiento`, show: `Package: ${pk}\nVersion: 1.24.0\nDescription: servidor web de alto rendimiento`, list: "nginx/noble,now 1.24.0 amd64 [installed]\ncurl/noble,now 8.5.0 amd64 [installed]" }[sub]; return R(o === undefined ? "" : o, SIM);
      }
      case "yum": case "dnf": { const sub = a.find(x => x[0] !== "-"); const pk = a.filter(x => x[0] !== "-")[1] || "paquete"; return R({ update: "Dependencies resolved.\nNothing to do.\nComplete!", install: `Installing: ${pk}\nComplete!`, remove: `Removing: ${pk}\nComplete!`, search: `${pk}.x86_64 : paquete de ejemplo`, list: "Installed Packages\nbash.x86_64   5.1.8   @System", clean: "12 files removed" }[sub] || "Complete!", SIM); }
      case "apk": { const sub = a[0]; return R({ update: "fetch https://dl-cdn.alpinelinux.org/alpine/v3.20/main/x86_64/APKINDEX.tar.gz\nOK: 5 distinct packages available", add: `(1/1) Installing ${a[1] || "paquete"}\nOK: 12 MiB in 20 packages`, del: `(1/1) Purging ${a[1] || "paquete"}\nOK: 11 MiB in 19 packages`, search: `${a[1] || "paquete"}-1.0-r0` }[sub] || "", SIM); }
      case "tar": { const fl = (a[0] || "").replace(/-/g, ""); if (fl.includes("t")) return R("proyecto/\nproyecto/src/\nproyecto/src/main.py\nproyecto/README.md", SIM); if (fl.includes("c")) return R("proyecto/\nproyecto/src/\nproyecto/src/main.py\nproyecto/README.md", SIM); return R(fl.includes("v") ? "proyecto/\nproyecto/src/main.py" : "", SIM); }
      case "zip": return R("  adding: proyecto/ (stored 0%)\n  adding: proyecto/src/main.py (deflated 41%)", SIM);
      case "unzip": return R("Archive:  archivo.zip\n   creating: proyecto/\n  inflating: proyecto/src/main.py", SIM);
      case "ps": return R("USER         PID %CPU %MEM COMMAND\nroot           1  0.0  0.1 /sbin/init\nroot         702  0.0  0.1 sshd: /usr/sbin/sshd -D\nroot        1190  0.0  0.2 nginx: master process /usr/sbin/nginx\nwww-data    1203  0.0  0.2 nginx: worker process\nalumno      2150  0.0  0.1 -bash\nalumno      2210  0.0  0.0 sleep 300\nalumno      2288  0.0  0.1 ssh -f -N -L 8080:localhost:8080 juan@servidor", SIM);
      case "top": return R("top - 12:54:00 up 3 days,  1 user,  load average: 0.08, 0.03, 0.01\nTasks: 112 total,   1 running, 111 sleeping\n%Cpu(s):  1.2 us,  0.4 sy, 98.4 id\nMiB Mem :   1985.0 total,    812.3 free,    604.2 used\n\n  PID USER      %CPU %MEM COMMAND\n 1190 root       0.3  0.2 nginx\n  702 root       0.0  0.1 sshd", SIM);
      case "htop": return R("", "htop abre un monitor visual interactivo (salir con q). Se instala con apt o yum.");
      case "kill": case "killall": case "pkill": return R("", "Señal enviada (simulado). Primero kill PID; si no responde, kill -9 PID.");
      case "sleep": return R("", /&/.test(J) ? "Proceso en segundo plano: [1] 2301" : "Esperaría " + (a[0] || "N") + " segundos.");
      case "systemctl": { const sub = a[0], sv = a[a.length - 1]; if (sub === "status") return R(`● ${sv}.service - A high performance web server\n     Loaded: loaded (/lib/systemd/system/${sv}.service; enabled; preset: enabled)\n     Active: active (running) since Mon 2026-10-26 08:00:11 -05; 4h 54min ago\n   Main PID: 1190 (nginx)\n      Tasks: 3 (limit: 2318)\n     Memory: 4.8M`, SIM); return R("", `Hecho (simulado): systemctl ${a.join(" ")}`); }
      case "journalctl": return R("oct 26 08:00:11 ubuntu systemd[1]: Starting nginx.service...\noct 26 08:00:11 ubuntu systemd[1]: Started nginx.service.\noct 26 12:30:02 ubuntu nginx[1190]: reload ok", SIM);
      case "crontab": if (a[0] === "-l") return R("# m h dom mon dow command\n*/5 * * * * /home/alumno/backup.sh >> /var/log/backup.log 2>&1\n30 2 * * * /usr/bin/apt-get update > /dev/null 2>&1", SIM); if (a[0] === "-e") return R("", "crontab -e abriría tu editor con el crontab. Cada línea: minuto hora día-mes mes día-semana comando."); if (a[0] === "-r") return R("", "crontab -r eliminaría tu crontab completo. Cuidado: no pide confirmación."); return R("");
      case "ssh": return R("", "Conexión simulada. En un servidor real verías: contraseña/llave → prompt del servidor. (-p puerto, -i llave, -L túnel, -f -N segundo plano.)");
      case "scp": case "rsync": return R(/rsync/.test(name) ? "sending incremental file list\n./\nnotas.txt\n\nsent 1,204 bytes  received 38 bytes  total size 980" : "notas.txt                100%  980   1.2MB/s   00:00", SIM);
      case "ssh-keygen": return R("Generating public/private ed25519 key pair.\nYour identification has been saved in /home/alumno/.ssh/id_ed25519\nYour public key has been saved in /home/alumno/.ssh/id_ed25519.pub", SIM);
      case "ssh-copy-id": return R("Number of key(s) added: 1\nAhora prueba a conectarte con: ssh usuario@servidor", SIM);
      case "wsl": return R(/--list\s+--online/.test(J) ? "Estas son las distribuciones válidas:\n  Ubuntu-24.04    Ubuntu 24.04 LTS\n  Debian          Debian GNU/Linux\n  kali-linux      Kali Linux Rolling" : /--version/.test(J) ? "Versión de WSL: 2.3.26.0\nVersión del kernel: 5.15.167.4-1" : /--list/.test(J) ? "  NAME            STATE    VERSION\n* Ubuntu-24.04    Running  2" : /--install/.test(J) ? "Instalando: Ubuntu 24.04 LTS\nSe instaló la distribución. Reinicia el PC y crea tu usuario." : /--update/.test(J) ? "Buscando actualizaciones...\nSe actualizó WSL." : "", "Esto se escribe en PowerShell de Windows; aquí es solo práctica.");
      case "vim": case "vi": case "nano": return R("", "El editor no corre en este terminal. En Vim: i = insertar · Esc = normal · :wq guardar y salir · :q! salir sin guardar. Aquí puedes crear contenido con echo o heredoc.");
      case "useradd": case "usermod": case "userdel": case "groupadd": case "groupdel": case "passwd": return R("", "Hecho (simulado). En un sistema real necesitas sudo.");
      case "yq": return R(/-o=json/.test(J) ? "{\"nombre\":\"api-pagos\",\"version\":\"1.4.2\",\"puerto\":8080}" : /^'?\.nombre/.test(a[0] || "") ? "api-pagos" : "", SIM);
      case "exit": case "logout": return R("logout");
    }
    return null;
  }
  const KNOWN = ["ping", "curl", "nc", "telnet", "ss", "traceroute", "ipcalc", "ip", "docker", "aws", "dig", "nslookup", "host", "apt", "apt-get", "yum", "dnf", "apk", "tar", "zip", "unzip", "ps", "top", "htop", "kill", "killall", "pkill", "sleep", "systemctl", "journalctl", "crontab", "ssh", "scp", "rsync", "ssh-keygen", "ssh-copy-id", "wsl", "vim", "vi", "nano", "useradd", "usermod", "userdel", "groupadd", "groupdel", "passwd", "yq", "exit", "logout"];

  function runArgv(argv, inp) {
    const name = argv[0], a = argv.slice(1);
    if (name === undefined) return R("");
    if (cmds[name]) return cmds[name](a, inp);
    if (name.includes("/")) {
      const n = node(name);
      if (!n) return E(`bash: ${name}: No existe el archivo o el directorio`, 127);
      if (n.t === "d") return E(`bash: ${name}: Es un directorio`, 126);
      if (!/x/.test(perm(n.mode).slice(0, 3))) return E(`bash: ${name}: Permiso denegado`, 126);
      return runScript(n.txt, false);
    }
    if (KNOWN.includes(name)) { const c = canned(name, a); if (c) return c; return R("", "Comando registrado (simulado)."); }
    return E(`${name}: orden no encontrada`, 127);
  }

  // ---------- análisis ----------
  function tokenize(s) {
    const ops = ["2>&1", "&>", "2>>", "2>", ">>", ">", "<", "||", "&&", "|", ";"]; const t = []; let i = 0;
    const expand = x => x.replace(/\$\{(\w+)\}|\$(\w+)/g, (m, p, q) => "\u0001" + (p || q) + "\u0002");
    while (i < s.length) {
      if (/\s/.test(s[i])) { i++; continue; }
      const op = ops.find(o => s.startsWith(o, i));
      if (op) { t.push({ op }); i += op.length; continue; }
      if (s[i] === "&") { i++; continue; }
      let w = "", quoted = false, started = false;
      while (i < s.length && !/\s/.test(s[i]) && !"|;<>&".includes(s[i])) {
        const c = s[i];
        if (c === "'") { const j = s.indexOf("'", i + 1); const end = j < 0 ? s.length : j; w += s.slice(i + 1, end); i = end + 1; quoted = true; }
        else if (c === '"') { let j = i + 1, buf = ""; while (j < s.length && s[j] !== '"') { if (s[j] === "\\" && j + 1 < s.length && '"$\\'.includes(s[j + 1])) { buf += s[j + 1]; j += 2; } else buf += s[j++]; } w += expand(buf); i = j + 1; quoted = true; }
        else if (c === "\\" && i + 1 < s.length) { w += s[i + 1]; i += 2; quoted = true; }
        else { let j = i; while (j < s.length && !/[\s|;<>&'"\\]/.test(s[j])) j++; let seg = s.slice(i, j); if (!started && seg[0] === "~" && (seg.length === 1 || seg[1] === "/")) seg = HOME + seg.slice(1); w += expand(seg); i = j; }
        started = true;
      }
      t.push({ w, quoted });
    }
    return t;
  }
  function globExpand(w) {
    if (!w.includes("*")) return [w];
    const slash = w.lastIndexOf("/"); const dir = slash >= 0 ? w.slice(0, slash + 1) : ""; const pat = slash >= 0 ? w.slice(slash + 1) : w; const dn = node(dir || ".");
    if (!dn || dn.t !== "d") return [w];
    const re = new RegExp("^" + pat.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
    const m = Object.keys(dn.c).filter(k => k[0] !== "." && re.test(k)).sort().map(k => dir + k);
    return m.length ? m : [w];
  }
  const ev = w => w.replace(/\u0001(\w+)\u0002/g, (m, k) => env[k] ?? "");
  function runSimple(toks, stdin) {
    toks = toks.map(t => t.w !== undefined ? Object.assign({}, t, { w: ev(t.w) }) : t);
    const argv = []; let outF = null, errF = null, bothF = null, errToOut = false, inF = null, append = false, errApp = false;
    for (let k = 0; k < toks.length; k++) {
      const t = toks[k];
      if (t.op) {
        const nx = toks[k + 1];
        if (t.op === "2>&1") { errToOut = true; continue; }
        const target = nx && nx.w !== undefined ? nx.w : null; if (target === null) return E("bash: error de sintaxis cerca del elemento inesperado «newline»", 2);
        if (t.op === ">") { outF = target; append = false; } else if (t.op === ">>") { outF = target; append = true; } else if (t.op === "2>") { errF = target; errApp = false; } else if (t.op === "2>>") { errF = target; errApp = true; } else if (t.op === "&>") { bothF = target; } else if (t.op === "<") { inF = target; }
        k++; continue;
      }
      if (t.quoted || !t.w.includes("*")) argv.push(t.w); else argv.push(...globExpand(t.w));
    }
    if (argv.length === 1 && /^[A-Za-z_]\w*=/.test(argv[0])) { const m = argv[0].match(/^(\w+)=(.*)$/s); env[m[1]] = m[2]; return R(""); }
    let inp = stdin;
    if (inF) { const n = node(inF); if (!n || n.t !== "f") return E(`bash: ${inF}: No existe el archivo o el directorio`); inp = n.txt; }
    let av = argv; if (av[0] && aliases[av[0]]) { const ex = tokenize(aliases[av[0]]).filter(x => x.w !== undefined).map(x => ev(x.w)); av = ex.concat(av.slice(1)); }
    let r; try { r = runArgv(av, inp); } catch (x) { r = E("bash: error interno del simulador: " + x.message); }
    r = { o: r.o || "", e: r.e || "", c: r.c || 0, clear: r.clear, note: r.note };
    if (errToOut) { r.o += r.e; r.e = ""; }
    if (bothF) { const er = writeFile(bothF, r.o + r.e, false); r.o = ""; r.e = er ? er + "\n" : ""; }
    if (outF) { const er = writeFile(outF, r.o, append); r.o = ""; if (er) { r.e += er + "\n"; r.c = 1; } }
    if (errF) { const er = writeFile(errF, r.e, errApp); r.e = er ? er + "\n" : ""; }
    return r;
  }
  function execLine(line, heredoc, silentHist) {
    line = line.trim(); if (!line) return { o: "", e: "", c: 0 };
    let toks = tokenize(line);
    const items = []; let cur = []; let sep = ";";
    for (const t of toks) { if (t.op === ";" || t.op === "&&" || t.op === "||") { if (cur.length) items.push({ cur, sep }); cur = []; sep = t.op; } else cur.push(t); }
    if (cur.length) items.push({ cur, sep });
    let o = "", e = "", code = 0, clear = false, note = "";
    for (const it of items) {
      if (it.sep === "&&" && code !== 0) continue; if (it.sep === "||" && code === 0) continue;
      const segs = []; let c2 = []; for (const t of it.cur) { if (t.op === "|") { segs.push(c2); c2 = []; } else c2.push(t); } segs.push(c2);
      let stdin = heredoc ? heredoc.text : "", last = { o: "", e: "", c: 0 };
      segs.forEach((sg, i) => { const r = runSimple(sg, i === 0 ? stdin : last.o); e += r.e; if (r.clear) clear = true; if (r.note) note += (note ? "\n" : "") + r.note; last = r; code = r.c; });
      o += last.o;
    }
    return { o, e, c: code, clear, note };
  }
  function exec(line, heredoc) {
    let exp = null;
    if (/!!/.test(line) && hist.length) { const l2 = line.replace(/!!/g, hist[hist.length - 1]); exp = l2; line = l2; }
    const hd = heredoc ? { text: heredoc.literal ? heredoc.text : heredoc.text.replace(/\$\{(\w+)\}|\$(\w+)/g, (m, p, q) => env[p || q] ?? "") } : null;
    let ln = line.replace(/<<-?\s*['"]?\w+['"]?/, "");
    if (line.trim()) hist.push(line.trim());
    const r = execLine(ln, hd);
    r.exp = exp; return r;
  }
  function prompt() { const p = cwd === HOME ? "~" : cwd.startsWith(HOME + "/") ? "~" + cwd.slice(HOME.length) : cwd; return { u: "alumno@ubuntu", p }; }
  function heredocStart(line) { const m = line.match(/<<-?\s*(['"]?)(\w+)\1/); return m ? { delim: m[2], literal: !!m[1] } : null; }
  return { exec, reset, prompt, heredocStart };
})();
