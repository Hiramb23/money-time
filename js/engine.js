/* Money Time — moteur : état du match, règles, résolution d'une séquence.
   Aucun accès au DOM : ce fichier tourne aussi sous Node pour les simulations. */
(function (root) {
  'use strict';
  const MT = (root.MT = root.MT || {});
  const E = (MT.engine = {});
  const FAT = MT.FAT, POSR = MT.POSR, L = MT.L;

  /* ---------- utilitaires ---------- */
  function rnd(s) {
    s.seed = (s.seed + 0x6d2b79f5) | 0;
    let t = s.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const r1 = (x) => Math.round(x * 10) / 10;
  const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
  const pick = (s, a) => a[Math.floor(rnd(s) * a.length)];
  function wpick(s, items, wf) {
    const ws = items.map(wf);
    let t = ws.reduce((a, b) => a + b, 0) * rnd(s);
    for (let i = 0; i < items.length; i++) { t -= ws[i]; if (t <= 0) return items[i]; }
    return items[items.length - 1];
  }
  function maxBy(a, f) {
    let best = null, bv = -Infinity;
    for (const x of a) { const v = f(x); if (v > bv) { bv = v; best = x; } }
    return best;
  }
  E.rnd = rnd; E.clamp = clamp; E.maxBy = maxBy; E.wpick = wpick; E.mean = mean;

  function getP(s, id) {
    for (const t of s.teams) for (const p of t.players) if (p.id === id) return p;
    return null;
  }
  function eff(p, k) { return p[k] * (1 - (FAT[k] || 0) * p.fatigue / 100); }
  E.getP = getP; E.eff = eff;
  E.clone = (s) => JSON.parse(JSON.stringify(s));
  E.lineup = (s, t) => s.teams[t].onCourt.map((id) => getP(s, id));
  E.bench = (s, t) => s.teams[t].players.filter((p) => !s.teams[t].onCourt.includes(p.id));
  E.teamOf = (s, id) => (s.teams[0].players.some((p) => p.id === id) ? 0 : 1);

  E.scorer = (p) => Math.max(eff(p, 'three'), eff(p, 'mid'), eff(p, 'fin')) + 0.5 * eff(p, 'drb') + 0.3 * eff(p, 'iq');
  E.ovr = (p) => mean(['spd', 'three', 'mid', 'fin', 'drb', 'pas', 'dint', 'dext', 'oreb', 'dreb', 'iq'].map((k) => eff(p, k)));
  E.posCompat = (a, b) =>
    a.pos === b.pos || a.pos === b.pos2 || a.pos2 === b.pos || Math.abs(POSR[a.pos] - POSR[b.pos]) <= 1;

  function posKey(p) { return (POSR[p.pos] * 2 + POSR[p.pos2 || p.pos]) / 3 + p.h / 10000; }
  function matchups(off, def) {
    const a = off.slice().sort((x, y) => posKey(x) - posKey(y));
    const b = def.slice().sort((x, y) => posKey(x) - posKey(y));
    const m = {};
    a.forEach((p, i) => (m[p.id] = b[i]));
    return m;
  }
  function roles(off, play, targetId) {
    const T = off.find((p) => p.id === targetId) || maxBy(off, E.scorer);
    let H, S = null;
    if (play === 'shooter' || play === 'post') {
      S = T;
      H = maxBy(off.filter((p) => p !== S), (p) => eff(p, 'pas') + 0.5 * eff(p, 'drb'));
    } else H = T;
    let rest = off.filter((p) => p !== H && p !== S);
    const R = maxBy(rest, (p) => p.h + 2 * eff(p, 'fin') + p.w / 10);
    rest = rest.filter((p) => p !== R);
    const K = maxBy(rest, (p) => eff(p, 'three'));
    const o = rest.filter((p) => p !== K);
    return { H, S, R, K, o };
  }
  /** Rôles et oppositions pour l'affichage du terrain. */
  E.preview = function (s, play, targetId) {
    const oi = s.poss, off = E.lineup(s, oi), def = E.lineup(s, 1 - oi);
    const mu = matchups(off, def), muIds = {};
    Object.keys(mu).forEach((k) => (muIds[k] = mu[k].id));
    const out = { mu: muIds, order: off.slice().sort((x, y) => posKey(x) - posKey(y)).map((p) => p.id) };
    if (play) {
      const R = roles(off, play, targetId);
      out.roles = { H: R.H.id, S: R.S && R.S.id, R: R.R.id, K: R.K.id, o: R.o.map((p) => p.id) };
    }
    return out;
  };

  E.snap = (s) => ({
    clock: s.clock, shot: s.shot, score: s.score.slice(), poss: s.poss, period: s.period,
    to: s.teams.map((t) => t.timeouts), tf: s.teams.map((t) => t.teamFouls), give: s.teams.map((t) => t.toGive),
  });

  /* ---------- interventions ---------- */
  E.canTimeout = function (s, t) {
    if (s.over) return { ok: false, why: 'Match terminé.' };
    if (s.teams[t].timeouts <= 0) return { ok: false, why: 'Plus aucun temps mort disponible.' };
    if (s.ball === 'live' && s.poss !== t)
      return { ok: false, why: 'Ballon en jeu : seule l’équipe en possession peut demander un temps mort.' };
    return { ok: true };
  };
  E.callTimeout = function (s, t) {
    const T = s.teams[t];
    T.timeouts--;
    s.ball = 'dead'; s.subsOk = true; s.sit = 'Reprise après temps mort'; s.ato = t;
    if (s.poss === t) s.bc = false; // temps mort de l'attaque : remise en jeu en zone avant
    for (const tm of s.teams)
      for (const p of tm.players) p.fatigue = clamp(p.fatigue - (tm.onCourt.includes(p.id) ? 7 : 4), 0, 100);
    return { kind: 'timeout', team: t, text: `Temps mort ${T.name}. Les joueurs soufflent un peu.`, anim: [], snap: E.snap(s) };
  };
  E.canSub = function (s) {
    if (s.over) return { ok: false, why: 'Match terminé.' };
    if (s.subsOk) return { ok: true };
    if (s.ball === 'live')
      return { ok: false, why: 'Ballon en jeu : remplacement possible au prochain arrêt de jeu ou sur temps mort.' };
    return { ok: false, why: 'Après un panier, pas de remplacement sans temps mort.' };
  };
  E.canEnter = function (p) {
    return p.fouls >= 6 ? { ok: false, why: `${p.short} est exclu (6 fautes).` } : { ok: true };
  };
  E.substitute = function (s, t, outId, inId) {
    const T = s.teams[t], i = T.onCourt.indexOf(outId);
    const pin = getP(s, inId);
    if (i < 0 || T.onCourt.includes(inId) || !pin || pin.fouls >= 6) return false;
    T.onCourt[i] = inId;
    return true;
  };
  E.recordHabits = function (s) {
    for (let t = 0; t < 2; t++) {
      const h = s.habits[t], o = s.teams[t].orders;
      if (s.poss === t) {
        h.nOff++; h.play[o.play] = (h.play[o.play] || 0) + 1; h.target[o.target] = (h.target[o.target] || 0) + 1;
      } else { h.nDef++; h.scheme[o.scheme] = (h.scheme[o.scheme] || 0) + 1; }
    }
  };

  /* ---------- probabilités de tir ---------- */
  function pMake(sh, type, o, d) {
    let p;
    if (type === 'three') p = 0.16 + 0.024 * eff(sh, 'three') + (o - 0.5) * 0.28;
    else if (type === 'mid') p = 0.24 + 0.022 * eff(sh, 'mid') + (o - 0.5) * 0.3;
    else {
      let sk = eff(sh, 'fin');
      if (o > 0.55) sk = Math.max(sk, 0.5 * sk + 0.5 * eff(sh, 'dunk'));
      p = 0.36 + 0.03 * sk + (o - 0.5) * 0.4;
    }
    if (type !== 'rim' && d) p += clamp((sh.h - d.h) / 100, -0.2, 0.2) * 0.25 * (1 - o);
    p += 0.03 * (sh.form || 0); // forme du soir : au plus trois points de réussite, dans un sens ou dans l'autre
    return clamp(p, 0.03, 0.95);
  }
  E.pMake = pMake;
  /** Systèmes où le joueur recherché est servi par un partenaire (il n'est pas le porteur). */
  const served = (play) => play === 'shooter' || play === 'post';
  /** Le pressing ne s'applique que si la possession démarre par une relance depuis l'arrière. */
  E.pressApplies = (s) => !!s.bc;
  /** Ligne de statistiques vierge ; sec : temps de jeu en secondes. */
  E.newStats = () => ({ sec: 0, pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, to: 0 });
  /** 1 : en forme, -1 : en difficulté, 0 : dans ses standards. */
  E.formState = (p) => (p.form > 0.35 ? 1 : p.form < -0.35 ? -1 : 0);
  const openLabel = (o) => (o >= 0.7 ? 'grand ouvert' : o >= 0.52 ? 'ouvert' : o >= 0.34 ? 'contesté' : 'très contesté');
  E.openLabel = openLabel;

  const BASE = {
    pnr: [['H', 'rim', 0.3, 0.45], ['H', 'mid', 0.2, 0.48], ['H', 'three', 0.12, 0.42], ['R', 'rim', 0.22, 0.55, 1], ['K', 'three', 0.16, 0.58, 1]],
    iso: [['H', 'rim', 0.3, 0.4], ['H', 'mid', 0.35, 0.45], ['H', 'three', 0.2, 0.42], ['K', 'three', 0.15, 0.5, 1]],
    drive: [['H', 'rim', 0.55, 0.44], ['H', 'mid', 0.13, 0.45], ['K', 'three', 0.2, 0.56, 1], ['R', 'rim', 0.12, 0.55, 1]],
    shooter: [['S', 'three', 0.55, 0.55, 1], ['S', 'mid', 0.13, 0.5, 1], ['R', 'rim', 0.12, 0.5, 1], ['H', 'mid', 0.1, 0.36], ['H', 'three', 0.1, 0.36]],
    // dernier champ : 1 = passe décisive du porteur, 2 = du joueur recherché (ressortie après l'aide)
    post: [['S', 'rim', 0.44, 0.47, 1], ['S', 'mid', 0.18, 0.46, 1], ['K', 'three', 0.18, 0.52, 2], ['R', 'rim', 0.1, 0.5, 2], ['H', 'three', 0.1, 0.46, 2]],
  };
  const TO_BASE = { pnr: 0.11, iso: 0.08, drive: 0.12, shooter: 0.09, post: 0.11, motion: 0.115 };

  /* ---------- une séquence : de la décision au prochain point de décision ---------- */
  E.playSegment = function (s) {
    const ev = [];
    const oi = s.poss, di = 1 - oi;
    const O = s.teams[oi], D = s.teams[di];
    const oo = Object.assign({}, O.orders), dd = Object.assign({}, D.orders);
    const seg = { n: ++s.segN, period: s.period, clock0: s.clock, score0: s.score.slice(), poss: oi, oo, dd, texts: [], to: false, oreb: false };
    const off = E.lineup(s, oi), def = E.lineup(s, di);
    const R = roles(off, oo.play, oo.target);
    const mu = matchups(off, def);
    const dOf = (p) => mu[p.id] || def[0];
    const H = R.H, focus = served(oo.play) ? R.S : R.H;
    const zn = dd.scheme === 'zone';
    const pressOn = dd.scheme === 'press' && !!s.bc;
    s.bc = false;
    // effets différés des événements aléatoires (voir events.js)
    const M = s.mods || (s.mods = {});
    if (M.want && M.want.team === oi) {
      const w = getP(s, M.want.id);
      if (w && focus.id !== w.id) {
        w.form = clamp((w.form || 0) - 0.4, -1, 1);
        (s.notes = s.notes || []).push(`${w.short} n’a pas eu le ballon promis : il se braque.`);
      }
      delete M.want;
    }
    const rush = !!M.rush && M.rush.team === oi;
    if (rush && --M.rush.n <= 0) delete M.rush;
    const hunt = M.hunt && M.hunt.team === di ? M.hunt.id : null;
    if (hunt && --M.hunt.n <= 0) delete M.hunt;
    const hack = M.hack && M.hack.team === di ? M.hack.id : null;
    if (hack) delete M.hack;
    const margin = s.score[oi] - s.score[di];
    let avail = Math.min(s.clock, s.shot);
    let last = s.clock <= s.shot + 0.01;
    const ato = s.ato === oi;
    s.ato = null; s.ball = 'live'; s.subsOk = false;
    let used = 0;
    const spend = (t) => {
      t = Math.max(0, Math.min(t, s.clock));
      s.clock = r1(s.clock - t); s.shot = r1(Math.max(0, s.shot - t)); used += t;
    };
    const emit = (kind, text, anim, extra) => {
      const e = Object.assign({ kind, text, anim: (anim || []).filter(Boolean), snap: E.snap(s), team: oi }, extra || {});
      ev.push(e);
      if (text) seg.texts.push(text);
      return e;
    };
    // bc : la possession suivante part de l'arrière (panier, lancers, rebond défensif, ballon rendu)
    const turnBall = (ball, subsOk, sit, bc) => { s.poss = di; s.shot = 24; s.ball = ball; s.subsOk = subsOk; s.sit = sit; s.bc = !!bc; };

    const dblT = dd.scheme === 'double' ? off.find((p) => p.id === dd.dblTarget) || maxBy(off, E.scorer) : null;
    const activeDbl = !!dblT && dblT === focus;
    const misDbl = !!dblT && !activeDbl;
    const dblBy = dblT ? dOf(R.o[0] || R.K) : null;

    /* -- fautes, lancers, rebonds, tirs -- */
    function foulOut(p, ti) {
      const T = s.teams[ti];
      const cands = E.bench(s, ti).filter((b) => b.fouls < 6);
      if (!cands.length) return;
      const sub = maxBy(cands, (b) => E.ovr(b) + (E.posCompat(b, p) ? 2 : 0));
      E.substitute(s, ti, p.id, sub.id);
      emit('sub', `${p.short} est exclu pour six fautes ! ${sub.short} le remplace.`, [{ a: 'swap', out: p.id, in: sub.id }], { team: ti });
    }
    function fts(victim, n) {
      let lastMade = false;
      for (let i = 0; i < n; i++) {
        lastMade = rnd(s) < 0.4 + 0.055 * eff(victim, 'ft');
        victim.st.fta++;
        if (lastMade) { s.score[oi]++; victim.st.ftm++; victim.st.pts++; }
        const final = i === n - 1;
        if (final && lastMade) turnBall('dead', true, 'Remise en jeu après lancers francs', true);
        emit('ft', `${victim.short}, lancer ${i + 1} sur ${n} : ${lastMade ? pick(s, ['réussi.', 'dedans.', 'ça rentre.']) : pick(s, ['manqué.', 'trop court.', 'ça ressort.'])}`,
          [{ a: 'ft', id: victim.id, made: lastMade }], { pts: lastMade ? 1 : 0 });
      }
      if (!lastMade) rebound(victim, 'ft', 0);
    }
    function foul(fouler, victim, shots, intentional) {
      fouler.fouls++; D.teamFouls++;
      const penalty = D.toGive <= 0;
      if (D.toGive > 0) D.toGive--;
      const n = shots || (penalty ? 2 : 0);
      let txt = intentional
        ? `Faute volontaire de ${fouler.short} sur ${victim.short}`
        : shots ? `Faute de ${fouler.short} sur le tir` : `Faute de ${fouler.short} sur ${victim.short}`;
      txt += ` (${fouler.fouls}e faute personnelle). `;
      if (n) txt += shots === 1 ? 'Un lancer en bonus.' : `${n} lancers${!shots ? ', l’équipe est en pénalité' : ''}.`;
      else txt += `Pas de lancer, remise en jeu${D.toGive <= 0 ? ' — la prochaine faute coûtera deux lancers' : ''}.`;
      if (!n) { s.shot = Math.max(s.shot, Math.min(14, s.clock)); s.ball = 'dead'; s.subsOk = true; s.sit = 'Remise en jeu après faute'; }
      emit('foul', txt, [], { team: di });
      if (fouler.fouls >= 6) foulOut(fouler, di);
      if (n) fts(victim, n);
    }
    function rebound(shooter, type, depth) {
      const of = E.lineup(s, oi), df = E.lineup(s, di);
      const isFT = type === 'ft';
      const Oa = mean(of.map((p) => eff(p, 'oreb') * (p === shooter ? 0.5 : 1)));
      const Da = mean(df.map((p) => eff(p, 'dreb')));
      let pOff = isFT
        ? clamp(0.12 + (Oa - Da) * 0.02, 0.04, 0.25)
        : clamp(0.27 + (Oa - Da) * 0.035 + (type === 'three' ? 0.02 : 0) + (dd.endgame === 'rebound' ? -0.08 : 0) + (zn ? 0.05 : 0), 0.08, 0.45);
      if (depth >= 2) pOff = 0;
      spend(0.8 + rnd(s) * 1.4);
      if (s.clock <= 0) { emit('buzz', 'Le ballon traîne au rebond… et le buzzer retentit.'); return; }
      if (rnd(s) < pOff) {
        const rb = wpick(s, of, (p) => Math.pow(eff(p, 'oreb'), 2));
        rb.st.oreb++;
        seg.oreb = true;
        if (s.clock < 3 || rnd(s) < 0.35 + 0.04 * (eff(rb, 'fin') - 5)) {
          emit('oreb', `Rebond offensif de ${rb.short}, qui remonte aussitôt au cercle !`, [{ a: 'reb', id: rb.id }]);
          shot(rb, 'rim', clamp(0.5 + (rnd(s) - 0.5) * 0.3, 0.1, 0.9), maxBy(df, (p) => eff(p, 'dint')), null, depth + 1, '');
        } else {
          s.shot = Math.min(14, s.clock); s.ball = 'live'; s.sit = 'Rebond offensif : possession prolongée';
          emit('oreb', `Rebond offensif de ${rb.short} ! ${O.name} garde le ballon, 14 secondes pour tirer.`, [{ a: 'reb', id: rb.id }]);
        }
      } else {
        const rb = wpick(s, df, (p) => Math.pow(eff(p, 'dreb'), 2));
        rb.st.dreb++;
        turnBall('live', false, 'Ballon en jeu après rebond défensif', true);
        emit('dreb', pick(s, [`${rb.short} capte le rebond défensif.`, `Rebond pour ${rb.short}.`, `${rb.short} sécurise le rebond.`]),
          [{ a: 'reb', id: rb.id }], { team: di });
      }
    }
    function shot(sh, type, o, d, ast, depth, tact, flags) {
      flags = flags || {};
      const nofoul = dd.endgame === 'nofoul';
      const pm = pMake(sh, type, o, d) * (flags.heave ? 0.45 : 1);
      let pf = type === 'rim' ? 0.12 + 0.1 * (1 - o) : type === 'mid' ? 0.03 : 0.015;
      pf *= (nofoul ? 0.4 : 1) * (1 + 0.6 * d.fatigue / 100) * (oo.play === 'drive' && type === 'rim' ? 1.25 : 1);
      pf *= (d.soft ? 0.3 : 1) * (d.id === hunt ? 1.6 : 1);
      if (flags.heave) pf = 0.01;
      const fouled = rnd(s) < pf;
      const made = rnd(s) < (fouled ? pm * 0.55 : pm);
      const pts = type === 'three' ? 3 : 2;
      // un tir manqué sur faute ne compte pas comme une tentative
      if (made || !fouled) { sh.st.fga++; if (type === 'three') sh.st.tpa++; }
      if (made) { sh.st.fgm++; sh.st.pts += pts; if (type === 'three') sh.st.tpm++; if (ast) ast.st.ast++; }
      if (!flags.heave && (made || !fouled)) sh.form = clamp((sh.form || 0) + (made ? 0.12 : -0.07), -1, 1);
      if (depth === 0) seg.read = { who: sh.short, type, o, pm, heave: !!flags.heave };
      const lab = openLabel(o);
      let act;
      if (flags.heave) act = `${sh.short} n’a plus le temps et tente sa chance de loin`;
      else if (depth > 0) act = `${sh.short} au contact sous le cercle`;
      else if (type === 'three') act = ast ? `${ast.short} trouve ${sh.short} derrière l’arc (tir ${lab})` : `${sh.short} dégaine à trois points (tir ${lab})`;
      else if (type === 'mid') act = ast ? `${ast.short} sert ${sh.short} à mi-distance (tir ${lab})` : `${sh.short} s’arrête à mi-distance (tir ${lab})`;
      else act = ast ? `${ast.short} sert ${sh.short} près du cercle (tir ${lab})` : `${sh.short} va jusqu’au cercle (tir ${lab})`;
      const anim = [ast && { a: 'pass', to: sh.id }, depth === 0 && !flags.heave && { a: 'go', id: sh.id, where: type }, { a: 'shot', id: sh.id, made }];
      const pre = (tact ? tact + ' ' : '') + act;
      if (made) {
        s.score[oi] += pts;
        if (!fouled) turnBall('dead', false, 'Remise en jeu après panier', true);
        const dunk = type === 'rim' && o > 0.6 && eff(sh, 'dunk') >= 6;
        emit('made', `${pre} : ${dunk ? 'dunk !' : pick(s, ['ça rentre !', 'panier !', 'dedans !'])} +${pts}${fouled ? ' et la faute !' : ''}`, anim, { pts });
        if (fouled) foul(d, sh, 1);
      } else if (fouled) {
        emit('miss', `${pre} : manqué, mais il y a faute.`, anim);
        foul(d, sh, pts);
      } else {
        const df = E.lineup(s, di);
        const bl = maxBy(df, (p) => eff(p, 'blk'));
        const blocked = type !== 'three' && rnd(s) < (0.05 + 0.03 * eff(bl, 'blk')) * (1 - o);
        if (blocked) bl.st.blk++;
        const good = o >= 0.52 && depth === 0 && !flags.heave;
        emit('miss', `${pre} : ${blocked ? `contré par ${bl.short} !` : good ? pick(s, ['la position était bonne, mais ça ressort.', 'bien joué, mais le tir est manqué.']) : pick(s, ['ça ressort.', 'manqué.', 'le cercle refuse.'])}`, anim);
        rebound(sh, type, depth);
      }
    }

    /* -- fin de séquence : fatigue, lecture tactique, fin de période -- */
    function finish() {
      for (let t = 0; t < 2; t++) {
        const T = s.teams[t];
        for (const p of T.players) {
          if (T.onCourt.includes(p.id)) p.st.sec += used;
          if (T.onCourt.includes(p.id)) p.fatigue += used * 0.12 * (1 + (5 - p.end) * 0.12) * (t === oi && oo.tempo === 'quick' ? 1.15 : 1) * (t === di && zn ? 0.88 : 1);
          else p.fatigue -= used * 0.1;
        }
      }
      H.fatigue += oo.play === 'drive' ? 1.5 : oo.play === 'iso' ? 0.8 : 0.6;
      if (oo.play === 'post') { focus.fatigue += 0.8; dOf(focus).fatigue += 0.5; }
      if (oo.play === 'motion') for (const p of off) p.fatigue += 0.3;
      if (activeDbl) { dOf(focus).fatigue += 0.8; dblBy.fatigue += 0.8; }
      for (const T of s.teams) for (const p of T.players) p.fatigue = clamp(p.fatigue, 0, 100);

      let read = `Lecture — attaque : ${L.play[oo.play][0].toLowerCase()} pour ${focus.short}, ${L.tempo[oo.tempo][0].toLowerCase()} · défense : ${L.scheme[dd.scheme][0].toLowerCase()}${dblT ? ' sur ' + dblT.short : ''}${dd.scheme === 'press' && !pressOn ? ' (sans objet, attaque déjà installée)' : ''}, ${L.endgame[dd.endgame][0].toLowerCase()}`;
      if (seg.read && !seg.read.heave) read += ` · occasion : tir ${openLabel(seg.read.o)} de ${seg.read.who} (≈ ${Math.round(seg.read.pm * 100)} %)`;
      emit('read', read + '.', []);
      seg.texts.pop();

      if (s.clock <= 0.001) {
        s.clock = 0;
        if (s.score[0] === s.score[1]) {
          s.period++; s.clock = 120; s.shot = 24; s.poss = rnd(s) < 0.5 ? 0 : 1;
          s.ball = 'dead'; s.subsOk = true; s.sit = 'Entre-deux gagné : début de la prolongation';
          for (const T of s.teams) {
            T.teamFouls = 0; T.toGive = 1; T.timeouts = Math.min(2, T.timeouts + 1);
            for (const p of T.players) p.fatigue = clamp(p.fatigue - 6, 0, 100);
          }
          emit('period', `Égalité à ${s.score[0]} partout ! Prolongation éclair de deux minutes, ballon ${s.teams[s.poss].name}.`, [], { team: s.poss });
        } else {
          s.over = true; s.winner = s.score[0] > s.score[1] ? 0 : 1;
          emit('end', `C’est terminé ! Victoire ${s.teams[s.winner].name}, ${Math.max(s.score[0], s.score[1])} à ${Math.min(s.score[0], s.score[1])}.`, [], { team: s.winner });
        }
      }
      seg.score1 = s.score.slice(); seg.clock1 = s.clock;
      s.log.push(seg);
      return ev;
    }

    /* -- mise en place -- */
    const setupTxt = {
      pnr: `${H.short} appelle l’écran de ${R.R.short}.`,
      iso: `Isolation pour ${H.short}, ses partenaires s’écartent.`,
      drive: `${H.short} attaque le cercle balle en main.`,
      shooter: `Système pour ${focus.short} : écrans loin du ballon, ${H.short} à la baguette.`,
      post: `${H.short} cherche ${focus.short} au poste bas, dos au panier.`,
      motion: `Jeu en mouvement : le ballon circule, ${focus.short} en première option.`,
    }[oo.play];
    const rolesIds = { H: H.id, S: R.S && R.S.id, R: R.R.id, K: R.K.id, o: R.o.map((p) => p.id) };
    const muIds = {};
    Object.keys(mu).forEach((k) => (muIds[k] = mu[k].id));
    emit('setup', setupTxt, [{ a: 'setup', play: oo.play, roles: rolesIds, mu: muIds, scheme: dd.scheme === 'press' && !pressOn ? 'man' : dd.scheme, order: off.slice().sort((x, y) => posKey(x) - posKey(y)).map((p) => p.id), dbl: activeDbl ? focus.id : null, dblBy: dblBy && dblBy.id }]);

    /* -- A. faute volontaire de la défense -- */
    if (dd.endgame === 'foul') {
      const tf = 1.2 + rnd(s) * 2.3;
      if (tf < avail - 0.2) {
        spend(tf);
        const handlers = off.slice().sort((a, b) => eff(b, 'drb') + eff(b, 'pas') - eff(a, 'drb') - eff(a, 'pas')).slice(0, 3);
        const victim = (hack && off.find((p) => p.id === hack)) || (rnd(s) < 0.7 ? maxBy(handlers, (p) => eff(p, 'ft')) : pick(s, off));
        const fouler = maxBy(def, (p) => -p.fouls * 10 + rnd(s));
        foul(fouler, victim, 0, true);
        return finish();
      }
    }

    /* -- pressing tout terrain : la remontée de balle est disputée -- */
    let pressTxt = '', pressBeat = false;
    if (pressOn) {
      const k = dd.endgame === 'nofoul' ? 0.6 : 1; // sans faute : pressing moins agressif
      const P = 0.3 * mean(def.map((p) => eff(p, 'spd'))) + 0.35 * mean(def.map((p) => eff(p, 'stl'))) + 0.2 * mean(def.map((p) => eff(p, 'dext'))) + 0.15 * mean(def.map((p) => p.end * (1 - p.fatigue / 250)));
      const B = 0.4 * eff(H, 'drb') + 0.3 * eff(H, 'pas') + 0.3 * mean(off.map((p) => eff(p, 'iq')));
      const g = (P - B) / 10;
      for (const p of def) p.fatigue += 1.6 * k * (1 + (5 - p.end) * 0.1);
      H.fatigue += 0.5;
      const tp = Math.max(0, Math.min((4 + rnd(s) * 3 + 4 * Math.max(g, 0)) * k, avail - 0.5));
      if (rnd(s) < clamp((0.065 + 0.25 * g) * k, 0.02, 0.2)) {
        spend(tp * (0.4 + 0.5 * rnd(s)));
        seg.to = true; H.st.to++;
        if (rnd(s) < 0.7) {
          const th = wpick(s, def, (p) => Math.pow(eff(p, 'stl'), 2));
          th.st.stl++;
          turnBall('live', false, 'Ballon en jeu après interception');
          emit('steal', `Pressing tout terrain : ${th.short} piège ${H.short} et vole le ballon !`, [{ a: 'steal', id: th.id }], { team: di });
        } else {
          turnBall('dead', true, 'Remise en jeu après perte de balle', true);
          emit('to', `Pressing tout terrain : ${H.short} ne franchit pas le milieu de terrain dans les huit secondes. Ballon rendu.`, [], { team: di });
        }
        return finish();
      }
      if (rnd(s) < 0.035 * k) {
        spend(tp * 0.5);
        foul(wpick(s, def, (p) => 20 + p.fatigue), H, 0, false);
        return finish();
      }
      spend(tp);
      if (s.clock <= 0) { emit('buzz', `Le pressing étouffe ${H.short} jusqu’au buzzer.`); return finish(); }
      pressBeat = rnd(s) < clamp(0.38 - 0.5 * g, 0.12, 0.6);
      avail = Math.min(s.clock, s.shot); last = s.clock <= s.shot + 0.01;
      pressTxt = pressBeat ? `Le pressing est débordé : ${H.short} trouve des partenaires seuls devant lui.` : `Le pressing a coûté ${Math.round(tp)} secondes à l’attaque.`;
    }

    /* -- B. l'équipe qui mène laisse filer le chrono -- */
    if (margin > 0 && last && oo.tempo !== 'quick') {
      const st = mean(def.map((p) => eff(p, 'stl')));
      if (rnd(s) < 0.035 + 0.004 * (st - 5)) {
        spend(avail * (0.3 + 0.5 * rnd(s)));
        const th = wpick(s, def, (p) => Math.pow(eff(p, 'stl'), 2));
        seg.to = true;
        th.st.stl++; H.st.to++;
        turnBall('live', false, 'Ballon en jeu après interception');
        emit('steal', `${th.short} arrache le ballon des mains de ${H.short} !`, [{ a: 'steal', id: th.id }], { team: di });
      } else {
        spend(s.clock);
        emit('hold', `${H.short} garde le ballon et laisse filer les dernières secondes.`, []);
      }
      return finish();
    }

    /* -- C. possession jouée -- */
    let use;
    if (oo.tempo === 'quick') use = 4 + rnd(s) * 4;
    else if (oo.tempo === 'normal') use = 8 + rnd(s) * 7;
    else use = avail - (2.5 + rnd(s) * 2.5);
    if (last && (oo.tempo === 'milk' || (oo.tempo === 'normal' && margin >= 0))) use = avail - (0.3 + rnd(s) * 1.4);
    const offIQ = mean(off.map((p) => eff(p, 'iq'))), offPas = mean(off.map((p) => eff(p, 'pas')));
    const defIQ = mean(def.map((p) => eff(p, 'iq')));
    // jeu en mouvement : l'occasion demande du temps, sauf si la défense se trompe d'emblée
    const slip = oo.play === 'motion' && rnd(s) < clamp(0.15 + (5 - defIQ) * 0.03, 0.05, 0.3);
    if (oo.play === 'motion' && !(last && oo.tempo !== 'quick')) use = slip ? 4 + rnd(s) * 3 : use + 3;
    if (pressBeat && !(margin > 0 && last)) use = Math.min(use, 2 + rnd(s) * 2.5);
    use = clamp(use, Math.min(0.4, avail), Math.max(avail - 0.2, Math.min(0.4, avail)));
    const quick = oo.tempo === 'quick';

    // perte de balle
    const care = oo.play === 'post' ? (eff(H, 'pas') - 6) * 0.012 - (dd.scheme === 'paint' ? 0.015 : 0) - (zn ? 0.02 : 0) // entrée de balle
      : oo.play === 'motion' ? (offPas + offIQ - 12) * 0.006 // coordination du cinq
      : (eff(H, 'drb') + eff(H, 'pas') - 12) * 0.005;
    let pTO = TO_BASE[oo.play] + (mean(def.map((p) => eff(p, 'stl'))) - 5) * 0.008 - care
      + 0.05 * H.fatigue / 100 + (rush ? 0.04 : 0) + (quick ? 0.01 : 0) + (use < 4 ? 0.02 : 0) - (dd.endgame === 'nofoul' ? 0.01 : 0);
    if (activeDbl) pTO += 0.07 - (eff(focus, 'pas') - 5) * 0.01;
    if (use < 1.5) pTO = 0.03;
    if (rnd(s) < clamp(pTO, 0.02, 0.3)) {
      spend(use * (0.35 + 0.5 * rnd(s)));
      seg.to = true;
      const dbTxt = activeDbl ? `Pris à deux, ${focus.short} cherche une sortie… ` : '';
      const loser = activeDbl ? focus : H;
      loser.st.to++;
      if (rnd(s) < 0.55) {
        const th = wpick(s, def, (p) => Math.pow(eff(p, 'stl'), 2));
        th.st.stl++;
        turnBall('live', false, 'Ballon en jeu après interception');
        emit('steal', dbTxt + pick(s, [`${th.short} coupe la ligne de passe : interception !`, `${th.short} vole le ballon à ${loser.short} !`, `Ballon dévié puis récupéré par ${th.short} !`]),
          [{ a: 'steal', id: th.id }], { team: di });
      } else if (rnd(s) < 0.25) {
        loser.fouls++;
        turnBall('dead', true, 'Remise en jeu après faute offensive', true);
        emit('to', dbTxt + `Passage en force de ${loser.short} (${loser.fouls}e faute personnelle). Ballon rendu.`, [], { team: di });
        if (loser.fouls >= 6) foulOut(loser, oi);
      } else {
        turnBall('dead', true, 'Remise en jeu après perte de balle', true);
        emit('to', dbTxt + pick(s, [`Mauvaise passe de ${loser.short}, le ballon file en touche.`, `${loser.short} marche. Ballon rendu.`, `${loser.short} perd le contrôle, sortie de balle.`]), [], { team: di });
      }
      return finish();
    }

    // faute défensive hors tir
    let pNSF = 0.04 * (dd.endgame === 'nofoul' ? 0.35 : 1) * (1 + 0.8 * mean(def.map((p) => p.fatigue)) / 100) + (activeDbl ? 0.02 : 0);
    if (use < 1.5) pNSF = 0;
    if (rnd(s) < pNSF) {
      spend(use * (0.3 + 0.5 * rnd(s)));
      foul(wpick(s, def, (p) => (20 + p.fatigue) * (p.soft ? 0.2 : 1) * (p.id === hunt ? 3 : 1)), H, 0, false);
      return finish();
    }

    spend(use);

    // tir du désespoir
    if (use < 1.5) {
      shot(focus, 'three', 0.15, dOf(focus), null, 0, '', { heave: true });
      return finish();
    }

    // occasions possibles
    const sw = dd.scheme === 'switch', pa = dd.scheme === 'paint', pe = dd.scheme === 'perimeter';
    const one = (a, d) => (0.6 * eff(a, 'drb') + 0.4 * eff(a, 'spd') - 0.7 * eff(d, 'dext') - 0.3 * eff(d, 'spd')) / 10;
    // poste bas : un changement défensif peut laisser un petit sur l'intérieur
    const postD = oo.play === 'post' ? (sw && dOf(H).h < dOf(focus).h ? dOf(H) : dOf(focus)) : null;
    let adv;
    if (oo.play === 'pnr') {
      const dR = dOf(R.R);
      adv = sw ? one(H, dR) : one(H, dOf(H)) * 0.6 + ((eff(H, 'pas') + eff(H, 'iq')) / 2 - (eff(dR, 'spd') + eff(dR, 'dint')) / 2) / 10 * 0.4 + 0.05;
    } else if (oo.play === 'iso') adv = one(H, dOf(H));
    else if (oo.play === 'drive') {
      const d = dOf(H);
      adv = (0.4 * eff(H, 'drb') + 0.4 * eff(H, 'spd') + 0.2 * eff(H, 'fin') - 0.6 * eff(d, 'dext') - 0.4 * eff(d, 'spd')) / 10;
    } else if (oo.play === 'post') {
      const d = postD;
      adv = (0.5 * eff(focus, 'fin') + 0.25 * eff(focus, 'mid') + 0.25 * eff(focus, 'iq') - 0.75 * eff(d, 'dint') - 0.25 * eff(d, 'blk')) / 10
        + clamp((focus.h - d.h) / 100, -0.15, 0.2) * 0.8 + clamp((focus.w - d.w) / 100, -0.15, 0.2) * 0.5 + 0.03;
    } else if (oo.play === 'motion') {
      adv = ((offPas + offIQ) / 2 * 0.7 + mean(off.map((p) => eff(p, 'spd'))) * 0.3
        - 0.4 * mean(def.map((p) => eff(p, 'dext'))) - 0.3 * defIQ - 0.3 * mean(def.map((p) => eff(p, 'spd')))) / 10 + 0.04;
    } else {
      const d = dOf(focus);
      adv = (0.5 * eff(focus, 'spd') + 0.5 * eff(focus, 'iq') + 0.3 * (eff(H, 'pas') - 5) - 0.5 * eff(d, 'dext') - 0.3 * eff(d, 'spd') - 0.2 * eff(d, 'iq')) / 10 + 0.05;
    }
    // zone : on défend des espaces, les duels pèsent moins ; tout dépend de la circulation du ballon
    if (zn && oo.play !== 'motion') adv *= oo.play === 'shooter' ? 0.7 : oo.play === 'pnr' ? 0.5 : 0.3;
    const zq = 0.4 * defIQ + 0.3 * mean(def.map((p) => eff(p, 'spd'))) + 0.15 * mean(def.map((p) => eff(p, 'dext'))) + 0.15 * mean(def.map((p) => eff(p, 'dint')));
    const zgap = clamp(((oo.play === 'motion' ? (offPas + offIQ) / 2 : (eff(H, 'pas') + eff(H, 'iq')) / 2) - zq) / 10, -0.3, 0.3);
    const rp = Math.max.apply(null, def.map((p) => (eff(p, 'dint') + eff(p, 'blk')) / 2));
    const rimAdj = -(rp - 5) * 0.03 * (pa ? 1.4 : pe ? 0.6 : 1);
    const pq = oo.play === 'shooter' ? 0.7 : oo.play === 'motion' ? 0.9 : clamp(0.5 + (eff(focus, 'pas') + eff(focus, 'iq') - 10) / 20, 0.1, 1);
    const whoMap = { H: R.H, S: R.S, R: R.R, K: R.K };
    const kIQ = 0.6 * (oo.play === 'motion' ? offIQ + 1 : eff(H, 'iq'));
    // jeu en mouvement : chaque joueur peut recevoir, sur son meilleur tir ; le joueur recherché reste prioritaire
    const entries = oo.play !== 'motion' ? BASE[oo.play].map((b) => ({ role: b[0], who: whoMap[b[0]], type: b[1], w: b[2], o: b[3], ast: b[4] === 2 ? focus : b[4] ? H : null }))
      : off.map((p) => {
        const type = eff(p, 'three') >= Math.max(eff(p, 'fin'), eff(p, 'mid') * 0.9) ? 'three' : eff(p, 'fin') >= eff(p, 'mid') * 0.9 ? 'rim' : 'mid';
        return { role: p === focus ? 'H' : 'M', who: p, type, w: p === focus ? 0.34 : 0.165, o: 0.5, ast: wpick(s, off.filter((x) => x !== p), (x) => Math.pow(eff(x, 'pas'), 2)) };
      });
    const opts = [];
    for (const b of entries) {
      const role = b.role, type = b.type;
      let w = b.w, o = b.o;
      const who = b.who;
      if (!who) continue;
      let d = dOf(who);
      if (postD && role === 'S') d = postD;
      if (sw && oo.play === 'pnr') { if (role === 'H') d = dOf(R.R); else if (role === 'R') d = dOf(R.H); }
      const own = who === focus;
      const fallback = oo.play === 'shooter' && role === 'H';
      if (!fallback) o += (oo.play === 'motion' ? 0.45 : own ? 0.5 : 0.3) * adv;
      if (zn) {
        if (type === 'rim') { w *= 0.55; o -= 0.14; } else if (type === 'mid') { w *= 1.2; o += 0.05 + 0.3 * zgap; } else { w *= 1.35; o += 0.07 + 0.5 * zgap; }
        o += oo.play === 'motion' ? 0.1 : oo.play === 'iso' || oo.play === 'drive' ? -0.08 : oo.play === 'post' ? -0.03 : 0;
      }
      if (slip) o += 0.08;
      if (oo.play === 'motion' && quick) o -= 0.04;
      if (pressOn) { if (pressBeat) { o += 0.16; if (type === 'rim') w *= 1.6; } else o -= 0.02; }
      if (type === 'rim') o += rimAdj;
      if (pa) { if (type === 'rim') { w *= 0.55; o -= 0.15; } else if (type === 'mid') { w *= 1.3; o += 0.1; } else { w *= 1.25; o += 0.12; } }
      if (pe) { if (type === 'three') { w *= 0.5; o -= 0.18; } else if (type === 'rim') { w *= 1.3; o += 0.1; } else { w *= 1.1; o += 0.03; } }
      if (sw) {
        if (oo.play === 'pnr') {
          if (role === 'H' && type === 'rim') w *= 0.8;
          if (role === 'R') { w *= 0.5; o += clamp((who.h - d.h) / 100, -0.2, 0.25); }
          if (role === 'K') { w *= 0.6; o -= 0.08; }
        } else if (oo.play === 'shooter') {
          if (role === 'S') { w *= type === 'three' ? 0.6 : 0.7; o -= type === 'three' ? 0.15 : 0.1; }
          if (role === 'R') { w *= 1.8; o += 0.12; }
        } else o += 0.03;
      }
      if (activeDbl) { if (own) { w *= 0.35; o -= 0.22; } else { w *= 2.2; o += 0.22 * pq; } }
      if (misDbl) o += 0.06;
      if (dd.endgame === 'nofoul') o += 0.05;
      if (dd.endgame === 'rebound') o += type === 'three' ? 0.05 : type === 'mid' ? 0.02 : 0;
      o += (quick ? -0.05 : oo.tempo === 'milk' ? -0.03 : 0) + (ato ? 0.04 : 0) - 0.05 * Math.max(0, 4 - use);
      o = clamp(o + (rnd(s) - 0.5) * 0.24, 0.05, 0.95);
      if (margin <= -3 && s.clock <= 30) {
        if (type === 'three') w *= s.clock < 10 ? 30 : 3;
        else if (margin === -3 && s.clock < 10) w *= 0.02;
      }
      const evp = pMake(who, type, o, d) * (type === 'three' ? 3 : 2);
      opts.push({ role, who, type, o, d, ast: b.ast, w: w * Math.exp(kIQ * (evp - 1)), own });
    }
    const c = wpick(s, opts, (x) => x.w);

    // lecture tactique rendue visible dans le commentaire
    let tact = '';
    if (activeDbl) tact = c.own ? `Pris à deux, ${focus.short} force quand même.` : `La prise à deux sur ${focus.short} laisse ${c.who.short} seul.`;
    else if (misDbl && rnd(s) < 0.6) tact = `La défense surveille ${dblT.short}, le jeu passe ailleurs.`;
    else if (sw && oo.play === 'pnr') tact = c.role === 'H' ? `Changement sur l’écran : ${H.short} se retrouve face à ${c.d.short}.` : c.role === 'R' ? `Changement : ${c.who.short} hérite de ${c.d.short} dans son dos.` : 'La défense change sur l’écran.';
    else if (sw && oo.play === 'shooter') tact = c.role === 'S' ? `Les changements suivent ${focus.short} sur chaque écran.` : c.role === 'R' ? `La défense change, ${c.who.short} plonge vers le cercle.` : `${focus.short} est verrouillé, il faut improviser.`;
    else if (slip) tact = `Erreur de placement de la défense : ${c.who.short} est trouvé tout de suite.`;
    else if (sw && oo.play === 'post' && c.role === 'S' && c.d !== dOf(focus)) tact = `Changement défensif : ${focus.short} se retrouve au poste bas face à ${c.d.short}.`;
    else if (zn) tact = c.type === 'three' ? 'La zone se resserre, le renversement trouve un tireur.' : c.type === 'rim' ? 'La zone ferme les accès au cercle.' : 'Le ballon trouve un espace au cœur de la zone.';
    else if (oo.play === 'post' && rnd(s) < 0.7) tact = c.role === 'S' ? `${focus.short} travaille dos au panier face à ${c.d.short}.` : `L’aide arrive sur ${focus.short}, qui ressort le ballon.`;
    else if (oo.play === 'motion' && rnd(s) < 0.7) tact = c.own ? `Le ballon circule et revient sur ${focus.short}.` : `Le mouvement du ballon libère ${c.who.short}.`;
    else if (pa) tact = c.type === 'rim' ? 'La raquette est verrouillée.' : 'La défense reste dans la raquette et laisse le tir extérieur.';
    else if (pe) tact = c.type === 'three' ? 'Les tireurs sont serrés de près.' : 'Les défenseurs collent aux tireurs, le couloir s’ouvre.';
    else if (oo.play === 'shooter' && c.role === 'H') tact = `${focus.short} ne se libère pas, ${H.short} doit improviser.`;

    if (pressTxt) tact = (pressTxt + ' ' + tact).trim();
    shot(c.who, c.type, c.o, c.d, c.ast && c.ast !== c.who ? c.ast : null, 0, tact);
    return finish();
  };

  /** Trois moments décisifs, dans l'ordre du match. */
  E.moments = function (s) {
    const u = s.user;
    const m = (sc) => sc[u] - sc[1 - u];
    const list = s.log.map((g) => {
      const d = m(g.score1) - m(g.score0);
      const flip = Math.sign(m(g.score1)) !== Math.sign(m(g.score0));
      const imp = (Math.abs(d) + (g.to ? 1.2 : 0) + (g.oreb ? 0.8 : 0) + (flip ? 2 : 0) + (d === 0 && !g.to ? 0.6 : 0))
        * (1 + (g.period - 4) * 0.8 + (120 - g.clock0) / 70);
      return { g, imp, d };
    });
    return list.sort((a, b) => b.imp - a.imp).slice(0, 3).sort((a, b) => a.g.n - b.g.n).map((x) => ({
      period: x.g.period, clock: x.g.clock0, text: x.g.texts.join(' '), score: x.g.score1, delta: x.d,
      mine: x.g.poss === u,
      order: x.g.poss === u
        ? `Votre consigne : ${L.play[x.g.oo.play][0]}, ${L.tempo[x.g.oo.tempo][0].toLowerCase()}`
        : `Votre consigne : ${L.scheme[x.g.dd.scheme][0]}, ${L.endgame[x.g.dd.endgame][0].toLowerCase()}`,
    }));
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
