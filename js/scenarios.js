/* Money Time — génération des défis : une famille de situations, puis des paramètres tirés dans des bornes cohérentes.
   L'équipe du joueur est toujours s.teams[0], l'adversaire s.teams[1]. */
(function (root) {
  'use strict';
  const MT = (root.MT = root.MT || {});
  const E = MT.engine, rnd = E.rnd, maxBy = E.maxBy;
  const S = (MT.scenarios = {});
  const ri = (s, a, b) => a + Math.floor(rnd(s) * (b - a + 1));

  /** Familles de situations proposées à l'écran d'accueil. */
  S.FAMILIES = [
    { key: 'lead', title: 'Protéger l’avance', pitch: 'Vous menez de 3 à 5 points, mais le ballon est à l’adversaire.' },
    { key: 'comeback', title: 'La remontée', pitch: '3 ou 4 points de retard, ballon en main, votre vedette est épuisée.' },
    { key: 'tie', title: 'Égalité sous tension', pitch: 'Égalité parfaite et votre meilleur défenseur joue avec cinq fautes.' },
    { key: 'nonet', title: 'Sans filet', pitch: 'Un ou deux points de retard, ballon adverse, presque plus de temps morts.' },
    { key: 'legs', title: 'Jambes lourdes', pitch: 'Courte avance, ballon en main, deux titulaires à bout de souffle.' },
  ];

  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const dist = (a, b) => { const x = rgb(a), y = rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
  /** Encre lisible sur une couleur d'équipe : ivoire ou bleu nuit. */
  S.ink = (h) => { const c = rgb(h); return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2] > 150 ? '#0B1422' : '#F4F1E8'; };
  S.team = (key) => MT.TEAMS.find((t) => t.key === key);

  /** Feuille de match des 46 premières minutes : les points de l'équipe retombent exactement sur son score. */
  function boxScore(s, T, target) {
    const ps = T.players, clamp = E.clamp;
    const share = (n, wf) => { for (let i = 0; i < n; i++) wf(E.wpick(s, ps, (p) => p._w * p.st.sec)); };
    const mins = ps.map((p, i) => (i < 5 ? 30 + rnd(s) * 8 : 5 + rnd(s) * 12));
    const tot = mins.reduce((a, b) => a + b, 0);
    ps.forEach((p, i) => (p.st.sec = Math.round(mins[i] / tot * 230 * 60)));
    let pts = 0, guard = 0;
    ps.forEach((p) => (p._w = Math.pow(Math.max(1, E.scorer(p) - 3), 1.5)));
    while (pts < target && guard++ < 600) {
      const p = E.wpick(s, ps, (q) => q._w * q.st.sec), st = p.st, rem = target - pts;
      if (rem === 1 || rnd(s) < 0.13) {
        for (let i = 0; i < (rem === 1 ? 1 : 2); i++) {
          st.fta++;
          if (rnd(s) < 0.4 + 0.055 * p.ft) { st.ftm++; st.pts++; pts++; }
        }
      } else if (rnd(s) < clamp(0.08 + 0.055 * (p.three - 3), 0.03, 0.6)) {
        st.fga++; st.tpa++;
        if (rem >= 3 && rnd(s) < 0.15 + 0.024 * p.three + 0.07 * p.form) { st.fgm++; st.tpm++; st.pts += 3; pts += 3; }
      } else {
        st.fga++;
        if (rnd(s) < 0.33 + 0.026 * (p.mid + p.fin) / 2 + 0.07 * p.form) { st.fgm++; st.pts += 2; pts += 2; }
      }
    }
    const made = ps.reduce((a, p) => a + p.st.fgm, 0);
    ps.forEach((p) => (p._w = p.pas * p.pas)); share(Math.round(made * (0.5 + rnd(s) * 0.15)), (p) => p.st.ast++);
    ps.forEach((p) => (p._w = p.oreb * p.oreb)); share(ri(s, 7, 12), (p) => p.st.oreb++);
    ps.forEach((p) => (p._w = p.dreb * p.dreb)); share(ri(s, 28, 36), (p) => p.st.dreb++);
    ps.forEach((p) => (p._w = p.stl * p.stl)); share(ri(s, 5, 9), (p) => p.st.stl++);
    ps.forEach((p) => (p._w = p.blk * p.blk)); share(ri(s, 2, 6), (p) => p.st.blk++);
    ps.forEach((p) => (p._w = 4 + p.drb + p.pas)); share(ri(s, 9, 14), (p) => p.st.to++);
    ps.forEach((p) => delete p._w);
  }

  /** opts : { team, opp, fam, seed } — opp et fam sont tirés au sort s'ils sont absents. */
  S.generate = function (opts) {
    opts = opts || {};
    const s = {
      seed: opts.seed == null ? (Math.random() * 0x7fffffff) | 0 : opts.seed,
      user: 0, period: 4, clock: 120, shot: 24, score: [0, 0], poss: 0, ball: 'dead', subsOk: true, sit: '',
      bc: false, over: false, winner: null, segN: 0, log: [], ato: null, aiTOseg: -1,
      ev: { n: 0, seg: -9, seen: [] }, mods: {}, notes: [],
      habits: [0, 1].map(() => ({ nOff: 0, nDef: 0, play: {}, target: {}, scheme: {} })),
      teams: [],
    };
    // équipe tirée au sort : jamais l'adversaire que le joueur a choisi
    const pool = MT.TEAMS.filter((x) => x.key !== opts.opp);
    const mine = S.team(opts.team) || pool[ri(s, 0, pool.length - 1)];
    let other = S.team(opts.opp);
    if (!other || other === mine) { const rest = MT.TEAMS.filter((t) => t !== mine); other = rest[ri(s, 0, rest.length - 1)]; }
    [mine, other].forEach((t, ti) => {
      const players = t.players.map((p, i) => {
        const q = Object.assign({}, p, { id: t.key + p.num });
        const starter = i < 5;
        q.fatigue = Math.round(E.clamp(starter ? 46 + rnd(s) * 22 + (6 - p.end) * 3 : 10 + rnd(s) * 22, 0, 100));
        q.fouls = starter ? [1, 2, 2, 3, 3, 4][ri(s, 0, 5)] : ri(s, 0, 3);
        q.form = Math.round((rnd(s) + rnd(s) - 1) * 100) / 100; // forme du soir, de -1 à +1
        q.st = E.newStats();
        return q;
      });
      // forme centrée sur l'équipe : jamais tout un effectif en réussite ou en panne le même soir
      const fm = players.reduce((x, q) => x + q.form, 0) / players.length;
      players.forEach((q) => (q.form = Math.round(E.clamp(q.form - fm, -1, 1) * 100) / 100));
      const tf = ri(s, 1, 5);
      // deux maillots trop proches : l'adversaire passe à sa couleur de rechange
      let color = t.color;
      if (ti === 1 && dist(color, mine.color) < 120) color = dist(t.alt, mine.color) < 120 ? '#d9d4c4' : t.alt;
      s.teams.push({
        key: t.key, name: t.name, abbr: t.abbr, color, ink: S.ink(color), players,
        onCourt: players.slice(0, 5).map((p) => p.id),
        timeouts: rnd(s) < 0.6 ? 2 : 1, teamFouls: tf, toGive: tf >= 4 ? 0 : 1, orders: null,
      });
    });
    const U = s.teams[0], V = s.teams[1];
    const base = ri(s, 97, 112);
    const five = U.players.slice(0, 5);
    const star = maxBy(five, E.scorer);
    const fam = S.FAMILIES.some((f) => f.key === opts.fam) ? opts.fam : S.FAMILIES[ri(s, 0, S.FAMILIES.length - 1)].key;
    let desc, diff, ball;
    if (fam === 'lead') {
      diff = ri(s, 3, 5); ball = 1;
      desc = `Vous menez de ${diff} points, mais le ballon est à ${V.name}. Tenez deux minutes.`;
    } else if (fam === 'comeback') {
      diff = -ri(s, 3, 4); ball = 0;
      star.fatigue = ri(s, 84, 92);
      desc = `${-diff} points de retard, ballon pour vous… et ${star.name} est à bout de souffle.`;
    } else if (fam === 'tie') {
      diff = 0; ball = rnd(s) < 0.5 ? 0 : 1;
      const stopper = maxBy(five, (p) => p.dext + p.dint + p.stl * 0.5);
      stopper.fouls = 5;
      desc = `Égalité parfaite. ${stopper.name}, votre meilleur défenseur, joue avec cinq fautes.`;
    } else if (fam === 'nonet') {
      diff = -ri(s, 1, 2); ball = 1;
      U.timeouts = ri(s, 0, 1);
      desc = `${-diff} point${diff < -1 ? 's' : ''} de retard, ballon à l’adversaire et ${U.timeouts ? 'un seul temps mort' : 'plus aucun temps mort'}. Il faut un stop.`;
    } else {
      diff = ri(s, 1, 2); ball = 0;
      const tired = five.slice().sort((a, b) => a.end - b.end).slice(0, 2);
      tired.forEach((p) => (p.fatigue = ri(s, 82, 90)));
      U.timeouts = 1;
      desc = `Vous menez de ${diff}, ballon en main, mais ${tired[0].short} et ${tired[1].short} sont cuits. Un seul temps mort.`;
    }
    s.score[0] = base + Math.max(diff, 0);
    s.score[1] = base + Math.max(-diff, 0);
    s.poss = ball;
    s.teams.forEach((T, i) => boxScore(s, T, s.score[i]));
    if (rnd(s) < 0.7) { s.ball = 'dead'; s.subsOk = true; s.sit = 'Remise en jeu ligne de touche'; }
    else { s.ball = 'live'; s.subsOk = false; s.shot = ri(s, 16, 24); s.sit = 'Ballon en jeu'; }
    s.challenge = { fam, title: S.FAMILIES.find((f) => f.key === fam).title, desc };
    s.teams.forEach((T, i) => {
      const on = E.lineup(s, i), opp = E.lineup(s, 1 - i);
      T.orders = {
        play: 'pnr', target: maxBy(on, E.scorer).id, tempo: 'normal',
        scheme: 'paint', dblTarget: maxBy(opp, E.scorer).id, endgame: 'normal',
      };
    });
    return s;
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
