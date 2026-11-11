/* Money Time — événements aléatoires : au plus trois par match (quatre avec prolongation), jamais deux de suite.
   roll() tire un événement et ses choix, apply() en applique un, tick() raconte les suites différées.
   Aucun accès au DOM. Les effets durables passent par les joueurs (aptitudes, forme, fatigue) ou par s.mods, lu par le moteur. */
(function (root) {
  'use strict';
  const MT = (root.MT = root.MT || {});
  const E = MT.engine, rnd = E.rnd, clamp = E.clamp, maxBy = E.maxBy, eff = E.eff, L = MT.L;
  const EV = (MT.events = {});
  const pick = (s, a) => a[Math.floor(rnd(s) * a.length)];
  const form = (p, d) => (p.form = clamp((p.form || 0) + d, -1, 1));
  const drop = (p, keys, d) => keys.forEach((k) => (p[k] = Math.max(1, p[k] - d)));
  const dead = (s, sit) => { s.ball = 'dead'; s.subsOk = true; s.sit = sit; };

  /** Remplace p par le meilleur joueur disponible du banc ; renvoie l'entrant ou null. */
  function autoSub(s, t, p) {
    const c = E.bench(s, t).filter((b) => b.fouls < 6);
    const b = maxBy(c, (x) => E.ovr(x) + (E.posCompat(x, p) ? 2 : 0));
    return b && E.substitute(s, t, p.id, b.id) ? b : null;
  }
  function freeThrows(s, t, sh, n) {
    let made = 0;
    for (let i = 0; i < n; i++) {
      sh.st.fta++;
      if (rnd(s) < 0.4 + 0.055 * eff(sh, 'ft')) { made++; sh.st.ftm++; sh.st.pts++; s.score[t]++; }
    }
    return n === 1 ? `${sh.short} ${made ? 'transforme' : 'manque'} le lancer.` : `${sh.short} : ${made} lancer${made > 1 ? 's' : ''} réussi${made > 1 ? 's' : ''} sur ${n}.`;
  }
  /** Faute sifflée hors séquence contre l'équipe t ; lancers si elle est en pénalité. */
  function giveFoul(s, t, fouler, victim) {
    const T = s.teams[t];
    fouler.fouls++; T.teamFouls++;
    let txt = `Faute de ${fouler.short} (${fouler.fouls}e faute personnelle). `;
    if (T.toGive > 0) { T.toGive--; txt += 'Pas de lancer.'; }
    else txt += 'Équipe en pénalité : ' + freeThrows(s, 1 - t, victim, 2);
    if (fouler.fouls >= 6) { const b = autoSub(s, t, fouler); txt += ` ${fouler.short} est exclu${b ? `, ${b.short} le remplace` : ''}.`; }
    return txt;
  }

  /* Chaque événement : make(s, u) renvoie { text, d, choices } ou null s'il ne peut pas survenir ;
     run(s, u, d, i) applique le choix i et renvoie le texte du commentaire. */
  const DEFS = {
    injury: {
      title: 'Joueur touché',
      make(s, u) {
        const p = E.wpick(s, E.lineup(s, u), (x) => 20 + x.fatigue);
        return {
          d: { id: p.id },
          text: `${p.name} retombe mal et se tient la cheville. Il fait signe qu’il peut continuer, mais il grimace.`,
          choices: [
            { label: 'Le sortir', hint: 'Il est remplacé d’office ; vous pouvez ajuster le cinq avant la reprise.' },
            { label: 'Le laisser sur le terrain', hint: 'Rapidité, défense extérieure et détente en baisse, avec un risque que la cheville lâche.' },
          ],
        };
      },
      run(s, u, d, i) {
        const p = E.getP(s, d.id);
        if (i === 0) {
          drop(p, ['spd', 'dunk'], 1);
          const b = autoSub(s, u, p);
          dead(s, 'Reprise après soins');
          return b ? `${p.short} rejoint le banc pour se faire strapper, ${b.short} entre en jeu.` : `Personne pour remplacer ${p.short} : il serre les dents.`;
        }
        drop(p, ['spd', 'dext', 'dunk'], 2); drop(p, ['fin'], 1);
        p.hurt = 1;
        return `${p.short} reste sur le terrain, la cheville douloureuse.`;
      },
    },
    cramps: {
      title: 'Crampes',
      make(s, u) {
        const c = E.lineup(s, u).filter((p) => p.fatigue >= 68);
        if (!c.length) return null;
        const p = maxBy(c, (x) => x.fatigue), to = s.teams[u].timeouts > 0;
        return {
          d: { id: p.id },
          text: `${p.name} se tient le mollet : les crampes arrivent (fatigue ${Math.round(p.fatigue)} %).`,
          choices: [
            { label: 'Le remplacer', hint: 'Il sort souffler ; vous pouvez ajuster le cinq avant la reprise.' },
            { label: 'Temps mort pour le soigner', hint: 'Coûte un temps mort : il récupère nettement, les autres un peu.', off: to ? '' : 'Plus aucun temps mort.' },
            { label: 'Continuer ainsi', hint: 'Sa fatigue grimpe encore et il perd en rapidité.' },
          ],
        };
      },
      run(s, u, d, i) {
        const p = E.getP(s, d.id);
        if (i === 0) {
          const b = autoSub(s, u, p);
          dead(s, 'Reprise après soins');
          return b ? `${p.short} sort en boitillant, ${b.short} le remplace.` : `Personne pour remplacer ${p.short}.`;
        }
        if (i === 1) {
          const e = E.callTimeout(s, u);
          p.fatigue = clamp(p.fatigue - 14, 0, 100);
          const subs = MT.ai.onTimeout(s, 1 - u).map((x) => x.text).join(' ');
          return `${e.text} Le kiné s’occupe du mollet de ${p.short}. ${subs}`.trim();
        }
        p.fatigue = clamp(p.fatigue + 10, 0, 100); drop(p, ['spd'], 1);
        return `${p.short} s’étire rapidement et reprend sa place, les jambes raides.`;
      },
    },
    review: {
      title: 'Action litigieuse',
      make(s, u) {
        const c = E.lineup(s, u).filter((p) => p.fouls <= 4);
        if (!c.length) return null;
        const p = pick(s, c), v = pick(s, E.lineup(s, 1 - u)), T = s.teams[u];
        return {
          d: { id: p.id, vid: v.id },
          text: `Coup de sifflet loin du ballon : faute de ${p.name} sur ${v.short}. Le contact paraît très léger${T.toGive > 0 ? '' : ', et vous êtes en pénalité : deux lancers'}.`,
          choices: [
            { label: 'Demander la vidéo', hint: 'Si la décision est maintenue, vous perdez un temps mort.', off: T.timeouts > 0 ? '' : 'Il faut un temps mort pour contester.' },
            { label: 'Laisser jouer', hint: `La faute est maintenue : ce sera la ${p.fouls + 1}e de ${p.short}.` },
          ],
        };
      },
      run(s, u, d, i) {
        const p = E.getP(s, d.id), v = E.getP(s, d.vid);
        if (i === 0) {
          if (rnd(s) < 0.45) return `Après visionnage, les arbitres annulent la faute de ${p.short}. Contestation gagnée, le temps mort est conservé.`;
          s.teams[u].timeouts--;
          return `Décision maintenue après visionnage : le temps mort est perdu. ${giveFoul(s, u, p, v)}`;
        }
        return giveFoul(s, u, p, v);
      },
    },
    temper: {
      title: 'Colère contre l’arbitre',
      make(s, u) {
        const p = maxBy(E.lineup(s, u), E.scorer);
        return {
          d: { id: p.id },
          text: `${p.name} n’a pas digéré le dernier coup de sifflet et le fait savoir à l’arbitre, de plus en plus fort.`,
          choices: [
            { label: 'Le calmer', hint: 'Aucun risque, mais il sort un peu de son match.' },
            { label: 'Le laisser s’expliquer', hint: 'Il peut en sortir remonté à bloc… ou écoper d’une faute technique : un lancer pour l’adversaire.' },
          ],
        };
      },
      run(s, u, d, i) {
        const p = E.getP(s, d.id);
        if (i === 0) { form(p, -0.15); return `Vous ramenez ${p.short} vers le banc. Il se tait, la mâchoire serrée.`; }
        if (rnd(s) < 0.4) {
          const sh = maxBy(E.lineup(s, 1 - u), (x) => eff(x, 'ft'));
          return `Faute technique contre ${p.short} ! ${freeThrows(s, 1 - u, sh, 1)}`;
        }
        form(p, 0.3);
        return `${p.short} dit ce qu’il avait à dire, puis revient le regard noir. Il a quelque chose à prouver.`;
      },
    },
    ball: {
      title: '« Donnez-moi le ballon »',
      make(s, u) {
        const p = maxBy(E.lineup(s, u), (x) => x.form);
        if (!p || p.form < 0.15) return null;
        return {
          d: { id: p.id },
          text: `${p.name} vient vers vous : « Coach, je le sens ce soir. Le prochain ballon est pour moi. » Il a ${p.st.pts} points.`,
          choices: [
            { label: 'Promettre le ballon', hint: 'Sa confiance grimpe. S’il n’est pas le joueur recherché sur votre prochaine attaque, il se braque.' },
            { label: 'Refuser', hint: 'Vous gardez la main sur vos systèmes, sa confiance en prend un coup.' },
          ],
        };
      },
      run(s, u, d, i) {
        const p = E.getP(s, d.id);
        if (i === 0) { form(p, 0.25); s.mods.want = { team: u, id: p.id }; return `${p.short} hoche la tête : le prochain ballon est pour lui.`; }
        form(p, -0.25);
        return `${p.short} repart sans un mot.`;
      },
    },
    scuffle: {
      title: 'Accrochage',
      make(s, u) {
        const a = pick(s, E.lineup(s, u).filter((p) => p.fouls <= 4)), b = pick(s, E.lineup(s, 1 - u).filter((p) => p.fouls <= 4));
        if (!a || !b) return null;
        return {
          d: { a: a.id, b: b.id },
          text: `Ça chauffe entre ${a.name} et ${b.name} : coups d’épaule, quelques mots, les arbitres s’approchent.`,
          choices: [
            { label: 'Calmer vos joueurs', hint: 'L’incident s’arrête là.' },
            { label: 'Laisser monter', hint: 'L’adversaire peut craquer et prendre la faute… ou votre joueur.' },
          ],
        };
      },
      run(s, u, d, i) {
        const a = E.getP(s, d.a), b = E.getP(s, d.b);
        if (i === 0) return `Vous rappelez ${a.short} à l’ordre, le jeu peut reprendre.`;
        const x = rnd(s);
        if (x < 0.36) return `${b.short} craque et repousse ${a.short} des deux mains. ${giveFoul(s, 1 - u, b, a)}`;
        if (x < 0.68) return `${a.short} répond d’un geste de trop. ${giveFoul(s, u, a, b)}`;
        a.fatigue = clamp(a.fatigue + 3, 0, 100); b.fatigue = clamp(b.fatigue + 3, 0, 100);
        return 'Les arbitres séparent tout le monde sans siffler. Beaucoup d’énergie dépensée pour rien.';
      },
    },
    hack: {
      title: 'Cible aux lancers',
      make(s, u) {
        if (s.poss === u) return null;
        const p = maxBy(E.lineup(s, 1 - u), (x) => -x.ft);
        if (!p || p.ft > 5) return null;
        const pct = Math.round((0.4 + 0.055 * eff(p, 'ft')) * 100);
        return {
          d: { id: p.id },
          text: `Votre assistant vous glisse un chiffre : ${p.name} tourne autour de ${pct} % aux lancers francs, et il est sur le terrain.`,
          choices: [
            { label: 'Faire faute sur lui', hint: 'Faute volontaire dès cette possession, sur lui : une faute de plus pour vous, des lancers pour lui si vous êtes en pénalité.' },
            { label: 'Défendre normalement', hint: 'Vous gardez votre consigne.' },
          ],
        };
      },
      run(s, u, d, i) {
        const p = E.getP(s, d.id);
        if (i === 1) return 'Vous gardez votre plan défensif.';
        s.teams[u].orders.endgame = 'foul'; s.mods.hack = { team: u, id: p.id };
        return `Consigne passée : faute sur ${p.short} dès qu’il touche le ballon.`;
      },
    },
    crowd: {
      title: 'Le public s’enflamme',
      make(s, u) {
        return {
          d: {},
          text: 'La salle est debout et le bruit devient assourdissant. Vos joueurs le sentent et veulent courir.',
          choices: [
            { label: 'Accélérer pour en profiter', hint: 'Vos cinq joueurs gagnent en confiance, mais le risque de perte de balle augmente sur vos deux prochaines attaques.' },
            { label: 'Garder le contrôle', hint: 'Rien ne change : vous jouez votre match.' },
          ],
        };
      },
      run(s, u, d, i) {
        if (i === 1) return 'Vous faites signe de calmer le jeu.';
        E.lineup(s, u).forEach((p) => form(p, 0.15));
        s.mods.rush = { team: u, n: 2 };
        return 'Vous lâchez les chevaux : vos joueurs se nourrissent du bruit de la salle.';
      },
    },
    tip: {
      title: 'Conseil de l’assistant',
      make(s, u) {
        return {
          d: {},
          text: 'Votre assistant se penche vers vous : « J’ai repéré quelque chose dans leurs habitudes. Je vous le dis, ou vous préférez rester sur votre idée ? »',
          choices: [
            { label: 'Écouter son conseil', hint: 'Il annonce ce que l’adversaire devrait faire sur cette séquence. Il lui arrive de se tromper.' },
            { label: 'Se fier à son instinct', hint: 'Votre assurance rassure le groupe : légère hausse de confiance pour vos cinq joueurs.' },
          ],
        };
      },
      run(s, u, d, i) {
        if (i === 1) { E.lineup(s, u).forEach((p) => form(p, 0.08)); return '« Je sais ce que je fais. » Vos joueurs vous sentent sûr de vous.'; }
        const c = E.clone(s);
        MT.ai.orders(c, 1 - u);
        const o = c.teams[1 - u].orders;
        if (s.poss === u) return `L’assistant : « Ils vont ${L.scheme[o.scheme][0].toLowerCase()}${o.scheme === 'double' ? ' ' + E.getP(s, o.dblTarget).short : ''}. Enfin, je pense. »`;
        return `L’assistant : « Ça va être ${L.play[o.play][0].toLowerCase()} pour ${E.getP(s, o.target).short}. Enfin, je pense. »`;
      },
    },
    rookie: {
      title: 'Remplaçant qui trépigne',
      make(s, u) {
        const c = E.bench(s, u).filter((p) => p.fouls < 6 && p.age <= 25);
        if (!c.length) return null;
        const p = maxBy(c, (x) => -x.age + rnd(s));
        const star = maxBy(E.lineup(s, u), E.scorer); // on ne sort pas la vedette pour faire plaisir à un jeune
        const out = maxBy(E.lineup(s, u), (x) => x.fatigue + (E.posCompat(x, p) ? 25 : 0) - (x === star ? 40 : 0));
        return {
          d: { id: p.id, out: out.id },
          text: `${p.name}, ${p.age} ans, ne tient plus en place au bout du banc : « Coach, mettez-moi, je suis prêt. »`,
          choices: [
            { label: 'Le lancer', hint: `Il entre à la place de ${out.short}, gonflé à bloc, mais la pression pèse sur ses choix. Vous pouvez ajuster le cinq avant la reprise.` },
            { label: 'Le laisser sur le banc', hint: 'Il se rassoit, déçu.' },
          ],
        };
      },
      run(s, u, d, i) {
        const p = E.getP(s, d.id), out = E.getP(s, d.out);
        if (i === 1) { form(p, -0.2); return `${p.short} se rassoit en secouant la tête.`; }
        form(p, 0.35); drop(p, ['iq'], 2);
        E.substitute(s, u, out.id, p.id);
        dead(s, 'Reprise après changement');
        return `${p.short} arrache son survêtement et entre à la place de ${out.short}.`;
      },
    },
    pause: {
      title: 'Arrêt de jeu imprévu',
      make(s, u) {
        return {
          d: {},
          text: pick(s, ['Une flaque de sueur sous le panier : les arbitres arrêtent le jeu le temps d’essuyer le parquet.', 'Le chrono des 24 secondes est en panne : arrêt de jeu, le temps de le relancer.']),
          choices: [
            { label: 'Faire souffler le cinq', hint: 'Vos joueurs sur le terrain récupèrent.' },
            { label: 'Remobiliser le groupe', hint: 'Quelques mots pour redonner confiance à vos cinq joueurs.' },
            { label: 'En profiter pour remplacer', hint: 'Les remplacements sont ouverts avant la reprise.' },
          ],
        };
      },
      run(s, u, d, i) {
        // l'adversaire profite lui aussi de la pause, quel que soit votre choix
        E.lineup(s, 1 - u).forEach((p) => (p.fatigue = clamp(p.fatigue - 4, 0, 100)));
        if (i === 0) { E.lineup(s, u).forEach((p) => (p.fatigue = clamp(p.fatigue - 8, 0, 100))); return 'Vos joueurs s’assoient, boivent et récupèrent pendant l’interruption.'; }
        if (i === 1) { E.lineup(s, u).forEach((p) => form(p, 0.12)); return 'Vous réunissez le cinq : quelques mots simples, les regards se relèvent.'; }
        dead(s, 'Reprise après arrêt de jeu');
        return 'Vous faites signe à la table de marque : les remplacements sont ouverts.';
      },
    },
    hunted: {
      title: 'Joueur à cinq fautes pris pour cible',
      make(s, u) {
        if (s.poss === u) return null;
        const p = E.lineup(s, u).find((x) => x.fouls === 5 && !x.soft);
        if (!p) return null;
        return {
          d: { id: p.id },
          text: `Le banc adverse désigne ${p.name} du doigt : avec ses cinq fautes, ils vont l’attaquer pour le faire exclure.`,
          choices: [
            { label: 'Le protéger', hint: 'Il défend sur la retenue jusqu’à la fin : bien moins de fautes, mais une défense nettement plus molle.' },
            { label: 'Le sortir', hint: 'Il est remplacé d’office ; vous pouvez ajuster le cinq avant la reprise.' },
            { label: 'Ne rien changer', hint: 'Il défend normalement, avec un risque de faute accru sur vos deux prochaines défenses.' },
          ],
        };
      },
      run(s, u, d, i) {
        const p = E.getP(s, d.id);
        if (i === 0) { p.soft = true; drop(p, ['dext', 'dint', 'stl', 'blk'], 2); return `${p.short} reçoit la consigne : mains en l’air, aucun contact.`; }
        if (i === 1) {
          const b = autoSub(s, u, p);
          dead(s, 'Reprise après changement');
          return b ? `${p.short} sort, ${b.short} entre pour défendre à sa place.` : `Personne pour remplacer ${p.short}.`;
        }
        s.mods.hunt = { team: u, id: p.id, n: 2 };
        return `${p.short} reste en jeu et défend comme d’habitude. L’adversaire va le chercher.`;
      },
    },
  };
  EV.DEFS = DEFS;

  /** Un événement survient-il avant cette décision ? Renvoie { key, title, text, d, choices } ou null. */
  EV.roll = function (s) {
    if (s.over || s.segN < 1) return null;
    const ev = s.ev;
    if (ev.n >= (s.period > 4 ? 4 : 3) || s.segN - ev.seg < 2) return null;
    if (rnd(s) > 0.22) return null;
    const keys = Object.keys(DEFS).filter((k) => !ev.seen.includes(k));
    while (keys.length) {
      const k = keys.splice(Math.floor(rnd(s) * keys.length), 1)[0];
      const m = DEFS[k].make(s, s.user);
      if (!m) continue;
      ev.n++; ev.seg = s.segN; ev.seen.push(k);
      return { key: k, title: DEFS[k].title, text: m.text, d: m.d, choices: m.choices };
    }
    return null;
  };
  /** Applique le choix i ; renvoie les lignes de commentaire. */
  EV.apply = function (s, e, i) {
    const text = DEFS[e.key].run(s, s.user, e.d, i);
    return [{ kind: 'event', team: s.user, text: `${e.title} — ${text}`, snap: E.snap(s) }];
  };
  /** Suites différées, à appeler avant chaque décision : notes laissées par le moteur, cheville qui lâche. */
  EV.tick = function (s) {
    const out = (s.notes || []).map((t) => ({ kind: 'event', team: s.user, text: t, snap: E.snap(s) }));
    s.notes = [];
    if (s.over) return out;
    for (const p of E.lineup(s, s.user)) {
      if (p.hurt === 1 && rnd(s) < 0.22) {
        p.hurt = 2; drop(p, ['spd', 'dext', 'fin'], 2); p.fatigue = clamp(p.fatigue + 8, 0, 100);
        out.push({ kind: 'event', team: s.user, text: `La cheville de ${p.short} lâche un peu plus : il boite nettement.`, snap: E.snap(s) });
      }
    }
    return out;
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
