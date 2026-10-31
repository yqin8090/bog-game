# BoG

A one-versus-one card game you play with friends in the browser.

## How to play

- Each player has three strongholds: two at the front and one at the back (the main stronghold).
- At the start you're offered 4 champions. Pick 3 and place one at each stronghold.
  The champion at the back is your **leader**: their leader ability is active while they stand.
- Each player gets action points every turn: 2 at first, and 3 from the starting player's third turn on.
  Each champion can use its ability once per turn. Using an ability or playing a utility card (heals,
  shields, bombs...) costs 1 action point. Unused points are lost at the end of your turn.
- Utility cards cost no action points while Windfall is active. You draw a card every turn.
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
- `public/card-view.js` draws each champion as a trading card. All cards share one look, with no card types.
- `public/cards-preview.html` shows every card at full size. Open http://localhost:3000/cards-preview.html.
- `public/cards/` holds card pictures. A picture works best at 708 x 972 pixels (the shape of a trading card,
  63 wide to 88 tall). The picture fills the whole card and the attacks sit over its lower half, so keep the
  face in the upper half. For example `public/cards/sam-card.jpg`, and it goes in the champion's `image` line in `cards.js`.
- Each ability, passive and leader can have a `short` line in `cards.js`. That one line is printed on the card.
  The full `desc` shows in the tooltip.
