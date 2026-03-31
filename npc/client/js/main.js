// client/js/main.js

const socket = io();

let isReady = false;
let boardInitialized = false;
let timerInterval = null;
let latestGameState = null;
let gamePaused = false;

// Connection handler
socket.on("connect", () => {
  console.log("Connected! ID:", socket.id);

  // Show main menu, hide everything else
  document.getElementById("main-menu").style.display = "flex";
  document.getElementById("lobby").style.display = "none";
  document.getElementById("game-container").style.display = "none";
  document.getElementById("pause-overlay").style.display = "none";
  document.getElementById("spectate-msg").style.display = "none";

  // Reset name input for new connection - FIXED
  document.getElementById("name-input-area").style.display = "block";
  document.getElementById("name-input").disabled = false;
  document.getElementById("name-input").value = ""; // Clear input
  document.getElementById("set-name-btn").disabled = false;
  document.getElementById("set-name-btn").textContent = "Set Name";

  // Reset state
  if (document.getElementById("game-board")) {
    document.getElementById("game-board").innerHTML = "";
  }
  playerElements = {};
  boardInitialized = false;
  isReady = false;
  latestGameState = null;
});

// Disconnection handler
socket.on("disconnect", () => {
  console.log("Disconnected from server!");
});

// Receive game state
socket.on("GAME_STATE", (data) => {
  latestGameState = data;
});

// Game loop
function gameLoop() {
  if (latestGameState) {
    const data = latestGameState;

    // Show game container, hide others
    document.getElementById("lobby").style.display = "none";
    document.getElementById("main-menu").style.display = "none";
    document.getElementById("game-container").style.display = "flex";
    document.getElementById("game-board").style.display = "grid";

    // Initialize board once
    if (!boardInitialized) {
      document.getElementById("game-board").innerHTML = "";
      playerElements = {};
      initBoard();
      boardInitialized = true;
      startGameMusic();
    }

    // Render
    updateBoard(data.grid);
    updatePlayers(data.players);
    updatePlayerCards(data.players);

    // Spectate message
    if (data.players[socket.id] && !data.players[socket.id].alive) {
      document.getElementById("spectate-msg").style.display = "block";
    } else {
      document.getElementById("spectate-msg").style.display = "none";
    }

    // Timer - FIXED: Reset properly
    if (!timerInterval && !gamePaused) {
      const startTime = Date.now() - data.timer * 1000;
      timerInterval = setInterval(() => {
        const totalSeconds = Math.floor((Date.now() - startTime) / 1000);
        updateTimerDisplay(totalSeconds);
      }, 100);
    }
  }

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
