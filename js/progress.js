/* Money Time — progression : étoiles par défi, palmarès, trophées, code de partage.
   La progression est gardée dans le navigateur du joueur (localStorage) et n'est jamais envoyée nulle part.
   Si le navigateur refuse de la garder (navigation privée, réglages), le jeu reste jouable : elle vit le temps de la page. */
(function (root) {
  'use strict';
  const MT = (root.MT = root.MT || {});
  const P = (MT.progress = {});
  const KEY = 'moneytime.progress';

  /* ---------- mémoire ---------- */
  const blank = () => ({
    v: 1, best: {}, played: 0, wins: 0, streak: 0, bestStreak: 0, home: [0, 0], away: [0, 0],
    plays: [], schemes: [], events: [], trophies: {},
  });
  let data = blank(), kept = true;
  try {
    root.localStorage.setItem(KEY + '.test', '1');
    root.localStorage.removeItem(KEY + '.test');
    const raw = root.localStorage.getItem(KEY);
    if (raw) data = Object.assign(blank(), JSON.parse(raw));
  } catch (e) { kept = false; }
  function save() {
    if (!kept) return;
    try { root.localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { kept = false; }
  }
  /** La progression survit-elle à la fermeture de la page ? */
  P.kept = () => kept;
  P.data = () => data;
  P.reset = function () {
    data = blank();
    try { root.localStorage.removeItem(KEY); } catch (e) { /* rien à effacer */ }
  };

  /* ---------- étoiles : gagner, puis deux objectifs propres au scénario ---------- */
  const GOALS = {
    lead: ['Gagner', 'Encaisser 4 points ou moins', 'Gagner sans faute volontaire'],
    comeback: ['Gagner', 'Gagner sans prolongation', 'Faire souffler votre vedette au moins une séquence'],
    tie: ['Gagner', 'Gagner sans prolongation', 'Votre défenseur à cinq fautes n’est pas exclu'],
    nonet: ['Gagner', 'Gagner sans prolongation', 'Gagner sans faute volontaire'],
    legs: ['Gagner', 'Gagner sans prendre de temps mort', 'Gagner de 4 points ou plus'],
  };
  P.goals = (fam) => GOALS[fam] || GOALS.lead;
  const teamKeys = () => MT.TEAMS.map((t) => t.key);
  const famKeys = () => MT.scenarios.FAMILIES.map((f) => f.key);
  P.maxStars = () => teamKeys().length * famKeys().length * 3;
  P.best = (team, fam) => data.best[team + ':' + fam] || 0;
  P.teamStars = (team) => famKeys().reduce((a, f) => a + P.best(team, f), 0);
  P.totalStars = () => Object.keys(data.best).reduce((a, k) => a + data.best[k], 0);
  const teamsWon = () => teamKeys().filter((t) => famKeys().some((f) => P.best(t, f) >= 1)).length;

  /** Ce que le match a montré, pour les étoiles et les trophées. */
  function facts(s) {
    const u = s.user, o = 1 - u, log = s.log || [];
    const m = (sc) => sc[u] - sc[o];
    const won = s.winner === u;
    const ordered = log.some((g) => g.poss !== u && g.dd.endgame === 'foul');
    const score0 = s.score0 || (log[0] ? log[0].score0 : s.score);
    const U = s.teams[u], ch = s.challenge || {};
    let goals;
    switch (ch.fam) {
      case 'lead': goals = [s.score[o] - score0[o] <= 4, !ordered]; break;
      case 'comeback': goals = [s.period === 4, !!ch.star && log.some((g) => g.on && !g.on[u].includes(ch.star))]; break;
      case 'tie': { const p = U.players.find((x) => x.id === ch.stopper); goals = [s.period === 4, !!p && p.fouls < 6]; break; }
      case 'nonet': goals = [s.period === 4, !ordered]; break;
      default: goals = [!(s.toUsed && s.toUsed[u]), m(s.score) >= 4];
    }
    const stars = [won, won && goals[0], won && goals[1]];
    // trois possessions adverses de suite sans encaisser
    let run = 0, wall = 0;
    log.forEach((g) => { if (g.poss === o) { run = g.score1[o] === g.score0[o] ? run + 1 : 0; wall = Math.max(wall, run); } });
    // panier décisif : la dernière action qui donne l'avantage pour de bon
    let hero = null;
    if (won) for (let i = log.length - 1; i >= 0; i--) { const g = log[i]; if (g.poss === u && m(g.score0) <= 0 && m(g.score1) > 0) { hero = g.scorer; break; } }
    const last = log[log.length - 1];
    return {
      won, stars, n: stars.filter(Boolean).length, ordered,
      trail4: log.some((g) => (g.clock0 <= 30 && m(g.score0) <= -4) || (g.clock1 <= 30 && m(g.score1) <= -4)),
      awayFire: s.home !== u && Math.max(s.crowd || 0, s.crowdHi == null ? -100 : s.crowdHi) >= 60,
      ot: s.period - 4,
      buzzer: won && !!last && last.poss === u && last.clock1 <= 1 && m(last.score0) <= 0 && m(last.score1) > 0,
      wall,
      benchHero: !!hero && !!log[0] && !log[0].on[u].includes(hero),
      fresh: U.players.every((p) => p.fatigue <= 85),
      plays: log.filter((g) => g.poss === u && g.score1[u] > g.score0[u]).map((g) => g.oo.play),
      schemes: log.filter((g) => g.poss === o && g.score1[o] === g.score0[o]).map((g) => g.dd.scheme),
      events: (s.ev && s.ev.seen) || [], evN: (s.ev && s.ev.n) || 0,
    };
  }
  P.facts = facts;

  /* ---------- trophées ---------- */
  const all = (list, keys) => keys.every((k) => list.includes(k));
  P.TROPHIES = [
    { k: 'first', g: 'Parcours', name: 'Premier banc', desc: 'Gagner un premier défi.', ok: (f, d) => d.wins >= 1 },
    { k: 'perfect', g: 'Parcours', name: 'Sans fausse note', desc: 'Obtenir trois étoiles sur un défi.', ok: (f, d) => Object.keys(d.best).some((x) => d.best[x] >= 3) },
    { k: 'specialist', g: 'Parcours', name: 'Spécialiste', desc: 'Réussir les cinq scénarios avec une même équipe.', ok: () => teamKeys().some((t) => famKeys().every((fm) => P.best(t, fm) >= 1)) },
    { k: 'tour', g: 'Parcours', name: 'Tour de la ligue', desc: 'Gagner avec dix équipes différentes.', ok: () => teamsWon() >= 10 },
    { k: 'league', g: 'Parcours', name: 'Toute la ligue', desc: 'Gagner avec les dix-huit équipes.', ok: () => teamsWon() >= teamKeys().length },
    { k: 'centurion', g: 'Parcours', name: 'Centurion', desc: 'Réunir 100 étoiles.', ok: () => P.totalStars() >= 100 },
    { k: 'slam', g: 'Parcours', name: 'Grand chelem', desc: 'Réunir toutes les étoiles du palmarès.', ok: () => P.totalStars() >= P.maxStars() },
    { k: 'comeback', g: 'Exploits', name: 'Remontée impossible', desc: 'Gagner en étant mené de 4 points ou plus à 30 secondes de la fin.', ok: (f) => f.won && f.trail4 },
    { k: 'silence', g: 'Exploits', name: 'Faire taire la salle', desc: 'Gagner à l’extérieur après que la salle a été en feu.', ok: (f) => f.won && f.awayFire },
    { k: 'cool', g: 'Exploits', name: 'Sang-froid', desc: 'Gagner après une prolongation.', ok: (f) => f.won && f.ot >= 1 },
    { k: 'marathon', g: 'Exploits', name: 'Marathon', desc: 'Gagner après deux prolongations.', secret: true, ok: (f) => f.won && f.ot >= 2 },
    { k: 'buzzer', g: 'Exploits', name: 'Au buzzer', desc: 'Gagner sur un panier marqué dans la dernière seconde.', ok: (f) => f.buzzer },
    { k: 'wall', g: 'Exploits', name: 'Le mur', desc: 'Arrêter trois possessions adverses de suite sans encaisser de point.', ok: (f) => f.wall >= 3 },
    { k: 'tactician', g: 'Tactique', name: 'Tacticien', desc: 'Marquer avec chacun des six systèmes, sur l’ensemble de vos parties.', ok: (f, d) => all(d.plays, Object.keys(MT.L.play)) },
    { k: 'defense', g: 'Tactique', name: 'Maître des défenses', desc: 'Arrêter une possession adverse avec chacune des six défenses, sur l’ensemble de vos parties.', ok: (f, d) => all(d.schemes, Object.keys(MT.L.scheme)) },
    { k: 'poker', g: 'Tactique', name: 'Coup de poker', desc: 'Gagner un match où vous avez ordonné une faute volontaire.', ok: (f) => f.won && f.ordered },
    { k: 'bench', g: 'Tactique', name: 'Banc décisif', desc: 'Gagner quand un joueur entré en cours de défi marque le panier décisif.', ok: (f) => f.won && f.benchHero },
    { k: 'manager', g: 'Tactique', name: 'Gestionnaire', desc: 'Gagner sans qu’aucun de vos joueurs ne finisse au-dessus de 85 % de fatigue.', secret: true, ok: (f) => f.won && f.fresh },
    { k: 'events', g: 'Imprévus', name: 'Rien ne m’étonne', desc: 'Vivre les douze événements aléatoires, sur l’ensemble de vos parties.', ok: (f, d) => all(d.events, Object.keys(MT.events.DEFS)) },
    { k: 'chief', g: 'Imprévus', name: 'Chef de meute', desc: 'Gagner un match marqué par trois événements.', secret: true, ok: (f) => f.won && f.evN >= 3 },
  ];

  /** Range un match terminé ; renvoie { stars, n, prev, record, trophies } (une seule fois par match). */
  P.record = function (s) {
    if (s.recorded) return s.recorded;
    const f = facts(s), o = s.opts || {};
    const key = o.team + ':' + (s.challenge ? s.challenge.fam : o.fam);
    const prev = data.best[key] || 0;
    if (f.n > prev) data.best[key] = f.n;
    data.played++;
    if (f.won) { data.wins++; data.streak++; data.bestStreak = Math.max(data.bestStreak, data.streak); } else data.streak = 0;
    const v = s.home === s.user ? data.home : data.away;
    v[0]++; if (f.won) v[1]++;
    const merge = (list, add) => add.forEach((x) => { if (!list.includes(x)) list.push(x); });
    merge(data.plays, f.plays); merge(data.schemes, f.schemes); merge(data.events, f.events);
    const today = new Date().toISOString().slice(0, 10), fresh = [];
    P.TROPHIES.forEach((t) => { if (!data.trophies[t.k] && t.ok(f, data)) { data.trophies[t.k] = today; fresh.push(t); } });
    save();
    s.recorded = { stars: f.stars, n: f.n, prev, record: f.n > prev, trophies: fresh.map((t) => t.k) };
    return s.recorded;
  };

  /* ---------- partage : un défi se reproduit à partir de ses choix résolus et de sa graine ---------- */
  /** Code du type SEA-PIT-ext-comeback-1a2b3c-1.8 */
  P.code = (s) => [s.opts.team, s.opts.opp, s.opts.venue === 'home' ? 'dom' : 'ext', s.opts.fam, (s.seed0 >>> 0).toString(36), MT.VERSION].join('-');
  P.parse = function (code) {
    const p = String(code || '').trim().split('-');
    if (p.length < 6) return null;
    const [team, opp, ven, fam, seed] = p, version = p.slice(5).join('-');
    const keys = teamKeys();
    if (!keys.includes(team) || !keys.includes(opp) || team === opp || !famKeys().includes(fam) || !['dom', 'ext'].includes(ven)) return null;
    const n = parseInt(seed, 36);
    if (!/^[0-9a-z]+$/.test(seed) || !isFinite(n)) return null;
    return { team, opp, fam, venue: ven === 'dom' ? 'home' : 'away', seed: n | 0, version };
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
