
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const { EVENTS, TILES } = require('../shared/constants');
const LobbyManager = require('./lobbymanager');
const { explodeBomb } = require('./bomb');
const { movePlayer, placeBomb } = require('./gameActions');
const { addNPCs, stopNPCLoops } = require('./npc/npcManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '..', 'client')));

io.on(EVENTS.CONNECT, (socket) => {
    console.log('Socket connected:', socket.id);

    socket.on(EVENTS.CREATE_LOBBY, ({ name, password, mode }) => {
        const game = LobbyManager.createLobby(name, password);
        game.isSinglePlayer = (mode === 'single');
        const player = game.addPlayer(socket, null);

        socket.emit(EVENTS.LOBBY_JOINED, {
            lobbyId:        game.id,
            playerId:       player.number,
            isSinglePlayer: game.isSinglePlayer,
        });

        io.to(game.id).emit(EVENTS.LOBBY_UPDATE, game.getLobbyData());
    });

    socket.on(EVENTS.JOIN_LOBBY, ({ lobbyId, password }) => {
        const game = LobbyManager.getLobby(lobbyId); // Case-sensitive?

        if (!game) {
            socket.emit(EVENTS.LOBBY_ERROR, 'Lobby not found');
            return;
        }
        // Single-player lobbies refuse all incoming connections
        if (game.isSinglePlayer) {
            socket.emit(EVENTS.LOBBY_ERROR, 'This is a single-player game');
            return;
        }
        if (game.password && game.password !== password) {
            socket.emit(EVENTS.LOBBY_ERROR, 'Incorrect password');
            return;
        }
        if (Object.keys(game.players).length >= 4) {
            socket.emit(EVENTS.LOBBY_ERROR, 'Lobby is full');
            return;
        }

        const player = game.addPlayer(socket, null);
        if (!player) {
            socket.emit(EVENTS.LOBBY_ERROR, 'Could not join lobby');
            return;
        }

        socket.emit(EVENTS.LOBBY_JOINED, {
            lobbyId: game.id,
            playerId: player.number
        });

        // USE KEY HELPER HERE
        io.to(game.id).emit(EVENTS.LOBBY_UPDATE, game.getLobbyData());

        if (game.gameState === 'playing') {
            game.emitGameState(socket);
        }
    });

    socket.on('SET_NAME', (name) => {
        const game = LobbyManager.getLobbyBySocketId(socket.id);
        if (!game) return;

        const player = game.players[socket.id];
        if (!name || typeof name !== 'string') return;
        name = name.trim().substring(0, 15);

        const nameTaken = Object.values(game.players).some(
            p => p.name && p.name.toLowerCase() === name.toLowerCase() && p.id !== socket.id
        );
        if (nameTaken) {
            socket.emit('NAME_ERROR', 'Name already taken!');
            return;
        }

        player.name = name;
        console.log(`[${game.id}] Player ${player.number} set name: ${name}`);

        // USE KEY HELPER HERE
        io.to(game.id).emit(EVENTS.LOBBY_UPDATE, game.getLobbyData());
    });

    socket.on("SET_SKIN", ({ skinIndex }) => {
      const game = LobbyManager.getLobbyBySocketId(socket.id);
      if (!game) return;
      const player = game.players[socket.id];
      if (!player) return;
      player.skinIndex = skinIndex;
      io.to(game.id).emit(EVENTS.LOBBY_UPDATE, game.getLobbyData());
    });

    socket.on(EVENTS.START_GAME, ({ npcConfigs } = {}) => {
        const game = LobbyManager.getLobbyBySocketId(socket.id);
        if (!game) return;
        if (game.gameState !== 'lobby') return;

        const player = game.players[socket.id];
        if (!player.name) {
            socket.emit('NAME_ERROR', 'Set your name first!');
            return;
        }

        // In single-player mode, add bots before checking totals
        if (game.isSinglePlayer) {
            if (!npcConfigs || npcConfigs.length === 0) {
                socket.emit('START_ERROR', 'Add at least 1 bot for single-player!');
                return;
            }
            addNPCs(game, npcConfigs);
        }

        // Only check human players for name requirement
        const humans = Object.values(game.players).filter(p => !p.isNPC);
        if (!humans.every(p => p.name)) {
            socket.emit('START_ERROR', 'Waiting for all players to set names!');
            return;
        }

        game.readyPlayers.add(player.number);
        const total = Object.keys(game.players).length;
        const ready = game.readyPlayers.size;

        console.log(`[${game.id}] Player ${player.number} ready (${ready}/${total})`);

        if (ready >= total && total >= 2) {
            console.log(`[${game.id}] All ready! Starting countdown...`);
            game.startCountDown(5, io);
        }

        io.to(game.id).emit(EVENTS.LOBBY_UPDATE, game.getLobbyData());
    });

    socket.on('PLAY_AGAIN', () => {
        const game = LobbyManager.getLobbyBySocketId(socket.id);
        if (game) {
            if (game.gameState !== 'lobby') {
                game.resetRound();
            }
            io.to(game.id).emit(EVENTS.LOBBY_UPDATE, game.getLobbyData());
        }
    });

    // ... (Movement, Bomb, Pause, Disconnect logic remains the same) ...
    // BUT! In Disconnect, update the emit:

    socket.on(EVENTS.DISCONNECT, () => {
        const game = LobbyManager.getLobbyBySocketId(socket.id);
        if (!game) return;
        const player = game.removePlayer(socket);
        if (!player) return;

        console.log(`[${game.id}] Player ${player.number} disconnected.`);
        io.to(game.id).emit('PLAYER_QUIT', { name: player.name });

        // In single-player, if the human leaves, shut everything down
        const humans = Object.values(game.players).filter(p => !p.isNPC);
        if (game.isSinglePlayer && humans.length === 0) {
            stopNPCLoops(game);
            LobbyManager.removeLobby(game.id);
            return;
        }

        if (Object.keys(game.players).length === 0) {
            LobbyManager.removeLobby(game.id);
        } else {
            if (game.gameState === 'playing') game.emitGameState(io);
            io.to(game.id).emit(EVENTS.LOBBY_UPDATE, game.getLobbyData());
        }
    });


    // Just make sure there are no other manual LOBBY_UPDATE emits!

    // (Include the movement/bomb handlers here)
socket.on(EVENTS.PLAYER_MOVE, (data) => {
    const game = LobbyManager.getLobbyBySocketId(socket.id);
    if (!game || game.gameState !== 'playing' || game.gamePaused) return;

    // Normalise WASD → Arrow keys so gameActions only needs one set of cases
    const keyMap = { KeyW: 'ArrowUp', KeyS: 'ArrowDown', KeyA: 'ArrowLeft', KeyD: 'ArrowRight' };
    const direction = keyMap[data.key] || data.key;

    movePlayer(game, socket.id, direction, io);
});

    socket.on(EVENTS.PLACE_BOMB, () => {
        const game = LobbyManager.getLobbyBySocketId(socket.id);
        if (!game || game.gameState !== 'playing' || game.gamePaused) return;

        placeBomb(game, socket.id, io);
    });

    socket.on('PAUSE_GAME', () => {
        const game = LobbyManager.getLobbyBySocketId(socket.id);
        if (!game || game.gameState !== 'playing') return;
        game.gamePaused = true;
        game.pausedBy = game.players[socket.id].name;
        io.to(game.id).emit('GAME_PAUSED', { by: game.pausedBy });
    });

    socket.on('RESUME_GAME', () => {
        const game = LobbyManager.getLobbyBySocketId(socket.id);
        if (!game || !game.gamePaused) return;
        game.gamePaused = false;
        io.to(game.id).emit('GAME_RESUMED', { by: game.players[socket.id].name });
    });

    // Client requests a full game state refresh (e.g. after unpausing)
    socket.on('REQUEST_STATE', () => {
        const game = LobbyManager.getLobbyBySocketId(socket.id);
        if (!game || game.gameState !== 'playing') return;
        game.emitGameState(socket);
    });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});