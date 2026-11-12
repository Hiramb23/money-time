/* Money Time — données de jeu : attributs et libellés des consignes. Les équipes sont dans teams.js. */
(function (root) {
  'use strict';
  const MT = (root.MT = root.MT || {});

  // à tenir à jour avec versions.html
  MT.VERSION = '1.1';

  // k : clé, label : libellé complet, short : libellé de carte, fat : part de l'attribut perdue à 100 % de fatigue
  MT.ATTRS = [
    { k: 'spd', label: 'Rapidité', short: 'Rapidité', group: 'Physique', fat: 0.35 },
    { k: 'end', label: 'Endurance', short: 'Endurance', group: 'Physique', fat: 0 },
    { k: 'three', label: 'Trois points', short: '3 pts', group: 'Tir et finition', fat: 0.12 },
    { k: 'mid', label: 'Mi-distance', short: 'Mi-dist.', group: 'Tir et finition', fat: 0.12 },
    { k: 'ft', label: 'Lancers francs', short: 'Lancers', group: 'Tir et finition', fat: 0.05 },
    { k: 'fin', label: 'Finition au cercle', short: 'Finition', group: 'Tir et finition', fat: 0.12 },
    { k: 'dunk', label: 'Dunk', short: 'Dunk', group: 'Tir et finition', fat: 0.35 },
    { k: 'drb', label: 'Dribble', short: 'Dribble', group: 'Création', fat: 0.12 },
    { k: 'pas', label: 'Passes', short: 'Passe', group: 'Création', fat: 0.08 },
    { k: 'dint', label: 'Défense intérieure', short: 'Déf. int.', group: 'Défense', fat: 0.25 },
    { k: 'dext', label: 'Défense extérieure', short: 'Déf. ext.', group: 'Défense', fat: 0.25 },
    { k: 'stl', label: 'Interception', short: 'Interception', group: 'Défense', fat: 0.2 },
    { k: 'blk', label: 'Contre', short: 'Contre', group: 'Défense', fat: 0.25 },
    { k: 'oreb', label: 'Rebond offensif', short: 'Reb. off.', group: 'Rebond', fat: 0.25 },
    { k: 'dreb', label: 'Rebond défensif', short: 'Reb. déf.', group: 'Rebond', fat: 0.25 },
    { k: 'iq', label: 'QI basket', short: 'QI basket', group: 'Lecture', fat: 0 },
  ];
  MT.FAT = {};
  MT.ATTRS.forEach((a) => (MT.FAT[a.k] = a.fat));

  MT.L = {
    play: {
      pnr: ['Pick-and-roll', 'Écran sur le porteur : tir, passe au poseur ou ressortie.'],
      iso: ['Isolation', 'Un contre un. Peu de pertes de balle, tout repose sur le duel.'],
      shooter: ['Système pour un tireur', 'Écrans loin du ballon pour libérer le joueur recherché.'],
      drive: ['Attaque du cercle', 'Pénétration : fautes provoquées, mais fatigue et pertes de balle.'],
    },
    tempo: {
      quick: ['Tir rapide', 'Garde du temps pour la suite, tir moins travaillé.'],
      normal: ['Tempo normal', 'Laisse le système se développer.'],
      milk: ['Consommer le chrono', 'Tir en fin de possession, moins de temps pour l’adversaire.'],
    },
    scheme: {
      switch: ['Changer sur les écrans', 'Éteint les écrans, mais crée des duels déséquilibrés.'],
      paint: ['Protéger le cercle', 'Ferme la raquette, laisse des tirs extérieurs.'],
      perimeter: ['Limiter les 3 points', 'Colle aux tireurs, ouvre le chemin du cercle.'],
      double: ['Prendre à deux', 'Étouffe un joueur, laisse un partenaire seul.'],
    },
    endgame: {
      normal: ['Défense normale', 'Contester sans consigne particulière.'],
      nofoul: ['Défendre sans faute', 'Peu de lancers concédés, contestations plus molles.'],
      rebound: ['Privilégier le rebond', 'Moins de secondes chances, tireurs un peu plus libres.'],
      foul: ['Faute volontaire', 'Arrête le chrono ; lancers si l’équipe est en pénalité.'],
    },
  };

  MT.POS = { MJ: 'Meneur', AR: 'Arrière', AI: 'Ailier', AF: 'Ailier fort', PV: 'Pivot' };
  MT.POSR = { MJ: 1, AR: 2, AI: 3, AF: 4, PV: 5 };
})(typeof globalThis !== 'undefined' ? globalThis : window);
