// The BoG rules. The server keeps one game object per room and calls these
// functions when players do things. Each action returns an error message
// (a string) if it isn't allowed, or nothing if it worked.

const { CHAMPIONS, UTILITIES, BACKGROUNDS } = require("./cards");

const SLOTS = ["left", "right", "back"];
const FRONT = ["left", "right"];
const SLOT_NAMES = { left: "left stronghold", right: "right stronghold", back: "main stronghold" };
const STARTING_HAND = 3;
const MAX_HAND = 7;
const CHAMPIONS_OFFERED = 4;
const MAX_SWIFT = 3;
const BLEED_TURNS = 3;
const MAX_SHIELD = 6;
const SUDDEN_DEATH_TURN = 21; // so games can't go on forever
const BASE_ACTIONS = 2; // action points each turn at first
const RAISED_ACTIONS = 3; // from the starting player's third turn on
const RAISE_AT_TURN = 3;

// Fractions like 1.5x damage can make HP like 7.5, so keep one decimal place.
const round = (n) => Math.round(n * 10) / 10;

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
    background: shuffle(BACKGROUNDS)[0], // the picture behind the board, the same for both players
    players: {},
    turn: null,
    turnNumber: 0,
    pending: null, // a Soul Link guess waiting for an answer
    skipFor: null, // a player whose next turn is skipped (Wind version of turning tide)
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
      turnsTaken: 0,
      actions: 0, // action points left this turn
      actionMax: 0, // action points this turn started with
      boosts: [], // damage boosts from Tailwind and Gust: { mult, from (caster's slot), until (turn number) }
    };
  });
  return game;
}

function opponentOf(game, pid) {
  return game.order.find((id) => id !== pid);
}

function log(game, text) {
  game.log.push(text);
  if (game.log.length > 60) game.log.shift();
}

function champName(champ) {
  return champ.form ? CHAMPIONS[champ.card].form.name : CHAMPIONS[champ.card].name;
}

function leaderOf(game, pid) {
  const back = game.players[pid].slots.back;
  return back.hp > 0 ? CHAMPIONS[back.card].leader : null;
}

// Action points for a player's turn. Windfall gives 3 from the first turn. Otherwise it's 2, or 3 once the
// player who started the game has had three turns. Haste adds 1.
function actionPointsFor(game, pid) {
  const leader = leaderOf(game, pid);
  if (leader === "windfall") return RAISED_ACTIONS;
  const base = game.players[game.order[0]].turnsTaken >= RAISE_AT_TURN ? RAISED_ACTIONS : BASE_ACTIONS;
  return base + (leader === "haste" ? 1 : 0);
}

// The damage multiplier from active boosts. A boost skips the champion that cast it.
function boostOf(game, pid, slot) {
  const p = game.players[pid];
  return p.boosts.reduce((mult, b) => (b.from !== slot && b.until >= p.turnsTaken ? mult * b.mult : mult), 1);
}

function passiveOf(champ) {
  return CHAMPIONS[champ.card].passive || {};
}

// A champion's abilities right now (a transformation can swap some out).
function abilitiesOf(champ) {
  const def = CHAMPIONS[champ.card];
  return def.abilities.map((a, i) => (champ.form && def.form.replace[i]) || a);
}

function alive(game, pid, slot) {
  const c = game.players[pid].slots[slot];
  return c && c.hp > 0;
}

// Which enemy slots can be attacked right now.
function attackableSlots(game, targetPid) {
  const front = FRONT.filter((s) => alive(game, targetPid, s));
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
  // Ironhide: while this leader stands at the back, every champion on the team gets +2 HP.
  // Vitality: while this leader stands at the back, only the leader gets +10 HP.
  const backLeader = CHAMPIONS[lineup.back].leader;
  const hpBonus = backLeader === "ironhide" ? 2 : 0;
  for (const s of SLOTS) {
    const def = CHAMPIONS[lineup[s]];
    const selfBonus = s === "back" && backLeader === "vitality" ? 10 : 0;
    p.slots[s] = {
      card: lineup[s], hp: def.hp + hpBonus + selfBonus, maxHp: def.hp + hpBonus + selfBonus, shield: 0, acted: false,
      used: [], readyAt: {}, swift: 0, form: false, respawned: false,
      marked: false, bleeds: [], link: null, dazed: false,
    };
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
  const enemy = opponentOf(game, pid);
  const leader = leaderOf(game, pid);
  p.turnsTaken++;

  // The player who goes first doesn't draw on turn 1, to keep it fair.
  if (game.turnNumber > 1) drawCards(game, pid, 1 + (leader === "scholar" ? 1 : 0));

  p.actionMax = actionPointsFor(game, pid);
  p.actions = p.actionMax;
  for (const s of SLOTS) {
    const c = p.slots[s];
    c.acted = !!c.dazed; // a dazed champion sits this turn out
  }

  // Bleeding champions lose HP at the start of their own turn.
  for (const s of SLOTS) {
    const c = p.slots[s];
    if (c.hp <= 0) continue;
    for (const b of c.bleeds) {
      if (game.phase === "playing") damage(game, enemy, pid, s, b.amount, { direct: true, reason: "bleed" });
      b.turns--;
    }
    c.bleeds = c.bleeds.filter((b) => b.turns > 0);
  }

  // Soul Links hurt the linked enemy at the start of the linker's turn.
  for (const s of SLOTS) {
    const c = p.slots[s];
    if (!c.link || game.phase !== "playing") continue;
    if (c.hp <= 0 || !alive(game, enemy, c.link)) {
      c.link = null;
      continue;
    }
    damage(game, pid, enemy, c.link, c.linkDamage, { from: s, direct: true, reason: "link" });
  }

  // Sudden death: long games start hurting everyone, a bit more every 10 turns.
  if (game.turnNumber >= SUDDEN_DEATH_TURN) {
    if (game.turnNumber === SUDDEN_DEATH_TURN) log(game, "⏳ Sudden death! Champions now take damage at the start of each turn.");
    const hurt = Math.floor((game.turnNumber - SUDDEN_DEATH_TURN) / 10) + 1;
    for (const s of SLOTS) {
      if (game.phase === "playing" && alive(game, pid, s)) damage(game, enemy, pid, s, hurt, { direct: true, reason: "storm" });
    }
  }

  if (game.phase !== "playing") return;
  if (leader === "fortify") for (const s of FRONT) heal(game, pid, s, 1);
  if (leader === "lifeline") heal(game, pid, "back", 2);
}

// --- Effects ---

function heal(game, pid, slot, amount, overheal = false) {
  const c = game.players[pid].slots[slot];
  if (c.hp <= 0 || amount <= 0) return;
  const healed = round(overheal ? amount : Math.min(amount, c.maxHp - c.hp));
  if (healed <= 0) return;
  c.hp = round(c.hp + healed);
  game.events.push({ type: "heal", owner: pid, slot, amount: healed });
}

// Deal damage to a champion.
//   from:   the attacking champion's slot (if a champion did it)
//   direct: bleed and Soul Link damage skip bonuses, dodging and shields' thorns
function damage(game, attackerPid, targetPid, slot, amount, { from = null, direct = false, reason = null } = {}) {
  const target = game.players[targetPid].slots[slot];
  if (target.hp <= 0) return 0;
  const attacker = from ? game.players[attackerPid].slots[from] : null;
  const isFront = slot !== "back";

  if (!direct) {
    const dodge = target.swift * 0.1 * (target.form ? CHAMPIONS[target.card].form.swiftMultiplier : 1);
    if (dodge > 0 && Math.random() < dodge) {
      game.events.push({ type: "dodge", owner: targetPid, slot });
      log(game, `💨 ${champName(target)} dodged!`);
      return 0;
    }
    if (from && leaderOf(game, attackerPid) === "rally") amount += 1;
    if (from && leaderOf(game, attackerPid) === "pack" && attacker.hp < attacker.maxHp / 2) amount *= 1.5;
    if (from) amount *= boostOf(game, attackerPid, from);
    if (target.marked) {
      amount *= 2;
      target.marked = false;
      log(game, `🎯 Weak spot! Double damage on ${champName(target)}.`);
    }
    if (from === "back" && passiveOf(target).leaderWeakness) amount *= passiveOf(target).leaderWeakness;
    // Vianoc's passive: extra damage against one class, like frontliners.
    const vsClass = attacker ? passiveOf(attacker).vsClass : null;
    if (vsClass && CHAMPIONS[target.card].class === vsClass.class) amount *= vsClass.mult;
    if (isFront && leaderOf(game, targetPid) === "bulwark") amount = Math.max(0, amount - 1);
  }
  amount = round(amount);

  const blocked = Math.min(target.shield, amount);
  target.shield = round(target.shield - blocked);
  const dealt = round(amount - blocked);
  target.hp = round(Math.max(0, target.hp - dealt));
  game.events.push({ type: "damage", owner: targetPid, slot, amount: dealt, blocked, reason });

  // Rise Again (Carlos): a champion that would be knocked out may get back up once per game, at a share of its HP.
  const respawn = passiveOf(target).respawn;
  if (target.hp === 0 && respawn && !target.respawned && Math.random() < respawn.chance) {
    target.respawned = true;
    target.hp = round(target.maxHp * respawn.hp);
    game.events.push({ type: "heal", owner: targetPid, slot, amount: target.hp });
    log(game, `✨ ${champName(target)} rises again!`);
  }

  if (target.hp === 0) {
    target.link = null;
    const name = game.players[targetPid].name;
    log(game, `💥 ${champName(target)} is knocked out! ${name}'s ${SLOT_NAMES[slot]} has fallen.`);
    if (slot === "back") {
      game.phase = "over";
      game.winner = attackerPid;
      game.pending = null;
      log(game, `🏆 ${game.players[attackerPid].name} wins!`);
      return dealt;
    }
  }

  // Abbas's passive: heal from damage dealt, even past max HP.
  if (attacker && attacker.hp > 0 && passiveOf(attacker).lifesteal) {
    heal(game, attackerPid, from, dealt * passiveOf(attacker).lifesteal, passiveOf(attacker).overheal);
  }

  if (!direct && from && isFront && leaderOf(game, targetPid) === "thorns" && alive(game, attackerPid, from)) {
    damage(game, targetPid, attackerPid, from, 1, { direct: true, reason: "thorns" });
  }
  return dealt;
}

// Gives a champion a shield, up to MAX_SHIELD.
function addShield(game, pid, slot, amount) {
  const c = game.players[pid].slots[slot];
  c.shield = Math.min(MAX_SHIELD, c.shield + amount);
  game.events.push({ type: "shield", owner: pid, slot, amount });
}

function checkTarget(game, pid, targetType, target) {
  if (target && !SLOTS.includes(target.slot)) return "Unknown stronghold.";
  const enemy = opponentOf(game, pid);
  if (targetType === "enemy") {
    if (!target || target.owner !== enemy || !attackableSlots(game, enemy).includes(target.slot) || !alive(game, enemy, target.slot)) {
      return "Pick an enemy champion you can attack.";
    }
  } else if (targetType === "anyEnemy") {
    if (!target || target.owner !== enemy || !alive(game, enemy, target.slot)) return "Pick an enemy champion.";
  } else if (targetType === "ally") {
    if (!target || target.owner !== pid || !alive(game, pid, target.slot)) return "Pick one of your champions.";
  }
}

function applyEffect(game, pid, effect, targetType, target, from) {
  const enemy = opponentOf(game, pid);
  const p = game.players[pid];
  const self = from ? p.slots[from] : null;

  if (effect.damage) {
    let slots = [target && target.slot];
    if (targetType === "allEnemies") slots = attackableSlots(game, enemy);
    if (targetType === "enemyFront") {
      slots = FRONT.filter((s) => alive(game, enemy, s));
      game.events.push({ type: "slash", owner: enemy });
    }
    for (const s of slots) {
      if (game.phase !== "playing") break;
      const dealt = damage(game, pid, enemy, s, effect.damage, { from });
      if (effect.bleed && dealt > 0 && alive(game, enemy, s)) {
        game.players[enemy].slots[s].bleeds.push({ amount: effect.bleed, turns: BLEED_TURNS });
      }
      if (effect.daze && alive(game, enemy, s) && Math.random() < effect.daze) {
        game.players[enemy].slots[s].dazed = true;
        game.events.push({ type: "daze", owner: enemy, slot: s });
        log(game, `💫 ${champName(game.players[enemy].slots[s])} is dazed! It can't act next turn.`);
      }
    }
  }
  // Sunder: the enemy's leader takes damage too, but only when the leader can be attacked.
  if (effect.leaderDamage && target.slot !== "back" && game.phase === "playing" && attackableSlots(game, enemy).includes("back") && alive(game, enemy, "back")) {
    damage(game, pid, enemy, "back", effect.leaderDamage, { from });
  }
  // Relentless Thrust: each hit rolls on its own, and the series stops if the champion is knocked out.
  if (effect.hits && target) {
    for (const hit of effect.hits) {
      if (game.phase !== "playing" || !alive(game, enemy, target.slot)) break;
      if (Math.random() < hit.chance) {
        damage(game, pid, enemy, target.slot, hit.damage, { from });
      } else {
        log(game, `💨 A hit on ${champName(game.players[enemy].slots[target.slot])} missed.`);
      }
    }
  }
  if (effect.drain) {
    damage(game, pid, enemy, target.slot, effect.drain, { from });
    if (game.phase === "playing") heal(game, pid, from, effect.drain);
  }
  if (effect.swift && self) self.swift = Math.min(MAX_SWIFT, self.swift + effect.swift);
  if (effect.mark) {
    game.players[enemy].slots[target.slot].marked = true;
    game.events.push({ type: "mark", owner: enemy, slot: target.slot });
  }
  if (effect.heal) heal(game, pid, target.slot, effect.heal);
  if (effect.shield) addShield(game, pid, target.slot, effect.shield);
  if (effect.frontShield) {
    for (const s of FRONT) if (alive(game, pid, s)) addShield(game, pid, s, effect.frontShield);
  }
  if (effect.teamShield) {
    for (const s of SLOTS) if (alive(game, pid, s)) addShield(game, pid, s, effect.teamShield);
  }
  if (effect.transform && self) {
    const form = CHAMPIONS[self.card].form;
    self.form = true;
    self.maxHp += form.bonusHp;
    self.hp = round(self.hp + form.bonusHp);
    game.events.push({ type: "transform", owner: pid, slot: from });
    log(game, `✨ ${CHAMPIONS[self.card].name} transforms into ${form.name}!`);
  }
  if (effect.allyBoost && from) {
    p.boosts = p.boosts.filter((b) => b.until >= p.turnsTaken);
    p.boosts.push({ mult: effect.allyBoost, from, until: p.turnsTaken + 1 });
    log(game, `💨 ${p.name}'s other champions deal ${effect.allyBoost}x damage this turn and next.`);
  }
  if (effect.skipTurn) game.skipFor = enemy;
  if (effect.draw) drawCards(game, pid, effect.draw);
  if (effect.refresh) p.slots[target.slot].acted = false;
  if (effect.actionPoint) p.actions += effect.actionPoint;
}

// Whether an ability can be used right now, and if not, why.
function abilityBlock(game, pid, slot, index) {
  const p = game.players[pid];
  const champ = p.slots[slot];
  const ability = abilitiesOf(champ)[index];
  if (ability.once && champ.used.includes(index)) return "Already used";
  if (ability.effect.transform && champ.form) return "Already transformed";
  const readyIn = (champ.readyAt[index] || 0) - p.turnsTaken;
  if (readyIn > 0) return readyIn === 1 ? "Ready next turn" : `Ready in ${readyIn} turns`;
  const req = ability.requires || {};
  if (req.belowHalf && champ.hp >= champ.maxHp / 2) return "Needs under half HP";
  if (req.minTurn && p.turnsTaken < req.minTurn) return `Unlocks on your turn ${req.minTurn}`;
  return null;
}

// --- Player actions on their turn ---

function checkTurn(game, pid) {
  if (game.phase !== "playing") return "The game isn't running.";
  if (game.turn !== pid) return "It's not your turn.";
  if (game.pending) return "Waiting for the Soul Link guess.";
}

function useAbility(game, pid, slot, index, target, choice) {
  const err = checkTurn(game, pid);
  if (err) return err;
  const p = game.players[pid];
  if (!SLOTS.includes(slot)) return "Unknown stronghold.";
  const champ = p.slots[slot];
  if (champ.hp <= 0) return "That champion is knocked out.";
  if (champ.dazed) return "That champion is dazed and can't act this turn.";
  if (champ.acted) return "That champion already acted this turn.";
  const ability = Number.isInteger(index) && abilitiesOf(champ)[index];
  if (!ability) return "Unknown ability.";
  const blocked = abilityBlock(game, pid, slot, index);
  if (blocked) return blocked;
  const targetErr = checkTarget(game, pid, ability.target, target);
  if (targetErr) return targetErr;
  if (ability.effect.soulLink && choice !== "left" && choice !== "right") return "Pick Left or Right.";
  if (p.actions < 1) return "You have no action points left this turn.";

  p.actions--;
  champ.acted = true;
  if (ability.once) champ.used.push(index);
  // A cooldown of N means the ability sits out the next N of this player's turns.
  if (ability.cooldown) champ.readyAt[index] = p.turnsTaken + ability.cooldown + 1;
  log(game, `${p.name}'s ${champName(champ)} used ${ability.name}.`);

  if (ability.effect.soulLink) {
    // The other player now has to guess. Picking the same side as the linker means they're caught.
    game.pending = { type: "soulLink", pid, slot, target, choice, damage: ability.effect.soulLink };
    return;
  }
  applyEffect(game, pid, ability.effect, ability.target, target, slot);
}

function guessLink(game, pid, side) {
  const pending = game.pending;
  if (!pending || game.phase !== "playing") return "Nothing to guess.";
  if (pending.target.owner !== pid) return "It's not your guess.";
  if (side !== "left" && side !== "right") return "Pick Left or Right.";
  game.pending = null;
  const linker = game.players[pending.pid].slots[pending.slot];
  const victim = game.players[pid].slots[pending.target.slot];
  const caught = side === pending.choice;
  game.events.push({ type: "guess", linker: pending.choice, guess: side, caught, owner: pid, slot: pending.target.slot });
  if (caught && linker.hp > 0) {
    linker.link = pending.target.slot;
    linker.linkDamage = pending.damage;
    log(game, `⛓️ ${champName(victim)} is Soul Linked! They'll take ${pending.damage} damage every turn.`);
  } else {
    log(game, `${champName(victim)} escaped the Soul Link.`);
  }
}

function playCard(game, pid, handIndex, target) {
  const err = checkTurn(game, pid);
  if (err) return err;
  const p = game.players[pid];
  if (p.actions < 1) return "You have no action points left this turn.";
  const id = Number.isInteger(handIndex) ? p.hand[handIndex] : null;
  const card = UTILITIES[id];
  if (!card) return "You don't have that card.";
  const targetErr = checkTarget(game, pid, card.target, target);
  if (targetErr) return targetErr;
  if (card.effect.refresh && !p.slots[target.slot].acted) return "That champion hasn't acted yet.";
  if (card.effect.refresh && p.slots[target.slot].dazed) return "That champion is dazed and can't act this turn.";

  p.actions--;
  p.hand.splice(handIndex, 1);
  log(game, `${p.name} played ${card.name}.`);
  applyEffect(game, pid, card.effect, card.target, target, null);
}

function endTurn(game, pid) {
  const err = checkTurn(game, pid);
  if (err) return err;
  // Dazed champions recover once their owner's turn is over.
  for (const s of SLOTS) game.players[pid].slots[s].dazed = false;
  const next = opponentOf(game, pid);
  if (game.skipFor === next) {
    game.skipFor = null;
    log(game, `⏭️ ${game.players[next].name}'s turn is skipped!`);
    startTurn(game, pid);
    return;
  }
  startTurn(game, next);
}

function forfeit(game, pid) {
  if (game.phase === "over") return;
  game.phase = "over";
  game.winner = opponentOf(game, pid);
  game.pending = null;
  log(game, `${game.players[pid].name} left the game.`);
}

// What one player is allowed to see (you can't see the other player's hand or deck).
function viewFor(game, pid) {
  const bothPicked = game.order.every((id) => game.players[id].slots);
  const players = {};
  for (const id of game.order) {
    const p = game.players[id];
    const mine = id === pid;
    let slots = null;
    if (p.slots && (mine || bothPicked)) {
      slots = {};
      for (const s of SLOTS) {
        const c = p.slots[s];
        slots[s] = {
          ...c,
          name: champName(c),
          boostMult: boostOf(game, id, s),
          abilities: abilitiesOf(c).map((a, i) => ({
            name: a.name, short: a.short, desc: a.desc, target: a.target, effect: a.effect, power: !!a.power, cooldown: a.cooldown || 0,
            blocked: game.phase === "playing" ? abilityBlock(game, id, s, i) : null,
          })),
        };
      }
    }
    players[id] = {
      id,
      name: p.name,
      handCount: p.hand.length,
      deckCount: p.deck.length,
      actionsLeft: p.actions,
      actionsMax: p.actionMax,
      turnsTaken: p.turnsTaken,
      hand: mine ? p.hand : null,
      offered: mine ? p.offered : null,
      picked: !!p.slots,
      slots,
    };
  }
  let pending = null;
  if (game.pending) {
    const { pid: linker, slot, target, choice } = game.pending;
    pending = { type: "soulLink", linker, slot, target, choice: linker === pid ? choice : null };
  }
  return {
    phase: game.phase,
    background: game.background,
    me: pid,
    opponent: opponentOf(game, pid),
    order: game.order,
    turn: game.turn,
    winner: game.winner,
    pending,
    log: game.log,
    events: game.events,
    attackable: game.phase === "playing" ? attackableSlots(game, opponentOf(game, pid)) : [],
    players,
  };
}

module.exports = { createGame, chooseLineup, useAbility, guessLink, playCard, endTurn, forfeit, viewFor };
