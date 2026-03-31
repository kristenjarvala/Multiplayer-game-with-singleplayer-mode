# Bober Bomberman

A browser-based Bomberman-style game. Play locally against friends or singleplayer against AI

---

## What you need

- **[Node.js](https://nodejs.org/)** (v18 or newer)  this runs the server
- **A web browser**  Chrome, Firefox, Edge, etc.
- **Git**  to download the project

---

## How to run it

**1. Download the project**
```bash
git clone https://gitea.kood.tech/kristenjarvala/npc
cd npc
```

**2. Install dependencies**
```bash
npm install
```

**3. Start the server**
```bash
node server/index.js
```

**4. Open the game**

Go to `http://localhost:3000` in your browser.


---

## How the game works

- Up to **4 players** can join a lobby at the same time
- Each player starts in a corner of the grid
- **Place bombs** to blow up boxes and kill other players
- **Bombs explode after 3 seconds** — make sure you're out of the blast path
- **Powerups** drop randomly from destroyed boxes:
  -  **Extra bomb**  lets you place one more bomb at a time
  -  **Extra range**  your bombs explode farther in each direction
- Last player standing wins the round

**Controls:** WASD or Arrow keys to move, `Space` to place a bomb

---

## Project structure

```
server/          — Node.js game server (Express + Socket.io)
  index.js       — entry point, handles connections and socket events
  game.js        — game state (grid, players, scores)
  gameActions.js — shared move and bomb logic used by players and bots
  bomb.js        — explosion, fire spread, kill and win detection
  grid.js        — map generation and fire cleanup
  npc/
    npcManager.js  — creates bots, runs their decision loop
    npcAI.js       — decides what the bot does each tick
    pathfinding.js — BFS helpers: danger detection, escape routing, target finding
    difficulties.js — preset stat values for easy / med / hard labels

client/          — Browser-side code (no framework, just HTML/CSS/JS)
  index.html     — single page that holds all screens
  js/menu.js     — main menu logic
  js/lobby.js    — lobby, player list, bot configuration
  js/renderer.js — draws the game grid every tick
  js/ui.js       — HUD, scores, win screen
  css/style.css  — all game styles
```

---

## Single-player / bot mode

When setting up a lobby you can add AI bots. Each bot has three sliders (all 1–10):

| Slider | What it does |
|---|---|
| **Speed** | How often the bot acts. 1 = one move per second. 10 = nearly as fast as a human. |
| **Aggression** | How hard it hunts you. Low = mostly breaks boxes. High = ignores boxes and chases you directly, bombs the moment you're in range. |
| **Accuracy** | How smart its pathing is. Low = wanders randomly a lot. High = always takes the most direct route, picks up powerups, rarely wastes moves. |

The label shown in the lobby (**easy / med / hard**) is just the average of the three sliders rounded into a tier — it's purely cosmetic.

### What the bot actually does (in priority order)

1. **Flee**  if standing in a bomb blast path, run to the nearest safe tile it can reach before the bomb goes off
2. **Attack**  if you're within bomb range, place a bomb immediately (no hesitation on higher aggression)
3. **Chase**  navigate toward you (or toward boxes at lower aggression) using the shortest safe path
4. **Wander**  if nothing else applies, take a random safe move to avoid getting stuck

The bot will **never place a bomb it can't escape from**  it simulates the blast zone first and only commits if it can reach safety in time.
