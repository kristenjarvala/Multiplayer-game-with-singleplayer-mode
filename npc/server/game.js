// server/game.js
const { EVENTS } = require('../shared/constants');
const { createGrid, spawnPoints } = require('./grid');
const { startNPCLoops, stopNPCLoops } = require('./npc/npcManager');

class Game {
    constructor(id, name, password) {
        this.id = id;
        this.roomName = name;
        this.password = password;

        this.players = {};
        this.grid = createGrid();

        this.gameState = 'lobby';
        this.readyPlayers = new Set();
        this.countdownTimer = null;

        this.gamePaused = false;
        this.pausedBy = null;
        this.pauseTime = null;
        this.gameStartTime = null;

        this.playerWins      = { 0: 0, 1: 0, 2: 0, 3: 0 };
        this.playerBoxScores = { 0: 0, 1: 0, 2: 0, 3: 0 };

        this.isSinglePlayer = false;
        this.npcIntervals   = {};
        this.bombRanges     = {}; // 'row,col' -> range, used by pathfinding danger calculation
    }

    // Builds the lobby payload sent to all clients
    getLobbyData() {
        const playerList = Object.values(this.players).map(p => ({
            name:       p.name,
            number:     p.number,
            skinIndex:  p.skinIndex,
            ready:      this.readyPlayers.has(p.number),
            isNPC:      p.isNPC || false,
            difficulty: p.difficulty || null,
        }));

        return {
            players:        playerList,
            total:          Object.keys(this.players).length,
            needed:         2,
            readyCount:     this.readyPlayers.size,
            countdown:      this.lastCountdown,
            isSinglePlayer: this.isSinglePlayer,
        };
    }

    addPlayer(socket, name) {
        const usedNumbers = Object.values(this.players).map(p => p.number);
        let playerNumber = 0;
        while (usedNumbers.includes(playerNumber)) playerNumber++;
        if (playerNumber >= 4) return null;

        const player = {
          id: socket.id,
          number: playerNumber,
          skinIndex: 0,
          name: name || `Player ${playerNumber + 1}`,
          row: spawnPoints[playerNumber].row,
          col: spawnPoints[playerNumber].col,
          x: spawnPoints[playerNumber].col,
          y: spawnPoints[playerNumber].row,
          hasBomb: false,
          activeBombs: 0,
          maxBombs: 1,
          bombRange: 1,
          alive: true,
          wins: this.playerWins[playerNumber] || 0,
          boxesDestroyed: this.playerBoxScores[playerNumber] || 0,
        };

        this.players[socket.id] = player;
        socket.join(this.id);

        return player;
    }

    // Removes a human player; cancels countdown if not enough humans remain
    removePlayer(socket) {
        if (!this.players[socket.id]) return null;
        const p = this.players[socket.id];
        delete this.players[socket.id];
        this.readyPlayers.delete(p.number);
        socket.leave(this.id);

        if (this.gameState === 'starting') {
            const humans = Object.values(this.players).filter(pl => !pl.isNPC);
            if (humans.length < 1) {
                if (this.countdownTimer) { clearInterval(this.countdownTimer); this.countdownTimer = null; }
                this.gameState = 'lobby';
                this.readyPlayers.clear();
                console.log(`[${this.id}] Countdown cancelled — no human players.`);
            }
        }
        return p;
    }

    emitGameState(io) {
        io.to(this.id).emit(EVENTS.GAME_STATE, {
            grid: this.grid,
            players: this.players,
            timer: this.gameStartTime ? Math.floor((Date.now() - this.gameStartTime) / 1000) : 0
        });
    }

    startCountDown(seconds, io) {
        if (this.countdownTimer) clearInterval(this.countdownTimer);
        this.gameState = 'starting';
        let countdown = seconds;

        const broadcastUpdate = () => {
            const data = this.getLobbyData();
            data.countdown = countdown;
            io.to(this.id).emit(EVENTS.LOBBY_UPDATE, data);
        };

        broadcastUpdate();

        this.countdownTimer = setInterval(() => {
            countdown--;
            broadcastUpdate();

            if (countdown <= 0) {
                clearInterval(this.countdownTimer);
                this.countdownTimer = null;
                this.gameState      = 'playing';
                this.gameStartTime  = Date.now();
                this.lastCountdown  = null;
                console.log(`Game ${this.id} started!`);
                startNPCLoops(this, io);
                this.emitGameState(io);
            }
        }, 1000);
    }

    // Resets back to lobby — removes NPCs (they are re-added fresh on next START_GAME)
    resetRound() {
        stopNPCLoops(this);

        Object.keys(this.players).forEach(id => {
            if (this.players[id].isNPC) {
                this.readyPlayers.delete(this.players[id].number);
                delete this.players[id];
            }
        });

        this.grid          = createGrid();
        this.gameState     = 'lobby';
        this.readyPlayers.clear();
        this.gamePaused    = false;
        this.gameStartTime = null;
        this.lastCountdown = null;
        this.bombRanges    = {};

        Object.values(this.players).forEach(p => {
            p.alive       = true;
            p.activeBombs = 0;
            p.hasBomb     = false;
            p.maxBombs    = 1;
            p.bombRange   = 1;
            p.row = spawnPoints[p.number].row;
            p.col = spawnPoints[p.number].col;
            p.x   = p.col;
            p.y   = p.row;
        });
    }
}

module.exports = Game;