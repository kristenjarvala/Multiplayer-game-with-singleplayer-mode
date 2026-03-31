const Game = require('./game');

class lobbymanager {
    constructor() {
        this.lobbies = new Map();
    }

    createLobby(name, password) {
        const id = Math.random().toString(36).substring(2, 8).toUpperCase();

        const game = new Game(id, name, password);
        this.lobbies.set(id, game);

        console.log(`Lobby ${id} created!`);
        return game;
    }

    getLobby(id) {
        return this.lobbies.get(id);
    }

    removeLobby(id) {
        this.lobbies.delete(id);
        console.log(`Lobby ${id} removed!`);
    }

    getLobbyBySocketId(socketId) {
        for (const game of this.lobbies.values()) {
            if (game.players[socketId]) {
                return game;
            }
        }
        return null;
    }
}

module.exports = new lobbymanager();