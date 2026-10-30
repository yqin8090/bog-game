// The BoG rules. The server keeps one game object per room and calls these
// functions when players do things. Each action returns an error message
// (a string) if it isn't allowed, or nothing if it worked.

const { LEADERS, CHAMPIONS, UTILITIES } = require("./cards");

const SLOTS = ["left", "right", "back"];
const SLOT_NAMES = { left: "left stronghold", right: "right stronghold", back: "main stronghold" };
const ENERGY_PER_TURN = 3;
const STARTING_HAND = 3;
const MAX_HAND = 7;
const CHAMPIONS_OFFERED = 4;

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck() {
  const deck = [];
  for (const [id, card] of Object.entries(UTILITIES)) {
    for (let i = 0; i < card.count; i++) deck.push(id);
  }
  return shuffle(deck);
}

function createGame(players) {
  // Each player is offered different champions and picks 3 of them.
  const roster = shuffle(Object.keys(CHAMPIONS));
  const game = {
    phase: "setup", // "setup" -> "playing" -> "over"
    order: players.map((p) => p.id),
    players: {},
    turn: null,
    turnNumber: 0,
    winner: null,
    log: [],
    events: [],
  };
  players.forEach((p, i) => {
    game.players[p.id] = {
      id: p.id,
      name: p.name,
      offered: roster.slice(i * CHAMPIONS_OFFERED, (i + 1) * CHAMPIONS_OFFERED),
      slots: null, // { left, right, back } once chosen
      hand: [],
      deck: buildDeck(),
      energy: 0,
    };
  });
  return game;
}

function opponentOf(game, pid) {
  return game.order.find((id) => id !== pid);
}

function log(game, text) {
  game.log.push(text);
  if (game.log.length > 50) game.log.shift();
}

function leaderOf(game, pid) {
  const back = game.players[pid].slots.back;
  return back.hp > 0 ? CHAMPIONS[back.card].leader : null;
}

function alive(game, pid, slot) {
  const c = game.players[pid].slots[slot];
  return c && c.hp > 0;
}

// Which enemy slots can be attacked right now.
function attackableSlots(game, targetPid) {
  const front = ["left", "right"].filter((s) => alive(game, targetPid, s));
  return front.length < 2 ? [...front, "back"] : front;
}

function drawCards(game, pid, n) {
  const p = game.players[pid];
  for (let i = 0; i < n && p.deck.length > 0; i++) {
    if (p.hand.length >= MAX_HAND) break;
    p.hand.push(p.deck.pop());
  }
}

// --- Setup: pick 3 champions and where they stand ---

function chooseLineup(game, pid, lineup) {
  if (game.phase !== "setup") return "The game already started.";
  const p = game.players[pid];
  if (p.slots) return "You already picked.";
  const picks = SLOTS.map((s) => lineup && lineup[s]);
  if (picks.some((c) => !p.offered.includes(c)) || new Set(picks).size !== 3) {
    return "Pick 3 different champions from your offer.";
  }
  p.slots = {};
  for (const s of SLOTS) {
    const hp = CHAMPIONS[lineup[s]].hp;
    p.slots[s] = { card: lineup[s], hp, maxHp: hp, shield: 0, acted: false };
  }
  if (game.order.every((id) => game.players[id].slots)) startPlaying(game);
}

function startPlaying(game) {
  game.phase = "playing";
  for (const id of game.order) drawCards(game, id, STARTING_HAND);
  game.order = shuffle(game.order);
  log(game, `${game.players[game.order[0]].name} goes first.`);
  startTurn(game, game.order[0]);
}

function startTurn(game, pid) {
  game.turn = pid;
  game.turnNumber++;
  const p = game.players[pid];
  const leader = leaderOf(game, pid);
  const firstTurn = game.turnNumber === 1;

  // The player who goes first gets a little less on turn 1 to keep it fair.
  p.energy = (firstTurn ? ENERGY_PER_TURN - 1 : ENERGY_PER_TURN) + (leader === "inspire" ? 1 : 0);
  if (!firstTurn) drawCards(game, pid, 1 + (leader === "scholar" ? 1 : 0));
  for (const s of SLOTS) p.slots[s].acted = false;

  if (leader === "fortify") {
    for (const s of ["left", "right"]) heal(game, pid, s, 1);
  }
  if (leader === "lifeline") heal(game, pid, "back", 2);
}

// --- Effects ---

function heal(game, pid, slot, amount) {
  const c = game.players[pid].slots[slot];
  if (c.hp <= 0) return;
  const healed = Math.min(amount, c.maxHp - c.hp);
  c.hp += healed;
  if (healed > 0) game.events.push({ type: "heal", owner: pid, slot, amount: healed });
}

// Deal damage to a champion. "from" is the attacking champion's slot, if a champion attacked.
function damage(game, attackerPid, targetPid, slot, amount, from) {
  const target = game.players[targetPid].slots[slot];
  if (target.hp <= 0) return;
  const isFront = slot !== "back";
  if (from && leaderOf(game, attackerPid) === "rally") amount += 1;
  if (isFront && leaderOf(game, targetPid) === "bulwark") amount = Math.max(0, amount - 1);

  const blocked = Math.min(target.shield, amount);
  target.shield -= blocked;
  const dealt = amount - blocked;
  target.hp = Math.max(0, target.hp - dealt);
  game.events.push({ type: "damage", owner: targetPid, slot, amount: dealt, blocked });

  if (target.hp === 0) {
    const name = game.players[targetPid].name;
    log(game, `💥 ${CHAMPIONS[target.card].name} is knocked out! ${name}'s ${SLOT_NAMES[slot]} has fallen.`);
    if (slot === "back") {
      game.phase = "over";
      game.winner = attackerPid;
      log(game, `🏆 ${game.players[attackerPid].name} wins!`);
      return;
    }
  }

  if (from && isFront && leaderOf(game, targetPid) === "thorns" && alive(game, attackerPid, from)) {
    damage(game, targetPid, attackerPid, from, 1, null);
  }
}

// Runs an ability or utility card's effect. Returns an error if the target is wrong.
function checkTarget(game, pid, targetType, target) {
  if (target && !SLOTS.includes(target.slot)) return "Unknown stronghold.";
  if (targetType === "enemy") {
    const enemy = opponentOf(game, pid);
    if (!target || target.owner !== enemy || !attackableSlots(game, enemy).includes(target.slot) || !alive(game, enemy, target.slot)) {
      return "Pick an enemy champion you can attack.";
    }
  } else if (targetType === "ally") {
    if (!target || target.owner !== pid || !alive(game, pid, target.slot)) return "Pick one of your champions.";
  }
}

function applyEffect(game, pid, effect, targetType, target, from) {
  const enemy = opponentOf(game, pid);
  const p = game.players[pid];
  if (effect.damage) {
    const slots = targetType === "allEnemies" ? attackableSlots(game, enemy) : [target.slot];
    for (const s of slots) if (game.phase === "playing") damage(game, pid, enemy, s, effect.damage, from);
  }
  if (effect.drain) {
    damage(game, pid, enemy, target.slot, effect.drain, from);
    if (game.phase === "playing") heal(game, pid, from, effect.drain);
  }
  if (effect.heal) heal(game, pid, target.slot, effect.heal);
  if (effect.shield) {
    p.slots[target.slot].shield += effect.shield;
    game.events.push({ type: "shield", owner: pid, slot: target.slot, amount: effect.shield });
  }
  if (effect.draw) drawCards(game, pid, effect.draw);
  if (effect.energy) p.energy += effect.energy;
  if (effect.refresh) p.slots[target.slot].acted = false;
}

// --- Player actions on their turn ---

function checkTurn(game, pid) {
  if (game.phase !== "playing") return "The game isn't running.";
  if (game.turn !== pid) return "It's not your turn.";
}

function useAbility(game, pid, slot, index, target) {
  const err = checkTurn(game, pid);
  if (err) return err;
  const p = game.players[pid];
  if (!SLOTS.includes(slot)) return "Unknown stronghold.";
  const champ = p.slots[slot];
  if (!champ || champ.hp <= 0) return "That champion is knocked out.";
  if (champ.acted) return "That champion already acted this turn.";
  const ability = Number.isInteger(index) && CHAMPIONS[champ.card].abilities[index];
  if (!ability) return "Unknown ability.";
  if (p.energy < ability.cost) return "Not enough energy.";
  const targetErr = checkTarget(game, pid, ability.target, target);
  if (targetErr) return targetErr;

  p.energy -= ability.cost;
  champ.acted = true;
  log(game, `${p.name}'s ${CHAMPIONS[champ.card].name} used ${ability.name}.`);
  applyEffect(game, pid, ability.effect, ability.target, target, slot);
}

function playCard(game, pid, handIndex, target) {
  const err = checkTurn(game, pid);
  if (err) return err;
  const p = game.players[pid];
  const id = Number.isInteger(handIndex) ? p.hand[handIndex] : null;
  const card = UTILITIES[id];
  if (!card) return "You don't have that card.";
  if (p.energy < card.cost) return "Not enough energy.";
  const targetErr = checkTarget(game, pid, card.target, target);
  if (targetErr) return targetErr;
  if (card.effect.refresh && !p.slots[target.slot].acted) return "That champion hasn't acted yet.";

  p.energy -= card.cost;
  p.hand.splice(handIndex, 1);
  log(game, `${p.name} played ${card.name}.`);
  applyEffect(game, pid, card.effect, card.target, target, null);
}

function endTurn(game, pid) {
  const err = checkTurn(game, pid);
  if (err) return err;
  startTurn(game, opponentOf(game, pid));
}

function forfeit(game, pid) {
  if (game.phase === "over") return;
  game.phase = "over";
  game.winner = opponentOf(game, pid);
  log(game, `${game.players[pid].name} left the game.`);
}

// What one player is allowed to see (you can't see the other player's hand or deck).
function viewFor(game, pid) {
  const bothPicked = game.order.every((id) => game.players[id].slots);
  const players = {};
  for (const id of game.order) {
    const p = game.players[id];
    const mine = id === pid;
    players[id] = {
      id,
      name: p.name,
      energy: p.energy,
      handCount: p.hand.length,
      deckCount: p.deck.length,
      hand: mine ? p.hand : null,
      offered: mine ? p.offered : null,
      picked: !!p.slots,
      slots: mine || bothPicked ? p.slots : null,
    };
  }
  return {
    phase: game.phase,
    me: pid,
    opponent: opponentOf(game, pid),
    order: game.order,
    turn: game.turn,
    winner: game.winner,
    log: game.log,
    events: game.events,
    attackable: game.phase === "playing" ? attackableSlots(game, opponentOf(game, pid)) : [],
    players,
  };
}

module.exports = { createGame, chooseLineup, useAbility, playCard, endTurn, forfeit, viewFor };
