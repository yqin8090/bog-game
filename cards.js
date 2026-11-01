// All the cards in BoG. This is the file to edit to add or change cards.
//
// CHAMPIONS sit at your strongholds. Each one has:
//   name, title  - shown on the card
//   class        - frontliner, warrior, assassin, support or ranger
//   rarity       - "holo" adds a shiny foil effect; "common" doesn't
//   hp           - how much damage it can take before its stronghold falls
//   art          - an emoji shown as the picture when there's no image
//   image        - optional: a picture in public/cards/, about 600x360 pixels, like "sam-card.jpg"
//   artShift     - optional: moves the picture down, as a percent of the card height, so its top clears the name bar
//   abilities    - what it can do. Each champion can use its ability once per turn, and each use costs 1 action point.
//   short        - optional one-line text shown on the card; desc goes in the tooltip
//   power        - an ability marked power: true is shown as a POWER band, not an attack
//   passive      - optional: always-on powers, with a name and a description. vsClass: { class, mult }
//                  multiplies the damage this champion deals to champions of that class.
//                  respawn: { chance, hp } lets it rise once per game when knocked out, with hp as a share of its max HP
//   form         - optional: a transformation (like Rahoon turning into Simba)
//   leader       - a bonus that only works while this champion is at the back
//
// Ability fields:
//   once         - can only be used once per game
//   cooldown     - turns to wait after using it before it can be used again. 0 means every turn.
//                  Basic 2-damage attacks use 0, 3 damage or a small effect 1, strong or multi-target 2,
//                  big team effects 3. Once-per-game powers don't need one
//   requires     - { belowHalf: true } needs this champion under half HP,
//                  { minTurn: N } can't be used until your turn N
//   target:
//     "enemy"      - an enemy champion you're allowed to attack
//     "anyEnemy"   - any enemy champion, even a protected leader
//     "ally"       - one of your own champions
//     "allEnemies" - every enemy champion you're allowed to attack
//     "enemyFront" - both enemy front champions
//     "none"       - no target
//   effect:
//     damage: N    - deal N damage          heal: N    - heal N HP
//     shield: N    - block the next N damage (a champion can hold up to 6 shield)
//     drain: N     - deal N damage and heal this champion N
//     draw: N      - draw N utility cards
//     refresh      - a champion that already acted this turn can act again
//     actionPoint: N - gain N action points this turn
//     mark         - the next hit on the target deals double damage
//     swift: N     - this champion gains N Swift stacks (each is a 10% chance to dodge, max 3)
//     bleed: N     - the target loses N HP at the start of each of their turns, for 3 turns
//     transform    - turn into this champion's form
//     soulLink: N  - Soul Link guessing game; if it works, the target takes N damage every turn
//     frontShield: N - give both of your front champions an N shield
//     teamShield: N  - give every champion on your team an N shield
//     daze: 0.4    - chance (0 to 1) to daze the target. A dazed champion can't act on its owner's next turn
//     allyBoost: N - your other two champions deal N times damage, for the rest of this turn and your next turn.
//                    Boosts multiply, so two boosts active at once stack
//     skipTurn     - the enemy skips their next turn
//     hits: [{ chance, damage }] - a series of hits on one enemy. Each hit rolls its own chance to land
//     leaderDamage: N - also deal N damage to the enemy's leader, if the leader can be attacked

const CLASSES = {
  frontliner: "🛡️ Frontliner",
  warrior: "⚔️ Warrior",
  assassin: "🗡️ Assassin",
  support: "💚 Support",
  ranger: "🏹 Ranger",
};

const LEADERS = {
  rally: { name: "Rally", short: "All champions +1 damage", desc: "All your champions deal +1 damage." },
  bulwark: { name: "Bulwark", short: "Fronts take 1 less damage", desc: "Your front champions take 1 less damage from each hit." },
  fortify: { name: "Fortify", short: "Fronts heal 1 each turn", desc: "At the start of your turn, heal your front champions 1." },
  thorns: { name: "Thorns", short: "Attackers take 1 back", desc: "When an enemy champion hits your front champion, it takes 1 damage back." },
  haste: { name: "Haste", short: "+1 action point each turn", desc: "You get 1 extra action point at the start of your turn." },
  scholar: { name: "Scholar", short: "Draw an extra utility", desc: "Draw an extra utility card every turn." },
  lifeline: { name: "Lifeline", short: "Leader heals 2 each turn", desc: "At the start of your turn, this leader heals 2." },
  ironhide: { name: "Ironhide", short: "All champions +2 HP", desc: "While this leader is at the back, all your champions start with 2 more HP." },
  windfall: { name: "Windfall", short: "3 action points every turn", desc: "While this leader is at the back, you have 3 action points every turn, from your first turn." },
  pack: { name: "Pack Rage", short: "Below half HP: 1.5x damage", desc: "While this leader is at the back, your champions below half HP deal 1.5x damage." },
  vitality: { name: "Vitality", short: "This champion +10 HP", desc: "While this leader is at the back, this champion has 10 more HP." },
};

const CHAMPIONS = {
  // ---------- Hunter's friends ----------
  ruhaan: {
    name: "Rahoon", title: "The Pack Brain", class: "warrior", rarity: "holo", hp: 10, art: "🐾",
    image: "cards/ruhaan-card.jpg", credit: "Art: Gemini",
    abilities: [
      { name: "Neuro Scan", short: "Next hit deals double", target: "anyEnemy", effect: { mark: true }, cooldown: 2, desc: "Find an enemy's weakness. The next hit on them deals double damage." },
      { name: "Paw Swipe", short: "2 damage, +1 Swift", target: "enemy", effect: { damage: 2, swift: 1 }, desc: "Dog paws scratch for 2 damage. +1 Swift (10% dodge each, max 3)." },
      {
        name: "Simba Form", short: "+10 HP, 2x dodge", power: true, once: true, target: "none", effect: { transform: true }, requires: { belowHalf: true, minTurn: 5 },
        desc: "Turn into Simba! +10 max HP and HP, Swift dodge is doubled (up to 60%), Paw Swipe becomes Wolf Claws. Needs under half HP, after 4 turns.",
      },
    ],
    form: {
      name: "Simba Form", image: "cards/ruhaan-card.jpg", bonusHp: 10, swiftMultiplier: 2,
      replace: {
        1: { name: "Wolf Claws", short: "4 damage + bleed", target: "enemy", effect: { damage: 4, swift: 1, bleed: 0.4 }, cooldown: 2, desc: "Wolf claws deal 4 damage and cause bleed (0.4 a turn for 3 turns). +1 Swift." },
      },
    },
    leader: "pack",
  },
  abbas: {
    name: '"Wemby"', title: "The Reaper", class: "frontliner", rarity: "holo", hp: 10, art: "💀",
    image: "cards/abbas-card.jpg", credit: "Art: Gemini",
    passive: {
      name: "Reaper's Hunger", short: "Heals half of damage", lifesteal: 0.5, overheal: true, leaderWeakness: 1.5,
      desc: "Heals 50% of damage he deals, and can heal past max HP. Takes 1.5x damage from the enemy leader.",
    },
    abilities: [
      { name: "Scythe Slice", short: "4 to both enemy fronts", target: "enemyFront", effect: { damage: 4 }, cooldown: 2, desc: "Swing across the board: 4 damage to both enemy front champions." },
      { name: "Soul Link", short: "Guess a side to link", target: "anyEnemy", effect: { soulLink: 2 }, cooldown: 2, desc: "Pick any enemy and play Left or Right. If they pick the same side, they're linked and take 2 damage every turn." },
    ],
    leader: "thorns",
  },

  matthew: {
    name: "Skies", title: "The Iron Ape", class: "frontliner", rarity: "holo", hp: 30, art: "🦍",
    image: "cards/matthew-card.jpg", credit: "Art: Gemini",
    abilities: [
      { name: "Punch", target: "enemy", effect: { damage: 2 }, desc: "Deal 2 damage." },
      { name: "Brace", short: "2 shield to both fronts", target: "none", effect: { frontShield: 2 }, cooldown: 1, desc: "Give both of your front champions a 2 shield." },
      { name: "Grand Slam", short: "4 damage, 40% to daze", target: "enemy", effect: { damage: 4, daze: 0.4 }, cooldown: 2, desc: "Deal 4 damage. 40% chance to daze the enemy, who can't act next turn." },
      { name: "Iron Wall", short: "5 shield to the whole team", target: "none", effect: { teamShield: 5 }, cooldown: 3, desc: "Give every champion on your team a 5 shield." },
    ],
    leader: "ironhide",
  },
  ted: {
    name: "Teddy", title: "The Windcaller", class: "support", rarity: "holo", hp: 15, art: "🌬️",
    image: "cards/ted-card.jpg", credit: "Art: Gemini",
    abilities: [
      { name: "Gale Lunge", short: "2 damage, 10% to daze", target: "enemy", effect: { damage: 2, daze: 0.1 }, cooldown: 1, desc: "Deal 2 damage. 10% chance to daze the enemy, who can't act next turn." },
      { name: "Tailwind", short: "Other two champions deal 1.5x", target: "none", effect: { allyBoost: 1.5 }, cooldown: 2, desc: "Your other two champions deal 1.5x damage for the rest of this turn and your next turn." },
      { name: "Gust", short: "3 shield to all, others 2x", target: "none", effect: { teamShield: 3, allyBoost: 2 }, cooldown: 3, desc: "Give every champion on your team a 3 shield. Your other two champions deal 2x damage for the rest of this turn and your next turn. Stacks with Tailwind." },
      { name: "Wind version of turning tide", short: "Enemy skips their next turn", power: true, once: true, target: "none", effect: { skipTurn: true }, desc: "Once per game. The enemy skips their next turn." },
    ],
    leader: "windfall",
  },
  vianoc: {
    name: "Vianoc", title: "The Spearman", class: "warrior", rarity: "holo", hp: 20, art: "🔱",
    image: "cards/vianoc-card.jpg", artShift: 16, credit: "Art: Gemini",
    abilities: [
      { name: "Pierce", target: "enemy", effect: { damage: 3 }, cooldown: 1, desc: "Deal 3 damage." },
      { name: "Sunder", short: "3 damage, 3 to their leader", target: "enemy", effect: { damage: 3, leaderDamage: 3 }, cooldown: 2, desc: "Deal 3 damage to an enemy champion and 3 damage to their leader. The leader only takes it if it can be attacked." },
      {
        name: "Relentless Thrust", short: "Three hits: 2, 3 and 4 damage", target: "enemy",
        effect: { hits: [{ chance: 1, damage: 2 }, { chance: 0.5, damage: 3 }, { chance: 0.2, damage: 4 }] }, cooldown: 2,
        desc: "Three hits on one enemy champion. The first deals 2 damage and always lands. The second deals 3 damage with a 50% chance. The third deals 4 damage with a 20% chance.",
      },
    ],
    passive: {
      name: "Front Breaker", short: "2x damage to frontliners", vsClass: { class: "frontliner", mult: 2 },
      desc: "Deals 2x damage to frontliner champions.",
    },
    leader: "vitality",
  },
  carlos: {
    name: "Carlos", title: "The Aviator", class: "warrior", rarity: "holo", hp: 15, art: "⚡",
    image: "cards/carlos-card.jpg", artShift: 16, credit: "Art: Gemini",
    abilities: [
      { name: "Prism Punch", short: "3 damage", target: "enemy", effect: { damage: 3 }, cooldown: 1, desc: "Deal 3 damage." },
      { name: "Light Beam", short: "A beam of light", target: "enemy", effect: { damage: 6 }, cooldown: 2, desc: "Fire a beam of light for 6 damage." },
      { name: "Spectrum Wave", short: "5 damage to every enemy", target: "allEnemies", effect: { damage: 5 }, cooldown: 2, desc: "Send a wave of light for 5 damage to every enemy champion you can attack." },
    ],
    passive: {
      name: "Rise Again", short: "50% to rise at half HP", respawn: { chance: 0.5, hp: 0.5 },
      desc: "When this champion is knocked out, it has a 50% chance to rise again with half its HP. Works once per game.",
    },
    leader: "haste",
  },

};

// UTILITY cards are played from your hand. Each one costs 1 action point. "count" is how many are in each player's deck.
const UTILITIES = {
  potion: { name: "Potion", target: "ally", effect: { heal: 4 }, desc: "Heal a champion 4.", art: "🧪", count: 4 },
  bigPotion: { name: "Big Potion", target: "ally", effect: { heal: 7 }, desc: "Heal a champion 7.", art: "⚗️", count: 2 },
  shield: { name: "Shield", target: "ally", effect: { shield: 3 }, desc: "Give a champion a 3 shield.", art: "🔰", count: 3 },
  bomb: { name: "Bomb", target: "enemy", effect: { damage: 3 }, desc: "Deal 3 damage.", art: "💣", count: 3 },
  fireArrow: { name: "Fire Arrow", target: "enemy", effect: { damage: 2 }, desc: "Deal 2 damage.", art: "🏹", count: 4 },
  energyDrink: { name: "Energy Drink", target: "none", effect: { actionPoint: 2 }, desc: "Gain 2 action points this turn.", art: "🥤", count: 2 },
  secondWind: { name: "Second Wind", target: "ally", effect: { refresh: true }, desc: "A champion that already acted can act again.", art: "💨", count: 2 },
};

// Pictures behind the board. The server picks one at random for each game.
const BACKGROUNDS = ["backgrounds/world-school.jpg", "backgrounds/calgary-rockies.jpg", "backgrounds/lauremont.jpg"];

module.exports = { CLASSES, LEADERS, CHAMPIONS, UTILITIES, BACKGROUNDS };
