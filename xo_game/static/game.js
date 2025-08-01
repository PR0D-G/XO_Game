// === static/game.js ===
const urlParams = new URLSearchParams(window.location.search);
const name = urlParams.get('name');
const id = urlParams.get('id');
const room = urlParams.get('room');
const host = urlParams.get('host') === 'true';

const cells = document.querySelectorAll('.cell');
const info = document.getElementById('info');
const scoreX = document.getElementById('score-x') || document.getElementById('scoreX');
const scoreO = document.getElementById('score-o') || document.getElementById('scoreO');
const timerDisplay = document.getElementById('timer');
const playerRoleDisplay = document.getElementById('player-role');
const turnInfo = document.getElementById('turn-info');

let player = null;
let currentTurn = 'X';
let timer = 0;
let timerInterval = null;
const isHost = urlParams.get('host') === 'true';

document.getElementById('roomId').textContent = room;

if (isHost) {
  const hostEl = document.getElementById('hostId');
  if (hostEl) {
    hostEl.textContent = id;
  }
}


const socket = io();  

// ✅ Socket connection confirmation
socket.on('connect', () => {
  console.log(`[🔌 CONNECTED] Socket ID: ${socket.id}`);
  socket.emit('join_room', { name, id, room, host });
});
socket.on('connect_error', (err) => {
  console.error('[❌ SOCKET.IO ERROR]', err);
});
// your existing initial code setup ...
socket.on('update_player_names', (data) => {
  document.getElementById('playerXName').textContent = data.X || 'Waiting...';
  document.getElementById('playerOName').textContent = data.O || 'Waiting...';
});






cells.forEach(cell => cell.addEventListener('click', () => {
  if (player !== currentTurn) return;
  const idx = parseInt(cell.dataset.index);
  if (cell.classList.contains('taken')) return;
  socket.emit('move', { index: idx, room });
}));

// rest unchanged from your code...


function startTimer() {
  clearInterval(timerInterval);
  timer = 0;
  timerInterval = setInterval(() => {
    timer++;
    if (timerDisplay) {
      timerDisplay.textContent = timer.toString().padStart(2, '0');
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
}

cells.forEach(cell => {
  cell.addEventListener('click', () => {
    if (player !== currentTurn) return;
    const index = parseInt(cell.dataset.index);
    if (cell.classList.contains('taken')) return;
    socket.emit('move', { index });
  });
});

function updateBoard(board) {
    board.forEach((val, i) => {
        const cell = cells[i];
        cell.textContent = val;
        cell.classList.remove("X", "O");
        if (val !== "") {
            cell.classList.add('taken', val);
        }
    });
}


// ... your existing code ...

socket.on('player_assigned', data => {
  player = data.player;
  const name = data.name;

  if (player === 'X') {
    const xElem = document.getElementById('playerXName');
    if (xElem) xElem.textContent = name;
  } else {
    const oElem = document.getElementById('playerOName');
    if (oElem) oElem.textContent = name;
  }

  const symbolElem = document.getElementById('playerSymbol');
  if (symbolElem) symbolElem.textContent = player;

  console.log('Assigned:', data);
});

// ✅ New: Update names when both players are present
socket.on('update_player_names', (data) => {
  const xElem = document.getElementById('playerXName');
  const oElem = document.getElementById('playerOName');

  if (xElem) xElem.textContent = data.X || 'Waiting...';
  if (oElem) oElem.textContent = data.O || 'Waiting...';
});





socket.on('game_status', data => {
  currentTurn = data.current_player;
  updateBoard(data.board);
  if (scoreX) scoreX.textContent = data.scores['X'];
  if (scoreO) scoreO.textContent = data.scores['O'];
  if (info) info.textContent = data.active ? "Game Started!" : "Waiting for opponent...";
  if (turnInfo) turnInfo.textContent = `Turn: Player ${data.current_player}`;
  if (data.active) startTimer();
  console.log(`[📢 STATUS] Turn: ${currentTurn} | Active: ${data.active}`);
});
socket.on('update', (data) => {
    updateBoard(data.board);
    scoreX.textContent = data.scores['X'];
    scoreO.textContent = data.scores['O'];
    turnInfo.textContent = `Turn: Player ${data.current_player}`;
    currentTurn = data.current_player;

    if (data.winner) {
        info.textContent = `${data.winner} Wins!`;
        document.getElementById('winSound')?.play();
        stopTimer();

        const message = (player === data.winner)
            ? "🎉 You Win!"
            : "😢 You Lost!";
        showPopup(message);
    } else if (data.draw) {
        info.textContent = `It's a Draw!`;
        document.getElementById('drawSound')?.play();
        stopTimer();
        showPopup("It's a Draw!");
    }
});


socket.on('reset_board', () => {
  cells.forEach(cell => {
    cell.textContent = '';
    cell.classList.remove('taken');
  });
  if (info) info.textContent = "Game Reset. Waiting for Player X...";
  if (turnInfo) turnInfo.textContent = "";
  currentTurn = 'X';
  startTimer();
  console.log(`[🔄 RESET] Board reset`);
});

socket.on('player_disconnected', () => {
  if (info) info.textContent = "A player disconnected. Game paused.";
  if (turnInfo) turnInfo.textContent = "";
  stopTimer();
  console.log(`[⚠️ DISCONNECT] A player has disconnected.`);
});

function resetGame() {
  if (player) {
    socket.emit('reset');
    console.log(`[🔁 RESET REQUEST] Sent by player ${player}`);
  }
}
document.getElementById('resetBtn').addEventListener('click', () => {
    if (player) {
        socket.emit('reset');
    }
});
function showPopup(message) {
    const popup = document.getElementById('popup');
    document.getElementById('popup-message').textContent = message;
    popup.style.display = 'flex';
}

function closePopup() {
    const popup = document.getElementById('popup');
    popup.style.display = 'none';
}

