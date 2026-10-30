(function () {
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ICO = { home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>', menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', plus: '<path d="M12 5v14M5 12h14"/>', prev: '<path d="M15 6l-6 6 6 6"/>', next: '<path d="M9 6l6 6-6 6"/>', play: '<path d="M7 5l12 7-12 7z"/>', term: '<path d="M3 5h18v14H3zM7 10l3 2-3 2M12 14h4"/>', check: '<path d="M5 12l5 5 9-10"/>', chev: '<path d="M9 6l6 6-6 6"/>', cols: '<path d="M3 5h18v14H3zM12 5v14"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>', moon: '<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>', auto: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16"/><path d="M12 4a8 8 0 010 16z" fill="currentColor"/>' };
  const ic = n => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICO[n]}</svg>`;
  function hl(s) {
    const re = /(\s+)|("(?:[^"\\]|\\.)*"|'[^']*')|(\$\{?\w+\}?)|(\|\||&&|2>&1|&>|>>|2>>|2>|[|;<>&])|(--?[A-Za-z][\w=.\-]*)|([^\s"'|;<>&$]+)/g;
    let first = true, out = "", m;
    while ((m = re.exec(s))) {
      if (m[1]) out += m[1];
      else if (m[2]) out += `<span class="h-s">${esc(m[2])}</span>`;
      else if (m[3]) out += `<span class="h-v">${esc(m[3])}</span>`;
      else if (m[4]) { out += `<span class="h-o">${esc(m[4])}</span>`; if (/^(\||\|\||&&|;)$/.test(m[4])) first = true; }
      else if (m[5]) out += `<span class="h-f">${esc(m[5])}</span>`;
      else if (m[6] !== undefined) { if (first && !/^[.\/~#:*]/.test(m[6])) { out += `<span class="h-c">${esc(m[6])}</span>`; if (m[6] !== "sudo") first = false; } else { out += esc(m[6]); first = false; } }
      else break;
    }
    return out;
  }
  const KEY = "aula.v1";
  let P = { seen: {}, lab: {}, quiz: {}, cards: {}, open: {}, last: null, read: {}, notes: {}, days: {} };
  try { const r = localStorage.getItem(KEY); if (r) P = Object.assign(P, JSON.parse(r)); } catch (e) {}
  const applyTheme = () => { try { const r = document.documentElement; if (P.theme === "light" || P.theme === "dark") r.setAttribute("data-theme", P.theme); else r.removeAttribute("data-theme"); } catch (e) {} };
  const THEMES = { auto: ["Automático", "auto"], light: ["Claro", "sun"], dark: ["Oscuro", "moon"] };
  if (!P.theme) P.theme = "dark";
  applyTheme();
  const today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const touch = () => { P.days = P.days || {}; const t = today(); if (!P.days[t]) { P.days[t] = 1; try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) {} } };
  const streak = () => { let n = 0; const d = new Date(); if (!(P.days || {})[today()]) d.setDate(d.getDate() - 1); for (;;) { const k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); if ((P.days || {})[k]) { n++; d.setDate(d.getDate() - 1); } else break; } return n; };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) {} };

  // ---------- datos ----------
  let cid = (P.last && COURSES.some(c => c.id === P.last.course)) ? P.last.course : COURSES[0].id;
  const course = () => COURSES.find(c => c.id === cid);
  const flatCache = {};
  const flat = () => flatCache[cid] || (flatCache[cid] = course().modules.flatMap(m => m.lessons.map(l => Object.assign({}, l, { mod: m }))));
  const lesson = id => flat().find(l => l.id === id) || flat()[0];
  const lkey = l => cid + ":" + l.id;
  const S = { lesson: (P.last && P.last.lesson) || "0.1", tab: (P.last && P.last.tab) || "teoria", scope: "lesson", queue: [], shown: false, cram: false, hints: {}, hidecm: false, split: !!P.split, chat: [], busy: false, newc: false, home: true, hg: "all" };
  if (!flat().some(l => l.id === S.lesson)) S.lesson = flat()[0].id;
  const TABS = [["teoria", "Lección teórica"], ["lab", "Terminal y Lab"], ["quiz", "Autoevaluación"], ["anki", "Tarjetas Anki"], ["tutor", "Tutor IA"]];

  // ---------- markdown mínimo ----------
  function md(src) {
    let s = esc(src); const blocks = [];
    s = s.replace(/```(\w*)\n?([\s\S]*?)```/g, (m, l, c) => { blocks.push(c.replace(/\n$/, "")); return "\u0000" + (blocks.length - 1) + "\u0000"; });
    s = s.replace(/`([^`\n]+)`/g, "<code>$1</code>").replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
    let out = "", list = null, tb = null;
    const close = () => { if (list) { out += `</${list}>`; list = null; } };
    const flushT = () => { if (!tb) return; const rows = tb.filter(r => !/^\s*\|?\s*:?-{2,}/.test(r)).map(r => r.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim())); const hd = rows.shift(); out += `<div class="tbl"><table><thead><tr>${hd.map(c => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => i ? `<td>${c}</td>` : `<th scope="row">${c}</th>`).join("")}</tr>`).join("")}</tbody></table></div>`; tb = null; };
    for (const ln of s.split("\n")) {
      let m;
      if (/^\s*\|.*\|\s*$/.test(ln)) { close(); (tb = tb || []).push(ln); continue; } else flushT();
      if ((m = ln.match(/^\s*&gt;\s?(.*)/))) { close(); out += `<aside class="call">${m[1]}</aside>`; continue; }
      if ((m = ln.match(/^\s*#{2,4}\s+(.*)/))) { close(); out += `<h3>${m[1]}</h3>`; continue; }
      if ((m = ln.match(/^\s*[-*]\s+(.*)/))) { if (list !== "ul") { close(); out += "<ul>"; list = "ul"; } out += `<li>${m[1]}</li>`; }
      else if ((m = ln.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== "ol") { close(); out += "<ol>"; list = "ol"; } out += `<li>${m[1]}</li>`; }
      else if (!ln.trim()) { close(); }
      else if (/^\u0000\d+\u0000$/.test(ln.trim())) { close(); out += ln.trim(); }
      else { close(); out += `<p>${ln.replace(/^#+\s*/, "")}</p>`; }
    }
    close(); flushT();
    return out.replace(/\u0000(\d+)\u0000/g, (m, i) => `<pre><code>${blocks[+i]}</code></pre>`);
  }

  // ---------- teoría legible: párrafos densos -> viñetas, conceptos clave, recuerdo activo ----------
  function sentences(p) {
    const codes = []; let t = p.replace(/`[^`]*`/g, m => "\u0001" + (codes.push(m) - 1) + "\u0001");
    t = t.replace(/\b(p\. ?ej|ej|etc|vs|aprox|núm)\./gi, m => m.replace(/\./g, "\u0002"));
    return t.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡*«"(\u0001])/).map(x => x.replace(/\u0002/g, ".").replace(/\u0001(\d+)\u0001/g, (m, i) => codes[+i]));
  }
  function mdStudy(src) {
    const out = String(src || "").split(/\n{2,}/).map((blk, bi) => {
      if (/^\s*([-*|>#]|\d+[.)]\s|```)/.test(blk) || blk.includes("\n")) return blk;
      const dots = blk.split(" · ");
      if (dots.length >= 3) { const f = dots[0].match(/^(\*\*[^*]+:\*\*)\s*(.*)$/); return (f ? f[1] + "\n\n- " + [f[2]].concat(dots.slice(1)).filter(Boolean).join("\n- ") : dots.map(x => "- " + x).join("\n")).replace(/\n\n- /, "\n\n- "); }
      const ss = sentences(blk);
      if (ss.length >= 3 && !(bi === 0 && ss.length <= 3) && blk.length > 170) return ss.map(x => "- " + x).join("\n");
      return blk;
    });
    return md(out.join("\n\n"));
  }
  function keyTerms(src) {
    const seen = new Set(), r = []; String(src || "").replace(/\*\*([^*\n]+)\*\*/g, (m, t) => { t = t.replace(/[:.\s]+$/, ""); const k = t.toLowerCase(); if (t.length >= 4 && t.length <= 30 && !/^(no|sí|si|los|las|el|la|un|una|ejemplo)$/i.test(t) && !/^(los|las) \d/i.test(t) && !seen.has(k)) { seen.add(k); r.push(t); } return m; });
    return r.slice(0, 10);
  }

  // ---------- progreso ----------
  const lbk = l => lkey(l) + (l.isMod ? ":v2" : "");
  const labState = l => { const a = P.lab[lbk(l)] || []; return l.lab.map((t, i) => !!a[i]); };
  const isClf = () => cid === "clf" || cid === "aif";
  const certCode = () => cid === "aif" ? "AIF-C01" : "CLF-C02";
  const qOK = (q, sel) => Array.isArray(q[2]) ? (Array.isArray(sel) && sel.length === q[2].length && q[2].every(x => sel.includes(x))) : sel === q[2];
  const qTxt = q => Array.isArray(q[2]) ? q[2].map(i => "ABCDE"[i] + ") " + q[1][i]).join(" · ") : q[1][q[2]];
  const quizAns = l => ((P.quiz[lkey(l)] && P.quiz[lkey(l)].a) || []).slice(0, (l.quiz || []).length);
  function status(l) {
    const lab = labState(l).filter(Boolean).length, qa = quizAns(l).filter(x => x != null).length;
    if (!l.lab.length && !l.quiz.length) return P.seen[lkey(l)] ? 2 : 0;
    if (lab === l.lab.length && qa === l.quiz.length) return 2;
    return (P.seen[lkey(l)] || lab || qa) ? 1 : 0;
  }


  // ---------- identidad por curso ----------
  const CC = ["#2F5BEA", "#0FA394", "#E0702B", "#8B5CF6", "#D6457B", "#2E9E5B", "#C79A12", "#0E8FC4", "#B4533C"];
  const ccol = c => CC[Math.max(0, COURSES.findIndex(x => x.id === c.id)) % CC.length];
  const CICO = { term: '<path d="M3 5h18v14H3zM7 10l3 2-3 2M12 14h4"/>', globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>', net: '<circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 7v5M12 12l-6 6M12 12l6 6"/>', cloud: '<path d="M7 18a4 4 0 010-8 5.5 5.5 0 0110.6 1.5A3.3 3.3 0 0117 18z"/>', code: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 6l-3 12"/>', shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>', box: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9"/>', book: '<path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3zM5 17a3 3 0 013-3h11"/>' };
  function cico(c) { const n = (c.name || "").toLowerCase(); const k = /docker|contenedor/.test(n) ? "box" : /dns|dominio/.test(n) ? "globe" : /nube|cloud|aws|vpc/.test(n) ? "cloud" : /segur|cripto|ciber/.test(n) ? "shield" : /python|program|script/.test(n) ? "code" : /redes|network/.test(n) ? "net" : /linux|bash|shell|terminal|devops/.test(n) ? "term" : "book"; return `<svg viewBox="0 0 24 24" aria-hidden="true">${CICO[k]}</svg>`; }
  const gname = g => g ? (g.id === "sk" ? "Técnicos" : g.name.charAt(0).toUpperCase() + g.name.slice(1)) : "Curso";

  // ---------- barra lateral ----------
  function renderSide() {
    const c = course(); const all = flat(); const done = all.filter(l => status(l) === 2).length; const pct = Math.round(done / all.length * 100);
    const cur = lesson(S.lesson);
    const seg = c.modules.map(m => { const d = m.lessons.filter(l => status(lesson(l.id)) === 2).length; return `<i title="Módulo ${m.n}: ${d}/${m.lessons.length}"><b style="width:${Math.round(d / m.lessons.length * 100)}%"></b></i>`; }).join("");
    let h = `<div class="brand"><div class="brand-k"><button class="brand-home" data-act="home" title="Ir al inicio"><i>${ic("home")}</i>Aula de estudio</button><button class="theme" data-act="theme" title="Cambiar tema (claro, oscuro o automático)" aria-label="Tema: ${THEMES[P.theme || "auto"][0]}">${ic(THEMES[P.theme || "auto"][1])}<span>${THEMES[P.theme || "auto"][0]}</span></button></div>
      <div class="brand-t"><span class="cbadge">${cico(c)}</span><span>${esc(c.name)}</span></div>
      <div class="course-pick"><select id="csel" aria-label="Curso">${GROUPS.filter(g => COURSES.some(x => x.group === g.id)).map(g => `<optgroup label="${esc(gname(g))}">${COURSES.filter(x => x.group === g.id).map(x => `<option value="${x.id}" ${x.id === cid ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</optgroup>`).join("")}</select><button class="sq" data-act="newc" title="Agregar otro curso" aria-label="Agregar otro curso">${ic("plus")}</button></div>
      ${S.newc ? `<div class="newcourse">Para sumar un curso nuevo (universidad, ciberseguridad, leyes, lo que sea), pásale el material a Claude y pídele: <b>agrega el curso X a mi Aula</b>.</div>` : ""}
      <div class="pbar" role="img" aria-label="Avance ${pct}%"><b style="width:${pct}%"></b></div>
      <div class="prog-t"><span><b>${done}</b>/${all.length} clases</span><span>${pct}% · racha <b>${streak()}</b> d</span></div><div class="side-tools"><button class="srch-btn" data-act="srch" title="Buscar en todos los cursos (Ctrl+K)">Buscar<kbd>Ctrl K</kbd></button></div></div><nav class="mods">`;
    for (const m of c.modules) {
      const open = P.open[cid + ":" + m.n] !== undefined ? P.open[cid + ":" + m.n] : m.lessons.some(l => l.id === cur.id);
      const md_ = m.lessons.filter(l => status(lesson(l.id)) === 2).length;
      h += `<div class="mod ${open ? "open" : ""}"><button class="mod-h" data-act="mod" data-m="${m.n}" aria-expanded="${open}"><span class="mod-n">M${String(m.n).padStart(2, "0")}</span><span>${esc(m.title)}</span><span class="mod-c">${md_}/${m.lessons.length}</span><svg class="i chev" viewBox="0 0 24 24" aria-hidden="true">${ICO.chev}</svg></button><div class="lessons">`;
      for (const l0 of m.lessons) {
        const l = lesson(l0.id); const st = status(l);
        h += `<button class="les ${l.isMod ? "modlesson" : ""} ${l.id === cur.id ? "cur" : ""}" data-act="lesson" data-id="${l.id}"><span class="id">${l.isMod ? "★" : l.id}</span><span class="tt">${esc(l.t)}${l.star ? ' <span class="star" title="Clase esencial">✱</span>' : ""}${l.ai ? ' <span class="aib" title="Sesión completada por Claude: no viene del curso original">✦</span>' : ""}</span><span class="dots"></span><span class="st ${st === 2 ? "done" : ""}">${st === 2 ? "listo" : st === 1 ? "en curso" : ""}</span></button>`;
      }
      h += `</div></div>`;
    }
    $("#side").innerHTML = h + "</nav>";
  }

  // ---------- cabecera y etapas ----------
  function renderTop() {
    const l = lesson(S.lesson), all = flat(), i = all.findIndex(x => x.id === l.id);
    $("#top").innerHTML = `<button class="burger btn-ghost" data-act="burger" aria-label="Abrir módulos">${ic("menu")} Módulos</button>
      <div class="hd-id">${l.isMod ? "M" + l.mod.n : l.id}</div>
      <div class="hd-main"><div class="crumb">Módulo ${l.mod.n} · ${esc(l.mod.title)}</div><h1>${esc(l.t)}${l.star ? '<span class="ess">esencial</span>' : ""}${l.ai ? '<span class="ess ai">✦ completado por Claude</span>' : ""}</h1></div>
      <div class="nav"><button class="btn-ghost" data-act="prev" ${i === 0 ? "disabled" : ""}>${ic("prev")} Anterior</button><button class="btn-ghost" data-act="next" ${i === all.length - 1 ? "disabled" : ""}>Siguiente ${ic("next")}</button></div>`;
    const lab = labState(l), qa = quizAns(l).filter(x => x != null).length;
    const counts = { lab: `${lab.filter(Boolean).length}/${l.lab.length}`, quiz: `${qa}/${l.quiz.length}`, anki: String(queueCount(S.scope).due + queueCount(S.scope).nw) };
    $("#tabs").innerHTML = TABS.map(([k, n], i) => `<button class="tab" role="tab" data-act="tab" data-t="${k}" aria-selected="${S.tab === k}"><span class="tn">${i + 1}</span><span class="tl2">${k === "lab" && l.vlab ? "Laboratorio" : n}</span>${counts[k] ? `<small>${counts[k]}</small>` : ""}</button>`).join("") + (S.tab === "teoria" ? `<button class="splitbtn" data-act="split" aria-pressed="${S.split}" title="Mostrar el laboratorio, la autoevaluación, las tarjetas o el tutor al costado de la lección">${ic("cols")} Panel al costado</button>` : "");
  }

  // ---------- teoría ----------
  function parseCmds(txt) { return txt.split("\n").map(ln => { if (ln.startsWith("## ")) return { g: ln.slice(3) }; const i = ln.indexOf("  ## "); return i < 0 ? { c: ln, m: "" } : { c: ln.slice(0, i), m: ln.slice(i + 5) }; }); }
  const CARET = { l: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>', r: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>' };
  S.sl = S.sl || {};
  const slIdx = l => Math.max(0, Math.min(S.sl[l.id] || 0, l.slides.length - 1));
  function viewSlides(l) {
    const i = slIdx(l), n = l.slides.length;
    return `<div class="wrap dxwrap"><div class="dnsx"><div class="dx-progress" style="width:${(i + 1) / n * 100}%"></div><div class="dx-scroll"><div class="dx-slide active">${l.slides[i]}</div></div>
      <button class="dx-nav l" data-act="dxprev" ${i === 0 ? "disabled" : ""} aria-label="Diapositiva anterior">${CARET.l}</button><button class="dx-nav r" data-act="dxnext" ${i === n - 1 ? "disabled" : ""} aria-label="Diapositiva siguiente">${CARET.r}</button>
      <div class="dx-foot"><div class="dx-dots">${l.slides.map((_, k) => `<button data-act="dxgo" data-i="${k}" class="${k === i ? "on" : ""}" aria-label="Diapositiva ${k + 1}"></button>`).join("")}</div><span class="dx-counter">${i + 1} / ${n}</span></div></div>
      <div class="cta"><button class="btn" data-act="tab" data-t="lab">${ic("term")} Ir al laboratorio</button><button class="btn btn-2" data-act="tab" data-t="quiz">Autoevaluarme</button></div></div>`;
  }
  const msHead = x => `<div class="ms-h"><span class="ms-id">${esc(x.id)}</span><h2>${esc(x.t)}</h2>${x.ai ? '<span class="ess ai" title="Esta sesión la completó Claude: no viene del curso original">✦ completado por Claude</span>' : ""}</div>`;
  const modLessons = l => flat().filter(x => !x.isMod && x.mod.n === l.mod.n);
  // ---------- videos de YouTube incrustados (solo en la versión web propia: window.VIDEO_EMBED) ----------
  const ytId = u => { u = String(u || "").trim(); let m = u.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/); if (m) return m[1]; m = u.match(/^([\w-]{11})(?:[?&]|$)/); return m ? m[1] : ""; };
  const ytStart = u => { const m = String(u || "").match(/[?&](?:t|start)=(\d+)/); return m ? m[1] : ""; };
  const ytEnd = u => { const m = String(u || "").match(/[?&]end=(\d+)/); return m ? m[1] : ""; };
  const mmss = s => { s = +s; const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0"); };
  // key = "curso:id" (sesion) o "curso:m<n>" (modulo). Un valor guardado por el alumno manda sobre el de VIDEOS; "" = sin video.
  function vidBoxK(key, label) {
    if (!window.VIDEO_EMBED) return "";
    const sv = (P.vids || {})[key], u = sv !== undefined ? sv : (window.VIDEOS || {})[key], id = ytId(u);
    // Video propio (prototipo): ruta local a un .mp4/.webm, p. ej. "assets/videos/vpc-1-1.mp4"
    if (/^(?!https?:)[\w./-]+\.(mp4|webm)$/i.test(String(u || "").trim())) {
      const src = esc(String(u).trim());
      return `<div class="vidbox"><div class="vid-fr"><video controls preload="metadata" playsinline src="${src}" title="${esc(label)}" style="position:absolute;inset:0;width:100%;height:100%;background:#000"></video></div><div class="vid-row"><span class="vid-l">${esc(label)} · <b>Clase grabada (prototipo)</b></span><button class="vl-link" data-act="vidrm" data-key="${esc(key)}">Cambiar o quitar video</button></div></div>`;
    }
    if (id) { const st = ytStart(u), en = ytEnd(u); const q = [st ? "start=" + st : "", en ? "end=" + en : ""].filter(Boolean).join("&"); const seg = st || en ? "Minuto " + mmss(st || 0) + (en ? " a " + mmss(en) : " hasta el final") : ""; return `<div class="vidbox"><div class="vid-fr"><iframe src="https://www.youtube-nocookie.com/embed/${id}${q ? "?" + q : ""}" title="${esc(label)}" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"></iframe></div><div class="vid-row"><span class="vid-l">${esc(label)}${seg ? " · <b>" + seg + "</b>" : ""}</span><a class="vl-link" href="https://www.youtube.com/watch?v=${id}${st ? "&t=" + st + "s" : ""}" target="_blank" rel="noopener">Abrir en YouTube</a><button class="vl-link" data-act="vidrm" data-key="${esc(key)}">Cambiar o quitar video</button></div></div>`; }
    return `<div class="vidbox add"><input class="vid-in" data-vid="${esc(key)}" placeholder="Pega aquí el link de YouTube (${esc(label)})" aria-label="Link de YouTube"><button class="btn btn-2" data-act="vidadd" data-key="${esc(key)}">Agregar video</button></div>`;
  }
  const vidBox = l => vidBoxK(cid + ":" + l.id, "Video de la sesión " + l.id);
  const vidMod = l => l.mod ? vidBoxK(cid + ":m" + l.mod.n, "Video del módulo " + l.mod.n) : "";
  function viewModScroll(l) {
    const cta = x => { const lc = labState(x).filter(Boolean).length; const b = []; if (x.lab.length) b.push(`<button class="btn" data-act="lt" data-id="${x.id}" data-t="lab">${ic("term")} ${x.vlab ? "Laboratorio" : "Terminal"} de ${esc(x.id)} <small>${lc}/${x.lab.length}</small></button>`); if (x.quiz.length) b.push(`<button class="btn btn-2" data-act="lt" data-id="${x.id}" data-t="quiz">Autoevaluación de ${esc(x.id)}</button>`); return b.length ? `<div class="cta">${b.join("")}</div>` : ""; };
    return `<div class="wrap dxwrap">${vidMod(l)}<p class="ms-top">Módulo ${l.mod.n} · ${esc(l.mod.title)}. Todo el módulo está en esta página: desliza hacia abajo, o toca una sesión del panel izquierdo para ir directo a ella.</p>${modLessons(l).map(x => `<section class="ms" id="ms-${x.id}" data-ms="${x.id}">${msHead(x)}${x.slides ? x.slides.map(sl => `<div class="dnsx stk"><div class="dx-scroll"><div class="dx-slide active">${sl}</div></div></div>`).join("") : `${vidBox(x)}<article class="sum">${mdStudy(x.sum)}</article>`}${cta(x)}</section>`).join("")}</div>`;
  }
  function viewTeoria(l) {
    if (course().scroll && !l.isMod) return viewModScroll(l);
    if (l.slides) return viewSlides(l);
    const rows = parseCmds(l.cmds).filter(r => r.g !== undefined || (r.c && r.c.trim()));
    if (l.isMod) return `<div class="wrap"><article class="sum">${md(l.sum)}</article>
      <div class="sec-h">Clases del módulo</div><div class="modlinks">${flat().filter(x => !x.isMod && x.mod.n === l.mod.n).map(x => `<button class="btn-ghost" data-act="lesson" data-id="${x.id}"><b>${x.id}</b> ${esc(x.t)}</button>`).join("")}</div>
      <div class="sec-h">Todos los comandos del módulo</div>
      <div class="cmdbox" id="cmdbox"><div class="cmdhd"><span>comando</span></div>${rows.map(r => r.g !== undefined ? `<div class="cmdgrp">${esc(r.g)}</div>` : `<div class="cmd"><code>${hl(r.c)}</code><span class="cm">${esc(r.m)}</span><button class="try" data-act="try" data-c="${esc(r.c)}" title="Llevar al terminal">${ic("play")} Probar</button></div>`).join("")}</div>
      <div class="cta"><button class="btn" data-act="tab" data-t="lab">${ic("term")} Ir al laboratorio integrado</button><button class="btn btn-2" data-act="tab" data-t="quiz">Autoevaluación del módulo</button></div></div>`;
    const kt = keyTerms(l.sum), rc = (l.quiz || []).slice(0, 3);
    return `<div class="wrap study" style="--fs:${P.fs || 17}px">
      ${l.id === flat()[0].id ? `<div class="howto"><div><b>Cómo estudiar este curso.</b> ${esc(course().howto)}</div></div>` : ""}
      <section class="lh ${S.lh ? "open" : "closed"}">
        <div class="lh-top">${l.main ? `<span class="lh-k">Tema ${esc(l.id)} del PDF</span>` : `<span class="lh-k">${l.mod ? "Módulo " + l.mod.n : "Clase"}</span>`}<span class="lh-m">≈ ${Math.max(1, Math.round(String(l.sum).split(/\s+/).length / 170))} min de lectura</span><span class="rb-s"><button data-act="fs" data-d="-1" aria-label="Letra más chica">A−</button><button data-act="fs" data-d="1" aria-label="Letra más grande">A+</button></span><button class="lh-t" data-act="lhtog" aria-expanded="${!!S.lh}">${S.lh ? "Ocultar detalles" : "Mostrar detalles"}</button></div>
        <div class="lh-body" ${S.lh ? "" : "hidden"}>${l.main ? `<p class="lh-main">${esc(l.main)}</p>` : ""}
        ${routeHTML(l)}
        ${tocHTML(l)}
        </div>
      </section>
      ${kt.length && !tocHTML(l) ? `<div class="kterms"><span class="kt-l">Conceptos clave</span>${kt.map(t => `<button class="kt" data-act="kt" data-t="${esc(t)}">${esc(t)}</button>`).join("")}</div>` : ""}
      ${vidBox(l)}<article class="sum">${mdStudy(l.sum)}</article>
      ${l.fig ? `<div class="figbox">${FIG[l.fig] || ""}</div>` : ""}
      ${rows.length ? `<div class="sec-h">Comandos de la clase <label class="toggle"><input type="checkbox" id="hidecm" ${S.hidecm ? "checked" : ""}> Tapar los comentarios (pasa el cursor para verlos)</label></div>
      <div class="cmdbox ${S.hidecm ? "hide-cm" : ""}" id="cmdbox"><div class="cmdhd"><span>comando</span></div>${rows.map(r => r.g !== undefined ? `<div class="cmdgrp">${esc(r.g)}</div>` : `<div class="cmd"><code>${hl(r.c)}</code><span class="cm">${esc(r.m)}</span><button class="try" data-act="try" data-c="${esc(r.c)}" title="Llevar al terminal">${ic("play")} Probar</button></div>`).join("")}</div>` : ""}
      ${rc.length ? `<div class="sec-h">Pon a prueba tu memoria</div><p class="rag-note" style="margin:0 0 10px">Primero intenta responder en tu cabeza; luego abre la respuesta. Recordar sin mirar es lo que más fija lo aprendido.</p><div class="recall">${rc.map((q, i) => `<details class="rc"><summary><span class="q-n">${i + 1}</span>${esc(q[0])}</summary><div class="rc-a"><b>${esc(qTxt(q))}</b>${q[3] ? `<span>${esc(q[3])}</span>` : ""}</div></details>`).join("")}</div>` : ""}
      <div class="sec-h">Mis notas</div><textarea id="note" class="note" rows="4" placeholder="Escribe aquí con tus palabras lo que entendiste, dudas o trucos para recordar. Se guarda solo en este navegador.">${esc((P.notes || {})[lkey(l)] || "")}</textarea>
      ${ctaHTML(l)}</div>`;
  }

  // ---------- ruta de estudio, notas, búsqueda ----------
  function stepsOf(l) {
    const lab = labState(l).filter(Boolean).length, qa = quizAns(l).filter(x => x != null).length, cd = (l.cards || []).filter((c, i) => P.cards[ckey(l, i)]).length;
    return [["teoria", "Teoría", P.read[lkey(l)] ? 1 : 0, 1, "read"], ["lab", l.vlab ? "Laboratorio" : "Terminal", lab, l.lab.length, "tab"], ["quiz", "Autoevaluación", qa, l.quiz.length, "tab"], ["anki", "Tarjetas", cd, (l.cards || []).length, "tab"]].filter(x => x[3] > 0);
  }
  function tocHTML(l) {
    const hs = [...String(l.sum || "").matchAll(/^###\s+(.*)$/gm)].map(m => m[1].replace(/[*`]/g, ""));
    if (hs.length < 3) return "";
    return `<nav class="toc" aria-label="En esta lección"><span class="kt-l">En esta lección</span>${hs.map((h, i) => `<button class="toc-i" data-act="toc" data-i="${i}">${esc(h)}</button>`).join("")}</nav>`;
  }
  function routeHTML(l) {
    if (l.isMod) return "";
    const st = stepsOf(l);
    return `<div class="route" role="list" aria-label="Tu ruta en esta clase">${st.map((x, i) => `<button class="rt ${x[2] >= x[3] ? "ok" : x[2] ? "mid" : ""}" role="listitem" data-act="${x[4]}" data-t="${x[0]}" title="${x[0] === "teoria" ? "Marcar como leída / no leída" : "Ir a " + x[1]}"><span class="rt-n">${x[2] >= x[3] ? "✓" : i + 1}</span><span class="rt-t">${x[1]}</span><span class="rt-c">${x[0] === "teoria" ? (x[2] ? "leída" : "pendiente") : x[2] + "/" + x[3]}</span></button>`).join("")}</div>`;
  }
  function ctaHTML(l) {
    const st = stepsOf(l), nx = st.find(x => x[2] < x[3] && x[0] !== "teoria"), all = flat(), i = all.findIndex(x => x.id === l.id), nl = all[i + 1];
    let h = `<div class="cta">`;
    if (!P.read[lkey(l)]) h += `<button class="btn btn-2" data-act="read">Marcar teoría como leída</button>`;
    if (nx) h += `<button class="btn" data-act="tab" data-t="${nx[0]}">${ic("term")} Siguiente paso: ${nx[1]} (${nx[2]}/${nx[3]})</button>`;
    else if (nl) h += `<button class="btn" data-act="lesson" data-id="${nl.id}">Clase completada · Ir a ${esc(nl.id)} ${esc(nl.t)} →</button>`;
    return h + `</div>`;
  }
  let SIDX = null;
  const nrm = t => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  function buildSIdx() {
    SIDX = []; COURSES.forEach(c => c.modules.forEach(m => m.lessons.forEach(l => { if (l.isMod) return; const raw = String(l.sum || "").replace(/[*`#|>-]+/g, " ").replace(/\s+/g, " "), cards = (l.cards || []).map(x => x.join(" ")).join(" "); SIDX.push({ c: c.id, cn: c.name, id: l.id, t: l.t, raw, nt: nrm(l.t), nx: nrm(raw + " " + cards) }); })));
  }
  function searchQ(q) {
    if (!SIDX) buildSIdx(); const ws = nrm(q).split(/\s+/).filter(x => x.length > 1); if (!ws.length) return [];
    return SIDX.map(e => { let sc = 0; for (const w of ws) { if (e.nt.includes(w)) sc += 10; const n = e.nx.split(w).length - 1; if (n) sc += Math.min(n, 5); else if (!e.nt.includes(w)) return null; } return sc ? Object.assign({ sc }, e) : null; }).filter(Boolean).sort((a, b) => b.sc - a.sc).slice(0, 12).map(e => { const ws0 = ws[0], i = nrm(e.raw).indexOf(ws0), sn = i >= 0 ? e.raw.slice(Math.max(0, i - 40), i + 90) : e.raw.slice(0, 110); return Object.assign(e, { sn }); });
  }
  let SS = { open: false, q: "", r: [], i: 0 };
  function srchPaint() {
    let el = document.getElementById("srch");
    if (!SS.open) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement("div"); el.id = "srch"; document.body.appendChild(el); }
    const keep = el.querySelector("input"); const had = keep && document.activeElement === keep;
    el.innerHTML = `<div class="srch-bg" data-act="srchx"></div><div class="srch-box" role="dialog" aria-label="Buscar"><input id="sq" type="search" placeholder="Busca un tema, concepto o servicio en todos tus cursos…" value="${esc(SS.q)}" autocomplete="off"><div class="srch-res">${SS.q.trim().length < 2 ? `<p class="srch-h">Escribe al menos 2 letras. Busca en títulos, teoría y tarjetas de todos los cursos. Usa ↑ ↓ y Enter.</p>` : SS.r.length ? SS.r.map((e, i) => `<button class="sr ${i === SS.i ? "on" : ""}" data-act="srgo" data-i="${i}"><b>${esc(e.t)}</b><span class="sr-c">${esc(e.cn)} · ${esc(e.id)}</span><span class="sr-s">…${esc(e.sn)}…</span></button>`).join("") : `<p class="srch-h">Sin resultados para «${esc(SS.q)}».</p>`}</div></div>`;
    const inp = el.querySelector("#sq"); if (inp) { inp.focus(); const n = inp.value.length; try { inp.setSelectionRange(n, n); } catch (e) {} }
  }
  const srchOpen = () => { SS = { open: true, q: "", r: [], i: 0 }; srchPaint(); };
  const srchClose = () => { SS.open = false; srchPaint(); };
  function srchGo(i) { const e = SS.r[i]; if (!e) return; srchClose(); if (cid !== e.c) { cid = e.c; S.chat = []; INDEX = null; } go(e.id, "teoria"); }

  // ---------- terminal y lab ----------
  const T = { lines: [{ k: "dim", t: "Terminal de práctica con archivos de ejemplo: notas.txt, servidor.log, datos.csv, usuarios.txt, config.json. Los comandos que escribas se comprueban contra los objetivos." }], hist: [], hi: -1, here: null, prefill: "" };
  function tasksHTML(l) {
    const st = labState(l);
    let lv = ""; return l.lab.map((t, i) => { const k = l.id + ":" + i; const hd = t[3] && t[3] !== lv ? (lv = t[3], `<div class="lvl">${t[3]}</div>`) : ""; return hd + `<div class="task ${st[i] ? "done" : ""}"><div class="task-t"><span class="chk">${st[i] ? "✓" : ""}</span><span>${esc(t[0])}</span></div>${st[i] ? "" : `<div class="hint">${S.hints[k] ? `<code>${esc(t[2])}</code>` : `<button data-act="hint" data-k="${k}">Ver pista</button>`}</div>`}</div>`; }).join("");
  }
  function termHTML() {
    return T.lines.map(l => l.k === "cmd" ? `<div class="tl"><span class="tu">${esc(l.u)}</span>:<span class="tp">${esc(l.p)}</span>$ ${hl(l.t)}</div>` : `<div class="tl ${l.k}">${esc(l.t)}</div>`).join("");
  }
  function psHTML() { if (T.here) return `<span class="tp">&gt;</span>`; const p = Shell.prompt(); return `<span class="tu">${esc(p.u)}</span>:<span class="tp">${esc(p.p)}</span>$`; }
  function viewLab(l, cls) { return viewLab0(l, cls) + `<div id="upbox">${upHTML(l)}</div>`; }
  function viewLab0(l, cls) {
    if (l.vlab) return viewVLab(l, cls);
    return `<div class="lab ${cls || ""}"><div><div class="sec-h" style="margin-top:0">Objetivos <span class="score" id="labscore"></span></div>${l.intro ? `<p class="labintro">${esc(l.intro)}</p>` : ""}<div class="tasks" id="tasks">${tasksHTML(l)}</div>
      <p class="rag-note" style="margin-top:12px">Los objetivos se marcan solos cuando escribes el comando. Usa ↑ para repetir comandos y <code>clear</code> para limpiar.</p></div>
      <div class="term" id="term"><div class="term-bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span style="margin-left:6px">alumno@ubuntu — bash</span><span class="sp"></span><button data-act="tclear">Limpiar</button><button data-act="treset" title="Restaura los archivos de ejemplo">Reiniciar entorno</button></div>
      <div class="tout" id="tout">${termHTML()}</div><div class="tin"><span class="ps" id="ps">${psHTML()}</span><input id="tinp" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Línea de comandos"></div></div></div>`;
  }

  // ---------- subir de nivel (opcional, solo si el alumno lo pide) ----------
  const UPB = { busy: false, err: "" };
  const labDone = l => { const s = labState(l); return s.length > 0 && s.every(Boolean); };
  function paintUp() { const b = $("#upbox"); if (b) b.innerHTML = upHTML(lesson(S.lesson)); }
  function upHTML(l) {
    if (!labDone(l)) return "";
    const U = (P.up || {})[lkey(l)];
    const err = UPB.err ? `<p class="up-err">${esc(UPB.err)}</p>` : "";
    if (UPB.busy) return `<div class="upbox"><b>Preparando tu reto…</b><span class="typing"><i></i><i></i><i></i></span></div>`;
    if (!U || !U.items) return `<div class="upbox"><div><b>Laboratorio completado.</b><p>Si quieres, puedes pedir un reto un paso más difícil. Solo se crea cuando tú lo pides.</p></div><button class="btn" data-act="uplvl">Subir un nivel</button>${err}</div>`;
    const ans = U.ans || [], n = U.items.length, got = ans.filter(x => x != null).length, ok = U.items.filter((it, i) => ans[i] === it.a).length;
    return `<div class="upbox col"><div class="sec-h" style="margin-top:0">Reto · Nivel +${U.lvl} <span class="score">${got}/${n}</span></div>${U.items.map((it, i) => `<div class="qcard"><p class="q-h"><span class="q-n">${i + 1}</span>${esc(it.q)}</p>${it.o.map((o, j) => { const a = ans[i]; const c = a == null ? "" : (j === it.a ? "right" : (j === a ? "wrong" : "")); return `<button class="opt ${c}" data-act="upans" data-i="${i}" data-j="${j}" ${a != null ? "disabled" : ""}><span class="l">${"ABCD"[j]}</span><span>${esc(o)}</span></button>`; }).join("")}${ans[i] != null ? `<div class="expl">${esc(it.e || "")}</div>` : ""}</div>`).join("")}${got === n ? `<div class="upnext"><span>Acertaste ${ok} de ${n}.</span><button class="btn" data-act="uplvl">Subir otro nivel (opcional)</button></div>` : ""}${err}</div>`;
  }
  async function upGen() {
    if (UPB.busy) return; const l = lesson(S.lesson), k = lkey(l); P.up = P.up || {}; const prev = P.up[k] || { lvl: 0, hist: [] };
    UPB.err = ""; const sm = await getSample();
    if (!sm) { UPB.err = "Para crear retos nuevos esta página necesita el permiso de Claude, y aquí no está disponible."; paintUp(); return; }
    UPB.busy = true; paintUp();
    const lvl = (prev.lvl || 0) + 1;
    const tasks = l.lab.map(t => Array.isArray(t) ? t[0] : (t.t || t.q || t.title || "")).filter(x => typeof x === "string" && x).slice(0, 12).join("\n- ") || l.t;
    const content = `Eres el creador de retos de un alumno que estudia «${course().name}». Acaba de terminar el laboratorio de la clase ${l.id} — ${l.t}. Crea el RETO DE NIVEL +${lvl}: exactamente 3 preguntas de opción múltiple (4 opciones, una sola correcta) que sean UN PASO más difíciles que el laboratorio, no un salto. Deben ser situaciones prácticas de la vida real (qué comando usar, qué pasaría, cómo arreglar un error), no memorización. Español claro. Cada explicación, de 1 o 2 frases.\n\nLo que hizo en el laboratorio:\n- ${tasks}\n\nResumen de la clase:\n${String(l.sum || "").slice(0, 1800)}\n\nNo repitas estas preguntas ya hechas:\n${(prev.hist || []).join("\n") || "(ninguna)"}\n\nResponde SOLO con JSON válido, sin texto extra ni bloques de código, con esta forma: {"items":[{"q":"...","o":["...","...","...","..."],"a":0,"e":"..."}]} donde "a" es el índice (0 a 3) de la opción correcta.`;
    try {
      const res = await sm([{ role: "user", content }], { cache: false });
      const m = ((res && res.text) || "").match(/\{[\s\S]*\}/); const j = JSON.parse(m[0]);
      const items = (j.items || []).filter(x => x && x.q && Array.isArray(x.o) && x.o.length === 4 && x.a >= 0 && x.a <= 3).slice(0, 3).map(x => { const idx = [0, 1, 2, 3].sort(() => Math.random() - .5); return { q: String(x.q), o: idx.map(i => String(x.o[i])), a: idx.indexOf(x.a), e: String(x.e || "") }; });
      if (!items.length) throw new Error("vacío");
      P.up[k] = { lvl, items, ans: [], hist: (prev.hist || []).concat(items.map(x => x.q)).slice(-12) }; save();
    } catch (e) { UPB.err = e && e.code === "not_granted" ? "No diste permiso para usar Claude. Puedes cambiarlo desde el menú de permisos de esta página." : "No pude crear el reto ahora. Inténtalo de nuevo en unos segundos."; }
    UPB.busy = false; paintUp();
  }

  // ---------- práctica estilo AWS re/Start (solo cursos Manantial; se genera a pedido, con base en el texto de la clase) ----------
  const RSB = { busy: false, err: "", sel: {} };
  function paintRs() { const b = $("#rsbox"); if (b) b.innerHTML = rsHTML(lesson(S.lesson)); }
  function rsHTML(l) {
    if (course().group !== "manantial" && !isClf()) return "";
    const k = lkey(l), R = (P.rs || {})[k];
    const err = RSB.err ? `<p class="up-err">${esc(RSB.err)}</p>` : "";
    const head = `<div class="sec-h">${isClf() ? "Más preguntas estilo " + certCode() : "Práctica estilo AWS re/Start"}</div>`;
    if (RSB.busy) return `<div class="rsbox">${head}<div class="upbox"><b>Preparando preguntas con base en esta clase…</b><span class="typing"><i></i><i></i><i></i></span></div></div>`;
    if (!R || !R.items || !R.items.length) return `<div class="rsbox">${head}<div class="upbox"><div><b>Preguntas de escenario como las del examen.</b><p>Cuatro opciones, algunas con «elige dos», y siempre basadas en lo que dice esta clase. Se crean cuando tú lo pides.</p></div><button class="btn" data-act="rsgen">Generar 5 preguntas</button>${err}</div></div>`;
    const ans = R.ans || {}; const n = R.items.length; const got = R.items.filter((_, i) => ans[i]).length;
    const okc = R.items.filter((it, i) => ans[i] && ans[i].length === it.a.length && it.a.every(x => ans[i].includes(x))).length;
    const body = R.items.map((it, i) => { const done = !!ans[i]; const multi = it.a.length > 1; const sel = RSB.sel[k + ":" + i] || [];
      return `<div class="qcard"><p class="q-h"><span class="q-n">R${i + 1}</span>${esc(it.q)}</p>${multi ? `<p class="rs-m">Elige ${it.a.length === 2 ? "DOS" : "TRES"}.</p>` : ""}${it.o.map((o, j) => { let c = ""; if (done) c = it.a.includes(j) ? "right" : ans[i].includes(j) ? "wrong" : ""; else if (sel.includes(j)) c = "pick"; return `<button class="opt ${c}" data-act="${multi ? "rssel" : "rsans"}" data-i="${i}" data-j="${j}" ${done ? "disabled" : ""}><span class="l">${"ABCDE"[j]}</span><span>${esc(o)}</span></button>`; }).join("")}${multi && !done ? `<button class="btn btn-2" data-act="rscheck" data-i="${i}" ${sel.length === it.a.length ? "" : "disabled"}>Comprobar</button>` : ""}${done ? `<div class="expl">${esc(it.e || "")}</div>` : ""}</div>`; }).join("");
    return `<div class="rsbox">${head}<div class="upbox col"><div class="sec-h" style="margin-top:0">${n} preguntas <span class="score">${got}/${n}</span></div>${body}${got === n ? `<div class="upnext"><span>Acertaste ${okc} de ${n}.</span><button class="btn" data-act="rsgen">Generar otras 5</button></div>` : ""}${err}</div></div>`;
  }
  async function rsGen() {
    if (RSB.busy) return; const l = lesson(S.lesson), k = lkey(l); P.rs = P.rs || {}; const prev = P.rs[k] || { hist: [] };
    RSB.err = ""; const sm = await getSample();
    if (!sm) { RSB.err = "Para crear estas preguntas esta página necesita el permiso de Claude, y aquí no está disponible."; paintRs(); return; }
    RSB.busy = true; paintRs();
    let content = `Eres un redactor de exámenes del programa AWS re/Start (estilo del examen AWS Certified Cloud Practitioner). Crea 5 preguntas sobre la clase «${l.t}» del curso «${course().name}».\n\nREGLAS:\n- Usa SOLO hechos que aparecen en el TEXTO DE LA CLASE de abajo. No inventes datos ni uses temas que la clase no menciona.\n- Estilo AWS: un escenario corto de 1 a 2 frases (una empresa, un equipo o un caso real) y luego la pregunta. Incluye palabras clave que guíen, como «menor costo», «sin administrar servidores», «responsabilidad del cliente», «más seguro», cuando el texto lo permita.\n- 4 preguntas de UNA respuesta con 4 opciones, y 1 pregunta de «elige dos» con 5 opciones y 2 correctas.\n- Los distractores deben ser plausibles: conceptos, comandos o servicios parecidos que sí aparecen en el texto y se confunden fácil.\n- La explicación (1 a 3 frases) dice por qué la correcta es correcta y por qué falla la confusión más probable.\n- Español claro.\n\nNo repitas estas preguntas ya hechas:\n${(prev.hist || []).join("\n") || "(ninguna)"}\n\nTEXTO DE LA CLASE:\n${String(l.sum || "").slice(0, 7000)}\n\nResponde SOLO con JSON válido, sin texto extra ni bloques de código: {"items":[{"q":"escenario y pregunta","o":["...","...","...","..."],"a":[0],"e":"..."}]} donde "a" es la lista de índices correctos (empezando en 0).`;
    if (isClf()) {
      const mods = course().modules.find(m => m.n === l.mod.n); const mine = mods ? mods.lessons.filter(x => !x.isMod) : [l];
      const own = !l.isMod && String(l.sum || "").length > 700 ? String(l.sum) : mine.map(x => "### " + x.id + " " + x.t + "\n" + x.sum).join("\n\n");
      const exs = mine.flatMap(x => x.quiz || []).filter((q, i) => i < 40).sort(() => Math.random() - .5).slice(0, 3).map((q, i) => { const ans = Array.isArray(q[2]) ? q[2] : [q[2]]; return "PREGUNTA " + (i + 1) + "\n" + q[0] + "\n" + q[1].map((o, j) => "ABCDE"[j] + ") " + o).join("\n") + "\n✅ Respuesta correcta: " + ans.map(j => "ABCDE"[j]).join(" y ") + " 💡 " + (q[3] || ""); }).join("\n\n");
      content = `Eres el redactor del banco de preguntas del curso «${course().name}». Crea 5 preguntas nuevas con EXACTAMENTE el mismo criterio y estructura que las preguntas de ejemplo del banco de práctica del PDF, sobre «${l.t}» (módulo «${l.mod.title}»).\n\nREGLAS:\n- Mismo estilo que los ejemplos: un escenario corto (empresa, equipo o caso real) y luego la pregunta; en español; opciones plausibles que se confunden fácil (servicios o conceptos parecidos).\n- Usa SOLO hechos que aparecen en el MATERIAL de abajo. No inventes datos, precios ni servicios que el material no menciona.\n- 4 preguntas de UNA respuesta con 4 opciones y 1 pregunta de «elige dos» con 5 opciones y 2 correctas (escribe «(Seleccione DOS.)» al final del enunciado).\n- La explicación (1 a 3 frases) dice por qué la correcta es correcta y por qué falla el distractor más tentador, como en los ejemplos.\n- Dominios del examen: ${cid === "aif" ? "Fundamentos de IA y ML, Fundamentos de IA generativa, Aplicaciones de modelos fundacionales, IA responsable, Seguridad y gobernanza" : "Conceptos de la nube, Seguridad y cumplimiento, Tecnología y servicios, Facturación y soporte"}.\n\nEJEMPLOS DEL BANCO DEL PDF (imita su estilo):\n${exs || "(ninguno en este módulo)"}\n\nNo repitas estas preguntas ya hechas:\n${(prev.hist || []).join("\n") || "(ninguna)"}\n\nMATERIAL:\n${own.slice(0, 7000)}\n\nResponde SOLO con JSON válido, sin texto extra ni bloques de código: {"items":[{"q":"escenario y pregunta","o":["...","...","...","..."],"a":[0],"e":"..."}]} donde "a" es la lista de índices correctos (empezando en 0).`;
    }
    try {
      const res = await sm([{ role: "user", content }], { cache: false });
      const m = ((res && res.text) || "").match(/\{[\s\S]*\}/); const j = JSON.parse(m[0]);
      const items = (j.items || []).filter(x => x && x.q && Array.isArray(x.o) && (x.o.length === 4 || x.o.length === 5) && Array.isArray(x.a) && x.a.length >= 1 && x.a.length <= 3 && x.a.every(i => Number.isInteger(i) && i >= 0 && i < x.o.length)).slice(0, 5).map(x => { const idx = x.o.map((_, i) => i).sort(() => Math.random() - .5); return { q: String(x.q), o: idx.map(i => String(x.o[i])), a: x.a.map(i => idx.indexOf(i)).sort(), e: String(x.e || "") }; });
      if (!items.length) throw new Error("vacío");
      P.rs[k] = { items, ans: {}, hist: (prev.hist || []).concat(items.map(x => x.q)).slice(-15) }; RSB.sel = {}; save();
    } catch (e) { RSB.err = e && e.code === "not_granted" ? "No diste permiso para usar Claude. Puedes cambiarlo desde el menú de permisos de esta página." : "No pude crear las preguntas ahora. Inténtalo de nuevo en unos segundos."; }
    RSB.busy = false; paintRs();
  }
  function paintTerm() {
    const o = $("#tout"); if (!o) return; o.innerHTML = termHTML(); o.scrollTop = o.scrollHeight; $("#ps").innerHTML = psHTML();
    const l = lesson(S.lesson); const t = $("#tasks"); if (t) t.innerHTML = tasksHTML(l);
    const sc = $("#labscore"); if (sc) sc.textContent = labState(l).filter(Boolean).length + "/" + l.lab.length; paintUp();
  }
  function checkTasks(line) {
    const l = lesson(S.lesson); const k = lbk(l); const arr = (P.lab[k] || (P.lab[k] = [])); const used = new Set(); let changed = false;
    l.lab.forEach((t, i) => { if (arr[i] || used.has(t[1].source)) return; if (t[1].test(line)) { arr[i] = true; used.add(t[1].source); changed = true; } });
    if (changed) { save(); renderSide(); renderTop(); }
  }
  function runCmd(line, hd) {
    const r = Shell.exec(line, hd);
    if (r.clear) T.lines = [];
    if (r.exp) T.lines.push({ k: "dim", t: "↳ " + r.exp });
    if (r.o) T.lines.push({ k: "out", t: r.o.replace(/\n$/, "") });
    if (r.e) T.lines.push({ k: "err", t: r.e.replace(/\n$/, "") });
    if (r.note) T.lines.push({ k: "dim", t: "ⓘ " + r.note });
    checkTasks(line);
  }
  function submitLine(raw) {
    if (T.here) {
      T.lines.push({ k: "out", t: "> " + raw });
      if (raw.trim() === T.here.delim) { const h = T.here; T.here = null; runCmd(h.line, { text: h.buf.length ? h.buf.join("\n") + "\n" : "", literal: h.literal }); }
      else T.here.buf.push(raw);
      return;
    }
    const p = Shell.prompt(); T.lines.push({ k: "cmd", u: p.u, p: p.p, t: raw });
    if (!raw.trim()) return;
    T.hist.push(raw); T.hi = T.hist.length;
    const hd = Shell.heredocStart(raw);
    if (hd) { T.here = { line: raw, delim: hd.delim, literal: hd.literal, buf: [] }; return; }
    runCmd(raw, null);
  }

  // ---------- autoevaluación ----------
  // ----- tipos de pregunta generados desde el material (cambian al instante, no afectan el progreso de la clase) -----
  const QMODES = [["clasica", "Clásicas"], ["hace", "¿Qué hace?"], ["comando", "¿Qué comando?"], ["tarjetas", "De tarjetas"], ["falladas", "Mis errores"]];
  function mkRand(s) { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; }
  function genQuiz(l, mode, round) {
    const r = mkRand(l.id + mode + round), sh = arr => { const x = arr.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
    const mine = l.isMod ? flat().filter(x => !x.isMod && x.mod.n === l.mod.n) : [l];
    const rows = ls => ls.flatMap(x => parseCmds(x.cmds).filter(q => q.c && q.m));
    const own = rows(mine), all = rows(flat().filter(x => !x.isMod));
    const n = l.isMod ? 8 : 7; const out = [];
    const build = (pool, qf, correct, wrongPool, expl) => {
      sh(pool).slice(0, n).forEach(it => {
        const ok = correct(it); const ws = sh(wrongPool).map(correct).filter((v, i, ar) => v !== ok && ar.indexOf(v) === i).slice(0, 3);
        if (ws.length < 2) return; const opts = sh([ok].concat(ws)); out.push([qf(it), opts, opts.indexOf(ok), expl(it)]);
      });
    };
    if (mode === "hace") build(own, q => "¿Qué hace este comando?  " + q.c, q => q.m, all, q => q.c + " → " + q.m);
    else if (mode === "comando") build(own, q => "¿Qué comando sirve para: «" + q.m + "»?", q => q.c, all, q => q.c + " → " + q.m);
    else if (mode === "falladas") {
      const bad = []; flat().filter(x => !x.isMod).forEach(x => { const a = (P.quiz[lkey(x)] && P.quiz[lkey(x)].a) || []; (x.quiz || []).forEach((q, i) => { if (a[i] != null && !Array.isArray(q[2]) && a[i] !== q[2]) { const ok = q[1][q[2]], o = sh(q[1]); bad.push([q[0], o, o.indexOf(ok), q[3]]); } }); });
      sh(bad).slice(0, 10).forEach(q => out.push(q));
    }
    else if (mode === "mezcla") {
      const seen = new Set(), q0 = (l.isMod ? mine : [l]).flatMap(x => x.quiz || []).filter(q => !Array.isArray(q[2]));
      const re = sh(q0).map(q => { const ok = q[1][q[2]], o = sh(q[1]); return [q[0], o, o.indexOf(ok), q[3]]; });
      const gen = sh(["tarjetas", "hace", "comando"].flatMap(m => genQuiz(l, m, round + 7)));
      const pick = re.slice(0, Math.ceil(n / 2)).concat(gen);
      sh(pick).forEach(q => { if (out.length < n && !seen.has(q[0])) { seen.add(q[0]); out.push(q); } });
    }
    else { const cs = mine.flatMap(x => x.cards), allc = flat().filter(x => !x.isMod).flatMap(x => x.cards); build(cs, q => /[?¿]/.test(q[0]) ? q[0] : "«" + q[0] + "»: ¿cuál es la descripción correcta?", q => q[1], allc, q => q[1]); }
    return out;
  }
  S.qmode = S.qmode || "clasica"; S.qround = S.qround || 0; S.gans = S.gans || {}; S.gcache = S.gcache || {};
  function viewQuiz(l) { return viewQuiz0(l) + (course().group === "manantial" || isClf() ? `<div id="rsbox">${rsHTML(l)}</div>` : ""); }
  function viewQuiz0(l) {
    if (isClf()) return viewQuizClassic(l, "");
    const bar = `<div class="qbar"><div class="seg" role="group" aria-label="Tipo de pregunta">${QMODES.map(([k, n]) => `<button data-act="qmode" data-m="${k}" aria-pressed="${S.qmode === k}">${n}</button>`).join("")}</div><button class="btn btn-2" data-act="qnew">Otras preguntas</button>${S.qmode === "clasica" && S.qround > 0 ? `<button class="btn btn-2" data-act="qorig">Volver a las originales</button>` : ""}</div>`;
    if (course().scroll && !l.isMod && S.qmode === "clasica" && S.qround === 0) return viewQuizModule(l, bar);
    if (S.qmode === "clasica" && S.qround === 0) return viewQuizClassic(l, bar);
    const gm = S.qmode === "clasica" ? "mezcla" : S.qmode;
    const key = l.id + "|" + gm + "|" + S.qround; const qs = S.gcache[key] || (S.gcache[key] = genQuiz(l, gm, S.qround)); const a = S.gans[key] || (S.gans[key] = []);
    const answered = a.filter(x => x != null).length, right = qs.filter((q, i) => a[i] === q[2]).length;
    let h = `<div class="wrap">${bar}<p class="rag-note" style="margin:0 0 12px">${S.qmode === "falladas" ? "Preguntas que fallaste antes en este curso." : "Preguntas generadas del material de " + (l.isMod ? "todo el módulo" : "esta clase") + "."} No cuentan para tu progreso: sirven para practicar con otro formato. «Otras preguntas» te da un set distinto.</p>`;
    if (!qs.length) return h + `<div class="empty">${S.qmode === "falladas" ? "<b>Todavía no tienes errores registrados en este curso.</b><p>Cuando falles preguntas de las autoevaluaciones clásicas, aparecerán aquí para que las repases.</p>" : "<b>Esta clase no tiene material para este tipo de pregunta.</b><p>Prueba con otro tipo.</p>"}</div></div>`;
    if (answered === qs.length) h += `<div class="result"><b>${right}/${qs.length}</b><div>${right === qs.length ? "Perfecto." : "Pulsa «Otras preguntas» para seguir practicando."}</div></div>`;
    qs.forEach((q, i) => {
      const sel = a[i], done = sel != null;
      h += `<div class="qcard"><p class="q-h"><span class="q-n">P${i + 1}</span>${esc(q[0])}</p>${q[1].map((o, j) => `<button class="opt ${done ? (j === q[2] ? "right" : j === sel ? "wrong" : "") : ""}" data-act="gans" data-k="${esc(key)}" data-q="${i}" data-o="${j}" ${done ? "disabled" : ""}><span class="l">${"ABCD"[j]}</span><span>${esc(o)}</span></button>`).join("")}${done ? `<div class="expl">${sel === q[2] ? "Correcto. " : "No era esa. "}${esc(q[3] || ("La respuesta correcta es: " + q[1][q[2]] + "."))}</div>` : ""}</div>`;
    });
    return h + "</div>";
  }
  function viewQuizModule(l, bar) {
    return `<div class="wrap">${bar}${modLessons(l).map(x => `<section class="ms" id="ms-${x.id}" data-ms="${x.id}">${msHead(x)}${x.quiz.length ? viewQuizClassic(x, "").replace(/^<div class="wrap">/, '<div class="qsec">') : `<p class="rag-note">Esta sesión no tiene preguntas de autoevaluación.</p>`}</section>`).join("")}</div>`;
  }
  function viewQuizClassic(l, bar) {
    const a = quizAns(l); const answered = a.filter(x => x != null).length; const right = l.quiz.filter((q, i) => qOK(q, a[i])).length;
    let h = `<div class="wrap">${bar}`;
    if (isClf() && !l.quiz.length) {
      const cy = l.cy || [];
      h += `<div class="empty"><b>Esta sesión del PDF no trae preguntas de opción múltiple.</b><p>${cid === "clf" ? "Las preguntas con opciones están en el «Banco de práctica» de cada módulo." : "Repasa la teoría o genera preguntas nuevas aquí abajo."}${cy.length ? " Aquí abajo van las preguntas «Check yourself» de esta sesión: respóndelas en tu cabeza y luego abre la respuesta." : ""}</p></div>`;
      if (cy.length) h += `<div class="recall">${cy.map((p, i) => `<details class="rc"><summary><span class="q-n">${i + 1}</span>${esc(p[0])}</summary><div class="rc-a"><b>${esc(p[1])}</b></div></details>`).join("")}</div>`;
      return h + "</div>";
    }
    if (answered === l.quiz.length) h += `<div class="result"><b>${right}/${l.quiz.length}</b><div>${right === l.quiz.length ? "Perfecto. Esta clase está dominada." : right >= l.quiz.length / 2 ? "Vas bien. Repasa lo que fallaste en la teoría." : "Repasa la lección y vuelve a intentarlo."}</div><button class="btn btn-2" style="margin-left:auto" data-act="qretry" data-l="${l.id}">Reintentar</button></div>`;
    S.msel = S.msel || {};
    l.quiz.forEach((q, i) => {
      const sel = a[i]; const done = sel != null; const multi = Array.isArray(q[2]); const ms = S.msel[lkey(l) + ":" + i] || [];
      const cls = j => done ? (multi ? (q[2].includes(j) ? "right" : sel.includes(j) ? "wrong" : "") : (j === q[2] ? "right" : j === sel ? "wrong" : "")) : (multi && ms.includes(j) ? "pick" : "");
      h += `<div class="qcard"><p class="q-h"><span class="q-n">P${i + 1}</span>${esc(q[0])}</p>${multi ? `<p class="rs-m">Elige ${q[2].length === 2 ? "DOS" : q[2].length === 3 ? "TRES" : q[2].length}.</p>` : ""}${q[1].map((o, j) => `<button class="opt ${cls(j)}" data-act="${multi ? "mtog" : "ans"}" data-l="${l.id}" data-q="${i}" data-o="${j}" ${done ? "disabled" : ""}><span class="l">${"ABCDE"[j]}</span><span>${esc(o)}</span></button>`).join("")}${multi && !done ? `<button class="btn btn-2" data-act="mchk" data-l="${l.id}" data-q="${i}" ${ms.length === q[2].length ? "" : "disabled"}>Comprobar</button>` : ""}${done ? `<div class="expl">${qOK(q, sel) ? "Correcto. " : "No era esa. "}${esc(q[3] || ("La respuesta correcta es: " + qTxt(q) + "."))}</div>` : ""}</div>`;
    });
    return h + "</div>";
  }


  // ---------- laboratorio visual (cursos conceptuales, sin terminal) ----------
  S.vl = S.vl || {};
  const VL = id => S.vl[id] || (S.vl[id] = { recs: [], ord: {}, mat: {}, pk: {}, msg: {}, hint: {}, f: {}, bad: {} });
  const DOM = "jemjaf.com", RTYPES = ["A", "AAAA", "CNAME", "ALIAS", "NS", "MX", "TXT", "SRV"];
  const vnName = n => { n = String(n || "").trim().toLowerCase().replace(/\.$/, ""); if (n.endsWith("." + DOM)) n = n.slice(0, -DOM.length - 1); return (n === "" || n === "@" || n === DOM) ? "@" : n; };
  const vnVal = v => String(v || "").trim().toLowerCase().replace(/^["']|["']$/g, "").replace(/\.$/, "").replace(/\s+/g, " ");
  function vlShuf(arr, seed) { const r = mkRand(seed), x = arr.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; }
  function vlBuildCheck(t, r) {
    const n = vnName(r.n), v = vnVal(r.v);
    for (const [tn, tt, msg] of (t.traps || [])) if (n === tn && r.t === tt) return msg;
    if (n !== t.n) return "El nombre no es el esperado. Recuerda: «@» es el dominio raíz (jemjaf.com); un subdominio se escribe como «api» o «api.jemjaf.com».";
    if (r.t !== t.t) return "El tipo de registro no es el correcto. Piensa: ¿apunta a una IP, a otro nombre, a un correo, a un servicio o es texto?";
    const ok = t.v instanceof RegExp ? t.v.test(v) : vnVal(t.v) === v;
    return ok ? "" : "El valor no es el esperado" + (t.vh ? ": " + t.vh : ".");
  }
  const vlMark = (l, i) => { const k = lbk(l); const arr = P.lab[k] || (P.lab[k] = []); arr[i] = true; save(); renderSide(); };
  function vlTask(l, t, i, done, V) {
    const k = l.id + ":" + i; const msg = V.msg[i] ? `<div class="vl-msg bad">${esc(V.msg[i])}</div>` : "";
    const hint = t.h ? (V.hint[i] ? `<div class="vl-hint">💡 ${esc(t.h)}</div>` : `<button class="vl-link" data-act="vlhint" data-i="${i}">Ver pista</button>`) : "";
    if (done) return `<div class="vl-ok">${t.k === "build" ? "Registro creado en la zona." : t.k === "order" ? "Orden correcto: " + t.steps.map((s, j) => `<b>${j + 1}.</b> ${esc(s)}`).join(" · ") : t.k === "match" ? "Todas las parejas son correctas." : t.k === "ask" ? "Todas las respuestas son correctas." : "Respondido correctamente."}</div>`;
    if (t.k === "build") { const f = V.f[i] || {};
      return `<div class="vl-form"><label>Nombre<input id="vl-n-${i}" value="${esc(f.n || "")}" placeholder="@, www, api…" autocomplete="off" spellcheck="false"></label><label>Tipo<select id="vl-t-${i}">${RTYPES.map(x => `<option ${f.t === x ? "selected" : ""}>${x}</option>`).join("")}</select></label><label class="grow">Valor<input id="vl-v-${i}" value="${esc(f.v || "")}" placeholder="IP, nombre, texto…" autocomplete="off" spellcheck="false"></label><label>TTL<select id="vl-l-${i}"><option>300</option><option>60</option><option>3600</option></select></label><button class="btn" data-act="vlbuild" data-i="${i}">Crear registro</button></div>${msg}${hint}`; }
    if (t.k === "order") { const ch = V.ord[i] || []; const pool = vlShuf(t.steps.map((_, j) => j), l.id + i).filter(j => !ch.includes(j));
      return `<div class="vl-ord"><ol class="vl-seq">${ch.map(j => `<li>${esc(t.steps[j])}</li>`).join("") || '<li class="ph">Pulsa los pasos en el orden correcto…</li>'}</ol><div class="vl-pool">${pool.map(j => `<button data-act="vlord" data-i="${i}" data-j="${j}">${esc(t.steps[j])}</button>`).join("")}</div>${ch.length ? `<button class="vl-link" data-act="vlordr" data-i="${i}">Reiniciar este orden</button>` : ""}</div>${msg}${hint}`; }
    if (t.k === "match") { const defs = vlShuf(t.pairs.map(p => p[1]), l.id + i); const sel = V.mat[i] || []; const bad = V.bad[i] || [];
      return `<div class="vl-match">${t.pairs.map((p, j) => `<div class="vl-row ${bad[j] ? "bad" : ""}"><span>${esc(p[0])}</span><select id="vl-m-${i}-${j}"><option value="">Elige…</option>${defs.map(d2 => `<option ${sel[j] === d2 ? "selected" : ""}>${esc(d2)}</option>`).join("")}</select></div>`).join("")}</div><button class="btn btn-2" data-act="vlmatch" data-i="${i}">Comprobar</button>${msg}${hint}`; }
    if (t.k === "ask") { const cur = V.pk[i] || 0; const s = t.qs[cur];
      return `<div class="vl-pick">${t.qs.slice(0, cur).map(p => `<div class="vl-prev">✓ ${esc(p.q)} → <b>${esc(String(p.a[0]))}</b></div>`).join("")}<p class="vl-q"><span>${cur + 1}/${t.qs.length}</span> ${esc(s.q)}</p><div class="vl-form"><label class="grow">Tu respuesta<input id="vl-a-${i}" value="${esc(V.f[i] || "")}" placeholder="Escribe solo el resultado" autocomplete="off" spellcheck="false"></label><button class="btn" data-act="vlask" data-i="${i}">Comprobar</button></div></div>${msg}${hint}`; }
    if (t.k === "pick") { const cur = V.pk[i] || 0; const s = t.steps[cur]; const opts = vlShuf(s.o.map((x, j) => j), l.id + i + cur);
      return `<div class="vl-pick">${t.steps.slice(0, cur).map(p => `<div class="vl-prev">✓ ${esc(p.q)} → <b>${esc(p.o[0])}</b></div>`).join("")}<p class="vl-q"><span>${cur + 1}/${t.steps.length}</span> ${esc(s.q)}</p><div class="vl-opts">${opts.map(j => `<button data-act="vlpick" data-i="${i}" data-j="${j}">${esc(s.o[j])}</button>`).join("")}</div></div>${msg}${hint}`; }
    return "";
  }
  function viewVLab(l, cls) {
    const V = VL(l.id), st = labState(l), nd = st.filter(Boolean).length; const hasB = l.lab.some(t => t.k === "build");
    const zone = hasB ? `<div class="vl-zone"><div class="vl-zh"><b>Zona DNS · ${DOM}</b><span>${V.recs.length} registro${V.recs.length === 1 ? "" : "s"}</span></div><table><thead><tr><th>Nombre</th><th>Tipo</th><th>Valor</th><th>TTL</th></tr></thead><tbody>${V.recs.map(r => `<tr><td>${esc(r.n)}</td><td><span class="vl-ty">${esc(r.t)}</span></td><td>${esc(r.v)}</td><td>${esc(r.l)}</td></tr>`).join("") || '<tr><td colspan="4" class="vl-empty">Sin registros todavía. Crea el primero en el objetivo 1.</td></tr>'}</tbody></table></div>` : "";
    return `<div class="vlab ${cls || ""}"><div class="vl-head"><div><b>Laboratorio práctico</b> <span class="score">${nd}/${l.lab.length}</span></div><p>${esc(l.vintro || "")}</p></div>${zone}${l.lab.map((t, i) => `${t.lv && (i === 0 || l.lab[i - 1].lv !== t.lv) ? `<div class="lvl">${t.lv}</div>` : ""}<section class="vl-task ${st[i] ? "done" : ""}"><div class="task-t"><span class="chk">${st[i] ? "✓" : i + 1}</span><span>${esc(t.d)}</span></div><div class="vl-body">${vlTask(l, t, i, st[i], V)}</div></section>`).join("")}<button class="vl-link" data-act="vlreset">Reiniciar este laboratorio</button></div>`;
  }
  function vlAct(act, d, l) {
    const V = VL(l.id), i = +d.i, t = l.lab[i]; V.msg[i] = "";
    if (act === "vlhint") V.hint[i] = 1;
    else if (act === "vlreset") { S.vl[l.id] = null; P.lab[lbk(l)] = []; save(); renderSide(); }
    else if (act === "vlbuild") {
      const g = id => { const e = $(id + i); return e ? e.value : ""; };
      const r = { n: g("#vl-n-"), t: g("#vl-t-") || "A", v: g("#vl-v-"), l: g("#vl-l-") || "300" }; V.f[i] = r;
      if (!String(r.v).trim()) V.msg[i] = "Escribe el valor del registro.";
      else { const m = vlBuildCheck(t, r); if (m) V.msg[i] = m; else { V.recs.push({ n: vnName(r.n) === "@" ? "@ (raíz)" : vnName(r.n), t: r.t, v: r.v.trim(), l: r.l }); vlMark(l, i); } }
    }
    else if (act === "vlord") { const ch = V.ord[i] || (V.ord[i] = []); ch.push(+d.j); if (ch.length === t.steps.length) { const bad = ch.findIndex((x, p) => x !== p); if (bad < 0) vlMark(l, i); else { V.msg[i] = "El orden no es correcto: el paso en la posición " + (bad + 1) + " no va ahí. Piensa qué debe pasar antes. Intenta de nuevo."; V.ord[i] = []; } } }
    else if (act === "vlordr") V.ord[i] = [];
    else if (act === "vlmatch") {
      const sel = t.pairs.map((p, j) => { const e = $("#vl-m-" + i + "-" + j); return e ? e.value : ""; }); V.mat[i] = sel; V.bad[i] = sel.map((x, j) => x !== t.pairs[j][1]);
      if (V.bad[i].some(Boolean)) V.msg[i] = "Hay " + V.bad[i].filter(Boolean).length + " pareja(s) incorrecta(s), marcadas en rojo."; else vlMark(l, i);
    }
    else if (act === "vlask") { const e = $("#vl-a-" + i); const v = e ? e.value : ""; V.f[i] = v; const cur = V.pk[i] || 0, s = t.qs[cur]; const nz = x => String(x).toLowerCase().replace(/[\s.,\/]/g, "").replace(/ips?$|direcciones$/, "");
      if (!nz(v)) V.msg[i] = "Escribe una respuesta."; else if (s.a.some(x => nz(x) === nz(v))) { V.pk[i] = cur + 1; V.f[i] = ""; if (cur + 1 >= t.qs.length) vlMark(l, i); } else V.msg[i] = s.why || "No es correcto. Revisa el cálculo e inténtalo otra vez."; }
    else if (act === "vlpick") { const cur = V.pk[i] || 0, s = t.steps[cur]; if (+d.j === 0) { V.pk[i] = cur + 1; if (cur + 1 >= t.steps.length) vlMark(l, i); } else V.msg[i] = s.why || "No es esa. Vuelve a pensar cómo funciona y prueba otra opción."; }
    render(true);
  }

  // ---------- Anki ----------
  const ckey = (l, i) => cid + "|" + l.id + "|" + i;
  const scopeLs = scope => { if (scope !== "lesson") return flat().filter(x => !x.isMod); const l = lesson(S.lesson); return l.isMod ? flat().filter(x => !x.isMod && x.mod.n === l.mod.n) : [l]; };
  function scopeCards() { const ls = scopeLs(S.scope); const out = []; ls.forEach(l => l.cards.forEach((c, i) => out.push({ key: ckey(l, i), l, c }))); return out; }
  function queueCount(scope) {
    const ls = scopeLs(scope); let due = 0, nw = 0; const now = Date.now();
    ls.forEach(l => l.cards.forEach((c, i) => { const st = P.cards[ckey(l, i)]; if (!st) nw++; else if (st.due <= now) due++; }));
    return { due, nw };
  }
  function buildQueue() {
    const now = Date.now(); const cs = scopeCards();
    if (S.cram) { S.queue = cs.map(x => x.key); }
    else {
      const due = cs.filter(x => P.cards[x.key] && P.cards[x.key].due <= now).sort((a, b) => P.cards[a.key].due - P.cards[b.key].due);
      const nw = cs.filter(x => !P.cards[x.key]).slice(0, 30); S.queue = due.concat(nw).map(x => x.key);
    }
    S.shown = false;
  }
  function nextState(st, r) {
    st = st ? Object.assign({}, st) : { ease: 2.5, int: 0, reps: 0 }; const now = Date.now();
    if (r === 0) { st.int = 0; st.ease = Math.max(1.3, st.ease - 0.2); st.due = now + 6e4; }
    else {
      if (r === 1) { st.int = Math.max(1, Math.round((st.int || 1) * 1.2)); st.ease = Math.max(1.3, st.ease - 0.15); }
      else if (r === 2) st.int = st.int ? Math.round(st.int * st.ease) : 1;
      else { st.int = st.int ? Math.round(st.int * st.ease * 1.3) : 3; st.ease += 0.15; }
      st.reps = (st.reps || 0) + 1; st.due = now + st.int * 864e5;
    }
    return st;
  }
  const ivl = (st, r) => { const n = nextState(st, r); return r === 0 ? "< 1 min" : n.int + (n.int === 1 ? " día" : " días"); };
  const findCard = key => { const [c, lid, i] = key.split("|"); const l = lesson(lid); return { l, c: l.cards[+i] }; };
  function viewAnki() {
    if (!S.queue.length && !S._built) { buildQueue(); S._built = true; }
    const qc = queueCount(S.scope); const key = S.queue[0];
    let h = `<div class="wrap"><div class="anki-top"><div class="seg" role="group" aria-label="Alcance"><button data-act="scope" data-s="lesson" aria-pressed="${S.scope === "lesson"}">Esta clase</button><button data-act="scope" data-s="course" aria-pressed="${S.scope === "course"}">Todo el curso</button></div><label class="toggle"><input type="checkbox" id="cram" ${S.cram ? "checked" : ""}> Repasar todo (sin afectar el calendario)</label><div class="stat"><span>Pendientes <b>${qc.due}</b></span><span>Nuevas <b>${qc.nw}</b></span><span>En cola <b>${S.queue.length}</b></span></div></div>`;
    if (!key) {
      h += `<div class="empty"><b>No hay tarjetas pendientes aquí.</b><p style="margin:.5em 0 1em">Las que repasaste vuelven a aparecer según qué tan bien las supiste. Puedes practicar de todos modos.</p><button class="btn" data-act="cramgo">Repasar todo de nuevo</button></div>`;
    } else {
      const { l, c } = findCard(key); const st = P.cards[key];
      h += `<div class="card"><span class="from">${l.id} · ${esc(l.t)}${st ? "" : " · nueva"}</span><div class="front">${esc(c[0])}</div>${S.shown ? `<div class="back">${esc(c[1])}</div>` : ""}</div>`;
      h += S.shown ? `<div class="rate">${["Otra vez", "Difícil", "Bien", "Fácil"].map((n, r) => `<button class="r${r + 1}" data-act="rate" data-r="${r}">${n}<small>${S.cram ? "—" : ivl(st, r)}</small></button>`).join("")}</div><p class="rag-note" style="margin-top:8px">Atajos: 1 Otra vez · 2 Difícil · 3 Bien · 4 Fácil</p>` : `<div class="rate" style="grid-template-columns:1fr"><button data-act="show" class="btn">Mostrar respuesta <small style="color:inherit;opacity:.8">(espacio)</small></button></div>`;
    }
    return h + "</div>";
  }

  // ---------- tutor IA con RAG ----------
  const stop = new Set("de la el los las un una unos unas y o en a al del que se es por para con sin sobre como cual cuales qué que me mi mis tu tus lo le les su sus ya si no mas más muy este esta estos estas eso esa ese hay ser son era fue the and for with what how can i you".split(" "));
  const tok = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter(w => w.length > 1 && !stop.has(w)).map(w => w.length > 4 ? w.replace(/(es|s)$/, "") : w);
  let INDEX = null, INDEX_CID = null;
  function buildIndex() {
    const chunks = flat().filter(l => !l.isMod).map(l => {
      const text = `${l.t}. ${l.sum.replace(/[`*]/g, "")}\nComandos:\n${l.cmds.replace(/  ## /g, "   # ").replace(/^## /gm, "# ")}\nPreguntas clave: ${l.cards.map(c => c[0] + " → " + c[1]).join(" | ")}${l.slideText ? "\nContenido de las diapositivas: " + l.slideText : ""}`;
      const tf = {}; tok(l.id + " " + l.t + " " + l.t + " " + text).forEach(w => tf[w] = (tf[w] || 0) + 1);
      return { id: l.id, t: l.t, text, tf };
    });
    const df = {}; chunks.forEach(c => Object.keys(c.tf).forEach(w => df[w] = (df[w] || 0) + 1));
    INDEX = { chunks, df, n: chunks.length }; INDEX_CID = cid;
  }
  function retrieve(q, k) {
    if (!INDEX || INDEX_CID !== cid) buildIndex();
    const qt = tok(q); const cur = S.lesson;
    const scored = INDEX.chunks.map(c => { let s = 0; qt.forEach(w => { const f = c.tf[w]; if (f) s += (1 + Math.log(f)) * Math.log(1 + INDEX.n / INDEX.df[w]); else { for (const key in c.tf) if (key.length > 3 && w.length > 3 && (key.startsWith(w) || w.startsWith(key))) { s += 0.4; break; } } }); if (c.id === cur) s += /\b(esta|actual|clase|leccion|lección)\b/i.test(q) ? 6 : 0.8; return { c, s }; });
    return scored.filter(x => x.s > 0.5).sort((a, b) => b.s - a.s).slice(0, k).map(x => x.c);
  }
  function viewTutor() {
    const l = lesson(S.lesson);
    const chips = [`Explícame ${l.id} como si fuera nuevo en Linux`, "Hazme 3 preguntas de práctica de esta clase", "¿Cuál es el error más común con esto?", "Dame un mini reto para practicar en el terminal"];
    return `<div class="chat"><p class="rag-note">El tutor busca en el material del curso (${flat().length} clases) los fragmentos más relevantes a tu pregunta y responde con base en ellos. Verás de qué clases sacó la respuesta.</p>
      <div class="msgs" id="msgs">${msgsHTML()}</div>
      <div class="chips">${chips.map(c => `<button data-act="ask" data-q="${esc(c)}">${esc(c)}</button>`).join("")}</div>
      <div class="composer"><textarea id="tq" rows="1" placeholder="Pregunta lo que no entiendas del curso…" aria-label="Pregunta para el tutor"></textarea><button class="btn" data-act="send" id="sendb" ${S.busy ? "disabled" : ""}>Enviar</button></div></div>`;
  }
  function msgHTML(m) {
    if (m.role === "u") return `<div class="msg u">${esc(m.text)}</div>`;
    const body = m.text ? md(m.text) : `<span class="typing"><i></i><i></i><i></i></span>`;
    const src = m.src && m.src.length ? `<div class="src"><span>Fuentes:</span>${m.src.map(s => `<button data-act="go" data-id="${s.id}" title="${esc(s.t)}">${s.id}</button>`).join("")}</div>` : "";
    return `<div class="msg a">${body}${src}</div>`;
  }
  const msgsHTML = () => S.chat.length ? S.chat.map(msgHTML).join("") : `<div class="msg a"><p>Hola. Pregúntame lo que quieras de <b>${esc(course().name)}</b>: dudas de un comando, diferencias entre dos cosas, ejemplos o que te tome una prueba oral.</p></div>`;
  function paintMsgs() { const m = $("#msgs"); if (!m) return; m.innerHTML = msgsHTML(); m.scrollTop = m.scrollHeight; const b = $("#sendb"); if (b) b.disabled = S.busy; }
  async function getSample() { try { if (window.claude && window.claude.use) return await window.claude.use("sample"); } catch (e) {} return null; }
  async function ask(q) {
    q = q.trim(); if (!q || S.busy) return;
    const top = retrieve(q, 4); const l = lesson(S.lesson);
    if (!top.some(c => c.id === l.id) && /\b(esta|actual|clase|leccion|lección)\b/i.test(q)) top.unshift(INDEX.chunks.find(c => c.id === l.id));
    S.chat.push({ role: "u", text: q }); const m = { role: "a", text: "", src: top.map(c => ({ id: c.id, t: c.t })) }; S.chat.push(m); S.busy = true; paintMsgs();
    const sm = await getSample();
    if (!sm) {
      m.text = "El tutor con IA necesita el permiso de Claude en este visor, y aquí no está disponible. Mientras tanto, estos son los fragmentos del curso más relacionados con tu pregunta:\n\n" + top.map(c => `**${c.id} · ${c.t}**\n${c.text.split("\n")[0].slice(0, 280)}`).join("\n\n");
      S.busy = false; paintMsgs(); return;
    }
    const prior = S.chat.slice(0, -2).slice(-6).map(x => ({ role: x.role === "u" ? "user" : "assistant", content: x.text }));
    const ctx = top.map(c => `[Clase ${c.id} — ${c.t}]\n${c.text}`).join("\n\n");
    const instr = `Eres el tutor de IA de un alumno que estudia el curso «${course().name}». Responde en español, claro y breve, con base en el MATERIAL DEL CURSO de abajo. Si algo no está en el material, dilo y complétalo con conocimiento general marcándolo como tal. Pon los comandos en bloques de código y explica qué hace cada flag. Menciona de qué clase sale la idea (ej. «clase 2.2»). Cierra con una pregunta corta para que el alumno piense. Si pide practicar, hazle UNA pregunta a la vez y espera su respuesta.`;
    const content = `${instr}\n\nMATERIAL DEL CURSO (fragmentos recuperados):\n${ctx}\n\nLa clase que el alumno tiene abierta: ${l.id} — ${l.t}\n\nPREGUNTA DEL ALUMNO: ${q}`;
    try {
      const res = await sm(prior.concat([{ role: "user", content }]), { cache: false, onText: ({ text }) => { m.text = text; const box = $("#msgs"); if (box && box.lastElementChild) { box.lastElementChild.outerHTML = msgHTML(m); box.scrollTop = box.scrollHeight; } } });
      m.text = (res && res.text) || m.text || "No obtuve respuesta. Intenta de nuevo.";
    } catch (e) {
      m.text = e && e.code === "not_granted" ? "No diste permiso al tutor para usar Claude. Puedes cambiarlo desde el menú de permisos de esta página." : e && e.code === "rate_limited" ? "Muchas preguntas seguidas. Espera un momento e inténtalo otra vez." : (m.text || "No pude responder ahora. Inténtalo de nuevo en unos segundos.");
    }
    S.busy = false; paintMsgs();
  }

  // ---------- render general ----------
  // ---------- panel al costado de la teoría: lab, autoevaluación, Anki o tutor ----------
  S.sp = P.sp || "lab";
  const SPT = [["lab", "Lab"], ["quiz", "Autoevaluación"], ["anki", "Anki"], ["tutor", "Tutor IA"]];
  const eff = () => S.tab === "teoria" ? (S.split ? S.sp : "teoria") : S.tab;
  function spPanel(l) {
    const body = S.sp === "quiz" ? viewQuiz(l) : S.sp === "anki" ? viewAnki() : S.sp === "tutor" ? viewTutor() : viewLab(l, "col");
    return `<div class="sp-bar" role="tablist" aria-label="Panel al costado">${SPT.map(([k, n]) => `<button role="tab" data-act="sp" data-k="${k}" aria-selected="${S.sp === k}">${k === "lab" && !l.vlab ? "Terminal y lab" : k === "lab" ? "Laboratorio" : n}</button>`).join("")}</div><div class="sp-body ${S.sp === "lab" ? "sp-lab" : ""}">${body}</div>`;
  }

  // ---------- portada ----------
  function lesSt(c, l) { const k = c.id + ":" + l.id; const ab = P.lab[k + (l.isMod ? ":v2" : "")] || []; const lab = l.lab.filter((_, i) => ab[i]).length; const qa = ((P.quiz[k] || {}).a || []).slice(0, l.quiz.length).filter(x => x != null).length; if (!l.lab.length && !l.quiz.length) return P.seen[k] ? 2 : 0; if (lab === l.lab.length && qa === l.quiz.length) return 2; return (P.seen[k] || lab || qa) ? 1 : 0; }
  function hmStats(c) { let n = 0, d = 0, s = 0; for (const m of c.modules) for (const l of m.lessons) { n++; const x = lesSt(c, l); if (x === 2) d++; else if (x === 1) s++; } return { n, d, s, mods: c.modules.length }; }
  function nextLes(c) { const ls = c.modules.flatMap(m => m.lessons); const x = ls.find(l => lesSt(c, l) !== 2) || ls[0]; return x.id; }
  function donut(st) {
    const R = 32, C = 2 * Math.PI * R; const seg = [[st.d, "var(--ok)"], [st.s, "var(--primary)"]]; let off = 0;
    return `<svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="${R}" fill="none" stroke="var(--line)" stroke-width="10"/>${seg.map(([v, col]) => { const len = st.n ? v / st.n * C : 0; const s = `<circle cx="40" cy="40" r="${R}" fill="none" stroke="${col}" stroke-width="10" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 40 40)"/>`; off += len; return s; }).join("")}</svg>`;
  }
  function homeHTML() {
    const c = course(), st = hmStats(c), all = flat(), cur = lesson(S.lesson);
    const idx = Math.max(0, all.findIndex(x => x.id === cur.id)), from = Math.min(idx, Math.max(0, all.length - 6));
    const steps = all.slice(from, from + 6).map(l => { const s = lesSt(c, l); return `<div class="mk-st ${s === 2 ? "done" : ""} ${l.id === cur.id ? "on" : ""}"><span class="d">${s === 2 ? "✓" : ""}</span><span class="t">${esc(l.t)}</span></div>`; }).join("");
    const pct = st.n ? Math.round(st.d / st.n * 100) : 0;
    const rail = ["M4 5h16v14H4zM4 9h16", "M6 3h12v18H6zM9 8h6M9 12h6", "M12 8a4 4 0 100 8 4 4 0 000-8z", "M6 8a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6zM10 19h4", "M3 6h18v12H3zM3 7l9 6 9-6"].map(p => `<svg viewBox="0 0 24 24"><path d="${p}"/></svg>`).join("");
    const gn = g => g ? (g.id === "sk" ? "Técnicos" : g.name.charAt(0).toUpperCase() + g.name.slice(1)) : "Curso";
    const groups = GROUPS.filter(g => COURSES.some(x => x.group === g.id));
    const list = COURSES.filter(x => S.hg === "all" || x.group === S.hg);
    const cards = list.map(x => { const t = hmStats(x), p = t.n ? Math.round(t.d / t.n * 100) : 0; const g = GROUPS.find(y => y.id === x.group); const b = p === 100 ? ["ok", "Completo"] : (t.d || t.s) ? ["now", "En curso"] : ["", "Sin empezar"]; const RC = 2 * Math.PI * 24;
      return `<button class="hm-c" style="--cc:${ccol(x)}" data-act="opencourse" data-id="${x.id}"><div class="tp"><span class="cbadge">${cico(x)}</span><span class="tg">${esc(gname(g))}</span><span class="hm-b ${b[0]}">${b[1]}</span></div><h3>${esc(x.name)}</h3>${x.blurb ? `<p>${esc(x.blurb)}</p>` : ""}<div class="hm-f"><div class="ring" role="img" aria-label="Avance ${p}%"><svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="24" fill="none" stroke="var(--line)" stroke-width="6"/><circle cx="28" cy="28" r="24" fill="none" stroke="var(--cc)" stroke-width="6" stroke-linecap="round" stroke-dasharray="${p / 100 * RC} ${RC}" transform="rotate(-90 28 28)"/></svg><b>${p}%</b></div><div class="hm-m2"><span><b>${t.mods}</b> módulos</span><span><b>${t.n}</b> clases</span><span><b>${t.d}</b> completas</span></div></div></button>`; }).join("");
    return `<div class="hm">
      <div class="hm-top"><span class="brand-home"><i>${ic("home")}</i>Aula de estudio</span><button class="theme" data-act="theme" title="Cambiar tema" aria-label="Tema: ${THEMES[P.theme || "auto"][0]}">${ic(THEMES[P.theme || "auto"][1])}<span>${THEMES[P.theme || "auto"][0]}</span></button></div>
      <div class="hm-hero">
        <div><span class="hm-eyebrow">Curso · Módulo · Clase</span><h1>Estudia lo que quieras, <em>a tu ritmo.</em></h1>
          <p class="hm-lead">Cada clase reúne teoría, laboratorio, autoevaluación, tarjetas de repaso y un tutor para tus dudas.</p>
          <div class="hm-cta"><button class="btn" data-act="lesson" data-id="${cur.id}"><span>Continuar · ${esc(cur.id)} ${esc(cur.t)}</span></button><button class="btn btn-2" data-act="srch">${ic("play")} Buscar un tema</button></div></div>
        <div class="mock" style="--cc:${ccol(c)}" aria-label="Vista previa de tu curso actual">
          <div class="mk-bar"><i></i><i></i><i></i></div>
          <div class="mk-body"><div class="mk-rail"><span class="lg">${ic("home")}</span>${rail}</div>
            <div class="mk-steps"><div class="mk-prog"><b style="width:${pct}%"></b></div>${steps}</div>
            <div class="mk-stage"><small>Ahora estudias</small><b>${esc(c.name)}</b><button class="go" data-act="lesson" data-id="${cur.id}">Aprender</button></div></div>
          <div class="mk-fl mk-stats"><div><h4>Estadísticas</h4>${donut(st)}</div><div class="mk-lg"><span><i style="background:var(--ok)"></i>Listas<b>${st.d}</b></span><span><i style="background:var(--primary)"></i>En curso<b>${st.s}</b></span><span><i style="background:var(--line)"></i>Pendientes<b>${st.n - st.d - st.s}</b></span></div></div>
          <div class="mk-fl mk-chat"><h4>Tutor en línea</h4><div class="mk-msg"><span class="av">?</span><span class="bb">${esc("¿Me explicas " + cur.t + "?")}</span></div><div class="mk-msg"><span class="av">✦</span><span class="bb"><i style="width:100%"></i><i style="width:82%"></i><i style="width:55%"></i></span></div></div>
        </div>
      </div>
      <div><div class="hm-h"><h2>Mis cursos</h2><div class="hm-chips" role="group" aria-label="Filtrar cursos"><button class="hm-chip" data-act="hgrp" data-g="all" aria-pressed="${S.hg === "all"}">Todos</button>${groups.map(g => `<button class="hm-chip" data-act="hgrp" data-g="${g.id}" aria-pressed="${S.hg === g.id}">${esc(gn(g))}</button>`).join("")}</div></div><div class="hm-grid">${cards}</div></div>
    </div>`;
  }
  function render(keepScroll) {
    const l = lesson(S.lesson); const v = $("#view"); const sc = v.scrollTop;
    const ap = $("#app"); if (ap) ap.style.setProperty("--cc", ccol(course()));
    document.body.classList.toggle("ishome", !!S.home);
    if (S.home) { v.classList.remove("splitmode"); $("#main").classList.add("home"); renderSide(); v.innerHTML = homeHTML(); v.scrollTop = 0; return; }
    $("#main").classList.remove("home");
    renderSide(); renderTop();
    const spb = $(".sp-body"); const spsc = spb ? spb.scrollTop : 0;
    v.innerHTML = S.tab === "teoria" ? (S.split ? `<div class="split"><div class="split-l">${viewTeoria(l)}</div><div class="split-r">${spPanel(l)}</div></div>` : viewTeoria(l)) : S.tab === "lab" ? viewLab(l) : S.tab === "quiz" ? viewQuiz(l) : S.tab === "anki" ? viewAnki() : viewTutor();
    v.classList.toggle("splitmode", S.tab === "teoria" && S.split);
    v.scrollTop = keepScroll ? sc : 0;
    if (course().scroll && !keepScroll && (S.tab === "teoria" || S.tab === "quiz") && !l.isMod) scrollSec(S.lesson, false);
    if (keepScroll && spsc) { const nb = $(".sp-body"); if (nb) nb.scrollTop = spsc; }
    if (eff() === "lab") { paintTerm(); const inp = $("#tinp"); if (inp) { if (T.prefill) { inp.value = T.prefill; T.prefill = ""; } if (window.innerWidth > 860 && S.tab === "lab") inp.focus(); } }
    if (eff() === "tutor") { const m = $("#msgs"); if (m) m.scrollTop = m.scrollHeight; }
    P.last = { course: cid, lesson: S.lesson, tab: S.tab }; save();
  }
  function scrollSec(id, smooth) { const e = document.getElementById ? document.getElementById("ms-" + id) : null; if (e) { S._noSpy = Date.now(); e.scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" }); } }
  function go(id, tab) {
    if (course().scroll && !S.home) {
      const cur0 = lesson(S.lesson), nx = lesson(id); const tb = tab || S.tab;
      if (!cur0.isMod && !nx.isMod && nx.mod.n === cur0.mod.n && tb === S.tab && (S.tab === "teoria" || (S.tab === "quiz" && S.qmode === "clasica" && S.qround === 0))) {
        S.lesson = id; P.seen[cid + ":" + id] = 1; touch(); document.body.classList.remove("drawer"); renderSide(); renderTop(); P.last = { course: cid, lesson: id, tab: S.tab }; save(); scrollSec(id, true);
        const cur = document.querySelector(".les.cur"); if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: "nearest" }); return;
      }
    }
    S.home = false; S.lesson = id; if (tab) S.tab = tab; P.seen[cid + ":" + id] = 1; touch(); document.body.classList.remove("drawer");
    S._built = false; S.queue = []; S.cram = false; render(false);
    const cur = document.querySelector(".les.cur"); if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: "nearest" });
  }

  // ---------- el módulo en una sola página: la sesión activa sigue al desplazamiento ----------
  (() => { let busy = false; const v = $("#view"); if (!v || !v.addEventListener) return;
    v.addEventListener("scroll", () => { if (busy || S.home || !course().scroll || !(S.tab === "teoria" || S.tab === "quiz")) return; busy = true; requestAnimationFrame(() => { busy = false;
      if (Date.now() - (S._noSpy || 0) < 900) return; const secs = [...v.querySelectorAll(".ms")]; if (!secs.length) return; const top = v.getBoundingClientRect().top + 90; let id = secs[0].dataset.ms; for (const e of secs) { if (e.getBoundingClientRect().top <= top) id = e.dataset.ms; else break; }
      if (id !== S.lesson) { S.lesson = id; P.seen[cid + ":" + id] = 1; renderSide(); renderTop(); P.last = { course: cid, lesson: id, tab: S.tab }; save(); const cur = document.querySelector(".les.cur"); if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: "nearest" }); } }); }, { passive: true }); })();

  // ---------- eventos ----------
  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act]"); const tout = e.target.closest("#tout");
    if (!el) { if (tout && !(window.getSelection && String(window.getSelection()))) { const i = $("#tinp"); if (i) i.focus(); } if (document.body.classList.contains("drawer") && !e.target.closest("#side")) document.body.classList.remove("drawer"); return; }
    const d = el.dataset; const l = d.l ? lesson(d.l) : lesson(S.lesson); const all = flat(); const idx = all.findIndex(x => x.id === l.id);
    switch (d.act) {
      case "sp": S.sp = d.k; P.sp = d.k; if (d.k === "anki") { S._built = false; S.queue = []; } render(false); break;
      case "tab": S.tab = d.t; if (d.t === "anki") { S._built = false; S.queue = []; } render(false); break;
      case "vidadd": { const i = document.querySelector('.vid-in[data-vid="' + d.key + '"]'); const v = i ? i.value : ""; if (ytId(v)) { P.vids = P.vids || {}; P.vids[d.key] = v.trim(); save(); render(true); } else if (i) { i.value = ""; i.placeholder = "Ese link no parece de YouTube. Pégalo de nuevo."; } break; }
      case "vidrm": P.vids = P.vids || {}; P.vids[d.key] = ""; save(); render(true); break;
      case "lesson": go(d.id); break;
      case "lt": go(d.id, d.t); break;
      case "uplvl": upGen(); break;
      case "upans": { const k = lkey(l); const U = (P.up || {})[k]; if (U) { U.ans = U.ans || []; U.ans[+d.i] = +d.j; save(); paintUp(); } break; }
      case "lhtog": S.lh = !S.lh; render(true); break;
      case "rsgen": rsGen(); break;
      case "rsans": { const k = lkey(l); const R = (P.rs || {})[k]; if (R) { R.ans = R.ans || {}; R.ans[+d.i] = [+d.j]; save(); paintRs(); } break; }
      case "rssel": { const k = lkey(l); const key = k + ":" + d.i; const R = (P.rs || {})[k]; if (R) { const need = R.items[+d.i].a.length; let s = RSB.sel[key] || []; const j = +d.j; s = s.includes(j) ? s.filter(x => x !== j) : (s.length < need ? s.concat(j) : s); RSB.sel[key] = s; paintRs(); } break; }
      case "rscheck": { const k = lkey(l); const R = (P.rs || {})[k]; if (R) { R.ans = R.ans || {}; R.ans[+d.i] = (RSB.sel[k + ":" + d.i] || []).slice().sort(); save(); paintRs(); } break; }
      case "home": S.home = true; render(false); break;
      case "hgrp": S.hg = d.g; render(false); break;
      case "opencourse": { cid = d.id; S.chat = []; INDEX = null; go(nextLes(course()), "teoria"); break; }
      case "go": go(d.id, "teoria"); break;
      case "mod": { const k = cid + ":" + d.m; const cur = P.open[k] !== undefined ? P.open[k] : course().modules.find(m => m.n === +d.m).lessons.some(x => x.id === S.lesson); P.open[k] = !cur; save(); renderSide(); break; }
      case "prev": if (idx > 0) go(all[idx - 1].id); break;
      case "next": if (idx < all.length - 1) go(all[idx + 1].id); break;
      case "fs": P.fs = Math.max(14, Math.min(24, (P.fs || 17) + (+d.d) * 1)); save(); { const w = $(".study"); if (w) w.style.setProperty("--fs", P.fs + "px"); } break;
      case "kt": { const t = (d.t || "").toLowerCase(); const el = [...document.querySelectorAll(".sum strong")].find(x => x.textContent.replace(/[:.\s]+$/, "").toLowerCase() === t); if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); } break; }
      case "read": { const lz = lesson(S.lesson); P.read[lkey(lz)] = P.read[lkey(lz)] ? 0 : 1; save(); render(true); break; }
      case "toc": { const el = document.querySelectorAll(".sum h3")[+d.i]; if (el) el.scrollIntoView({ block: "start", behavior: "smooth" }); break; }
      case "srch": srchOpen(); break;
      case "srchx": srchClose(); break;
      case "srgo": srchGo(+d.i); break;
      case "burger": document.body.classList.toggle("drawer"); break;
      case "theme": { const o = ["auto", "light", "dark"]; P.theme = o[(o.indexOf(P.theme || "auto") + 1) % 3]; applyTheme(); save(); renderSide(); if (S.home) render(true); break; }
      case "newc": S.newc = !S.newc; renderSide(); break;
      case "try": if (S.split && S.tab === "teoria") { if (S.sp !== "lab") { S.sp = "lab"; P.sp = "lab"; T.prefill = d.c; render(true); break; } const i = $("#tinp"); if (i) { i.value = d.c; i.focus(); } break; } T.prefill = d.c; S.tab = "lab"; render(false); break;
      case "split": S.split = !S.split; P.split = S.split; S._built = false; S.queue = []; save(); render(true); break;
      case "hint": S.hints[d.k] = 1; { const t = $("#tasks"); if (t) t.innerHTML = tasksHTML(l); } break;
      case "tclear": T.lines = []; paintTerm(); { const i = $("#tinp"); if (i) i.focus(); } break;
      case "treset": Shell.reset(); T.here = null; T.lines = [{ k: "dim", t: "Entorno reiniciado: los archivos de ejemplo volvieron a su estado original." }]; paintTerm(); break;
      case "mtog": { const k = lkey(l); const st = P.quiz[k] || (P.quiz[k] = { a: [] }); if (st.a[+d.q] != null) break; S.msel = S.msel || {}; const kk = k + ":" + d.q; const cur = S.msel[kk] || []; const j = +d.o; const need = (l.quiz[+d.q] || [])[2].length; S.msel[kk] = cur.includes(j) ? cur.filter(x => x !== j) : (cur.length < need ? cur.concat(j) : cur); render(true); break; }
      case "mchk": { const k = lkey(l); const st = P.quiz[k] || (P.quiz[k] = { a: [] }); if (st.a[+d.q] != null) break; const kk = k + ":" + d.q; const cur = ((S.msel || {})[kk] || []).slice().sort(); const need = (l.quiz[+d.q] || [])[2].length; if (cur.length !== need) break; st.a[+d.q] = cur; save(); render(true); break; }
      case "ans": { const k = lkey(l); const st = P.quiz[k] || (P.quiz[k] = { a: [] }); if (st.a[+d.q] != null) break; st.a[+d.q] = +d.o; save(); render(true); break; }
      case "vlhint": case "vlreset": case "vlbuild": case "vlord": case "vlordr": case "vlmatch": case "vlpick": case "vlask": vlAct(d.act, d, l); break;
      case "dxprev": if (l.slides) { S.sl[l.id] = Math.max(0, slIdx(l) - 1); render(true); } break;
      case "dxnext": if (l.slides) { S.sl[l.id] = Math.min(l.slides.length - 1, slIdx(l) + 1); render(true); } break;
      case "dxgo": if (l.slides) { S.sl[l.id] = +d.i; render(true); } break;
      case "qmode": S.qmode = d.m; S.qround = 0; render(true); break;
      case "qnew": S.qround++; render(true); break;
      case "qorig": S.qround = 0; render(true); break;
      case "gans": { const arr = S.gans[d.k] || (S.gans[d.k] = []); if (arr[+d.q] == null) arr[+d.q] = +d.o; render(true); break; }
      case "qretry": S.msel = {}; P.quiz[lkey(l)] = { a: [] }; save(); render(false); break;
      case "scope": S.scope = d.s; S._built = false; S.queue = []; render(false); break;
      case "cramgo": S.cram = true; S._built = false; S.queue = []; render(false); break;
      case "show": S.shown = true; render(true); break;
      case "rate": { const r = +d.r; const key = S.queue.shift(); if (!S.cram) P.cards[key] = nextState(P.cards[key], r); if (r === 0) S.queue.push(key); S.shown = false; save(); render(true); break; }
      case "ask": ask(d.q); break;
      case "send": { const t = $("#tq"); if (t && t.value.trim()) { const q = t.value; t.value = ""; ask(q); } break; }
    }
  });
  document.addEventListener("change", e => {
    if (e.target.id === "gsel") { const f = COURSES.find(x => x.group === e.target.value); if (f) { cid = f.id; S.lesson = flat()[0].id; S.chat = []; INDEX = null; go(S.lesson, "teoria"); } return; }
    if (e.target.id === "csel") { cid = e.target.value; S.lesson = flat()[0].id; S.chat = []; INDEX = null; go(S.lesson, "teoria"); }
    else if (e.target.id === "hidecm") { S.hidecm = e.target.checked; const b = $("#cmdbox"); if (b) b.classList.toggle("hide-cm", S.hidecm); }
    else if (e.target.id === "cram") { S.cram = e.target.checked; S._built = false; S.queue = []; render(false); }
  });
  let noteT = null;
  document.addEventListener("input", e => {
    const t = e.target;
    if (t.id === "note") { P.notes = P.notes || {}; P.notes[lkey(lesson(S.lesson))] = t.value; clearTimeout(noteT); noteT = setTimeout(save, 400); }
    else if (t.id === "sq") { SS.q = t.value; SS.r = searchQ(SS.q); SS.i = 0; const keepPos = t.selectionStart; srchPaint(); const n = document.getElementById("sq"); if (n) try { n.setSelectionRange(keepPos, keepPos); } catch (er) {} }
  });
  document.addEventListener("keydown", e => {
    const t = e.target;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); SS.open ? srchClose() : srchOpen(); return; }
    if (SS.open) { if (e.key === "Escape") srchClose(); else if (e.key === "ArrowDown") { SS.i = Math.min(SS.r.length - 1, SS.i + 1); srchPaint(); e.preventDefault(); } else if (e.key === "ArrowUp") { SS.i = Math.max(0, SS.i - 1); srchPaint(); e.preventDefault(); } else if (e.key === "Enter") { srchGo(SS.i); e.preventDefault(); } return; }
    if (!S.home && S.tab === "teoria" && (e.key === "ArrowRight" || e.key === "ArrowLeft") && !(t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) { const ls = lesson(S.lesson); if (ls.slides && !course().scroll) { S.sl[ls.id] = Math.max(0, Math.min(ls.slides.length - 1, slIdx(ls) + (e.key === "ArrowRight" ? 1 : -1))); render(true); e.preventDefault(); return; } }
    if (t.id === "tinp") {
      if (e.key === "Enter") { const v = t.value; t.value = ""; submitLine(v); paintTerm(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { if (T.hist.length) { T.hi = Math.max(0, T.hi - 1); t.value = T.hist[T.hi] || ""; } e.preventDefault(); }
      else if (e.key === "ArrowDown") { T.hi = Math.min(T.hist.length, T.hi + 1); t.value = T.hist[T.hi] || ""; e.preventDefault(); }
      else if (e.ctrlKey && e.key.toLowerCase() === "l") { T.lines = []; paintTerm(); e.preventDefault(); }
      else if (e.ctrlKey && e.key.toLowerCase() === "c") { if (T.here) T.here = null; T.lines.push({ k: "out", t: "^C" }); t.value = ""; paintTerm(); e.preventDefault(); }
      return;
    }
    if (t.id === "tq" && e.key === "Enter" && !e.shiftKey) { e.preventDefault(); const v = t.value; if (v.trim()) { t.value = ""; ask(v); } return; }
    if (eff() === "anki" && !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && S.queue.length) {
      if ((e.key === " " || e.key === "Enter") && !S.shown && t.tagName !== "BUTTON") { e.preventDefault(); S.shown = true; render(true); }
      else if (S.shown && /^[1-4]$/.test(e.key)) { const b = document.querySelector(`.rate [data-r="${+e.key - 1}"]`); if (b) b.click(); }
    }
  });

  render(false);

  // ---------- cronómetro personal (manual, no mide nada por su cuenta) ----------
  (function () {
    const el = $("#sw"); if (!el) return;
    let acc = 0, t0 = 0, run = false, laps = [], tick = null;
    const cur = () => acc + (run ? Date.now() - t0 : 0);
    const fmt = ms => { const s = Math.floor(ms / 1000), c = Math.floor(ms % 1000 / 100); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; const p = n => String(n).padStart(2, "0"); return (h ? h + ":" : "") + p(m) + ":" + p(x) + "." + c; };
    function paint() {
      el.className = "sw" + (run ? " run" : "");
      el.innerHTML = `<span>⏱</span><span class="t" id="swt">${fmt(cur())}</span><button data-s="go">${run ? "Pausa" : acc ? "Seguir" : "Iniciar"}</button>${run ? '<button data-s="lap">Vuelta</button>' : ""}${acc || run ? '<button data-s="rs">Reiniciar</button>' : ""}${laps.length ? `<span class="laps" title="${laps.join(" · ")}">${laps.slice(-3).join(" · ")}</span>` : ""}`;
    }
    el.addEventListener("click", e => {
      const b = e.target.closest("button[data-s]"); if (!b) return; const s = b.dataset.s;
      if (s === "go") { if (run) { acc += Date.now() - t0; run = false; clearInterval(tick); } else { t0 = Date.now(); run = true; tick = setInterval(() => { const t = $("#swt"); if (t) t.textContent = fmt(cur()); }, 100); } }
      else if (s === "lap") laps.push(fmt(cur()));
      else { acc = 0; run = false; laps = []; clearInterval(tick); }
      paint();
    });
    paint();
  })();
})();
