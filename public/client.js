// Runs in each player's browser. Talks to server.js and draws the game.
const socket = io();
const $ = (id) => document.getElementById(id);

let CARDS = null; // champion and utility card info, loaded from the server
let room = null; // latest room info
let game = null; // latest game view
let selected = null; // what you clicked: { kind: "champ", slot } | { kind: "ability", slot, index } | { kind: "card", handIndex }
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

function champCard(cardId, state, opts = {}) {
  const c = CARDS.CHAMPIONS[cardId];
  const leader = CARDS.LEADERS[c.leader];
  const el = document.createElement("div");
  el.className = "card champ";
  el.style.setProperty("--card", c.color);
  const hp = state ? state.hp : c.hp;
  const maxHp = state ? state.maxHp : c.hp;
  const down = state && hp <= 0;
  if (down) el.classList.add("down");
  el.title = [...c.abilities.map((a) => `${a.name} (${a.cost} energy): ${a.desc}`), `Leader - ${leader.name}: ${leader.desc}`].join("\n");
  if (state && state.acted && !down) el.classList.add("acted");
  const art = c.image ? `<img src="cards/${esc(c.image)}" alt="">` : esc(c.art);
  el.innerHTML = `
    <div class="card-art">${art}</div>
    <div class="card-name">${esc(c.name)}</div>
    <div class="card-title">${esc(c.title)}</div>
    <div class="hp"><div class="hp-fill" style="width:${(hp / maxHp) * 100}%"></div><span>❤️ ${hp}/${maxHp}</span></div>
    ${state && state.shield ? `<div class="shield">🔰 ${state.shield}</div>` : ""}
    ${opts.compact ? "" : `<ul class="abilities">${c.abilities.map((a) => `<li><b>${esc(a.name)}</b> (${a.cost}⚡) ${esc(a.desc)}</li>`).join("")}</ul>`}
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
    if (id) slotEl.appendChild(champCard(id, null, { isLeader: slot === "back" }));
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

function targetsFor(sel) {
  // Returns the list of { owner, slot } you can click for the current selection.
  if (!sel || sel.kind === "champ") return [];
  const me = game.players[game.me];
  const info = sel.kind === "ability"
    ? CARDS.CHAMPIONS[me.slots[sel.slot].card].abilities[sel.index]
    : CARDS.UTILITIES[me.hand[sel.handIndex]];
  if (info.target === "enemy") {
    const opp = game.players[game.opponent];
    return game.attackable.filter((s) => opp.slots[s].hp > 0).map((slot) => ({ owner: game.opponent, slot }));
  }
  if (info.target === "ally") {
    return ["left", "right", "back"]
      .filter((s) => me.slots[s].hp > 0 && (!info.effect.refresh || me.slots[s].acted))
      .map((slot) => ({ owner: game.me, slot }));
  }
  return [];
}

function send(action, data) {
  socket.emit(action, data, (res) => {
    $("game-error").textContent = res.error || "";
  });
  selected = null;
}

function renderGame() {
  show("game");
  const me = game.players[game.me];
  const opp = game.players[game.opponent];
  const myTurn = game.turn === game.me && game.phase === "playing";
  const targets = targetsFor(selected);

  $("opp-info").textContent = `${opp.name} · ${opp.handCount} cards in hand`;
  $("turn-banner").textContent = myTurn ? "Your turn!" : `${opp.name}'s turn`;
  $("turn-banner").className = myTurn ? "your-turn" : "";

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
      const el = champCard(state.card, state, { isLeader: slot === "back", compact: true });
      el.dataset.owner = owner;
      el.dataset.slot = slot;
      const isTarget = targets.some((t) => t.owner === owner && t.slot === slot);
      if (isTarget) el.classList.add("target");
      if (owner === game.opponent && slot === "back" && !game.attackable.includes("back")) el.classList.add("protected");
      if (selected && selected.slot === slot && owner === game.me && selected.kind !== "card") el.classList.add("selected");
      el.onclick = () => {
        if (!myTurn) return;
        if (isTarget) {
          const target = { owner, slot };
          if (selected.kind === "ability") send("useAbility", { slot: selected.slot, index: selected.index, target });
          else send("playCard", { handIndex: selected.handIndex, target });
        } else if (owner === game.me && state.hp > 0 && !state.acted) {
          selected = { kind: "champ", slot };
        } else {
          selected = null;
        }
        renderGame();
      };
      rowEl.appendChild(el);
    }
  }

  // Ability buttons for the champion you clicked.
  const action = $("action");
  action.innerHTML = "";
  if (selected && selected.kind !== "card") {
    const champ = CARDS.CHAMPIONS[me.slots[selected.slot].card];
    champ.abilities.forEach((a, index) => {
      const b = document.createElement("button");
      b.innerHTML = `${esc(a.name)} <small>${a.cost}⚡ · ${esc(a.desc)}</small>`;
      b.title = a.desc;
      b.disabled = a.cost > me.energy;
      if (selected.kind === "ability" && selected.index === index) b.classList.add("chosen");
      b.onclick = () => {
        if (a.target === "enemy" || a.target === "ally") {
          selected = { kind: "ability", slot: selected.slot, index };
          renderGame();
        } else {
          send("useAbility", { slot: selected.slot, index });
        }
      };
      action.appendChild(b);
    });
    const hint = document.createElement("span");
    hint.className = "hint";
    hint.textContent = selected.kind === "ability" ? "Now click a glowing champion." : `What should ${champ.name} do?`;
    action.appendChild(hint);
  } else if (selected && selected.kind === "card") {
    action.innerHTML = `<span class="hint">Now click a glowing champion.</span>`;
  } else if (myTurn) {
    action.innerHTML = `<span class="hint">Click one of your champions to use an ability, or play a card from your hand.</span>`;
  }

  $("energy").innerHTML = `⚡ <b>${me.energy}</b> energy`;
  $("end-turn").disabled = !myTurn;

  // Your hand of utility cards.
  const hand = $("hand");
  hand.innerHTML = "";
  me.hand.forEach((id, handIndex) => {
    const u = CARDS.UTILITIES[id];
    const el = document.createElement("div");
    el.className = "card utility";
    if (u.cost > me.energy || !myTurn) el.classList.add("cant");
    if (selected && selected.kind === "card" && selected.handIndex === handIndex) el.classList.add("selected");
    el.innerHTML = `<div class="cost">${u.cost}⚡</div><div class="card-art">${u.art}</div><div class="card-name">${esc(u.name)}</div><div class="card-desc">${esc(u.desc)}</div>`;
    el.onclick = () => {
      if (!myTurn) return;
      if (u.target === "none") return send("playCard", { handIndex });
      selected = selected && selected.kind === "card" && selected.handIndex === handIndex ? null : { kind: "card", handIndex };
      renderGame();
    };
    hand.appendChild(el);
  });

  $("log").innerHTML = game.log.slice().reverse().map((l) => `<li>${esc(l)}</li>`).join("");
}

$("end-turn").onclick = () => send("endTurn");

// Little floating numbers when champions get hit or healed.
function playEvents(events) {
  for (const e of events) {
    const el = document.querySelector(`.card[data-owner="${e.owner}"][data-slot="${e.slot}"]`);
    if (!el) continue;
    const pop = document.createElement("div");
    pop.className = `pop ${e.type}`;
    pop.textContent = e.type === "damage" ? `-${e.amount}${e.blocked ? ` (🔰${e.blocked})` : ""}` : `+${e.amount}`;
    el.appendChild(pop);
    if (e.type === "damage") el.classList.add("hit");
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
  $("over").hidden = false;
}

socket.on("game", (view) => {
  const newGame = !game || (game.phase === "over" && view.phase !== "over");
  game = view;
  if (newGame) {
    lineup = { left: null, right: null, back: null };
    picking = null;
    selected = null;
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
