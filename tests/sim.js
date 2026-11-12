/* Simulations de contrôle : ouvrir tests/sim.html dans le navigateur (ou : node tests/sim.js).
   Les deux bancs sont confiés au coach simulé pour vérifier la cohérence et l'équilibre du moteur. */
if (typeof require !== 'undefined') ['data', 'teams', 'engine', 'ai', 'scenarios', 'events'].forEach((f) => require('../js/' + f + '.js'));
const MT = globalThis.MT, E = MT.engine;
const out = [];
let failed = false;
const say = (...a) => { const l = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '); out.push(l); console.log(l); };
function assert(c, msg) { if (!c) { if (!failed || out.length < 60) say('ÉCHEC : ' + msg); failed = true; } }

const N = 6000;
const K = MT.TEAMS.length;
let userWins = 0, pts = 0, ot = 0, segs = 0, kinds = {};
// une partie sur deux subit les événements aléatoires, avec des choix tirés au hasard
const evStat = { games: 0, n: 0, max: 0, by: {} };
const rec = {}, box = { fga: 0, fgm: 0, tpa: 0, tpm: 0, n: 0 };
MT.TEAMS.forEach((t) => (rec[t.key] = { w: 0, g: 0 }));
for (let g = 0; g < N; g++) {
  // chaque équipe affronte les autres à tour de rôle, tantôt côté joueur, tantôt côté adversaire
  const i = g % K, j = (i + 1 + Math.floor(g / K) % (K - 1)) % K;
  const s = MT.scenarios.generate({ team: MT.TEAMS[i].key, opp: MT.TEAMS[j].key, seed: 1000 + g });
  let guard = 0;
  const withEv = g % 2 === 1;
  if (withEv) evStat.games++;
  while (!s.over && guard++ < 200) {
    if (withEv) {
      MT.events.tick(s);
      const e = MT.events.roll(s);
      if (e) {
        const ok = e.choices.map((c, i) => (c.off ? -1 : i)).filter((i) => i >= 0);
        assert(ok.length >= 1 && e.text && e.choices.length >= 2, 'événement jouable : ' + e.key);
        const sc = s.score[0] + s.score[1];
        const r = MT.events.apply(s, e, ok[Math.floor(E.rnd(s) * ok.length)]);
        assert(r.length && r[0].text && !/undefined|NaN/.test(r[0].text + e.text), 'texte d’événement : ' + e.key);
        pts += s.score[0] + s.score[1] - sc;
        evStat.n++; evStat.by[e.key] = (evStat.by[e.key] || 0) + 1;
      }
    }
    for (let t = 0; t < 2; t++) {
      MT.ai.intervene(s, t).forEach((e) => (kinds[e.kind] = (kinds[e.kind] || 0) + 1));
      MT.ai.orders(s, t);
    }
    E.recordHabits(s);
    const c0 = s.clock, p0 = s.period, sc0 = s.score[0] + s.score[1];
    const evs = E.playSegment(s);
    evs.forEach((e) => (kinds[e.kind] = (kinds[e.kind] || 0) + 1));
    segs++;
    pts += s.score[0] + s.score[1] - sc0;
    assert(s.period > p0 || s.clock <= c0, 'le chrono a reculé');
    assert(s.clock >= 0 && s.shot >= 0, 'chrono négatif');
    s.teams.forEach((T, ti) => {
      assert(T.onCourt.length === 5 && new Set(T.onCourt).size === 5, 'cinq joueurs distincts sur le terrain');
      assert(T.onCourt.every((id) => E.getP(s, id).fouls < 6 || E.bench(s, ti).every((b) => b.fouls >= 6)), 'joueur exclu encore en jeu');
      assert(T.timeouts >= 0, 'temps morts négatifs');
    });
  }
  assert(s.over, 'match non terminé');
  assert(s.ev.n <= (s.period > 4 ? 4 : 3) && new Set(s.ev.seen).size === s.ev.seen.length, 'au plus trois événements (quatre en prolongation), tous différents');
  evStat.max = Math.max(evStat.max, s.ev.n);
  s.teams.forEach((T, ti) => {
    const sum = (k) => T.players.reduce((a, p) => a + p.st[k], 0);
    assert(sum('pts') === s.score[ti], 'les points des joueurs retombent sur le score');
    assert(T.players.every((p) => p.st.pts === 2 * p.st.fgm + p.st.tpm + p.st.ftm && p.st.fgm <= p.st.fga && p.st.tpm <= p.st.tpa && p.st.ftm <= p.st.fta), 'feuille de match cohérente');
    box.fga += sum('fga'); box.fgm += sum('fgm'); box.tpa += sum('tpa'); box.tpm += sum('tpm'); box.n++;
  });
  s.teams.forEach((T, ti) => { rec[T.key].g++; if (s.winner === ti) rec[T.key].w++; });
  if (s.winner === s.user) userWins++;
  if (s.period > 4) ot++;
}
say(`${N} matchs entre les ${K} équipes — côté « joueur » gagnant : ${(userWins / N * 100).toFixed(1)} %`);
say(`séquences par match : ${(segs / N).toFixed(1)} — points par séquence : ${(pts / segs).toFixed(2)} — prolongations : ${(ot / N * 100).toFixed(1)} %`);
say('victoires par équipe : ' + Object.keys(rec).sort((a, b) => rec[b].w / rec[b].g - rec[a].w / rec[a].g).map((k) => `${k} ${(rec[k].w / rec[k].g * 100).toFixed(0)} %`).join(' · '));
say(`feuille de match moyenne par équipe : ${(box.fgm / box.n).toFixed(1)}/${(box.fga / box.n).toFixed(1)} aux tirs (${(box.fgm / box.fga * 100).toFixed(1)} %), ${(box.tpm / box.n).toFixed(1)}/${(box.tpa / box.n).toFixed(1)} à 3 pts (${(box.tpm / box.tpa * 100).toFixed(1)} %)`);
say('événements :', kinds);
say(`événements aléatoires : ${(evStat.n / evStat.games).toFixed(2)} par partie (maximum ${evStat.max}) —`, evStat.by);
assert(Object.keys(evStat.by).length === Object.keys(MT.events.DEFS).length, 'les douze événements surviennent');

/* Base de données : 18 équipes de 9 joueurs, identifiants et noms de famille uniques. */
{
  const all = MT.TEAMS.flatMap((t) => t.players.map((p) => ({ t: t.key, p })));
  assert(K === 18 && MT.TEAMS.every((t) => t.players.length === 9), '18 équipes de 9 joueurs');
  assert(new Set(all.map((x) => x.p.short)).size === all.length, 'noms de famille uniques');
  assert(MT.TEAMS.every((t) => new Set(t.players.map((p) => p.num)).size === 9), 'numéros uniques par équipe');
  assert(all.every((x) => MT.COUNTRIES[x.p.nat] && x.p.age >= 19 && x.p.age <= 40), 'âge et pays renseignés');
  assert(all.every((x) => MT.ATTRS.every((a) => x.p[a.k] >= 1 && x.p[a.k] <= 10)), 'attributs entre 1 et 10');
  const intl = all.filter((x) => x.p.nat !== 'US').length;
  say(`base : ${all.length} joueurs, ${intl} étrangers de ${new Set(all.map((x) => x.p.nat)).size - 1} pays, âges ${Math.min(...all.map((x) => x.p.age))}–${Math.max(...all.map((x) => x.p.age))} ans`);
}

/* Critère du cahier des charges : libérer un bon tireur vaut mieux qu'un tir contesté. */
function trial(play, scheme, n) {
  let made = 0, shots = 0, o = 0;
  for (let i = 0; i < n; i++) {
    const s = MT.scenarios.generate({ team: 'SEA', opp: 'PIT', seed: 50000 + i });
    s.poss = 0; s.clock = 120; s.shot = 24; s.score = [100, 100];
    s.teams.forEach((T) => T.players.forEach((p) => { p.fatigue = 50; p.fouls = 1; }));
    Object.assign(s.teams[0].orders, { play, target: 'SEA11', tempo: 'normal' });
    Object.assign(s.teams[1].orders, { scheme, endgame: 'normal', dblTarget: 'SEA3' });
    E.playSegment(s);
    const r = s.log[0].read;
    if (r && r.who === 'Lambert' && r.type === 'three') { shots++; o += r.o; made += r.pm; }
  }
  return { shots, pct: made / shots, open: o / shots };
}
const a = trial('shooter', 'paint', 4000), b = trial('iso', 'perimeter', 4000), c = trial('shooter', 'perimeter', 4000);
say(`Lambert à 3 pts — système tireur vs raquette protégée : ${(a.pct * 100).toFixed(1)} % (${a.shots} tirs, ouverture ${a.open.toFixed(2)})`);
say(`Lambert à 3 pts — système tireur vs 3 pts limités : ${(c.pct * 100).toFixed(1)} % (${c.shots} tirs, ouverture ${c.open.toFixed(2)})`);
say(`Lambert à 3 pts — isolation vs 3 pts limités : ${(b.pct * 100).toFixed(1)} % (${b.shots} tirs, ouverture ${b.open.toFixed(2)})`);
assert(a.pct > c.pct + 0.03 && c.pct > b.pct, 'un tireur libéré doit mieux réussir qu’un tir contesté');

/* Équilibre des consignes : points par séquence pour chaque système face à chaque défense, toutes équipes confondues. */
{
  const plays = Object.keys(MT.L.play), schemes = Object.keys(MT.L.scheme), n = 1400;
  const big = (five) => E.maxBy(five, (p) => p.h + 2 * p.fin), shooter = (five) => E.maxBy(five, (p) => p.three);
  const cell = (play, scheme, i) => {
    const s = MT.scenarios.generate({ team: MT.TEAMS[i % K].key, opp: MT.TEAMS[(i * 7 + 3) % K].key === MT.TEAMS[i % K].key ? MT.TEAMS[(i + 1) % K].key : MT.TEAMS[(i * 7 + 3) % K].key, seed: 90000 + i });
    s.poss = 0; s.clock = 120; s.shot = 24; s.score = [100, 100]; s.bc = scheme === 'press';
    s.teams.forEach((T) => T.players.forEach((p) => { p.fatigue = 50; p.fouls = 1; p.form = 0; }));
    const five = E.lineup(s, 0);
    const target = play === 'post' ? big(five) : play === 'shooter' ? shooter(five) : E.maxBy(five, E.scorer);
    Object.assign(s.teams[0].orders, { play, target: target.id, tempo: 'normal' });
    Object.assign(s.teams[1].orders, { scheme, endgame: 'normal', dblTarget: target.id });
    const c0 = s.clock;
    E.playSegment(s);
    return { pts: s.score[0] - 100, to: s.log[0].to ? 1 : 0, t: c0 - s.clock };
  };
  const tab = {}, rowAvg = {}, colAvg = {};
  let lo = 9, hi = 0;
  say('points par séquence (pertes de balle %) — lignes : attaque, colonnes : ' + schemes.join(' | '));
  for (const play of plays) {
    const line = [];
    for (const scheme of schemes) {
      let pts = 0, to = 0, tt = 0;
      for (let i = 0; i < n; i++) { const r = cell(play, scheme, i); pts += r.pts; to += r.to; tt += r.t; }
      const v = pts / n;
      tab[play + scheme] = v; lo = Math.min(lo, v); hi = Math.max(hi, v);
      rowAvg[play] = (rowAvg[play] || 0) + v / schemes.length; colAvg[scheme] = (colAvg[scheme] || 0) + v / plays.length;
      line.push(`${v.toFixed(2)} (${Math.round(to / n * 100)}) ${(tt / n).toFixed(0)}s`);
    }
    say(`  ${play.padEnd(8)} ${line.join(' | ')}  → moyenne ${rowAvg[play].toFixed(2)}`);
  }
  say('  moyenne par défense : ' + schemes.map((k) => `${k} ${colAvg[k].toFixed(2)}`).join(' · '));
  assert(lo > 0.8 && hi < 1.4, 'aucune combinaison attaque/défense ne doit écraser les autres');
  assert(Math.max(...Object.values(rowAvg)) - Math.min(...Object.values(rowAvg)) < 0.16, 'les systèmes d’attaque restent proches en moyenne');
  assert(Math.max(...Object.values(colAvg)) - Math.min(...Object.values(colAvg)) < 0.16, 'les défenses restent proches en moyenne');
}

/* Un temps mort ne remet pas l'équipe à neuf. */
{
  const s = MT.scenarios.generate({ team: 'SEA', opp: 'PIT', seed: 7 });
  s.teams[0].timeouts = 1; s.ball = 'dead';
  const p = E.lineup(s, 0)[0]; p.fatigue = 80;
  E.callTimeout(s, 0);
  assert(p.fatigue < 80 && p.fatigue > 60, 'récupération partielle sur temps mort');
  assert(!E.canTimeout(s, 0).ok, 'temps mort épuisé signalé');
}
say(failed ? 'Des contrôles ont échoué.' : 'Tous les contrôles passent.');
globalThis.SIM_OUT = out;
if (typeof document !== 'undefined') document.getElementById('out').textContent = out.join('\n');
else if (failed) process.exitCode = 1;
