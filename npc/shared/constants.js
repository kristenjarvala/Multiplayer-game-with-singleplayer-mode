module.exports = {
  GRID_WIDTH: 15,
  GRID_HEIGHT: 15,
  CELL_SIZE: 32,

  TILES: {
    FLOOR: 0,
    WALL: 1,
    BOX: 2,
    BOMB: 3,
    FIRE: 4,
    POWERUP_BOMB_COUNT: 5,
    POWERUP_BOMB_RANGE: 6
  },

  EVENTS: {
    CONNECT: 'connection',
    DISCONNECT: 'disconnect',
    PLAYER_JOIN: 'PLAYER_JOIN',
    PLAYER_MOVE: 'PLAYER_MOVE',
    PLACE_BOMB: 'PLACE_BOMB',
    GAME_STATE: 'GAME_STATE',
    GAME_OVER: 'GAME_OVER',
    START_GAME: 'START_GAME',
    LOBBY_UPDATE: 'LOBBY_UPDATE',
    CREATE_LOBBY: 'CREATE_LOBBY',
    JOIN_LOBBY: 'JOIN_LOBBY',
    LOBBY_JOINED: 'LOBBY_JOINED',
    LOBBY_ERROR: 'LOBBY_ERROR',


    SP_JOIN_REFUSED: 'SP_JOIN_REFUSED'
  },


 
  NPC_DEFAULTS: {
    tickRate:          700,
    bombChance:        0.5,
    randomMoveChance:  0.2,
    fleeRadius:        2,
    canCollectPowerups: true
  }
};
