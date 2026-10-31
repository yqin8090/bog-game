// Runs in each player's browser. Talks to server.js and draws the game.
const socket = io();
const $ = (id) => document.getElementById(id);

let CARDS = null; // champion and utility card info, loaded from the server
let room = null; // latest room info
let game = null; // latest game view
let selected = null; // what you clicked: { kind: "champ", slot } | { kind: "ability", slot, index } | { kind: "card", handIndex }
let linkTarget = null; // Soul Link target waiting for you to pick Left or Right
let lineup = { left: null, right: null, back: null };
let picking = null; // champion clicked during setup

fetch("/cards.json").then((r) => r.json()).then((c) => (CARDS = c));

const SCREENS = ["home", "lobby", "setup", "game"];
function show(screen) {
  for (const id of SCREENS) $(id).hidden = id !== screen;
  document.body.classList.toggle("wide", screen === "setup" || screen === "game");
}

function handleReply(res) {
  $("error").textContent = res.error || "";
}

function esc(text) {
  const d = document.createElement("div");
  d.textContent = text;
  return d.innerHTML;
}

const fmt = (n) => (Number.isInteger(n) ? n : n.toFixed(1));

// ---------- Home and lobby ----------

$("create").onclick = () => socket.emit("createRoom", { name: $("name").value }, handleReply);
$("join").onclick = () => socket.emit("joinRoom", { name: $("name").value, code: $("code").value }, handleReply);
$("start").onclick = () => socket.emit("startGame");
$("again").onclick = () => socket.emit("startGame");
$("to-lobby").onclick = () => {
  game = null;
  $("over").hidden = true;
  showLobby();
};

socket.on("room", (r) => {
  room = r;
  if (!room.started && !game) showLobby();
  updateOverButtons();
});

function showLobby() {
  show("lobby");
  $("room-code").textContent = room.code;
  $("players").innerHTML = "";
  for (const p of room.players) {
    const li = document.createElement("li");
    li.textContent = p.name + (p.id === room.hostId ? " (host)" : "") + (p.id === socket.id ? " (you)" : "");
    $("players").appendChild(li);
  }
  const isHost = room.hostId === socket.id;
  $("start").hidden = !isHost;
  $("start").disabled = room.players.length < 2;
  $("waiting").textContent = isHost
    ? room.players.length < 2 ? "Waiting for a friend to join..." : ""
    : "Waiting for the host to start the game...";
}

// ---------- Drawing a champion card ----------

function cooldownText(a) {
  return a.cooldown ? `cooldown ${a.cooldown}` : "every turn";
}

// state is the champion's live info during a game (null when just showing the card).
function champCard(cardId, state, opts = {}) {
  const c = CARDS.CHAMPIONS[cardId];
  const leader = CARDS.LEADERS[c.leader];
  const formOn = state && state.form;
  const abilities = state ? state.abilities : c.abilities;
  const el = document.createElement("div");
  el.className = "card champ";
  el.style.setProperty("--card", c.color);
  const hp = state ? state.hp : c.hp;
  const maxHp = state ? state.maxHp : c.hp;
  const down = state && hp <= 0;
  if (down) el.classList.add("down");
  if (state && state.acted && !down) el.classList.add("acted");
  if (formOn) el.classList.add("transformed");
  el.title = [
    ...abilities.map((a) => `${a.name} (${cooldownText(a)}): ${a.desc}`),
    c.passive ? `Passive: ${c.passive.desc}` : null,
    `Leader - ${leader.name}: ${leader.desc}`,
  ].filter(Boolean).join("\n");

  const image = formOn ? c.form.image : c.image;
  const art = image ? `<img src="cards/${esc(image)}" alt="">` : `<span>${esc(c.art)}</span>`;
  const badges = [];
  if (state) {
    if (state.shield) badges.push(`<span title="Shield blocks damage">🔰 ${fmt(state.shield)}</span>`);
    if (state.swift) {
      const mult = formOn ? c.form.swiftMultiplier : 1;
      badges.push(`<span title="Chance to dodge attacks">🐾 ${state.swift} · ${state.swift * 10 * mult}% dodge</span>`);
    }
    if (state.marked) badges.push(`<span class="bad" title="Next hit deals double damage">🎯 Weak spot</span>`);
    if (state.bleeds.length) badges.push(`<span class="bad" title="Loses HP every turn">🩸 Bleeding</span>`);
    if (opts.linked) badges.push(`<span class="bad" title="Takes damage every turn">⛓️ Linked</span>`);
    if (state.link) badges.push(`<span title="Soul Link is active">⛓️ Linking</span>`);
  }
  const hpPct = Math.min(100, (hp / maxHp) * 100);
  const over = hp > maxHp ? `<div class="hp-over" style="width:${Math.min(100, ((hp - maxHp) / maxHp) * 100)}%"></div>` : "";

  el.innerHTML = `
    <div class="card-art">${art}</div>
    ${badges.length ? `<div class="badges">${badges.join("")}</div>` : ""}
    <div class="card-name">${esc(state ? state.name : c.name)}</div>
    <div class="card-title">${esc(CARDS.CLASSES[c.class] || "")} · ${esc(c.title)}</div>
    <div class="hp"><div class="hp-fill" style="width:${hpPct}%"></div>${over}<span>❤️ ${fmt(hp)}/${fmt(maxHp)}</span></div>
    ${opts.compact ? "" : `<ul class="abilities">${abilities.map((a) => `<li><b>${esc(a.name)}</b> <i>(${cooldownText(a)})</i> ${esc(a.desc)}</li>`).join("")}</ul>`}
    ${c.passive && !opts.compact ? `<div class="passive">✦ <b>Passive:</b> ${esc(c.passive.desc)}</div>` : ""}
    ${opts.compact && !opts.isLeader ? "" : `<div class="leader-line ${opts.isLeader ? "active" : ""}">👑 <b>${esc(leader.name)}:</b> ${esc(leader.desc)}</div>`}
    ${down ? `<div class="fallen">FALLEN</div>` : ""}`;
  return el;
}

// ---------- Setup: pick 3 champions ----------

function renderSetup() {
  const me = game.players[game.me];
  show("setup");
  const offered = $("offered");
  offered.innerHTML = "";
  for (const id of me.offered) {
    const el = champCard(id);
    const placed = Object.values(lineup).includes(id);
    el.classList.toggle("used", placed);
    el.classList.toggle("selected", picking === id);
    el.onclick = () => {
      if (me.picked) return;
      picking = picking === id ? null : id;
      renderSetup();
    };
    offered.appendChild(el);
  }
  for (const slotEl of document.querySelectorAll(".pick-slot")) {
    const slot = slotEl.dataset.slot;
    const id = lineup[slot];
    slotEl.querySelector(".card")?.remove();
    if (id) slotEl.appendChild(champCard(id, null, { isLeader: slot === "back", compact: true }));
    slotEl.onclick = () => {
      if (me.picked) return;
      if (picking) {
        for (const s in lineup) if (lineup[s] === picking) lineup[s] = null;
        lineup[slot] = picking;
        picking = null;
      } else {
        lineup[slot] = null;
      }
      renderSetup();
    };
  }
  const full = Object.values(lineup).every(Boolean);
  $("ready").disabled = !full || me.picked;
  $("setup-wait").textContent = me.picked ? "Waiting for your opponent to pick..." : "";
}

$("ready").onclick = () => socket.emit("chooseLineup", { lineup }, (res) => {
  $("setup-wait").textContent = res.error || "";
});

// ---------- The game board ----------

function selectedInfo() {
  const me = game.players[game.me];
  if (!selected || selected.kind === "champ") return null;
  return selected.kind === "ability"
    ? me.slots[selected.slot].abilities[selected.index]
    : CARDS.UTILITIES[me.hand[selected.handIndex]];
}

// The champions you can click for the current selection, as { owner, slot }.
function targetsFor() {
  const info = selectedInfo();
  if (!info) return [];
  const me = game.players[game.me];
  const opp = game.players[game.opponent];
  const aliveEnemies = ["left", "right", "back"].filter((s) => opp.slots[s].hp > 0);
  if (info.target === "enemy") {
    return game.attackable.filter((s) => aliveEnemies.includes(s)).map((slot) => ({ owner: game.opponent, slot }));
  }
  if (info.target === "anyEnemy") return aliveEnemies.map((slot) => ({ owner: game.opponent, slot }));
  if (info.target === "ally") {
    const refresh = info.effect && info.effect.refresh;
    return ["left", "right", "back"]
      .filter((s) => me.slots[s].hp > 0 && (!refresh || me.slots[s].acted))
      .map((slot) => ({ owner: game.me, slot }));
  }
  return [];
}

function send(action, data) {
  socket.emit(action, data, (res) => {
    $("game-error").textContent = res.error || "";
  });
  selected = null;
  linkTarget = null;
}

function useOn(target) {
  const info = selectedInfo();
  if (selected.kind === "card") return send("playCard", { handIndex: selected.handIndex, target });
  if (info.target === "anyEnemy" && info.name === "Soul Link") {
    linkTarget = target;
    return renderGame();
  }
  send("useAbility", { slot: selected.slot, index: selected.index, target });
}

function renderGame() {
  show("game");
  const me = game.players[game.me];
  const opp = game.players[game.opponent];
  const myTurn = game.turn === game.me && game.phase === "playing" && !game.pending;
  const targets = targetsFor();

  // Who is Soul Linked to whom.
  const linked = new Set();
  for (const owner of [game.me, game.opponent]) {
    const other = owner === game.me ? game.opponent : game.me;
    for (const s of ["left", "right", "back"]) {
      const c = game.players[owner].slots[s];
      if (c.link) linked.add(`${other}:${c.link}`);
    }
  }

  $("opp-info").textContent = `${opp.name} · ${opp.handCount} cards in hand`;
  $("turn-banner").textContent = game.turn === game.me ? "Your turn!" : `${opp.name}'s turn`;
  $("turn-banner").className = game.turn === game.me ? "your-turn" : "";

  const rows = {
    "opp-back": [game.opponent, ["back"]],
    "opp-front": [game.opponent, ["left", "right"]],
    "my-front": [game.me, ["left", "right"]],
    "my-back": [game.me, ["back"]],
  };
  for (const [row, [owner, slots]] of Object.entries(rows)) {
    const rowEl = document.querySelector(`[data-row="${row}"]`);
    rowEl.innerHTML = "";
    for (const slot of slots) {
      const state = game.players[owner].slots[slot];
      const el = champCard(state.card, state, { isLeader: slot === "back", compact: true, linked: linked.has(`${owner}:${slot}`) });
      el.dataset.owner = owner;
      el.dataset.slot = slot;
      const isTarget = targets.some((t) => t.owner === owner && t.slot === slot);
      if (isTarget) el.classList.add("target");
      if (owner === game.opponent && slot === "back" && !game.attackable.includes("back")) el.classList.add("protected");
      if (selected && selected.slot === slot && owner === game.me && selected.kind !== "card") el.classList.add("selected");
      el.onclick = () => {
        if (!myTurn) return;
        if (isTarget) return useOn({ owner, slot });
        if (owner === game.me && state.hp > 0 && !state.acted) selected = { kind: "champ", slot };
        else selected = null;
        renderGame();
      };
      rowEl.appendChild(el);
    }
  }

  // Ability buttons for the champion you clicked.
  const action = $("action");
  action.innerHTML = "";
  if (selected && selected.kind !== "card") {
    const champ = me.slots[selected.slot];
    champ.abilities.forEach((a, index) => {
      const b = document.createElement("button");
      b.className = "ability";
      b.innerHTML = `<b>${esc(a.name)}</b> <small>${esc(a.blocked || cooldownText(a))}</small><span>${esc(a.desc)}</span>`;
      b.disabled = !!a.blocked;
      if (selected.kind === "ability" && selected.index === index) b.classList.add("chosen");
      b.onclick = () => {
        if (["enemy", "anyEnemy", "ally"].includes(a.target)) {
          selected = { kind: "ability", slot: selected.slot, index };
          renderGame();
        } else {
          send("useAbility", { slot: selected.slot, index });
        }
      };
      action.appendChild(b);
    });
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = selected.kind === "ability" ? "Now click a glowing champion." : `What should ${champ.name} do?`;
    action.appendChild(hint);
  } else if (selected && selected.kind === "card") {
    action.innerHTML = `<p class="hint">Now click a glowing champion.</p>`;
  } else if (myTurn) {
    action.innerHTML = `<p class="hint">Click one of your champions to use an ability. You can also play one card from your hand each turn.</p>`;
  }

  $("energy").textContent = me.cardPlayed ? "🃏 Card played this turn" : "🃏 1 card to play this turn";
  $("end-turn").disabled = !myTurn;

  // Your hand of utility cards.
  const hand = $("hand");
  hand.innerHTML = "";
  me.hand.forEach((id, handIndex) => {
    const u = CARDS.UTILITIES[id];
    const el = document.createElement("div");
    el.className = "card utility";
    if (!myTurn || me.cardPlayed) el.classList.add("cant");
    if (selected && selected.kind === "card" && selected.handIndex === handIndex) el.classList.add("selected");
    el.innerHTML = `<div class="card-art"><span>${u.art}</span></div><div class="card-name">${esc(u.name)}</div><div class="card-desc">${esc(u.desc)}</div>`;
    el.onclick = () => {
      if (!myTurn || me.cardPlayed) return;
      if (u.target === "none") return send("playCard", { handIndex });
      selected = selected && selected.kind === "card" && selected.handIndex === handIndex ? null : { kind: "card", handIndex };
      renderGame();
    };
    hand.appendChild(el);
  });

  $("log").innerHTML = game.log.slice().reverse().map((l) => `<li>${esc(l)}</li>`).join("");
  renderLinkPrompt();
}

// ---------- Soul Link guessing game ----------

function renderLinkPrompt() {
  const box = $("link");
  const p = game.pending;
  let html = "";
  if (linkTarget) {
    const victim = game.players[game.opponent].slots[linkTarget.slot];
    html = `<h2>⛓️ Soul Link</h2><p>Secretly pick a side. If ${esc(victim.name)} picks the same side, they're linked!</p>
      <div class="row"><button data-side="left">⬅️ Left</button><button data-side="right">Right ➡️</button></div>
      <button class="secondary" data-cancel>Cancel</button>`;
  } else if (p && p.target.owner === game.me) {
    const linker = game.players[p.linker].slots[p.slot];
    const victim = game.players[game.me].slots[p.target.slot];
    html = `<h2>⛓️ ${esc(linker.name)} is trying to Soul Link ${esc(victim.name)}!</h2>
      <p>Pick the side ${esc(linker.name)} <b>didn't</b> choose to escape.</p>
      <div class="row"><button data-guess="left">⬅️ Left</button><button data-guess="right">Right ➡️</button></div>`;
  } else if (p) {
    html = `<h2>⛓️ Soul Link</h2><p>You picked <b>${p.choice === "left" ? "Left" : "Right"}</b>. Waiting for ${esc(game.players[game.opponent].name)} to guess...</p>`;
  }
  box.hidden = !html;
  box.querySelector(".overlay-box").innerHTML = html;
  box.querySelectorAll("[data-side]").forEach((b) => {
    b.onclick = () => send("useAbility", { slot: selected.slot, index: selected.index, target: linkTarget, choice: b.dataset.side });
  });
  box.querySelectorAll("[data-guess]").forEach((b) => {
    b.onclick = () => send("guessLink", { side: b.dataset.guess });
  });
  const cancel = box.querySelector("[data-cancel]");
  if (cancel) cancel.onclick = () => { linkTarget = null; renderGame(); };
}

$("end-turn").onclick = () => send("endTurn");

// ---------- Animations ----------

function cardEl(owner, slot) {
  return document.querySelector(`.board .card[data-owner="${owner}"][data-slot="${slot}"]`);
}

function popText(el, text, type) {
  const pop = document.createElement("div");
  pop.className = `pop ${type}`;
  pop.textContent = text;
  el.appendChild(pop);
}

function playEvents(events) {
  for (const e of events) {
    if (e.type === "slash") {
      const row = document.querySelector(e.owner === game.me ? '[data-row="my-front"]' : '[data-row="opp-front"]');
      const slash = document.createElement("div");
      slash.className = "slash";
      row.appendChild(slash);
      setTimeout(() => slash.remove(), 900);
      continue;
    }
    if (e.type === "guess") {
      const msg = e.caught ? "⛓️ LINKED!" : "Escaped!";
      const el = cardEl(e.owner, e.slot);
      if (el) popText(el, msg, e.caught ? "damage" : "heal");
      continue;
    }
    const el = cardEl(e.owner, e.slot);
    if (!el) continue;
    if (e.type === "damage") {
      const icon = { bleed: "🩸", link: "⛓️", storm: "⏳" }[e.reason] || "";
      popText(el, `${icon}-${fmt(e.amount)}${e.blocked ? ` (🔰${fmt(e.blocked)})` : ""}`, "damage");
      el.classList.add("hit");
    } else if (e.type === "heal") popText(el, `+${fmt(e.amount)}`, "heal");
    else if (e.type === "shield") popText(el, `🔰+${e.amount}`, "shield");
    else if (e.type === "dodge") popText(el, "DODGE!", "shield");
    else if (e.type === "mark") popText(el, "🎯", "damage");
    else if (e.type === "transform") {
      popText(el, "✨ TRANSFORM!", "heal");
      el.classList.add("glow-in");
    }
  }
}

// ---------- Game over ----------

function updateOverButtons() {
  if (!room) return;
  const isHost = room.hostId === socket.id;
  $("again").hidden = !isHost;
  $("again").disabled = room.players.length < 2;
}

function renderOver() {
  const won = game.winner === game.me;
  $("over-title").textContent = won ? "🏆 You win!" : "You lost!";
  $("over-text").textContent = game.log.filter((l) => !l.startsWith("🏆")).pop() || "";
  updateOverButtons();
  $("link").hidden = true;
  $("over").hidden = false;
}

socket.on("game", (view) => {
  const newGame = !game || (game.phase === "over" && view.phase !== "over");
  game = view;
  if (newGame) {
    lineup = { left: null, right: null, back: null };
    picking = null;
    selected = null;
    linkTarget = null;
    $("over").hidden = true;
  }
  if (game.turn !== game.me) selected = null;
  if (game.phase === "setup") return renderSetup();
  const everyonePicked = Object.values(game.players).every((p) => p.slots);
  if (!everyonePicked) return renderOver(); // someone left before the game began
  renderGame();
  playEvents(game.events);
  if (game.phase === "over") renderOver();
});
