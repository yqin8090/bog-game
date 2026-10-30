// Runs in each player's browser. Talks to server.js.
const socket = io();
const $ = (id) => document.getElementById(id);

function show(section) {
  for (const id of ["home", "lobby", "game"]) $(id).hidden = id !== section;
}

function handleReply(res) {
  $("error").textContent = res.error || "";
}

$("create").onclick = () => socket.emit("createRoom", { name: $("name").value }, handleReply);
$("join").onclick = () => socket.emit("joinRoom", { name: $("name").value, code: $("code").value }, handleReply);
$("start").onclick = () => socket.emit("startGame");

socket.on("room", (room) => {
  if (room.started) return show("game");
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
    ? room.players.length < 2 ? "Waiting for at least one friend to join..." : ""
    : "Waiting for the host to start the game...";
});
