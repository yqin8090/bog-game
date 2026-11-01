// Draws a champion as a trading card. Used by the game board, the setup screen and cards-preview.html.
// The art fills the whole card. The name bar sits on top and the attacks sit over the art.
// Sizes inside a card are in cqw (percent of the card's own width), so one design fits any size.
// Set --w on a card, or on a parent, to choose how wide it is.
const CardView = (() => {
  const esc = (text) => String(text).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

  // The big number on an attack, like the damage on a trading card.
  function damageText(effect = {}) {
    if (effect.damage) return String(effect.damage);
    if (effect.drain) return String(effect.drain);
    if (effect.mark) return "×2";
    if (effect.soulLink) return `⛓${effect.soulLink}`;
    if (effect.heal) return `+${effect.heal}`;
    if (effect.shield) return `🔰${effect.shield}`;
    if (effect.frontShield || effect.teamShield) return `🔰${effect.frontShield || effect.teamShield}`;
    if (effect.allyBoost) return `×${effect.allyBoost}`;
    if (effect.hits) return effect.hits.map((h) => h.damage).join("·");
    return "";
  }

  // How often an ability can be used, for tooltips and the guide. Cooldown is the turns it waits after use.
  function timingText(a) {
    const when = a.power ? "once per game" : "once per turn";
    const cooldown = a.cooldown ? `, cooldown ${a.cooldown} turn${a.cooldown > 1 ? "s" : ""}` : "";
    return `${when}, 1 action point${cooldown}`;
  }

  function attackHtml(a) {
    const cooldown = a.cooldown ? ` <i class="tcg-cd" title="${esc(timingText(a))}">CD ${a.cooldown}</i>` : "";
    return `
      <div class="tcg-atk${a.blocked ? " off" : ""}" title="${esc(a.desc)}">
        <div class="tcg-atk-main">
          <div class="tcg-atk-line"><span class="tcg-atk-name"><b>${esc(a.name)}</b>${cooldown}</span><span class="tcg-dmg">${esc(damageText(a.effect))}</span></div>
          <div class="tcg-atk-desc">${esc(a.short || a.desc)}</div>
        </div>
      </div>`;
  }

  // A power is spent once it's used up (Simba Form, or a once-per-game power).
  function powerHtml(a, spent) {
    return `<div class="tcg-band power${spent ? " spent" : ""}"><b>POWER · ${esc(a.name)}</b> <em>${esc(a.short || a.desc)}</em></div>`;
  }

  function passiveHtml(p) {
    return `<div class="tcg-band passive"><b>PASSIVE · ${esc(p.name)}</b> <em>${esc(p.short || p.desc)}</em></div>`;
  }

  // Small pills on the art: shield, dodge chance, marks and bleeding.
  function badgesHtml(state, dodgePct, linked) {
    const pills = [];
    if (state.shield) pills.push(`<span title="A shield blocks damage">🔰 ${fmt(state.shield)}</span>`);
    if (state.swift) pills.push(`<span title="Chance to dodge an attack">💨 ${dodgePct}%</span>`);
    if (state.marked) pills.push(`<span class="bad" title="The next hit deals double damage">🎯 x2</span>`);
    if (state.dazed) pills.push(`<span class="bad" title="Can't act this turn">💫 dazed</span>`);
    if (state.boostMult > 1) pills.push(`<span title="Deals more damage this turn">💨 ×${fmt(state.boostMult)}</span>`);
    if (state.bleeds && state.bleeds.length) pills.push(`<span class="bad" title="Loses HP every turn">🩸 bleed</span>`);
    if (linked) pills.push(`<span class="bad" title="Takes damage every turn">⛓️ linked</span>`);
    if (state.link) pills.push(`<span title="Soul Link is on">⛓️ linking</span>`);
    return pills.length ? `<div class="tcg-badges">${pills.join("")}</div>` : "";
  }

  // state is the champion's live info during a game. Pass null to show the card as it is in the setup.
  // opts: compact (shorter text, for the board), isLeader (stands at the back), linked (Soul Link on it).
  function render(defs, cardId, state = null, opts = {}) {
    const c = defs.CHAMPIONS[cardId];
    const leader = defs.LEADERS[c.leader];
    const formOn = !!(state && state.form);
    const hp = state ? state.hp : c.hp;
    const maxHp = state ? state.maxHp : c.hp;
    const abilities = state ? state.abilities : c.abilities;
    const attacks = abilities.filter((a) => !a.power);
    const power = abilities.find((a) => a.power);
    const down = !!state && hp <= 0;
    const leaderActive = !!opts.isLeader && !down;
    const image = formOn ? c.form.image : c.image;
    const stage = formOn ? "Simba Form" : defs.CLASSES[c.class] || "";
    const dodgePct = state ? state.swift * 10 * (formOn ? c.form.swiftMultiplier : 1) : 0;
    // Cards with more attacks get tighter rows so they all fit in the body.
    const fit = attacks.length >= 4 ? "four" : attacks.length === 3 ? "many" : "";

    const el = document.createElement("div");
    el.className = ["tcg", c.rarity === "holo" ? "holo" : "", opts.compact ? "compact" : "", formOn ? "transformed" : "", fit]
      .filter(Boolean)
      .join(" ");
    el.title = [
      ...abilities.map((a) => `${a.name} (${timingText(a)}): ${a.desc}`),
      c.passive && `${c.passive.name}: ${c.passive.desc}`,
      `Leader, ${leader.name}: ${leader.desc}`,
    ]
      .filter(Boolean)
      .join("\n");

    el.innerHTML = `
      <div class="tcg-inner">
        <div class="tcg-art">
          ${image ? `<img src="${esc(image)}" alt="" draggable="false"${c.artShift ? ` style="top:${c.artShift}%;height:${100 - c.artShift}%"` : ""}>` : `<span class="tcg-emoji">${esc(c.art)}</span>`}
          <div class="tcg-foil"></div>
        </div>
        <div class="tcg-shade"></div>
        <div class="tcg-top">
          <div class="tcg-names">
            <span class="tcg-stage">${esc(stage)}</span>
            <span class="tcg-name">${esc(state ? state.name : c.name)}</span>
          </div>
          <div class="tcg-hp">${fmt(hp)}<small> HP</small></div>
        </div>
        <div class="tcg-hpbar"><div style="width:${Math.min(100, (hp / maxHp) * 100)}%"></div></div>
        ${state ? badgesHtml(state, dodgePct, opts.linked) : ""}
        <div class="tcg-body">${attacks.map(attackHtml).join("")}</div>
        <div class="tcg-bottom">
          ${power ? powerHtml(power, formOn || /^Already/.test(power.blocked || "")) : c.passive ? passiveHtml(c.passive) : ""}
          <div class="tcg-leader${leaderActive ? " active" : ""}"><span>👑</span> <b>${esc(leader.name)}</b> <em>${esc(leader.short || leader.desc)}</em></div>
          ${c.credit ? `<div class="tcg-credit">${esc(c.credit)}</div>` : ""}
        </div>
        ${down ? `<div class="tcg-fallen">FALLEN</div>` : ""}
      </div>`;
    return el;
  }

  // Holo shine and a little tilt follow the mouse. One listener covers every card on the page,
  // including cards drawn later.
  const still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.addEventListener("pointermove", (e) => {
    if (still || e.pointerType !== "mouse") return;
    const card = e.target.closest && e.target.closest(".tcg");
    if (!card) return;
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    card.style.setProperty("--ry", `${(x - 0.5) * 16}deg`);
    card.style.setProperty("--rx", `${(0.5 - y) * 16}deg`);
    card.style.setProperty("--fx", `${x * 100}%`);
    card.style.setProperty("--fy", `${y * 100}%`);
  });
  document.addEventListener("pointerout", (e) => {
    const card = e.target.closest && e.target.closest(".tcg");
    if (!card || card.contains(e.relatedTarget)) return;
    card.style.removeProperty("--rx");
    card.style.removeProperty("--ry");
  });

  return { render, timingText };
})();
