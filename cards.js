// All the cards in BoG. This is the file to edit to add or change cards.
//
// CHAMPIONS sit at your strongholds. Each one has:
//   name, title  - shown on the card
//   class        - frontliner, warrior, assassin, support or ranger
//   type         - lightning, darkness, fire, metal, grass, fighting or psychic.
//                  Sets the card's colors and its orb icon (see card-view.js)
//   rarity       - "holo" adds a shiny foil effect; "common" doesn't
//   hp           - how much damage it can take before its stronghold falls
//   art          - an emoji shown as the picture when there's no image
//   image        - optional: a picture in public/cards/, about 600x360 pixels, like "sam-card.jpg"
//   abilities    - what it can do. Each champion can use one ability per turn.
//   short        - optional one-line text shown on the card; desc goes in the tooltip
//   power        - an ability marked power: true is shown as a POWER band, not an attack
//   passive      - optional: always-on powers, with a name and a description
//   form         - optional: a transformation (like Ruhaan turning into Simba)
//   leader       - a bonus that only works while this champion is at the back
//
// Ability fields:
//   cooldown     - how many of your turns you must wait before using it again (0 = every turn)
//   once         - can only be used once per game
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
//     cooldownDown: N - a champion's cooldowns go down by N
//     mark         - the next hit on the target deals double damage
//     swift: N     - this champion gains N Swift stacks (each is a 10% chance to dodge, max 3)
//     bleed: N     - the target loses N HP at the start of each of their turns, for 3 turns
//     transform    - turn into this champion's form
//     soulLink: N  - Soul Link guessing game; if it works, the target takes N damage every turn

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
  haste: { name: "Haste", short: "Cooldowns drop 1 extra", desc: "Your cooldowns go down 1 extra at the start of your turn." },
  scholar: { name: "Scholar", short: "Draw an extra utility", desc: "Draw an extra utility card every turn." },
  lifeline: { name: "Lifeline", short: "Leader heals 2 each turn", desc: "At the start of your turn, this leader heals 2." },
};

const CHAMPIONS = {
  // ---------- Hunter's friends ----------
  ruhaan: {
    name: "Ruhaan Uppal", title: "The Pack Brain", class: "warrior", type: "lightning", rarity: "holo", hp: 10, art: "🐾",
    image: "cards/ruhaan-card.jpg", credit: "Art: Gemini",
    abilities: [
      { name: "Neuro Scan", short: "Next hit deals double", cooldown: 2, target: "anyEnemy", effect: { mark: true }, desc: "Find an enemy's weakness. The next hit on them deals double damage." },
      { name: "Paw Swipe", short: "2 damage, +1 Swift", cooldown: 1, target: "enemy", effect: { damage: 2, swift: 1 }, desc: "Dog paws scratch for 2 damage. +1 Swift (10% dodge each, max 3)." },
      {
        name: "Simba Form", short: "+10 HP, 2x dodge", power: true, once: true, target: "none", effect: { transform: true }, requires: { belowHalf: true, minTurn: 5 },
        desc: "Turn into Simba! +10 max HP and HP, Swift dodge is doubled (up to 60%), Paw Swipe becomes Wolf Claws. Needs under half HP, after 4 turns.",
      },
    ],
    form: {
      name: "Simba Form", image: "cards/ruhaan-card.jpg", bonusHp: 10, swiftMultiplier: 2,
      replace: {
        1: { name: "Wolf Claws", short: "4 damage + bleed", cooldown: 1, target: "enemy", effect: { damage: 4, swift: 1, bleed: 0.4 }, desc: "Wolf claws deal 4 damage and cause bleed (0.4 a turn for 3 turns). +1 Swift." },
      },
    },
    leader: "rally",
  },
  abbas: {
    name: "Abbas Shabbir", title: "The Reaper", class: "frontliner", type: "darkness", rarity: "holo", hp: 10, art: "💀",
    image: "cards/abbas-card.jpg", credit: "Art: Gemini",
    passive: {
      name: "Reaper's Hunger", short: "Heals half of damage", lifesteal: 0.5, overheal: true, leaderWeakness: 1.5,
      desc: "Heals 50% of damage he deals, and can heal past max HP. Takes 1.5x damage from the enemy leader.",
    },
    abilities: [
      { name: "Scythe Slice", short: "4 to both enemy fronts", cooldown: 2, target: "enemyFront", effect: { damage: 4 }, desc: "Swing across the board: 4 damage to both enemy front champions." },
      { name: "Soul Link", short: "Guess a side to link", cooldown: 3, target: "anyEnemy", effect: { soulLink: 2 }, desc: "Pick any enemy and play Left or Right. If they pick the same side, they're linked and take 2 damage every turn." },
    ],
    leader: "thorns",
  },

  // ---------- Made-up champions (replace with more friends!) ----------
  blaze: {
    name: "Blaze", title: "The Firestarter", class: "ranger", type: "fire", rarity: "common", hp: 12, art: "🔥",
    abilities: [
      { name: "Fireball", cooldown: 1, target: "enemy", effect: { damage: 4 }, desc: "Deal 4 damage." },
      { name: "Inferno", short: "2 damage to each enemy", cooldown: 2, target: "allEnemies", effect: { damage: 2 }, desc: "Deal 2 damage to every enemy you can attack." },
    ],
    leader: "rally",
  },
  ironwall: {
    name: "Ironwall", title: "The Unbreakable", class: "frontliner", type: "metal", rarity: "common", hp: 16, art: "🛡️",
    abilities: [
      { name: "Bash", cooldown: 0, target: "enemy", effect: { damage: 2 }, desc: "Deal 2 damage." },
      { name: "Guard", cooldown: 1, target: "ally", effect: { shield: 4 }, desc: "Give a champion a 4 shield." },
    ],
    leader: "bulwark",
  },
  sage: {
    name: "Sage", title: "The Healer", class: "support", type: "grass", rarity: "common", hp: 11, art: "🌿",
    abilities: [
      { name: "Mend", cooldown: 1, target: "ally", effect: { heal: 4 }, desc: "Heal a champion 4." },
      { name: "Zap", cooldown: 0, target: "enemy", effect: { damage: 2 }, desc: "Deal 2 damage." },
    ],
    leader: "fortify",
  },
  shade: {
    name: "Shade", title: "The Shadow", class: "assassin", type: "darkness", rarity: "common", hp: 10, art: "🗡️",
    abilities: [
      { name: "Backstab", cooldown: 2, target: "enemy", effect: { damage: 5 }, desc: "Deal 5 damage." },
      { name: "Jab", cooldown: 0, target: "enemy", effect: { damage: 2 }, desc: "Deal 2 damage." },
    ],
    leader: "thorns",
  },
  spark: {
    name: "Spark", title: "The Storm", class: "ranger", type: "lightning", rarity: "common", hp: 12, art: "⚡",
    abilities: [
      { name: "Chain Lightning", short: "3 damage to each enemy", cooldown: 3, target: "allEnemies", effect: { damage: 3 }, desc: "Deal 3 damage to every enemy you can attack." },
      { name: "Static", cooldown: 0, target: "enemy", effect: { damage: 2 }, desc: "Deal 2 damage." },
    ],
    leader: "haste",
  },
  brute: {
    name: "Brute", title: "The Wrecking Ball", class: "warrior", type: "fighting", rarity: "common", hp: 14, art: "👊",
    abilities: [
      { name: "Smash", cooldown: 2, target: "enemy", effect: { damage: 6 }, desc: "Deal 6 damage." },
      { name: "Punch", cooldown: 0, target: "enemy", effect: { damage: 2 }, desc: "Deal 2 damage." },
    ],
    leader: "thorns",
  },
  leech: {
    name: "Leech", title: "The Thirsty", class: "assassin", type: "darkness", rarity: "common", hp: 12, art: "🦇",
    abilities: [
      { name: "Drain", cooldown: 1, target: "enemy", effect: { drain: 3 }, desc: "Deal 3 damage and heal Leech 3." },
      { name: "Bite", cooldown: 0, target: "enemy", effect: { damage: 2 }, desc: "Deal 2 damage." },
    ],
    leader: "lifeline",
  },
  oracle: {
    name: "Oracle", title: "The Seer", class: "support", type: "psychic", rarity: "common", hp: 11, art: "🔮",
    abilities: [
      { name: "Foresight", cooldown: 1, target: "none", effect: { draw: 1 }, desc: "Draw a utility card." },
      { name: "Bolt", cooldown: 1, target: "enemy", effect: { damage: 3 }, desc: "Deal 3 damage." },
    ],
    leader: "scholar",
  },
};

// UTILITY cards are played from your hand, one per turn. "count" is how many are in each player's deck.
const UTILITIES = {
  potion: { name: "Potion", target: "ally", effect: { heal: 4 }, desc: "Heal a champion 4.", art: "🧪", count: 4 },
  bigPotion: { name: "Big Potion", target: "ally", effect: { heal: 7 }, desc: "Heal a champion 7.", art: "⚗️", count: 2 },
  shield: { name: "Shield", target: "ally", effect: { shield: 3 }, desc: "Give a champion a 3 shield.", art: "🔰", count: 3 },
  bomb: { name: "Bomb", target: "enemy", effect: { damage: 3 }, desc: "Deal 3 damage.", art: "💣", count: 3 },
  fireArrow: { name: "Fire Arrow", target: "enemy", effect: { damage: 2 }, desc: "Deal 2 damage.", art: "🏹", count: 4 },
  energyDrink: { name: "Energy Drink", target: "ally", effect: { cooldownDown: 1 }, desc: "A champion's cooldowns go down by 1.", art: "🥤", count: 2 },
  secondWind: { name: "Second Wind", target: "ally", effect: { refresh: true }, desc: "A champion that already acted can act again.", art: "💨", count: 2 },
};

// Pictures behind the board. The server picks one at random for each game.
const BACKGROUNDS = ["backgrounds/world-school.jpg", "backgrounds/calgary-rockies.jpg", "backgrounds/lauremont.jpg"];

module.exports = { CLASSES, LEADERS, CHAMPIONS, UTILITIES, BACKGROUNDS };
