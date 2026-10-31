// BoG game server.
// It serves the web page in /public and keeps track of game rooms.
// Players talk to the server in real time using Socket.IO.

const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const Game = require("./game");
const { CLASSES, LEADERS, CHAMPIONS, UTILITIES } = require("./cards");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));
app.get("/cards.json", (req, res) => res.json({ CLASSES, LEADERS, CHAMPIONS, UTILITIES }));

const MAX_PLAYERS = 2; // BoG is one versus one

// All open rooms, keyed by their join code (like "KQZD").
const rooms = new Map();

function makeCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I or O, they look like 1 and 0
  let code;
  do {
    code = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
  } while (rooms.has(code));
  return code;
}

// What every player in the room is allowed to see.
function publicRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    started: room.started,
    players: room.players.map((p) => ({ id: p.id, name: p.name })),
  };
}

function sendRoom(room) {
  io.to(room.code).emit("room", publicRoom(room));
}

// Each player gets their own view of the game, so nobody sees the other's hand.
function sendGame(room) {
  if (!room.game) return;
  for (const p of room.players) io.to(p.id).emit("game", Game.viewFor(room.game, p.id));
  room.game.events = [];
}

io.on("connection", (socket) => {
  let currentRoom = null;

  function join(room, name) {
    room.players.push({ id: socket.id, name });
    socket.join(room.code);
    currentRoom = room;
    sendRoom(room);
  }

  socket.on("createRoom", ({ name }, reply) => {
    name = String(name || "").trim().slice(0, 20);
    if (!name) return reply({ error: "Type your name first." });
    const room = { code: makeCode(), hostId: socket.id, started: false, players: [] };
    rooms.set(room.code, room);
    join(room, name);
    reply({ code: room.code });
  });

  socket.on("joinRoom", ({ name, code }, reply) => {
    name = String(name || "").trim().slice(0, 20);
    code = String(code || "").trim().toUpperCase();
    const room = rooms.get(code);
    if (!name) return reply({ error: "Type your name first." });
    if (!room) return reply({ error: "No room with that code." });
    if (room.started) return reply({ error: "That game already started." });
    if (room.players.length >= MAX_PLAYERS) return reply({ error: "That room is full." });
    join(room, name);
    reply({ code: room.code });
  });

  socket.on("startGame", () => {
    const room = currentRoom;
    if (!room || room.hostId !== socket.id || room.players.length < 2) return;
    if (room.game && room.game.phase !== "over") return;
    room.started = true;
    room.game = Game.createGame(room.players);
    sendRoom(room);
    sendGame(room);
  });

  // Every game move goes through here. If the move isn't allowed, the player gets the reason.
  function gameAction(name, run) {
    socket.on(name, (data, reply = () => {}) => {
      const room = currentRoom;
      if (!room || !room.game) return reply({ error: "No game running." });
      room.game.events = [];
      const error = run(room.game, data || {});
      if (error) return reply({ error });
      reply({});
      sendGame(room);
    });
  }

  gameAction("chooseLineup", (game, d) => Game.chooseLineup(game, socket.id, d.lineup));
  gameAction("useAbility", (game, d) => Game.useAbility(game, socket.id, d.slot, d.index, d.target, d.choice));
  gameAction("guessLink", (game, d) => Game.guessLink(game, socket.id, d.side));
  gameAction("playCard", (game, d) => Game.playCard(game, socket.id, d.handIndex, d.target));
  gameAction("endTurn", (game) => Game.endTurn(game, socket.id));

  socket.on("disconnect", () => {
    const room = currentRoom;
    if (!room) return;
    if (room.game) {
      Game.forfeit(room.game, socket.id);
      room.players = room.players.filter((p) => p.id !== socket.id);
      sendGame(room);
      room.game = null;
      room.started = false;
    }
    room.players = room.players.filter((p) => p.id !== socket.id);
    if (room.players.length === 0) {
      rooms.delete(room.code);
      return;
    }
    if (room.hostId === socket.id) room.hostId = room.players[0].id;
    sendRoom(room);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`BoG is running at http://localhost:${PORT}`));
