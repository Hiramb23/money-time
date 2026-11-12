/* Money Time — coach adverse simulé.
   Il décide à partir du score, du temps, des effectifs et des habitudes déjà observées,
   jamais à partir de la consigne que le joueur vient de choisir. */
(function (root) {
  'use strict';
  const MT = (root.MT = root.MT || {});
  const E = MT.engine, eff = E.eff, rnd = E.rnd, maxBy = E.maxBy;
  const A = (MT.ai = {});

  function subs(s, ai) {
    const out = [];
    const T = s.teams[ai];
    const margin = s.score[ai] - s.score[1 - ai];
    const swap = (p, b, why) => {
      if (!E.substitute(s, ai, p.id, b.id)) return;
      out.push({ kind: 'sub', team: ai, text: `Changement ${T.name} : ${b.short} entre à la place de ${p.short}${why}.`, anim: [], snap: E.snap(s) });
    };
    // joueurs épuisés
    const tired = E.lineup(s, ai).filter((p) => p.fatigue >= 76).sort((a, b) => b.fatigue - a.fatigue);
    for (const p of tired) {
      if (out.length >= 2) break;
      const cands = E.bench(s, ai).filter((b) => b.fouls < 6 && b.fatigue <= 55 && E.posCompat(b, p));
      const best = maxBy(cands, E.ovr);
      if (best && E.ovr(best) >= E.ovr(p) - 0.4) swap(p, best, ', à bout de souffle');
    }
    // main sûre aux lancers quand on protège une avance
    if (margin > 0 && s.poss === ai && s.clock <= 35 && out.length < 2) {
      const worst = maxBy(E.lineup(s, ai), (p) => -eff(p, 'ft'));
      const best = maxBy(E.bench(s, ai).filter((b) => b.fouls < 6), (b) => eff(b, 'ft'));
      if (worst && best && worst.ft <= 4 && eff(best, 'ft') >= 7) swap(worst, best, ' pour sécuriser les lancers francs');
    }
    return out;
  }

  /** Interventions du coach adverse avant la décision du joueur (temps mort, remplacements). */
  A.intervene = function (s, ai) {
    if (s.over) return [];
    const out = [];
    const margin = s.score[ai] - s.score[1 - ai];
    if (E.canTimeout(s, ai).ok && s.aiTOseg !== s.segN) {
      const tired = E.lineup(s, ai).filter((p) => p.fatigue >= 80).length;
      let want = false;
      if (!s.subsOk && tired >= 2 && rnd(s) < 0.6) want = true;
      if (s.poss === ai && s.ball === 'live' && s.clock <= 24 && margin <= 0 && margin >= -3 && rnd(s) < 0.6) want = true;
      if (want) { s.aiTOseg = s.segN; out.push(E.callTimeout(s, ai)); }
    }
    if (s.subsOk) out.push.apply(out, subs(s, ai));
    return out;
  };
  /** Réaction à un temps mort demandé par le joueur. */
  A.onTimeout = function (s, ai) { return s.subsOk ? subs(s, ai) : []; };

  /** Consignes du coach adverse pour la séquence à venir. */
  A.orders = function (s, ai) {
    const T = s.teams[ai], o = T.orders, hab = s.habits[1 - ai];
    const on = E.lineup(s, ai), opp = E.lineup(s, 1 - ai);
    const margin = s.score[ai] - s.score[1 - ai];
    const c = s.clock;
    if (s.poss === ai) {
      if (margin > 0 && c <= 45) o.tempo = 'milk';
      else if (margin <= -4 && c <= 50) o.tempo = 'quick';
      else if (margin < 0 && c <= 32 && c > s.shot) o.tempo = 'quick';
      else if (margin === 0 && c <= 30) o.tempo = 'milk';
      else { const x = rnd(s); o.tempo = x < 0.7 ? 'normal' : x < 0.85 ? 'milk' : 'quick'; }

      const f = (k) => (hab.nDef ? (hab.scheme[k] || 0) / hab.nDef : 0);
      const need3 = margin <= -3 && c <= 30;
      const targets = on.slice().sort((a, b) => E.scorer(b) - E.scorer(a)).slice(0, 3);
      const cands = [];
      for (const p of targets) {
        const best = Math.max(eff(p, 'three'), eff(p, 'mid'), eff(p, 'fin'));
        const sc = {
          iso: 0.6 * eff(p, 'drb') + 0.4 * eff(p, 'spd') + best,
          pnr: (eff(p, 'drb') + eff(p, 'pas') + eff(p, 'iq')) / 3 * 1.2 + best * 0.8 + 1,
          drive: (eff(p, 'spd') + eff(p, 'drb') + eff(p, 'fin')) / 3 * 2,
          shooter: eff(p, 'three') * 1.6 + (eff(p, 'spd') + eff(p, 'iq')) / 5,
        };
        sc.drive *= (1 - 0.5 * f('paint')) * (1 + 0.3 * f('perimeter'));
        sc.iso *= (1 - 0.2 * f('paint')) * (1 + 0.2 * f('switch'));
        sc.shooter *= (1 + 0.3 * f('paint')) * (1 - 0.5 * f('perimeter')) * (1 - 0.3 * f('switch'));
        sc.pnr *= 1 - 0.3 * f('switch');
        sc.drive *= 1 - 0.4 * f('zone'); sc.iso *= 1 - 0.35 * f('zone'); sc.shooter *= 1 + 0.25 * f('zone');
        for (const k in sc) {
          let v = sc[k];
          if (need3) v *= (k === 'shooter' ? 1.5 : 1) * (eff(p, 'three') < 6 ? 0.5 : 1);
          cands.push({ play: k, target: p.id, w: Math.pow(Math.max(v, 1), 5) });
        }
      }
      // poste bas : un intérieur adroit et costaud, surtout si la défense change ou ne protège pas le cercle
      const feeder = Math.max.apply(null, on.map((p) => eff(p, 'pas')));
      for (const p of on) {
        if (p.h < 203) continue;
        let v = eff(p, 'fin') + 0.4 * eff(p, 'mid') + 0.3 * eff(p, 'iq') + E.clamp((p.h - 200) / 4, -2, 3) + 0.25 * feeder;
        v *= (1 - 0.5 * f('paint')) * (1 + 0.3 * f('switch')) * (1 - 0.3 * f('zone')) * (1 - 0.3 * f('double'));
        if (need3) v *= 0.4;
        cands.push({ play: 'post', target: p.id, w: Math.pow(Math.max(v, 1), 5) });
      }
      // jeu en mouvement : un cinq de passeurs, contre les prises à deux et les zones
      {
        let v = (E.mean(on.map((p) => eff(p, 'pas'))) + E.mean(on.map((p) => eff(p, 'iq')))) * 0.95 + E.mean(on.map((p) => eff(p, 'spd'))) * 0.3 + 1;
        v *= (1 + 0.4 * f('double')) * (1 + 0.35 * f('zone'));
        if (need3) v *= 0.7;
        if (c <= 10) v *= 0.7;
        cands.push({ play: 'motion', target: targets[0].id, w: Math.pow(Math.max(v, 1), 5) });
      }
      const ch = E.wpick(s, cands, (x) => x.w);
      o.play = ch.play; o.target = ch.target;
    } else {
      const fp = (k) => (hab.nOff ? (hab.play[k] || 0) / hab.nOff : 0);
      const w = { switch: 1, paint: 1, perimeter: 1, double: 0.4, zone: 0.6, press: 0 };
      w.switch += 2 * fp('pnr') + fp('shooter');
      w.paint += 2.5 * fp('drive') + fp('iso');
      w.perimeter += 2 * fp('shooter') + 0.5 * fp('pnr');
      if (E.mean(opp.map((p) => eff(p, 'three'))) > 6.2) w.perimeter += 0.8; else w.paint += 0.8;
      if (Math.min.apply(null, on.map((p) => eff(p, 'spd'))) <= 3) w.switch *= 0.5;
      let top = null, share = 0;
      for (const p of opp) { const n = hab.target[p.id] || 0; if (hab.nOff && n / hab.nOff > share) { share = n / hab.nOff; top = p; } }
      if (hab.nOff >= 2 && share >= 0.6) w.double += 1.5;
      w.paint += 1.5 * fp('post'); w.switch *= 1 - 0.5 * fp('post'); w.double += 0.8 * fp('post');
      w.double *= 1 - 0.6 * fp('motion'); w.perimeter += 0.8 * fp('motion');
      // zone : contre une équipe de duels, pas contre des tireurs ni de bons passeurs
      w.zone += 1.5 * fp('iso') + 1.5 * fp('drive') + fp('post');
      if (E.mean(opp.map((p) => eff(p, 'three'))) > 6.2) w.zone *= 0.6;
      if (E.mean(opp.map((p) => eff(p, 'pas'))) > 6.5) w.zone *= 0.7;
      // pressing : seulement sur une relance, pour revenir au score ou faire tourner le chrono
      if (E.pressApplies(s)) {
        w.press = 0.15;
        if (margin < 0 && c <= 60) w.press += 1.2;
        if (margin <= -4) w.press += 1.5;
        if (margin > 0 && c <= 35) w.press += 0.4;
        if (E.mean(on.map((p) => p.fatigue)) > 75) w.press *= 0.4;
      }
      if (margin >= 3 && c <= 24) w.perimeter += 5;
      o.scheme = E.wpick(s, Object.keys(w), (k) => w[k]);
      o.dblTarget = (top || maxBy(opp, E.scorer)).id;

      if ((margin < 0 && c <= 26) || (margin <= -4 && c <= 40)) o.endgame = 'foul';
      else if (margin === 3 && c <= 7 && rnd(s) < 0.5) o.endgame = 'foul';
      else if (margin > 0 && c <= 35) o.endgame = 'nofoul';
      else o.endgame = rnd(s) < 0.2 ? 'rebound' : 'normal';
    }
  };

  /** Valide les consignes : le coach adverse choisit, puis la séquence est résolue. */
  MT.step = function (s) {
    A.orders(s, 1 - s.user);
    E.recordHabits(s);
    return E.playSegment(s);
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
