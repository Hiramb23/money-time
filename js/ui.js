/* Money Time — interface : lancement, match, résultat. */
(function () {
  'use strict';
  const E = MT.engine, L = MT.L, eff = E.eff;
  const $ = (q) => document.querySelector(q);
  const G = { s: null, start: null, user: 0, home: { team: 'SEA', opp: '', fam: '', venue: '' }, sel: null, busy: false, fast: false, pos: {}, mu: {}, holder: null };

  const SP = {
    top: [250, 338], lwing: [88, 250], rwing: [412, 250], lcorner: [34, 72], rcorner: [466, 72],
    lelbow: [172, 194], relbow: [328, 194], lblock: [196, 98], rblock: [304, 98], screen: [288, 310], ft: [250, 192],
  };
  const HOOP = [250, 52];
  const PLAY_SPOTS = {
    pnr: { H: 'top', R: 'screen', K: 'rwing', o: ['lcorner', 'lwing'] },
    iso: { H: 'top', R: 'lblock', K: 'rwing', o: ['lcorner', 'rcorner'] },
    drive: { H: 'lwing', R: 'rblock', K: 'rcorner', o: ['top', 'rwing'] },
    shooter: { S: 'lwing', R: 'lelbow', H: 'top', K: 'rwing', o: ['rcorner'] },
    post: { S: 'lblock', H: 'lwing', R: 'relbow', K: 'rwing', o: ['top'] },
    motion: { H: 'top', R: 'lelbow', K: 'rcorner', o: ['lwing', 'rwing'] },
  };

  const fmtClock = (c) => {
    if (c >= 60) { const m = Math.floor(c / 60), x = Math.floor(c - m * 60); return m + ':' + String(x).padStart(2, '0'); }
    return c.toFixed(1);
  };
  const fatClass = (f) => (f < 50 ? 'ok' : f < 75 ? 'mid' : 'hi');
  /** Jauge de fatigue : la fatigue ressentie en plein, la part effacée par le public en transparence. */
  const fatBar = (p) => {
    const f = Math.round(p.fatigue), r = Math.round(E.felt(p));
    return `<span class="bar ${fatClass(r)}">${r < f ? `<span class="ghost" style="width:${f}%"></span>` : ''}<span style="width:${r}%"></span></span>`;
  };
  const fatTip = (p) => { const f = Math.round(p.fatigue), r = Math.round(E.felt(p)); return r < f ? `Fatigue ${f} %, ressentie ${r} % grâce au public` : `Fatigue ${f} %`; };
  const VENUES = { home: 'À domicile', away: 'À l’extérieur' };
  const sleep = (ms) => new Promise((r) => setTimeout(r, G.fast ? ms * 0.12 : ms));
  const show = (id) => ['home', 'match', 'result'].forEach((k) => ($('#' + k).hidden = k !== id));
  let toastT;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => (t.hidden = true), 3200);
  }
  const traits = (p) =>
    MT.ATTRS.filter((a) => a.k !== 'end').slice().sort((a, b) => p[b.k] - p[a.k]).slice(0, 3).map((a) => `${a.short} ${p[a.k]}`).join(' · ');

  /* ---------- écran de lancement : équipe, adversaire, scénario ---------- */
  const S = MT.scenarios;
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const topN = (a, n) => a.slice().sort((x, y) => y - x).slice(0, n);
  function ratings(t) {
    const f = t.players.slice(0, 5);
    return [
      ['Attaque', avg(f.map((p) => Math.max(p.three, p.mid, p.fin) * 0.6 + (p.drb + p.pas) / 2 * 0.4))],
      ['3 points', avg(topN(f.map((p) => p.three), 3))],
      ['Défense', avg(f.map((p) => (p.dext + p.dint) / 2 + (p.stl + p.blk) / 8))],
      ['Rebond', avg(topN(f.map((p) => (p.oreb + p.dreb) / 2), 3))],
    ];
  }
  const cityOf = (t) => t.name.split(' ').slice(0, -1).join(' ');
  const nickOf = (t) => t.name.split(' ').pop();
  const flag = (p) => (MT.COUNTRIES[p.nat] || ['', ''])[1];
  function renderHome() {
    const h = G.home, T = S.team(h.team), O = S.team(h.opp), F = S.FAMILIES.find((f) => f.key === h.fam);
    const tile = (t) => `<button type="button" class="ttile ${t.key === h.team ? 'on' : ''}" data-team="${t.key}" style="--c:${t.color};--ink:${S.ink(t.color)}">
        <span class="badge">${t.abbr}</span><span class="tn"><b>${cityOf(t)}</b><small>${nickOf(t)}</small></span><em>${t.style}</em></button>`;
    const row = (p) => `<li><button type="button" data-prof="${p.num}" title="Voir la fiche de ${p.name}"><i>${p.num}</i><span>${p.name}</span><em>${p.pos}</em><em>${p.age} ans</em><em title="${(MT.COUNTRIES[p.nat] || [''])[0]}">${flag(p)}</em></button></li>`;
    $('#home').innerHTML = `<div class="homepage">
      <header class="hhead">
        <img class="logo" src="assets/logo.png" alt="">
        <h1 class="vh">Money Time</h1>
        <p class="sub">Deux minutes à jouer. À vous de gagner.</p>
        <p class="intro">Prenez place sur le banc d’une équipe à deux minutes de la fin du match. Systèmes, défense, remplacements, temps morts : chaque décision compte, et le chrono ne tourne pas pendant que vous réfléchissez.</p>
      </header>
      <div class="homewrap">
      <div class="hmain">
        <section><h3><b>1</b>Votre équipe</h3><div class="ochips trand"><button type="button" class="ochip rand ${T ? '' : 'on'}" data-team=""><i>?</i>Au hasard</button></div><div class="tgrid">${MT.TEAMS.map(tile).join('')}</div></section>
        <section><h3><b>2</b>Votre adversaire</h3><div class="ochips">
          <button type="button" class="ochip rand ${h.opp ? '' : 'on'}" data-opp=""><i>?</i>Au hasard</button>
          ${MT.TEAMS.filter((t) => t.key !== h.team).map((t) => `<button type="button" class="ochip ${t.key === h.opp ? 'on' : ''}" data-opp="${t.key}" style="--c:${t.color}"><i></i>${t.name}</button>`).join('')}
        </div></section>
        <section><h3><b>3</b>Le lieu du match</h3><div class="ochips">
          <button type="button" class="ochip rand ${h.venue ? '' : 'on'}" data-venue=""><i>?</i>Au hasard</button>
          ${Object.keys(VENUES).map((k) => `<button type="button" class="ochip ${k === h.venue ? 'on' : ''}" data-venue="${k}">${VENUES[k]}</button>`).join('')}
        </div><p class="vnote">À domicile, le public pousse derrière vous ; à l’extérieur, il gêne vos lancers francs et votre maîtrise du ballon.</p></section>
        <section><h3><b>4</b>Le scénario</h3><div class="sgrid">
          <button type="button" class="scard rand ${h.fam ? '' : 'on'}" data-fam=""><b>Au hasard</b><small>Le jeu tire une situation pour vous.</small></button>
          ${S.FAMILIES.map((f) => `<button type="button" class="scard ${f.key === h.fam ? 'on' : ''}" data-fam="${f.key}"><b>${f.title}</b><small>${f.pitch}</small></button>`).join('')}
        </div></section>
      </div>
      <aside class="hside" style="--c:${T ? T.color : '#F2B544'};--ink:${T ? S.ink(T.color) : '#0B1422'}">
        ${T ? `<div class="tdetail">
          <div class="thead"><span class="badge">${T.abbr}</span><div><h2>${T.name}</h2><p>${T.style}</p></div></div>
          <p class="prof">${T.profile}</p>
          <div class="rates">${ratings(T).map((r) => `<div><span>${r[0]}</span><span class="track"><span style="width:${Math.round(Math.max(6, Math.min(100, (r[1] - 3) / 6 * 100)))}%"></span></span></div>`).join('')}</div>
          <h3>Cinq de départ <span>cliquer un joueur pour sa fiche</span></h3><ul class="roster">${T.players.slice(0, 5).map(row).join('')}</ul>
          <h3>Banc</h3><ul class="roster">${T.players.slice(5).map(row).join('')}</ul>
        </div>` : `<div class="tdetail">
          <div class="thead"><span class="badge">?</span><div><h2>Équipe tirée au sort</h2><p>La surprise du chef</p></div></div>
          <p class="prof">Le jeu vous confiera l’une des dix-huit équipes au lancement du défi. Vous découvrirez votre effectif sur le banc : fiches des joueurs et statistiques du match y sont disponibles avant votre première décision.</p>
        </div>`}
        <p class="recap"><b>${T ? T.abbr : 'Une équipe tirée au sort'}</b> contre <b>${O ? O.name : 'un adversaire tiré au sort'}</b> · ${h.venue ? VENUES[h.venue].toLowerCase() : 'lieu tiré au sort'} · ${F ? F.title : 'scénario tiré au sort'}</p>
        <button type="button" id="launch" class="primary">Lancer le défi</button>
      </aside>
      </div>
      <footer class="hfoot">Un jeu de <b>Hiramb23</b>, aidé de Claude · Licence <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.fr" target="_blank" rel="license noopener">CC BY-NC-SA 4.0</a> : partage et adaptation autorisés, sans usage commercial, en citant l’auteur et sous la même licence.
        <nav class="hlinks"><a href="a-propos.html">À propos</a><a href="versions.html">Versions</a><a href="mentions-legales.html">Mentions légales et confidentialité</a><span>Version ${MT.VERSION}</span></nav></footer>
    </div>`;
  }
  $('#home').addEventListener('click', (e) => {
    const h = G.home;
    const pick = (attr) => { const el = e.target.closest('[data-' + attr + ']'); return el ? el.dataset[attr] : null; };
    const team = pick('team'), opp = pick('opp'), fam = pick('fam'), prof = pick('prof'), venue = pick('venue');
    if (prof != null) openProfile(h.team, prof);
    else if (team != null) { h.team = team; if (h.opp === team) h.opp = ''; renderHome(); }
    else if (opp != null) { h.opp = opp; renderHome(); }
    else if (fam != null) { h.fam = fam; renderHome(); }
    else if (venue != null) { h.venue = venue; renderHome(); }
    else if (e.target.closest('#launch')) newChallenge();
  });

  function newChallenge() {
    G.s = S.generate({ team: G.home.team, opp: G.home.opp, fam: G.home.fam, venue: G.home.venue });
    G.start = E.clone(G.s);
    enterMatch();
  }
  function replay() {
    G.s = E.clone(G.start);
    G.s.seed = (Math.random() * 0x7fffffff) | 0;
    enterMatch();
  }
  function enterMatch() {
    const s = G.s;
    G.sel = null; G.busy = false; G.fast = false; G.ev = null;
    $('#feed').innerHTML = '';
    hidePop();
    $('#tokens').innerHTML = '';
    show('match');
    feed({ kind: 'intro', text: `Défi — ${s.challenge.title}. ${s.challenge.desc}` });
    const host = s.teams[s.home];
    feed({ kind: 'crowd', team: s.home, text: s.home === s.user
      ? `Match à domicile : le public de ${E.city(host)} est derrière vous. ${E.crowdLevel(s.crowd)}.`
      : `Match à l’extérieur, dans la salle de ${E.city(host)}. ${E.crowdLevel(s.crowd)} : à vous de la faire taire.` });
    beginDecision();
  }
  /* volets de l'affichage téléphone ; sans effet sur grand écran, où tout est visible */
  function setTab(t) {
    $('#match').dataset.tab = t;
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    if (t === 'feed') { const f = $('#feed'); f.scrollTop = f.scrollHeight; }
  }
  $('#tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); });

  function beginDecision() {
    const s = G.s;
    setTab('panel');
    const evs = MT.ai.intervene(s, 1 - G.user).concat(MT.events.tick(s));
    evs.forEach(feed);
    popBrief(evs);
    const ev = MT.events.roll(s);
    // un événement aléatoire bloque la décision tant que le joueur n'a pas tranché
    if (ev) { G.busy = true; G.ev = ev; setTimeout(() => { if (G.ev === ev && G.s === s) showEvent(ev); }, evs.length ? 2200 : 500); }
    renderAll();
  }

  /* ---------- événement aléatoire : une situation, un choix ---------- */
  function showEvent(ev) {
    hidePop();
    $('#modal').innerHTML = `<div class="sheet evsheet">
      <p class="evtag">Événement</p><h2>${ev.title}</h2><p class="evtext"></p>
      <div class="evchoices">${ev.choices.map((c, i) => `<button type="button" data-ev="${i}" ${c.off ? 'disabled' : ''}><b>${c.label}</b><small>${c.off || c.hint}</small></button>`).join('')}</div>
    </div>`;
    $('#modal .evtext').textContent = ev.text;
    $('#modal').hidden = false;
    feed({ kind: 'event', team: G.user, text: `${ev.title} — ${ev.text}`, snap: E.snap(G.s) });
  }
  function chooseEvent(i) {
    const ev = G.ev;
    G.ev = null; G.busy = false;
    $('#modal').hidden = true;
    const out = MT.events.apply(G.s, ev, i);
    out.forEach(feed);
    popBrief(out);
    renderAll();
  }

  /* ---------- bandeau supérieur ---------- */
  function renderBoard(v) {
    const s = G.s;
    const team = (i) => {
      const T = s.teams[i];
      const dots = [0, 1].map((k) => `<i class="${k < v.to[i] ? 'on' : ''}"></i>`).join('');
      const pen = v.give[i] > 0 ? `${v.give[i]} <span class="lw">faute </span>à donner` : '<b class="pen">en pénalité</b>';
      return `<div class="tm tm${i} ${v.poss === i ? 'ball' : ''}" style="--c:${T.color}">
        <div class="tname"><span class="sw"></span><span class="lw">${T.name}</span><span class="sh">${T.abbr}</span>${i === s.user ? '<em>vous</em>' : ''}<span class="poss">●<span class="lw"> ballon</span></span></div>
        <div class="tmeta"><span class="tos" title="Temps morts restants"><span class="lw">Temps morts</span><span class="sh">TM</span> ${dots}</span><span><span class="lw">Fautes d’équipe</span><span class="sh">Fautes</span> ${v.tf[i]} · ${pen}</span></div>
      </div>`;
    };
    $('#board').innerHTML = `${team(0)}
      <div class="sc">${v.score[0]}</div>
      <div class="mid"><img class="logo" src="assets/logo.png" alt="Money Time"><div class="per"><span class="lw">${v.period > 4 ? 'Prolongation' : '4ᵉ quart-temps'}</span><span class="sh">${v.period > 4 ? 'Prol.' : '4ᵉ QT'}</span></div>
        <div class="clk">${fmtClock(v.clock)}</div>
        <div class="shot" title="Chrono de possession">${v.clock <= 0 ? '—' : Math.ceil(Math.min(v.shot, v.clock))}</div></div>
      <div class="sc">${v.score[1]}</div>${team(1)}${crowdBar(v.crowd)}`;
  }

  /** Jauge du public : elle s'étend du centre vers l'équipe que l'ambiance avantage. */
  function crowdBar(g) {
    const s = G.s, fav = g >= 0 ? s.home : 1 - s.home, w = Math.abs(g) / 2;
    const left = fav === 0 ? 50 - w : 50;
    const host = s.teams[s.home];
    return `<div class="crowd" title="Ambiance de la salle : ${g > 0 ? '+' : ''}${g} (de -100 à +100). Salle chaude : les joueurs de ${E.city(host)} sentent moins la fatigue, les visiteurs sont gênés aux lancers francs et dans la maîtrise du ballon. Salle qui siffle : c’est ${E.city(host)} qui est gênée.">
      <span class="clab"><span class="lw">Public de </span>${E.city(host)}<span class="lw"> (domicile)</span> · <b>${E.crowdLevel(g)}</b></span>
      <span class="cbar"><span class="cfill" style="left:${left}%;width:${w}%;background:${s.teams[fav].color}"></span><i></i></span>
    </div>`;
  }

  /* ---------- panneau de décision ---------- */
  function optGroup(title, key, dict, cur, cols) {
    return `<div class="grp"><h3>${title}</h3><div class="opts c${cols}">${Object.keys(dict).map((k) =>
      `<button type="button" class="opt ${k === cur ? 'on' : ''}" data-k="${key}" data-v="${k}"><b>${dict[k][0]}</b><small>${dict[k][1]}</small></button>`).join('')}</div></div>`;
  }
  function chips(title, key, players, cur) {
    return `<div class="grp"><h3>${title}</h3><div class="chips">${players.map((p) =>
      `<button type="button" class="chip ${p.id === cur ? 'on' : ''}" data-k="${key}" data-v="${p.id}"><i>${p.num}</i>${p.short}</button>`).join('')}</div></div>`;
  }
  function renderPanel() {
    const s = G.s, u = s.user, U = s.teams[u], o = U.orders;
    const att = s.poss === u;
    const mine = E.lineup(s, u), opp = E.lineup(s, 1 - u);
    if (!mine.some((p) => p.id === o.target)) o.target = E.maxBy(mine, E.scorer).id;
    if (!opp.some((p) => p.id === o.dblTarget)) o.dblTarget = E.maxBy(opp, E.scorer).id;
    const shot = Math.ceil(Math.min(s.shot, s.clock));
    let h = `<div class="sit ${att ? 'att' : 'def'}">
      <div class="chal">Défi · ${s.challenge.title}</div>
      <h2>${att ? 'Vous attaquez' : 'Vous défendez'}</h2>
      <p>${s.sit} · ${s.ball === 'dead' ? 'arrêt de jeu' : 'ballon en jeu'} · ${shot} s pour tirer</p>
    </div>`;
    if (att) {
      h += optGroup('Système', 'play', L.play, o.play, 2);
      h += chips({ shooter: 'Tireur à libérer', post: 'Intérieur à servir', motion: 'Première option' }[o.play] || 'Joueur recherché', 'target', mine, o.target);
      h += optGroup('Tempo', 'tempo', L.tempo, o.tempo, 3);
      h += `<p class="standing">Défense en place pour la suite : ${L.scheme[o.scheme][0]} · ${L.endgame[o.endgame][0]}</p>`;
    } else {
      h += optGroup('Défense', 'scheme', L.scheme, o.scheme, 2);
      if (o.scheme === 'double') h += chips('Joueur pris à deux', 'dblTarget', opp, o.dblTarget);
      if (o.scheme === 'press') h += `<p class="note ${E.pressApplies(s) ? 'ok' : ''}">${E.pressApplies(s)
        ? 'L’adversaire relance depuis l’arrière : le pressing s’applique dès cette possession.'
        : 'L’adversaire est déjà installé près de votre panier : défense individuelle sur cette possession, le pressing s’appliquera à la prochaine relance.'}</p>`;
      h += optGroup('Fin de possession', 'endgame', L.endgame, o.endgame, 2);
      h += `<p class="standing">Attaque en place pour la suite : ${L.play[o.play][0]} · ${L.tempo[o.tempo][0]}</p>`;
    }
    h += `<div class="grp"><h3>Cinq adverse <span>cliquer pour la fiche</span></h3><div class="oppfive">${opp.map((p) =>
      `<button type="button" class="oppp" data-info="${p.id}"><i style="background:${s.teams[1 - u].color};color:${s.teams[1 - u].ink}">${p.num}</i><span>${p.short}</span><em>${p.pos}</em>
        ${fatBar(p)}<em>${p.fouls} f.</em></button>`).join('')}</div></div>`;
    h += `<button type="button" id="go" class="primary" ${G.busy ? 'disabled' : ''}>${G.busy ? 'Séquence en cours…' : 'Jouer la séquence'}</button>`;
    $('#panel').innerHTML = h;
    $('#panel').classList.toggle('busy', G.busy);
  }
  $('#panel').addEventListener('click', (e) => {
    const info = e.target.closest('[data-info]');
    if (info) { openSheet(info.dataset.info); return; }
    if (G.busy) return;
    const b = e.target.closest('[data-k]');
    if (b) { G.s.teams[G.s.user].orders[b.dataset.k] = b.dataset.v; renderPanel(); layoutStatic(); return; }
    if (e.target.closest('#go')) runSequence();
  });

  /* ---------- bandeau inférieur : cinq, banc, temps mort ---------- */
  function card(p, on) {
    const out = p.fouls >= 6;
    return `<div class="card ${on ? 'on' : 'bn'} ${G.sel === p.id ? 'sel' : ''} ${out ? 'out' : ''}" data-pid="${p.id}" role="button" tabindex="0">
      <div class="ctop"><span class="num">${p.num}</span><span class="nm">${p.short}</span>
        <button type="button" class="info" data-info="${p.id}" title="Fiche détaillée">i</button></div>
      <div class="fl"><span>${p.pos}${p.pos2 !== p.pos ? '/' + p.pos2 : ''}</span><span class="${p.fouls >= 5 ? 'warn' : ''}">${out ? 'Exclu' : 'Fautes ' + p.fouls}</span></div>
      <div class="fatrow" title="${fatTip(p)}">${fatBar(p)}<span class="${E.felt(p) < p.fatigue - 0.5 ? 'lifted' : ''}">${Math.round(E.felt(p))} %</span></div>
      <div class="traits">${traits(p)}</div>
    </div>`;
  }
  function renderBench() {
    const s = G.s, u = s.user;
    const cs = E.canSub(s), ct = E.canTimeout(s, u);
    const subMsg = cs.ok
      ? G.sel ? 'Choisissez maintenant le joueur à échanger.' : 'Remplacement autorisé : cliquez un joueur du cinq, puis son remplaçant.'
      : cs.why;
    $('#bench').innerHTML = `
      <div class="bcol five"><h3>Sur le terrain</h3><div class="cards">${E.lineup(s, u).map((p) => card(p, true)).join('')}</div></div>
      <div class="bcol"><h3>Banc</h3><div class="cards">${E.bench(s, u).map((p) => card(p, false)).join('')}</div></div>
      <div class="bcol tocol"><h3>Interventions</h3>
        <button type="button" id="timeout" ${ct.ok && !G.busy ? '' : 'disabled'}>Temps mort <span>${s.teams[u].timeouts} restant${s.teams[u].timeouts > 1 ? 's' : ''}</span></button>
        <p class="why ${ct.ok ? '' : 'no'}">${ct.ok ? 'Arrête le jeu, permet de remplacer, récupération partielle.' : ct.why}</p>
        <p class="why ${cs.ok ? 'yes' : 'no'}">${subMsg}</p>
        <button type="button" id="statsBtn" ${G.busy ? 'disabled' : ''}>Statistiques du match</button>
      </div>`;
  }
  $('#bench').addEventListener('click', (e) => {
    const info = e.target.closest('[data-info]');
    if (info) { openSheet(info.dataset.info); return; }
    if (G.busy) return;
    const s = G.s, u = s.user;
    if (e.target.closest('#statsBtn')) { openStats(); return; }
    if (e.target.closest('#timeout')) {
      if (!E.canTimeout(s, u).ok) return;
      const evs = [E.callTimeout(s, u)].concat(MT.ai.onTimeout(s, 1 - u));
      evs.forEach(feed);
      popBrief(evs);
      renderAll();
      return;
    }
    const c = e.target.closest('[data-pid]');
    if (!c) return;
    const cs = E.canSub(s);
    if (!cs.ok) { toast(cs.why); return; }
    const id = c.dataset.pid, T = s.teams[u];
    const on = (x) => T.onCourt.includes(x);
    if (!G.sel || G.sel === id || on(G.sel) === on(id)) {
      G.sel = G.sel === id ? null : id;
      if (G.sel && !on(G.sel)) { const ce = E.canEnter(E.getP(s, G.sel)); if (!ce.ok) { toast(ce.why); G.sel = null; } }
      renderBench();
      return;
    }
    const outId = on(id) ? id : G.sel, inId = on(id) ? G.sel : id;
    const pin = E.getP(s, inId), pout = E.getP(s, outId);
    const ce = E.canEnter(pin);
    if (!ce.ok) { toast(ce.why); return; }
    E.substitute(s, u, outId, inId);
    G.sel = null;
    const sub = { kind: 'sub', team: u, text: `Changement ${T.name} : ${pin.short} entre à la place de ${pout.short}.` };
    feed(sub);
    popBrief([sub]);
    renderAll();
  });

  /* ---------- commentaire ---------- */
  function feed(e) {
    if (!e.text) return;
    const li = document.createElement('li');
    li.className = 'k-' + e.kind;
    if (e.team != null && G.s) li.style.setProperty('--c', G.s.teams[e.team].color);
    if (e.snap && !['read', 'intro'].includes(e.kind)) {
      const t = document.createElement('time');
      t.textContent = fmtClock(e.snap.clock);
      li.appendChild(t);
    }
    li.appendChild(document.createTextNode(e.text));
    const f = $('#feed');
    f.appendChild(li);
    while (f.children.length > 60) f.removeChild(f.firstChild);
    f.scrollTop = f.scrollHeight;
  }

  /* ---------- pop central : l'événement au moment où il se produit ---------- */
  const POP_TAG = {
    setup: 'Mise en place', action: 'Action', made: 'Panier', miss: 'Manqué', ft: 'Lancer franc', foul: 'Faute', steal: 'Interception',
    to: 'Balle perdue', oreb: 'Rebond offensif', dreb: 'Rebond', sub: 'Changement', timeout: 'Temps mort', hold: 'Fin de match',
    buzz: 'Buzzer', event: 'Événement', crowd: 'Public', period: 'Prolongation', end: 'Coup de sifflet final',
  };
  const readMs = (t) => Math.min(3400, 750 + t.length * 27);
  let popT;
  function pop(kind, text, team, big) {
    const el = $('#pop');
    clearTimeout(popT);
    el.className = 'k-' + kind + (big ? ' big' : '');
    el.style.setProperty('--c', team != null && G.s ? G.s.teams[team].color : '#F2B544');
    el.innerHTML = `<span class="ptag">${POP_TAG[kind] || ''}</span><p></p>`;
    el.querySelector('p').textContent = text;
    el.hidden = false;
    el.style.animation = 'none'; void el.getBoundingClientRect(); el.style.animation = '';
  }
  function hidePop() { clearTimeout(popT); $('#pop').hidden = true; }
  /** Événements hors séquence (temps mort, changement) : pop bref qui s'efface seul. */
  function popBrief(evs) {
    evs = evs.filter((e) => e && e.text);
    if (!evs.length) return;
    const text = evs.map((e) => e.text).join(' ');
    pop(evs[0].kind, text, evs[0].team);
    popT = setTimeout(hidePop, readMs(text) + 400);
  }

  /* ---------- terrain ---------- */
  function place(id, xy, instant) {
    G.pos[id] = xy;
    const el = document.getElementById('tok-' + id);
    if (!el) return;
    if (instant) { el.style.transition = 'none'; el.style.transform = `translate(${xy[0]}px,${xy[1]}px)`; void el.getBoundingClientRect(); el.style.transition = ''; }
    else el.style.transform = `translate(${xy[0]}px,${xy[1]}px)`;
    if (G.holder === id) ballTo([xy[0] + 11, xy[1] + 11]);
  }
  function ballTo(xy) { $('#ball').style.transform = `translate(${xy[0]}px,${xy[1]}px)`; }
  /** Ballon perdu en touche : il file vers la ligne de côté la plus proche. */
  function ballOut() {
    const xy = (G.holder && G.pos[G.holder]) || [250, 300];
    G.holder = null;
    document.querySelectorAll('.tok.has').forEach((x) => x.classList.remove('has'));
    ballTo([xy[0] < 250 ? 4 : 496, Math.min(390, xy[1] + 20)]);
  }
  function hold(id) {
    G.holder = id;
    document.querySelectorAll('.tok.has').forEach((x) => x.classList.remove('has'));
    const el = document.getElementById('tok-' + id);
    if (el) el.classList.add('has');
    if (G.pos[id]) ballTo([G.pos[id][0] + 11, G.pos[id][1] + 11]);
  }
  function syncTokens(offTeam) {
    const s = G.s, g = $('#tokens');
    if (offTeam == null) offTeam = s.poss;
    const ids = s.teams[0].onCourt.concat(s.teams[1].onCourt);
    Array.from(g.children).forEach((el) => { if (!ids.includes(el.dataset.id)) el.remove(); });
    ids.forEach((id) => {
      if (document.getElementById('tok-' + id)) return;
      const p = E.getP(s, id), T = s.teams[E.teamOf(s, id)];
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      el.setAttribute('class', 'tok'); el.id = 'tok-' + id; el.dataset.id = id;
      el.innerHTML = `<title>${p.name}</title><circle class="hit" r="23"/><circle r="14.5" fill="${T.color}"/><text y="4.5" style="fill:${T.ink}">${p.num}</text>`;
      g.appendChild(el);
      place(id, G.pos[id] || [250, 380], true);
    });
    document.querySelectorAll('.tok').forEach((el) => el.classList.toggle('defn', E.teamOf(s, el.dataset.id) !== offTeam));
  }
  function computeLayout(pv, play, scheme, dbl, dblBy) {
    const pos = {};
    if (play && pv.roles) {
      const r = pv.roles, m = PLAY_SPOTS[play];
      pos[r.H] = SP[m.H]; pos[r.R] = SP[m.R]; pos[r.K] = SP[m.K];
      if (r.S) pos[r.S] = SP[m.S];
      r.o.forEach((id, i) => (pos[id] = SP[m.o[i]]));
    } else ['top', 'rwing', 'lwing', 'rcorner', 'lblock'].forEach((k, i) => (pos[pv.order[i]] = SP[k]));
    return defendLayout(pos, pv.mu, pv.order, scheme, dbl, dblBy);
  }
  /** Place les défenseurs d'après les attaquants déjà placés dans pos (mu : attaquant → défenseur). */
  function defendLayout(pos, mu, order, scheme, dbl, dblBy) {
    const k = scheme === 'paint' ? 0.4 : scheme === 'perimeter' ? 0.13 : scheme === 'press' ? 0.09 : 0.24;
    if (scheme === 'zone' && order) {
      // zone 2-3 : deux joueurs en tête de raquette, trois près du cercle
      const spots = [[196, 218], [304, 218], [142, 112], [358, 112], [250, 96]];
      order.forEach((oid, i) => { if (mu[oid]) pos[mu[oid]] = spots[i]; });
      return pos;
    }
    Object.keys(mu).forEach((oid) => {
      const a = pos[oid];
      if (!a) return;
      const dx = HOOP[0] - a[0], dy = HOOP[1] - a[1], dist = Math.hypot(dx, dy) || 1;
      const d = Math.max(25, dist * k);
      pos[mu[oid]] = [a[0] + dx / dist * d, a[1] + dy / dist * d];
    });
    if (dbl && dblBy && pos[dbl]) pos[dblBy] = [pos[dbl][0] + (pos[dbl][0] < 250 ? 24 : -24), pos[dbl][1] - 16];
    return pos;
  }
  function applyLayout(pos, instant) { Object.keys(pos).forEach((id) => place(id, pos[id], instant)); }
  function layoutStatic() {
    const s = G.s, u = s.user, o = s.teams[u].orders, att = s.poss === u;
    syncTokens();
    let pos, holder;
    if (att) {
      const pv = E.preview(s, o.play, o.target);
      pos = computeLayout(pv, o.play, null);
      holder = pv.roles.H;
      G.mu = pv.mu;
    } else {
      const pv = E.preview(s, null);
      let dblBy = null;
      if (o.scheme === 'double') { const other = pv.order.filter((id) => id !== o.dblTarget).pop(); dblBy = pv.mu[other]; }
      const sch = o.scheme === 'press' && !E.pressApplies(s) ? null : o.scheme;
      pos = computeLayout(pv, null, sch, o.scheme === 'double' ? o.dblTarget : null, dblBy);
      holder = pv.order[0];
      G.mu = pv.mu;
    }
    // remise en jeu : un joueur hors du système tient le ballon derrière la ligne de touche
    if (s.ball === 'dead' && !/panier|lancers|prolongation/.test(s.sit)) {
      const pv = E.preview(s, att ? o.play : null, att ? o.target : null);
      const inb = pv.roles ? pv.roles.o[pv.roles.o.length - 1] : pv.order[pv.order.length - 1];
      const left = pos[inb][0] < 250;
      pos[inb] = [left ? 15 : 485, 300];
      if (pv.mu[inb]) pos[pv.mu[inb]] = [left ? 52 : 448, 286];
      holder = inb;
    }
    applyLayout(pos, false);
    hold(holder);
  }
  $('#court').addEventListener('click', (e) => { const t = e.target.closest('.tok'); if (t) openSheet(t.dataset.id); });
  $('#fastBtn').addEventListener('click', () => { G.fast = true; });

  /* ---------- placements des phases arrêtées et des rebonds ---------- */
  /** Joueurs affichés sur le terrain pour l'équipe t (l'état du moteur est déjà celui de fin de séquence). */
  const shown = (t) => Array.from(document.querySelectorAll('.tok')).map((el) => el.dataset.id)
    .filter((id) => E.teamOf(G.s, id) === t).map((id) => E.getP(G.s, id));
  const rebO = (p) => p.oreb * 2 + p.h / 20, rebD = (p) => p.dreb * 2 + p.h / 20;
  // emplacements le long de la raquette : les plus proches du panier à la défense, puis l'attaque, puis la défense
  const LANE_D = [[153, 80], [347, 80], [153, 152]], LANE_O = [[153, 116], [347, 116]];
  const FT_OUT_O = [[104, 304], [396, 304], [250, 372]], FT_OUT_D = [[196, 326], [304, 326], [250, 372]];
  /** Lancers francs : le tireur sur la ligne, deux attaquants et trois défenseurs le long de la raquette, les autres derrière l'arc. */
  function ftLayout(shooterId) {
    const t = E.teamOf(G.s, shooterId), pos = { [shooterId]: SP.ft };
    shown(t).filter((p) => p.id !== shooterId).sort((a, b) => rebO(b) - rebO(a))
      .forEach((p, i) => (pos[p.id] = i < 2 ? LANE_O[i] : FT_OUT_O[i - 2]));
    shown(1 - t).sort((a, b) => rebD(b) - rebD(a))
      .forEach((p, i) => (pos[p.id] = i < 3 ? LANE_D[i] : FT_OUT_D[i - 3]));
    return pos;
  }
  /** Rebond : les meilleurs rebondeurs se jettent sous le cercle, les défenseurs devant, les attaquants dans leur dos. */
  function crashLayout(rebId, ballXY) {
    const off = G.off == null ? E.teamOf(G.s, rebId) : G.off, pos = {};
    const spotsD = [[206, 98], [294, 98], [250, 132]], spotsO = [[192, 134], [308, 134]];
    const pickBest = (t, f, n) => shown(t).filter((p) => p.id !== rebId).sort((a, b) => f(b) - f(a)).slice(0, n);
    pickBest(1 - off, rebD, 3).forEach((p, i) => (pos[p.id] = spotsD[i]));
    pickBest(off, rebO, 2).forEach((p, i) => (pos[p.id] = spotsO[i]));
    pos[rebId] = ballXY;
    // personne ne se superpose au rebondeur
    Object.keys(pos).forEach((id) => {
      if (id === rebId) return;
      const a = pos[id], dx = a[0] - ballXY[0], dy = a[1] - ballXY[1], d = Math.hypot(dx, dy);
      if (d < 30) pos[id] = d < 1 ? [a[0] + 30, a[1]] : [ballXY[0] + dx / d * 32, ballXY[1] + dy / d * 32];
    });
    return pos;
  }
  /** Défenseur le plus proche du point visé, hormis celui du porteur : il vient aider. */
  function helper(id, to) {
    const own = G.mu[id], off = E.teamOf(G.s, id);
    let best = null, bd = Infinity;
    shown(1 - off).forEach((p) => {
      if (p.id === own || !G.pos[p.id]) return;
      const d = Math.hypot(G.pos[p.id][0] - to[0], G.pos[p.id][1] - to[1]);
      if (d < bd) { bd = d; best = p.id; }
    });
    return best;
  }

  /* ---------- déroulé des systèmes : deux ou trois temps avant le tir ---------- */
  const ARC = 237.5;
  /** Ramène un tireur à trois points derrière l'arc (les coins sont dans le prolongement de la ligne droite). */
  function outArc(xy) {
    if (xy[1] <= 140) return xy[0] <= 36 || xy[0] >= 464 ? xy : [xy[0] < 250 ? 26 : 474, xy[1]];
    const dx = xy[0] - HOOP[0], dy = xy[1] - HOOP[1], d = Math.hypot(dx, dy) || 1;
    if (d >= ARC + 12) return xy;
    return [HOOP[0] + dx / d * (ARC + 20), Math.min(390, HOOP[1] + dy / d * (ARC + 20))];
  }
  /** Un temps du système : les attaquants bougent, chaque défenseur suit le sien selon la défense choisie. */
  async function beat(moves, ms, after) {
    const L = G.lay, off = {};
    shown(G.off).forEach((p) => { if (G.pos[p.id]) off[p.id] = G.pos[p.id]; });
    Object.assign(off, moves);
    applyLayout(defendLayout(off, L.mu, L.order, L.scheme, L.dbl, L.dblBy), false);
    if (after) after();
    await sleep(ms);
  }
  /** Déroulé du système annoncé, jusqu'à l'option retenue par le moteur (st.id tire, servi par st.from). */
  async function runPlay(st) {
    const L = G.lay;
    if (!L || !L.roles) return;
    const r = L.roles, H = r.H, me = st.id, three = st.type === 'three', B = [];
    const help = (id, at, to) => () => { const h = helper(id, at); if (h) place(h, to); };
    if (L.play === 'pnr') {
      B.push([{ [r.R]: [272, 316] }, 450]); // l'écran est posé sur le porteur
      B.push([{ [H]: me === H && three ? [348, 302] : [326, 262], [r.R]: me === r.R || !three ? [262, 150] : [300, 326] }, 520]); // le porteur passe l'écran, l'intérieur plonge
    } else if (L.play === 'iso') {
      B.push([{ [r.R]: [92, 132] }, 420]); // l'intérieur libère le côté
      B.push([{ [H]: me === H && three ? [236, 354] : [274, 318] }, 420]); // premier appui du porteur
    } else if (L.play === 'drive') {
      B.push([{ [H]: [150, 206], [r.R]: [292, 104] }, 520, help(H, [150, 206], [178, 176])]); // pénétration, l'aide se resserre
    } else if (L.play === 'shooter' && r.S) {
      B.push([{ [r.S]: [150, 94], [r.R]: [176, 150] }, 450]); // le tireur descend vers la ligne de fond, l'écran se prépare
      B.push([{ [r.S]: me === r.S && st.type === 'mid' ? [166, 198] : [98, 268], [r.R]: me === r.R ? [226, 128] : [180, 162] }, 520]); // il ressort de l'écran
    } else if (L.play === 'post' && r.S) {
      B.push([{ [r.S]: [206, 112], [H]: [112, 238] }, 420]); // l'intérieur prend position dos au panier
      B.push([{}, 380, () => hold(r.S)]); // entrée de balle
      if (me !== r.S) B.push([me === r.R ? { [r.R]: [262, 124] } : {}, 420, help(r.S, [206, 112], [226, 132])]); // l'aide arrive, le ballon ressort
    } else if (L.play === 'motion') {
      const [o1, o2] = r.o;
      if (o2) B.push([{ [H]: [250, 140] }, 450, () => hold(o2)]); // passe sur l'aile, le passeur coupe dans la raquette
      B.push([Object.assign({ [H]: [40, 92] }, o1 ? { [o1]: [250, 338] } : {}), 500, () => o1 && hold(o1)]); // il ressort dans le coin, renversement
    }
    for (const [m, ms, after] of st.prelude ? B.slice(0, 1) : B) await beat(m, ms, after);
    if (st.prelude || !me) return;
    if (three && G.pos[me]) { const o = outArc(G.pos[me]); if (o !== G.pos[me]) await beat({ [me]: o }, 320); }
    // le ballon rejoint le passeur avant la passe décisive
    if (st.from && G.holder !== me && G.holder !== st.from) { hold(st.from); await sleep(380); }
  }

  async function animStep(st) {
    const near = (xy) => [xy[0] + (HOOP[0] - xy[0]) * 0.22, xy[1] + (HOOP[1] - xy[1]) * 0.22];
    if (st.a !== 'ft') G.ftFor = null;
    if (st.a === 'play') { await runPlay(st); return; }
    if (st.a === 'setup') {
      G.off = E.teamOf(G.s, st.roles.H);
      syncTokens(G.off);
      G.lay = { play: st.play, roles: st.roles, mu: st.mu, order: st.order, scheme: st.scheme, dbl: st.dbl, dblBy: st.dblBy };
      G.mu = st.mu;
      const pv = { roles: st.roles, mu: st.mu, order: st.order };
      applyLayout(computeLayout(pv, st.play, st.scheme, st.dbl, st.dblBy), false);
      hold(st.roles.H);
      await sleep(750);
    } else if (st.a === 'pass') { hold(st.to); await sleep(420); }
    else if (st.a === 'go') {
      const cur = G.pos[st.id] || SP.top, left = cur[0] < 250;
      let to = null;
      if (st.where === 'rim') to = [left ? 228 : 272, 92];
      else if (st.where === 'mid') to = left ? [178, 176] : [322, 176];
      if (to) {
        place(st.id, to);
        const d = G.mu[st.id];
        if (d) place(d, [to[0] + (left ? 14 : -14), to[1] - 22]);
        // pénétration jusqu'au cercle : un défenseur voisin vient fermer la route
        if (st.where === 'rim') { const h = helper(st.id, to); if (h) place(h, [to[0] + (left ? 34 : -34), to[1] + 8]); }
        await sleep(520);
      }
    } else if (st.a === 'shot') {
      G.holder = null;
      document.querySelectorAll('.tok.has').forEach((x) => x.classList.remove('has'));
      ballTo(HOOP);
      await sleep(520);
      if (st.made) { const h = $('#hoop'); h.classList.remove('swish'); void h.getBoundingClientRect(); h.classList.add('swish'); }
      else { ballTo([HOOP[0] + (Math.random() < 0.5 ? -34 : 34), 96]); await sleep(260); }
    } else if (st.a === 'reb') {
      const cur = G.pos[st.id] || [250, 140];
      applyLayout(crashLayout(st.id, [clampX(cur[0] * 0.3 + 250 * 0.7), 104]), false);
      hold(st.id);
      await sleep(520);
    } else if (st.a === 'steal') { hold(st.id); await sleep(430); }
    else if (st.a === 'ft') {
      // premier lancer : tout le monde prend sa place ; les suivants partent de là
      const first = G.ftFor !== st.id;
      if (first) { applyLayout(ftLayout(st.id), false); G.ftFor = st.id; }
      hold(st.id);
      await sleep(first ? 700 : 380);
      G.holder = null; ballTo(HOOP);
      await sleep(480);
      if (st.made) { const h = $('#hoop'); h.classList.remove('swish'); void h.getBoundingClientRect(); h.classList.add('swish'); }
    } else if (st.a === 'swap') {
      if (G.pos[st.out]) G.pos[st.in] = near(G.pos[st.out]);
      syncTokens(G.off);
      await sleep(300);
    }
  }
  const clampX = (x) => Math.max(200, Math.min(300, x));

  async function runSequence() {
    if (G.busy) return;
    const s = G.s;
    G.busy = true; G.fast = false; G.sel = null;
    hidePop();
    renderPanel(); renderBench();
    $('#fastBtn').hidden = false;
    setTab('feed');
    const evs = MT.step(s);
    for (const e of evs) {
      if (e.kind === 'read') { feed(e); renderBoard(e.snap); continue; }
      const cut = e.text.lastIndexOf(' : ');
      if (['made', 'miss', 'ft'].includes(e.kind) && cut > 0) {
        // l'action d'abord, le verdict une fois le ballon arrivé
        const pre = e.text.slice(0, cut), res = e.text.slice(cut + 3);
        pop(e.kind === 'ft' ? 'ft' : 'action', pre, e.team);
        // le déroulé du système occupe déjà le temps de lecture
        await sleep(readMs(pre) * (e.anim[0] && e.anim[0].a === 'play' ? 0.2 : 0.55));
        for (const st of e.anim) await animStep(st);
        feed(e);
        renderBoard(e.snap);
        pop(e.kind === 'ft' ? (e.pts ? 'made' : 'miss') : e.kind, res, e.team, true);
        await sleep(readMs(res) + 350);
      } else {
        feed(e);
        pop(e.kind, e.text, e.team);
        for (const st of e.anim) await animStep(st);
        if (e.kind === 'to' && /touche|sortie de balle/.test(e.text)) ballOut();
        renderBoard(e.snap);
        await sleep(readMs(e.text) * (e.kind === 'setup' ? 0.6 : 1));
      }
    }
    hidePop();
    $('#fastBtn').hidden = true;
    G.busy = false;
    if (s.over) { await new Promise((r) => setTimeout(r, 900)); renderResult(); }
    else beginDecision();
  }

  function renderAll() {
    renderBoard(E.snap(G.s));
    renderPanel();
    renderBench();
    layoutStatic();
  }

  /* ---------- fiche détaillée ---------- */
  /** live : état du joueur en match ; absent depuis l'accueil, où seules les valeurs habituelles existent. */
  function sheet(p, T, live) {
    const groups = {};
    MT.ATTRS.forEach((a) => (groups[a.group] = groups[a.group] || []).push(a));
    const rows = (as) => as.map((a) => {
      const b = p[a.k], e = live ? eff(p, a.k) : b, drop = b - e >= 0.15;
      return `<div class="row"><span class="lab">${a.label}</span>
        <span class="track"><span class="base" style="width:${b * 10}%"></span><span class="eff" style="width:${e * 10}%"></span></span>
        <span class="val">${drop ? `<s>${b}</s> ${e.toFixed(1)}` : b}</span></div>`;
    }).join('');
    const state = live
      ? `<span class="pill ${fatClass(E.felt(p))}">${E.felt(p) < p.fatigue - 0.5 ? `Fatigue ${Math.round(p.fatigue)} % · ressentie ${Math.round(E.felt(p))} % grâce au public` : `Fatigue ${Math.round(p.fatigue)} %`}</span>
            <span class="pill ${p.fouls >= 5 ? 'hi' : ''}">${p.fouls} faute${p.fouls > 1 ? 's' : ''} sur 6</span>
            <span class="pill">${p.fouls >= 6 ? 'Exclu' : live.on ? 'Sur le terrain' : 'Sur le banc'}</span>${formPill(p)}`
      : `<span class="pill">${T.players.indexOf(p) < 5 ? 'Titulaire' : 'Remplaçant'}</span>`;
    $('#modal').innerHTML = `<div class="sheet" style="--c:${T.color}">
      <button type="button" class="close" aria-label="Fermer">×</button>
      <div class="shead"><span class="bignum">${p.num}</span>
        <div><h2>${p.name}</h2>
          <p>${T.name} · ${MT.POS[p.pos]}${p.pos2 !== p.pos ? ' / ' + MT.POS[p.pos2] : ''} · ${p.h} cm · ${p.w} kg</p>
          <p>${p.age} ans · ${flag(p)} ${(MT.COUNTRIES[p.nat] || [''])[0]}</p>
          <p class="state">${state}</p></div></div>
      <p class="legend">${live
        ? `<span class="lg base"></span>valeur habituelle <span class="lg eff"></span>valeur effective avec la fatigue ${p.lift ? 'ressentie (le public en efface une partie)' : 'actuelle'}`
        : '<span class="lg eff"></span>valeurs habituelles, notées de 1 à 10 — en match, la fatigue les fait baisser'}</p>
      <div class="cols">${Object.keys(groups).map((g) => `<div class="g"><h3>${g}</h3>${rows(groups[g])}</div>`).join('')}</div>
    </div>`;
    $('#modal').hidden = false;
  }
  /* ---------- statistiques du match ---------- */
  const FORM = { 1: ['ok', '▲ En forme'], '-1': ['hi', '▼ En difficulté'] };
  const formPill = (p) => { const f = FORM[E.formState(p)]; return f ? `<span class="pill ${f[0]}">${f[1]}</span>` : ''; };
  function openStats() {
    const s = G.s;
    const pct = (m, a) => (a ? Math.round(m / a * 100) + ' %' : '—');
    const cells = (x, f) => `<td>${Math.floor(x.sec / 60)}</td><td class="pts">${x.pts}</td><td>${x.fgm}/${x.fga}</td><td class="dim">${pct(x.fgm, x.fga)}</td>
      <td>${x.tpm}/${x.tpa}</td><td>${x.ftm}/${x.fta}</td><td>${x.oreb + x.dreb}</td><td>${x.ast}</td><td>${x.stl}</td><td>${x.blk}</td><td>${x.to}</td><td>${f}</td>`;
    const table = (T, ti) => {
      const order = T.players.slice().sort((a, b) => T.onCourt.includes(b.id) - T.onCourt.includes(a.id) || b.st.sec - a.st.sec);
      const tot = E.newStats();
      T.players.forEach((p) => Object.keys(tot).forEach((k) => (tot[k] += p.st[k])));
      tot.sec = 0;
      const row = (p) => {
        const f = FORM[E.formState(p)];
        return `<tr class="${T.onCourt.includes(p.id) ? 'on' : ''}"><td class="n">${p.num}</td>
          <th><button type="button" data-info="${p.id}">${p.short}</button> <small>${p.pos}</small></th>
          <td class="form">${f ? `<span class="${f[0]}">${f[1]}</span>` : '<span class="dim">—</span>'}</td>${cells(p.st, p.fouls)}</tr>`;
      };
      return `<h3 style="--c:${T.color}"><i></i>${T.name}${ti === s.user ? ' <em>vous</em>' : ''}<b>${s.score[ti]}</b></h3>
        <div class="tscroll"><table class="stats"><thead><tr><th></th><th>Joueur</th><th>Forme</th><th title="Minutes jouées">MIN</th><th title="Points">PTS</th><th title="Tirs réussis / tentés">Tirs</th><th>%</th>
          <th title="Tirs à trois points réussis / tentés">3 pts</th><th title="Lancers francs réussis / tentés">LF</th><th title="Rebonds">REB</th><th title="Passes décisives">PD</th>
          <th title="Interceptions">INT</th><th title="Contres">CTR</th><th title="Balles perdues">BP</th><th title="Fautes personnelles">F</th></tr></thead>
          <tbody>${order.map(row).join('')}
          <tr class="tot"><td></td><th>Équipe</th><td></td>${cells(tot, T.players.reduce((a, p) => a + p.fouls, 0)).replace('<td>0</td>', '<td></td>')}</tr></tbody></table></div>`;
    };
    const v = s.over ? 'Match terminé' : `${s.period > 4 ? 'Prolongation' : '4ᵉ quart-temps'} · ${fmtClock(s.clock)} à jouer`;
    $('#modal').innerHTML = `<div class="sheet statsheet">
      <button type="button" class="close" aria-label="Fermer">×</button>
      <h2>Statistiques du match</h2><p class="when">${v} — depuis le coup d’envoi</p>
      ${[s.user, 1 - s.user].map((ti) => table(s.teams[ti], ti)).join('')}
      <p class="legend">Lignes éclairées : joueurs sur le terrain. La forme du soir pèse légèrement sur la réussite au tir et évolue au fil des tirs réussis ou manqués. Cliquer un nom ouvre la fiche du joueur.</p>
    </div>`;
    $('#modal').hidden = false;
  }

  function openSheet(id) {
    const s = G.s, T = s.teams[E.teamOf(s, id)];
    sheet(E.getP(s, id), T, { on: T.onCourt.includes(id) });
  }
  function openProfile(teamKey, num) {
    const T = S.team(teamKey), p = T && T.players.find((x) => String(x.num) === String(num));
    if (p) sheet(p, T, null);
  }
  $('#modal').addEventListener('click', (e) => {
    if (G.ev) { const c = e.target.closest('[data-ev]'); if (c && !c.disabled) chooseEvent(+c.dataset.ev); return; }
    const i = e.target.closest('[data-info]'); if (i) { openSheet(i.dataset.info); return; }
    if (e.target.id === 'modal' || e.target.closest('.close')) $('#modal').hidden = true; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !G.ev) $('#modal').hidden = true; });

  /* ---------- écran de résultat ---------- */
  function renderResult() {
    hidePop();
    const s = G.s, u = s.user, won = s.winner === u;
    const ms = E.moments(s);
    $('#result').innerHTML = `<div class="res ${won ? 'won' : 'lost'}">
      <img class="logo" src="assets/logo.png" alt="Money Time">
      <p class="chal">Défi · ${s.challenge.title}${s.period > 4 ? ' · après prolongation' : ''}</p>
      <h1>${won ? 'Défi réussi' : 'Défi manqué'}</h1>
      <div class="final">
        <span style="--c:${s.teams[0].color}"><i></i>${s.teams[0].name}</span><b>${s.score[0]}</b><em>–</em><b>${s.score[1]}</b>
        <span style="--c:${s.teams[1].color}">${s.teams[1].name}<i></i></span>
      </div>
      <h3>Trois moments décisifs</h3>
      <ol class="moments">${ms.map((m) => `<li class="${m.delta > 0 ? 'up' : m.delta < 0 ? 'down' : ''}">
        <div class="when"><b>${m.period > 4 ? 'Prol. ' : ''}${fmtClock(m.clock)}</b><span>${s.teams[0].abbr} ${m.score[0]} – ${m.score[1]} ${s.teams[1].abbr}</span></div>
        <div><p>${m.text}</p><small>${m.order}</small></div></li>`).join('')}</ol>
      <div class="acts">
        <button type="button" class="primary" data-act="replay">Rejouer cette situation</button>
        <button type="button" data-act="new">Nouveau défi</button>
        <button type="button" data-act="stats">Statistiques du match</button>
        <button type="button" data-act="home">Retour à l’accueil</button>
      </div></div>`;
    show('result');
  }
  $('#result').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'stats') openStats();
    else if (b.dataset.act === 'replay') replay();
    else if (b.dataset.act === 'new') newChallenge();
    else { renderHome(); show('home'); }
  });

  renderHome();
  MT.G = G;
})();
