# BoG

A one-versus-one card game you play with friends in the browser.

## How to play

- Each player has three strongholds: two at the front and one at the back (the main stronghold).
- At the start you're offered 4 champions. Pick 3 and place one at each stronghold.
  The champion at the back is your **leader**: their leader ability is active while they stand.
- On your turn, each champion can use one ability. Strong abilities have a cooldown: you have
  to wait that many of your turns before using them again.
- You can also play one utility card per turn (heals, shields, bombs...). You draw a card every turn.
- Attacks hit the enemy's front champions. When a champion's HP hits 0, that stronghold falls.
- The back champion can attack, but can't be attacked until one of its front strongholds has fallen.
- Knock out the enemy leader at the main stronghold to win!
- From turn 21, sudden death: champions take damage at the start of each turn, so games always end.

## Play it on your computer

1. Install [Node.js](https://nodejs.org) (the "LTS" version).
2. In this folder, run `npm install` once.
3. Run `npm start` and open http://localhost:3000.
4. Click **Make a room** and send the 4-letter code to your friend.

## Files

- `cards.js` has every champion and utility card. Edit this to add or change cards.
- `game.js` has the rules.
- `server.js` runs the game online and keeps track of rooms.
- `public/` is the web page players see. Card pictures go in `public/cards/`.
