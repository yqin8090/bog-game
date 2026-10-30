// All the cards in BoG. This is the file to edit to add or change cards.
//
// CHAMPIONS sit at your strongholds. Each one has:
//   name, title  - shown on the card
//   hp           - how much damage it can take before its stronghold falls
//   color        - the card's main color
//   art          - an emoji shown as the picture (until we add real art)
//   image        - optional: a picture file in public/cards/, like "sam.png"
//   abilities    - what it can do on your turn (one ability per champion per turn)
//   leader       - a bonus that only works while this champion is at the back
//
// Ability "target" can be:
//   "enemy"      - pick an enemy champion you're allowed to attack
//   "ally"       - pick one of your own champions
//   "allEnemies" - hits every enemy champion you're allowed to attack
//   "none"       - no target needed
//
// Ability "effect" can include:
//   damage: N  - deal N damage        heal: N   - heal N hp
//   shield: N  - block the next N damage
//   drain: N   - deal N damage and heal this champion N
//   draw: N    - draw N utility cards  energy: N - gain N energy this turn
//   refresh    - a champion that already acted this turn can act again

const LEADERS = {
  rally: { name: "Rally", desc: "All your champions deal +1 damage." },
  bulwark: { name: "Bulwark", desc: "Your front champions take 1 less damage from each hit." },
  fortify: { name: "Fortify", desc: "At the start of your turn, heal your front champions 1." },
  thorns: { name: "Thorns", desc: "When an enemy champion hits your front champion, it takes 1 damage back." },
  inspire: { name: "Inspire", desc: "You get +1 energy every turn." },
  scholar: { name: "Scholar", desc: "Draw an extra utility card every turn." },
  lifeline: { name: "Lifeline", desc: "At the start of your turn, this leader heals 2." },
};

const CHAMPIONS = {
  blaze: {
    name: "Blaze", title: "The Firestarter", hp: 12, color: "#e85d04", art: "🔥",
    abilities: [
      { name: "Fireball", cost: 2, target: "enemy", effect: { damage: 4 }, desc: "Deal 4 damage." },
      { name: "Inferno", cost: 3, target: "allEnemies", effect: { damage: 2 }, desc: "Deal 2 damage to every enemy you can attack." },
    ],
    leader: "rally",
  },
  ironwall: {
    name: "Ironwall", title: "The Unbreakable", hp: 18, color: "#6c757d", art: "🛡️",
    abilities: [
      { name: "Bash", cost: 1, target: "enemy", effect: { damage: 2 }, desc: "Deal 2 damage." },
      { name: "Guard", cost: 2, target: "ally", effect: { shield: 4 }, desc: "Give a champion a 4 shield." },
    ],
    leader: "bulwark",
  },
  sage: {
    name: "Sage", title: "The Healer", hp: 11, color: "#2a9d8f", art: "🌿",
    abilities: [
      { name: "Mend", cost: 2, target: "ally", effect: { heal: 4 }, desc: "Heal a champion 4." },
      { name: "Zap", cost: 1, target: "enemy", effect: { damage: 2 }, desc: "Deal 2 damage." },
    ],
    leader: "fortify",
  },
  shade: {
    name: "Shade", title: "The Shadow", hp: 10, color: "#5a189a", art: "🗡️",
    abilities: [
      { name: "Backstab", cost: 2, target: "enemy", effect: { damage: 5 }, desc: "Deal 5 damage." },
      { name: "Jab", cost: 1, target: "enemy", effect: { damage: 2 }, desc: "Deal 2 damage." },
    ],
    leader: "thorns",
  },
  spark: {
    name: "Spark", title: "The Storm", hp: 12, color: "#0077b6", art: "⚡",
    abilities: [
      { name: "Chain Lightning", cost: 3, target: "allEnemies", effect: { damage: 3 }, desc: "Deal 3 damage to every enemy you can attack." },
      { name: "Static", cost: 1, target: "enemy", effect: { damage: 2 }, desc: "Deal 2 damage." },
    ],
    leader: "inspire",
  },
  brute: {
    name: "Brute", title: "The Wrecking Ball", hp: 16, color: "#9d0208", art: "👊",
    abilities: [
      { name: "Smash", cost: 3, target: "enemy", effect: { damage: 6 }, desc: "Deal 6 damage." },
      { name: "Punch", cost: 1, target: "enemy", effect: { damage: 2 }, desc: "Deal 2 damage." },
    ],
    leader: "thorns",
  },
  leech: {
    name: "Leech", title: "The Thirsty", hp: 13, color: "#386641", art: "🦇",
    abilities: [
      { name: "Drain", cost: 2, target: "enemy", effect: { drain: 3 }, desc: "Deal 3 damage and heal Leech 3." },
      { name: "Bite", cost: 1, target: "enemy", effect: { damage: 2 }, desc: "Deal 2 damage." },
    ],
    leader: "lifeline",
  },
  oracle: {
    name: "Oracle", title: "The Seer", hp: 11, color: "#b5179e", art: "🔮",
    abilities: [
      { name: "Foresight", cost: 1, target: "none", effect: { draw: 1 }, desc: "Draw a utility card." },
      { name: "Bolt", cost: 2, target: "enemy", effect: { damage: 3 }, desc: "Deal 3 damage." },
    ],
    leader: "scholar",
  },
};

// UTILITY cards are played from your hand. "count" is how many are in each player's deck.
const UTILITIES = {
  potion: { name: "Potion", cost: 1, target: "ally", effect: { heal: 4 }, desc: "Heal a champion 4.", art: "🧪", count: 4 },
  bigPotion: { name: "Big Potion", cost: 2, target: "ally", effect: { heal: 7 }, desc: "Heal a champion 7.", art: "⚗️", count: 2 },
  shield: { name: "Shield", cost: 1, target: "ally", effect: { shield: 3 }, desc: "Give a champion a 3 shield.", art: "🔰", count: 3 },
  bomb: { name: "Bomb", cost: 2, target: "enemy", effect: { damage: 3 }, desc: "Deal 3 damage.", art: "💣", count: 3 },
  fireArrow: { name: "Fire Arrow", cost: 1, target: "enemy", effect: { damage: 2 }, desc: "Deal 2 damage.", art: "🏹", count: 4 },
  energyDrink: { name: "Energy Drink", cost: 0, target: "none", effect: { energy: 2 }, desc: "Gain 2 energy this turn.", art: "🥤", count: 2 },
  secondWind: { name: "Second Wind", cost: 2, target: "ally", effect: { refresh: true }, desc: "A champion that already acted can act again.", art: "💨", count: 2 },
};

module.exports = { LEADERS, CHAMPIONS, UTILITIES };
