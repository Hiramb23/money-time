#!/usr/bin/env python3
"""Génère js/teams.js : la base des 18 équipes de la ligue et de leurs 162 joueurs (fictifs).

    python3 tools/generate_teams.py

Le tirage est reproductible (graine fixe). js/teams.js peut ensuite être retouché à la main,
mais relancer ce script écrase ces retouches.
"""
import os
import random

R = random.Random(20261111)
ATTR = ['spd', 'end', 'three', 'mid', 'ft', 'fin', 'dunk', 'drb', 'pas', 'dint', 'dext', 'stl', 'blk', 'oreb', 'dreb', 'iq']

# Archétypes : poste, poste secondaire, taille (cm), corpulence, profil de base
#                                        spd end 3pt mid ft fin dnk drb pas din dex stl blk orb drb iq
ARCH = {
    'fg': ('MJ', 'MJ', (183, 191), 0.97, [7, 7, 6, 6, 8, 6, 2, 8, 9, 2, 6, 6, 1, 1, 3, 9]),   # meneur gestionnaire
    'sg': ('MJ', 'AR', (185, 193), 0.98, [9, 7, 8, 7, 8, 7, 4, 9, 6, 2, 5, 5, 1, 1, 3, 7]),   # meneur scoreur
    'dg': ('MJ', 'AR', (186, 194), 1.00, [8, 8, 5, 5, 7, 6, 3, 7, 6, 3, 8, 8, 1, 2, 3, 7]),   # meneur défenseur
    'sh': ('AR', 'AI', (193, 201), 0.96, [6, 7, 9, 7, 9, 5, 3, 5, 5, 3, 6, 4, 2, 2, 4, 7]),   # tireur d'élite
    'sl': ('AR', 'AI', (193, 200), 1.00, [8, 7, 5, 6, 7, 8, 8, 7, 5, 4, 6, 6, 3, 3, 4, 6]),   # slasheur
    'td': ('AR', 'AI', (196, 203), 0.98, [7, 8, 7, 5, 7, 5, 5, 5, 4, 5, 8, 6, 3, 3, 4, 7]),   # 3 pts et défense
    'tw': ('AI', 'AF', (199, 206), 1.01, [7, 8, 6, 7, 7, 7, 7, 6, 5, 6, 8, 6, 4, 4, 6, 7]),   # ailier complet
    'sw': ('AI', 'AR', (198, 206), 0.99, [7, 7, 7, 8, 8, 7, 6, 7, 5, 5, 5, 4, 3, 3, 5, 7]),   # ailier scoreur
    'pf': ('AI', 'AF', (201, 208), 1.01, [6, 7, 5, 6, 7, 7, 5, 7, 8, 5, 6, 5, 3, 4, 6, 8]),   # ailier créateur
    'st': ('AF', 'PV', (204, 211), 1.00, [5, 6, 8, 6, 8, 6, 4, 4, 5, 5, 4, 3, 4, 4, 6, 7]),   # intérieur fuyant
    'br': ('AF', 'PV', (203, 208), 1.09, [5, 7, 3, 5, 6, 7, 7, 3, 4, 8, 5, 4, 6, 8, 8, 6]),   # déménageur
    'at': ('AF', 'AI', (203, 208), 1.02, [7, 8, 4, 5, 6, 7, 9, 5, 4, 7, 6, 5, 7, 7, 7, 5]),   # intérieur athlétique
    'rp': ('PV', 'PV', (211, 221), 1.08, [4, 6, 1, 3, 5, 7, 8, 2, 3, 9, 3, 2, 9, 8, 9, 6]),   # protecteur du cercle
    'sb': ('PV', 'AF', (208, 213), 1.05, [4, 6, 5, 7, 7, 8, 5, 4, 7, 7, 4, 3, 5, 6, 8, 8]),   # pivot technique
    'rr': ('PV', 'AF', (208, 213), 1.03, [6, 7, 1, 3, 5, 8, 9, 2, 3, 7, 5, 3, 7, 8, 7, 5]),   # pivot coureur
}

COUNTRIES = {
    'US': ('États-Unis', '🇺🇸'), 'FR': ('France', '🇫🇷'), 'RS': ('Serbie', '🇷🇸'), 'HR': ('Croatie', '🇭🇷'), 'ES': ('Espagne', '🇪🇸'),
    'DE': ('Allemagne', '🇩🇪'), 'CA': ('Canada', '🇨🇦'), 'AU': ('Australie', '🇦🇺'), 'NG': ('Nigeria', '🇳🇬'), 'CM': ('Cameroun', '🇨🇲'),
    'SN': ('Sénégal', '🇸🇳'), 'GR': ('Grèce', '🇬🇷'), 'SI': ('Slovénie', '🇸🇮'), 'LT': ('Lituanie', '🇱🇹'), 'LV': ('Lettonie', '🇱🇻'),
    'JP': ('Japon', '🇯🇵'), 'BR': ('Brésil', '🇧🇷'), 'AR': ('Argentine', '🇦🇷'), 'TR': ('Turquie', '🇹🇷'), 'IT': ('Italie', '🇮🇹'),
    'DO': ('Rép. dominicaine', '🇩🇴'), 'CD': ('RD Congo', '🇨🇩'), 'MX': ('Mexique', '🇲🇽'), 'FI': ('Finlande', '🇫🇮'), 'UA': ('Ukraine', '🇺🇦'),
    'CN': ('Chine', '🇨🇳'), 'GB': ('Royaume-Uni', '🇬🇧'), 'PR': ('Porto Rico', '🇵🇷'),
}

NAMES = {
    'US': ("Marcus Darius Tyrese Malik Jalen DeShawn Andre Brandon Elijah Isaiah Xavier Jamal Terrence Devin Corey Trey Quentin Miles "
           "Caleb Jordan Cameron Tyler Darnell Lamar Reggie Omari Desmond Javon Keon Rashad Donte Micah Nolan Garrett Cody Austin Wyatt "
           "Logan Grant Mason Chase Zeke Tobias Julius Cedric Marvin Dexter Kelvin Rodney Jerome Curtis Travis Bryce Hunter Dominic "
           "Emmanuel Khalil Tariq Amari Kobi Davion Jaylon Markell Trevon Ronnie Clayton Spencer Preston Wesley").split(),
    'FR': "Théo Hugo Mathis Yanis Bastien Axel Rémi Loïc Mamadou Enzo".split(),
    'RS': "Nemanja Marko Stefan Vuk Dušan".split(), 'HR': "Ivan Luka Mateo Josip".split(),
    'ES': "Álvaro Pablo Sergio Iker Dani".split(), 'DE': "Jonas Lukas Felix Niklas Luka".split(),
    'CA': "Liam Ethan Noah Tristan Dylan".split(), 'AU': "Jack Lachlan Cooper Riley Angus".split(),
    'NG': "Chidi Emeka Tunde Obinna Femi".split(), 'CM': "Franck Christian Yves Landry".split(),
    'SN': "Cheikh Moussa Ibrahima Pape Abdou".split(), 'GR': "Nikos Dimitris Yannis Thanos".split(),
    'SI': "Jan Žiga Matej Rok".split(), 'LT': "Mantas Tomas Rokas Domas".split(), 'LV': "Artūrs Roberts Mārtiņš".split(),
    'JP': "Kenji Ryo Haruto Daiki".split(), 'BR': "Rafael Thiago Caio Gustavo".split(), 'AR': "Nicolás Lautaro Emiliano Facundo".split(),
    'TR': "Emre Kerem Burak Deniz".split(), 'IT': "Matteo Lorenzo Davide Alessandro".split(),
    'DO': "Ángel Luis Cristian Yeison".split(), 'CD': "Hervé Patrick Jonathan Christian".split(),
    'MX': "Diego Javier Emilio Rodrigo".split(), 'FI': "Eero Aleksi Otto".split(), 'UA': "Oleksandr Dmytro".split(),
    'CN': "Wei Jun Hao".split(), 'GB': "Oliver Callum Reece".split(), 'PR': "José Carlos Ángel".split(),
}
SURNAMES = {
    'US': ("Hollis Mercer Hayes Greer Pruitt Maddox Boone Langston Winters Calloway Draper Ellison Fontaine Garrison "
           "Hargrove Kimbrough Mayfield Norwood Pemberton Quarles Stanton Thibodeaux Underwood Vance Wardlow Yancey "
           "Blackwell Crenshaw Dupree Easley Foxworth Gaines Holloway Jeffcoat Kirkland Lattimore McAllister Nettles Oglesby Paxton "
           "Redmond Sherrod Talbot Upshaw Waddell Abernathy Bellamy Cartwright Delacroix Everhart Fairchild Hightower "
           "Jessup Kendall Lovett Montague Northcutt Overton Prescott Ridley Tolliver Varner Whitaker Yarbrough Ashford "
           "Braxton Colbert Dunmore Eastman Flowers Gantt Hawthorne Islington Keaton Lasalle Newsome Odum "
           "Pettigrew Roundtree Stokes Trammell Vickers Weatherby Culpepper Dorsett Embry Fenwick Glover Hobbs "
           "Ardmore Bostwick Chatham Dabney Eubanks Fulgham Gilliam Inman Joyner Mabry Neely Osgood Purnell Rucker "
           "Satterfield Usher Voss Yates Battle Cobb Dozier Fairley Gentry Hatcher Lyle Merritt Rollins Spivey Tate Waller Castleberry "
           "Durden Hinton Ledbetter Mims Peeples Ragland Tubbs Whitlow "
           "Kittrell Lindsey Mosley Pickett Thurman Wofford").split(),
    'FR': "Morel Girard Faure Besson Renaud Chevallier Kanté Marchand Leclerc Diabaté".split(),
    'RS': "Stanišić Vuković Lazarević Radić Simić".split(), 'HR': "Babić Knežević Horvat Marić Jurić".split(),
    'ES': "Ortega Molina Vidal Castillo Herrero".split(), 'DE': "Brandt Keller Vogel Schuster Lindner Albrecht".split(),
    'CA': "Tremblay MacLeod Fraser Beaulieu Sinclair Okonkwo".split(), 'AU': "Hawke Mundy Fitzroy Callaghan Brennan".split(),
    'NG': "Adeyemi Nwosu Balogun Eze Olatunji Ibekwe".split(), 'CM': "Mbarga Etoundi Ngassa Fotso Biyong".split(),
    'SN': "Gueye Sow Faye Diatta Mbaye".split(), 'GR': "Kalogeras Vlachos Samaras Stavrou".split(),
    'SI': "Kovač Zupan Novak Hribar".split(), 'LT': "Kazlauskas Petrauskas Butkus Vaitkus".split(), 'LV': "Ozols Kalniņš Bērziņš Liepa".split(),
    'JP': "Tanabe Kurosawa Ishikawa Fujimoto".split(), 'BR': "Almeida Carvalho Moreira Teixeira Pacheco".split(),
    'AR': "Acosta Benítez Cabrera Ferreyra Ledesma".split(), 'TR': "Yıldız Kaya Demir Aksoy Çelik".split(),
    'IT': "Ferrari Conti Rinaldi Marchetti Bellucci".split(), 'DO': "Peña Mejía Rosario Guzmán Tavárez".split(),
    'CD': "Mulumba Ilunga Tshibangu Kasongo".split(), 'MX': "Villaseñor Zamora Bustamante Coronado Luján".split(),
    'FI': "Laine Koskela Heikkinen".split(), 'UA': "Shevchuk Bondarenko Kravets".split(), 'CN': "Zhang Liang Zhou".split(),
    'GB': "Ashworth Pennington Whitcombe".split(), 'PR': "Maldonado Vizcarrondo Colón".split(),
}
INTL = [c for c in COUNTRIES if c != 'US']

# Deux effectifs écrits à la main (ceux du premier prototype)
FIXED = {
    'SEA': [
        (3, 'Malik Rivers', 'MJ', 'AR', 188, 86, 27, 'US', [9, 7, 9, 8, 9, 7, 3, 9, 8, 3, 5, 6, 1, 1, 3, 9]),
        (11, 'Théo Lambert', 'AR', 'AI', 198, 93, 29, 'FR', [6, 8, 10, 7, 9, 5, 3, 4, 5, 4, 6, 4, 2, 2, 4, 8]),
        (23, 'Jalen Okoye', 'AI', 'AF', 203, 100, 25, 'US', [7, 8, 7, 6, 7, 7, 7, 6, 5, 6, 8, 7, 4, 4, 6, 7]),
        (32, 'Niko Petrovic', 'AF', 'PV', 208, 107, 31, 'HR', [5, 6, 8, 6, 8, 6, 4, 4, 6, 5, 4, 3, 4, 4, 6, 7]),
        (14, 'Darius Cole', 'PV', 'AF', 211, 113, 24, 'US', [6, 7, 2, 4, 6, 8, 8, 3, 4, 7, 5, 3, 7, 7, 7, 6]),
        (5, 'Sam Whitfield', 'MJ', 'MJ', 185, 82, 22, 'US', [8, 8, 7, 6, 8, 6, 2, 7, 7, 2, 6, 6, 1, 1, 2, 7]),
        (9, 'Andre Baptiste', 'AR', 'AI', 196, 95, 33, 'CA', [8, 9, 5, 4, 6, 6, 6, 5, 4, 5, 9, 8, 3, 3, 4, 7]),
        (30, 'Kenji Morita', 'AI', 'AR', 201, 96, 26, 'JP', [6, 7, 8, 6, 8, 5, 4, 4, 4, 4, 5, 4, 2, 3, 4, 6]),
        (21, 'Luka Hartmann', 'AF', 'PV', 209, 111, 28, 'DE', [4, 7, 6, 5, 7, 6, 5, 3, 5, 6, 4, 2, 5, 6, 7, 6]),
    ],
    'PIT': [
        (1, 'Marcus Dunn', 'MJ', 'AR', 191, 91, 28, 'US', [8, 8, 5, 7, 7, 8, 6, 8, 7, 4, 7, 7, 2, 3, 4, 8]),
        (8, 'Elijah Brooks', 'AR', 'AI', 196, 98, 23, 'US', [8, 7, 6, 6, 7, 8, 8, 7, 5, 4, 6, 6, 3, 3, 4, 6]),
        (24, 'Victor Santos', 'AI', 'AF', 203, 104, 30, 'BR', [7, 8, 6, 8, 8, 8, 7, 7, 6, 6, 8, 6, 5, 5, 7, 9]),
        (34, 'Brandon Achebe', 'AF', 'PV', 206, 114, 26, 'NG', [5, 7, 3, 5, 6, 7, 7, 3, 4, 8, 5, 4, 6, 8, 8, 6]),
        (55, 'Ivan Kolarov', 'PV', 'PV', 216, 125, 32, 'RS', [3, 6, 1, 3, 4, 8, 8, 2, 4, 9, 3, 2, 9, 9, 9, 6]),
        (2, 'Tyrese Vaughn', 'MJ', 'MJ', 183, 80, 21, 'US', [8, 7, 8, 6, 9, 5, 2, 7, 6, 2, 5, 5, 1, 1, 2, 7]),
        (12, 'Owen Gallagher', 'AR', 'AI', 198, 97, 34, 'AU', [6, 8, 7, 5, 7, 5, 4, 4, 4, 5, 7, 5, 3, 3, 5, 7]),
        (41, 'DeShawn Price', 'AF', 'AI', 205, 108, 22, 'US', [7, 9, 4, 5, 6, 7, 8, 4, 3, 7, 6, 5, 6, 7, 7, 5]),
        (50, 'Mateo Ruiz', 'PV', 'AF', 211, 118, 29, 'ES', [4, 7, 4, 5, 8, 6, 5, 2, 5, 7, 4, 2, 6, 6, 7, 7]),
    ],
}

# clé, nom, couleur, couleur de rechange, style, profil, archétypes (5 titulaires puis 4 remplaçants), rang de la vedette,
# retouches d'équipe, âge ('young' / 'vet' / None), part de joueurs étrangers, pays privilégiés
TEAMS = [
    ('SEA', 'Seattle Cascades', '#12a594', '#0b5d54', 'Adresse et vitesse',
     'Jeu rapide et adresse extérieure. Cinq mobile, redoutable derrière l’arc, fragile au rebond et près du cercle.'),
    ('PIT', 'Pittsburgh Forge', '#e06a1b', '#4a4f57', 'Puissance et rebond',
     'Puissance, défense et rebond. Domine la raquette, mais peu de tireurs et un pivot maladroit aux lancers.'),
    ('LVG', 'Las Vegas Mirage', '#a8791a', '#5b2a86', 'Une superstar',
     'Tout passe par sa superstar à l’aile. Spectaculaire en transition, mais le banc est court et la défense intermittente.',
     ['fg', 'sl', 'sw', 'at', 'rr', 'sg', 'td', 'st', 'rp'], 2, {'spd': 1, 'dext': -1}, None, 0.25, []),
    ('KCS', 'Kansas City Stampede', '#8a5a2b', '#b3262e', 'Jeunesse et rebond',
     'Jeune troupeau physique qui écrase le rebond offensif. Peu d’adresse de loin et des erreurs de lecture.',
     ['dg', 'sl', 'tw', 'br', 'rp', 'fg', 'td', 'at', 'rr'], 3, {'oreb': 1, 'dreb': 1, 'three': -1}, 'young', 0.2, []),
    ('STL', 'St. Louis Arches', '#2c5fa8', '#7a8ba0', 'Vétérans collectifs',
     'Effectif expérimenté, ballon qui circule et très peu de pertes de balle. Les jambes sont lourdes en fin de match.',
     ['fg', 'sh', 'pf', 'st', 'sb', 'fg', 'sh', 'tw', 'br'], 0, {'pas': 1, 'iq': 1, 'spd': -1}, 'vet', 0.3, []),
    ('SDG', 'San Diego Surf', '#1c9bd1', '#c98a00', 'Pluie de 3 points',
     'Cinq tireurs sur le terrain, espaces maximum. Raquette ouverte en défense et rebond défaillant.',
     ['sg', 'sh', 'sw', 'st', 'sb', 'sg', 'sh', 'td', 'st'], 0, {'three': 1, 'dint': -1, 'dreb': -1}, None, 0.3, ['AU', 'ES', 'AR']),
    ('NSH', 'Nashville Rhythm', '#7b3fa0', '#c28f2c', 'Équilibre',
     'Aucune faiblesse criante, aucun point fort écrasant. Un ailier scoreur fiable et un banc utile.',
     ['fg', 'td', 'sw', 'at', 'sb', 'dg', 'sl', 'pf', 'rp'], 2, {}, None, 0.3, []),
    ('LOU', 'Louisville Derby', '#556b2f', '#b08d2a', 'Défense de fer',
     'Pression sur le porteur, interceptions et bras partout. L’attaque, elle, peine à trouver des paniers faciles.',
     ['dg', 'td', 'tw', 'br', 'rp', 'dg', 'td', 'tw', 'br'], 0, {'dext': 1, 'stl': 1, 'mid': -1, 'three': -1}, None, 0.2, []),
    ('VAN', 'Vancouver Orcas', '#4a5568', '#0aa3a3', 'Jeu de passes',
     'Un ailier créateur qui fait jouer tout le monde et un effectif venu des quatre coins du monde.',
     ['sg', 'sh', 'pf', 'st', 'rr', 'fg', 'sl', 'tw', 'sb'], 2, {'pas': 1}, None, 0.55, ['CA', 'AU', 'CN', 'JP', 'LT', 'GB']),
    ('MTL', 'Montréal Boréal', '#2456c7', '#9b1c31', 'École européenne',
     'Pivot technique au centre du jeu, lecture et fondamentaux. Peu d’explosivité au-dessus du cercle.',
     ['fg', 'sh', 'tw', 'st', 'sb', 'dg', 'sw', 'pf', 'rp'], 4, {'iq': 1, 'dunk': -1}, None, 0.8, ['FR', 'FR', 'CA', 'SN', 'CM', 'CD', 'SI', 'RS']),
    ('BAL', 'Baltimore Harbor', '#c9861c', '#3a3d45', 'Verrou défensif',
     'Vétérans rugueux, raquette cadenassée et ailier complet des deux côtés du terrain. Très peu de tir extérieur.',
     ['dg', 'sl', 'tw', 'br', 'rp', 'fg', 'td', 'at', 'rp'], 2, {'dint': 1, 'dext': 1, 'three': -1}, 'vet', 0.25, []),
    ('CIN', 'Cincinnati Rivermen', '#c0223b', '#2f3540', 'Scoreurs',
     'Un meneur scoreur capable de prendre feu et des ailiers qui créent leur tir. La défense suit quand elle peut.',
     ['sg', 'sl', 'sw', 'br', 'rr', 'fg', 'sh', 'at', 'sb'], 0, {'mid': 1}, None, 0.3, []),
    ('AUS', 'Austin Outlaws', '#d9a514', '#3b2f2f', 'Athlètes en liberté',
     'Jeunes, rapides, aériens. Du spectacle au cercle, mais des lancers francs tremblants et des choix discutables.',
     ['sg', 'sl', 'tw', 'at', 'rr', 'dg', 'sl', 'at', 'rr'], 1, {'spd': 1, 'dunk': 1, 'iq': -1, 'ft': -1}, 'young', 0.2, []),
    ('TPA', 'Tampa Bay Tides', '#ff7f50', '#0b6e8f', 'Rythme d’enfer',
     'Courir, tirer vite, recommencer. Un cinq endurant et adroit, trop léger pour tenir la raquette.',
     ['sg', 'td', 'sw', 'st', 'rr', 'fg', 'sh', 'td', 'at'], 0, {'spd': 1, 'end': 1, 'dint': -1}, None, 0.3, ['DO', 'PR', 'BR']),
    ('ABQ', 'Albuquerque Mesa', '#9c4a2f', '#2a9d8f', 'Pivot vedette',
     'Le jeu s’organise autour d’un pivot technique entouré de tireurs. Arrières solides mais sans génie.',
     ['fg', 'td', 'tw', 'st', 'sb', 'sg', 'sh', 'pf', 'br'], 4, {}, None, 0.3, ['MX', 'RS', 'TR']),
    ('BUF', 'Buffalo Blizzard', '#8ecae6', '#1d3557', 'Tours jumelles',
     'Deux géants devant le cercle : contres et rebonds garantis. Lent sur les ailes et vulnérable aux changements.',
     ['fg', 'sh', 'tw', 'br', 'rp', 'dg', 'td', 'br', 'rp'], 4, {'dint': 1, 'blk': 1, 'spd': -1}, None, 0.3, ['LT', 'LV', 'UA', 'FI']),
    ('HNL', 'Honolulu Waves', '#d63384', '#0f7c5f', 'Meneur chef d’orchestre',
     'Un meneur gestionnaire d’exception qui sert tireurs et intérieurs. Manque un vrai stoppeur sur les ailes.',
     ['fg', 'sh', 'pf', 'at', 'sb', 'sg', 'sw', 'tw', 'rr'], 0, {'pas': 1, 'dext': -1}, None, 0.35, ['JP', 'AU', 'CN']),
    ('MEX', 'Mexico City Jaguares', '#0f7a4a', '#a61e2e', 'Griffes et finition',
     'Ailier scoreur insaisissable, mains actives en défense, finition soignée. L’altitude fatigue surtout… les adversaires.',
     ['sg', 'sl', 'sw', 'br', 'rp', 'fg', 'td', 'sw', 'sb'], 2, {'fin': 1, 'stl': 1, 'blk': -1}, None, 0.6, ['MX', 'MX', 'AR', 'BR', 'DO', 'ES', 'PR']),
]

used_surnames = {p[1].split(' ', 1)[1] for ps in FIXED.values() for p in ps}
used_full = {p[1] for ps in FIXED.values() for p in ps}


def clamp(x, a, b):
    return max(a, min(b, x))


def pick_name(country):
    pool = [s for s in SURNAMES[country] if s not in used_surnames]
    if not pool:
        country = 'US'
        pool = [s for s in SURNAMES['US'] if s not in used_surnames]
    last = R.choice(pool)
    used_surnames.add(last)
    for _ in range(50):
        full = R.choice(NAMES[country]) + ' ' + last
        if full not in used_full:
            used_full.add(full)
            return full, country
    raise SystemExit('plus de prénom disponible pour ' + country)


def make_player(arch, tier, mods, age, country, num):
    pos, pos2, hr, build, base = ARCH[arch]
    h = R.randint(*hr)
    w = round((h - 100) * build + R.uniform(-3, 3))
    vals = []
    for k, b in zip(ATTR, base):
        v = b + R.uniform(-0.75, 0.75)
        if b >= 4:
            v += tier
        elif tier < 0:
            v += tier * 0.3
        if age <= 21:
            v += {'spd': 0.5, 'end': 0.7, 'dunk': 0.5, 'iq': -1.2, 'ft': -0.5}.get(k, 0)
        elif age <= 23:
            v += {'iq': -0.5}.get(k, 0)
        if age >= 32:
            v += {'spd': -1, 'end': -1, 'dunk': -1.2, 'iq': 1, 'ft': 0.4}.get(k, 0)
        if age >= 35:
            v += {'spd': -0.7, 'end': -0.7, 'dext': -0.7, 'iq': 0.3}.get(k, 0)
        v += mods.get(k, 0)
        vals.append(int(clamp(round(v), 1, 10)))
    name, country = pick_name(country)
    return (num, name, pos, pos2, h, w, age, country, vals)


def make_roster(spec):
    archs, star, mods, bias, intl, fav = spec[6:12]
    starters = [0.4, 0.2, 0.0, -0.2]
    R.shuffle(starters)
    tiers, it = [], iter(starters)
    for i in range(5):
        tiers.append(1.3 if i == star else next(it))
    tiers += [-0.5, -1.0, -1.0, -1.3]
    ages = []
    for i in range(9):
        if i == star:
            a = R.randint(25, 30)
        elif i < 5:
            a = R.randint(22, 32)
        else:
            a = R.randint(22, 30)
        ages.append(a)
    young, vet = R.sample(range(5, 9), 2)
    ages[young] = R.randint(19, 21)
    ages[vet] = R.randint(33, 37)
    shift = {'young': -3, 'vet': 4}.get(bias, 0)
    ages = [clamp(a + shift if i not in (young, vet) or shift == 0 else a + shift // 2, 19, 38) for i, a in enumerate(ages)]
    nums = R.sample(list(range(0, 36)) + [40, 42, 44, 45, 50, 54, 55, 77, 88, 99], 9)
    roster = []
    for i, arch in enumerate(archs):
        if R.random() < intl:
            country = R.choice(fav) if fav and R.random() < 0.75 else R.choice(INTL)
        else:
            country = 'US'
        roster.append(make_player(arch, tiers[i], mods, ages[i], country, nums[i]))
    return roster


def js(s):
    return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'"


out = ["/* Money Time — base de données de la ligue : 18 équipes, 162 joueurs (tous fictifs).",
       "   Fichier produit par tools/generate_teams.py ; il peut être retouché à la main. */",
       "(function (root) {", "  'use strict';", "  const MT = (root.MT = root.MT || {});",
       "  const KEYS = MT.ATTRS.map((a) => a.k);",
       "  function P(num, name, pos, pos2, h, w, age, nat, vals) {",
       "    const p = { num, name, short: name.split(' ').slice(1).join(' '), pos, pos2, h, w, age, nat };",
       "    KEYS.forEach((k, i) => (p[k] = vals[i]));", "    return p;", "  }", "",
       "  MT.COUNTRIES = {"]
out += ["    %s: [%s, %s]," % (c, js(n), js(f)) for c, (n, f) in COUNTRIES.items()]
out += ["  };", "",
        "  //                                                              spd end 3pt mid ft fin dnk drb pas din dex stl blk orb drb iq",
        "  MT.TEAMS = ["]
total = 0
for spec in TEAMS:
    key, name, color, alt, style, profile = spec[:6]
    roster = FIXED[key] if key in FIXED else make_roster(spec)
    total += len(roster)
    out.append("    {")
    out.append("      key: %s, name: %s, abbr: %s, color: %s, alt: %s," % (js(key), js(name), js(key), js(color), js(alt)))
    out.append("      style: %s," % js(style))
    out.append("      profile: %s," % js(profile))
    out.append("      players: [")
    for (num, pname, pos, pos2, h, w, age, nat, vals) in roster:
        out.append("        P(%d, %s, %s, %s, %d, %d, %d, %s, [%s])," % (num, js(pname), js(pos), js(pos2), h, w, age, js(nat), ', '.join(map(str, vals))))
    out.append("      ],")
    out.append("    },")
out += ["  ];", "})(typeof globalThis !== 'undefined' ? globalThis : window);", ""]

path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'js', 'teams.js')
with open(path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))
print('%d équipes, %d joueurs écrits dans js/teams.js' % (len(TEAMS), total))
