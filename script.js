document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTI WELCOME SCREEN ---
    const welcomeScreen = document.getElementById('welcome-screen');
    const playBtn = document.getElementById('play-btn');
    const rulesBtn = document.getElementById('rules-btn');
    const aboutBtn = document.getElementById('about-btn');
    const mainMenu = document.getElementById('main-menu');
    const rulesPanel = document.getElementById('rules-panel');
    const aboutPanel = document.getElementById('about-panel');
    const backBtns = document.querySelectorAll('.back-btn');

    // --- ELEMENTI GIOCO ---
    const boardElement = document.getElementById('game-board');
    const timerElement = document.getElementById('timer');
    const scoreElement = document.getElementById('score');
    const multiplierElement = document.getElementById('multiplier');
    const instructionsElement = document.getElementById('game-instructions');
    const historyListElement = document.getElementById('history-list');
    
    // Buttons
    const pauseBtn = document.getElementById('pause-btn');
    const newGameBtn = document.getElementById('new-game-btn');
    const optionsBtn = document.getElementById('options-btn');
    const undoBtn = document.getElementById('undo-btn');

    // Modals
    const gameModal = document.getElementById('game-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalText = document.getElementById('modal-text');
    const modalButton = document.getElementById('modal-button');
    const optionsModal = document.getElementById('options-modal');
    const optionsCloseBtn = document.getElementById('options-close-btn');

    // --- STATO GIOCO ---
    const GRID_SIZE = 10;
    let grid = [];
    let currentNumber = 1;
    let lastPosition = null;
    let isGameOver = false;
    let score = 0;
    let multiplier = 10;
    let gameHistory = [];
    let undoChances = 1;
    let timerInterval = null;
    let startTime = 0;
    let elapsedTimeBeforePause = 0;
    let isPaused = false;
    let synth;
    const noteScale = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
    let streakCounter = 0;
    let lastMoveTimestamp = 0;
    let lastUndoneIndex = null; // NEW: To handle the hover bug after undo

    // --- IMPOSTAZIONI ---
    let settings = {
        playMode: 'click',
        showAssistedCells: true,
        soundEnabled: true,
    };

    // --- INIZIALIZZAZIONE ---
    function init() {
        setupWelcomeScreenListeners();
        loadSettings();
        setupOptionsListeners();
        createGrid();
        resetGameState();
        addEventListeners();
        loadGameHistory();
    }

    function setupWelcomeScreenListeners() {
        playBtn.addEventListener('click', () => {
            welcomeScreen.classList.add('fade-out');
        });
        rulesBtn.addEventListener('click', () => {
            mainMenu.classList.add('hidden');
            rulesPanel.classList.remove('hidden');
        });
        aboutBtn.addEventListener('click', () => {
            mainMenu.classList.add('hidden');
            aboutPanel.classList.remove('hidden');
        });
        backBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                rulesPanel.classList.add('hidden');
                aboutPanel.classList.add('hidden');
                mainMenu.classList.remove('hidden');
            });
        });
    }

    function createGrid() {
        boardElement.innerHTML = '';
        for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.index = i;
            boardElement.appendChild(cell);
        }
    }
    
    function addEventListeners() {
        boardElement.addEventListener('click', handleCellClick);
        boardElement.addEventListener('mouseover', handleCellMouseOver);
        boardElement.addEventListener('mouseout', handleCellMouseOut); // NEW: Listener to reset the undone cell
        newGameBtn.addEventListener('click', resetGameState);
        pauseBtn.addEventListener('click', togglePause);
        optionsBtn.addEventListener('click', () => optionsModal.classList.remove('hidden'));
        undoBtn.addEventListener('click', undoMove);
    }

    // --- LOGICA GIOCO ---
    function handleCellClick(e) {
        if (isGameOver || isPaused) return;
        const cell = e.target.closest('.cell');
        if (!cell) return;

        // **NUOVA LOGICA**: Se si clicca sulla cella annullabile, si annulla la mossa
        if (cell.classList.contains('undoable')) {
            undoMove();
            return;
        }

        if (currentNumber === 1) {
            processMove(cell);
            return;
        }
        if (settings.playMode === 'click') {
            processMove(cell);
        }
    }

    function handleCellMouseOver(e) {
        if (settings.playMode === 'click' || isGameOver || isPaused || currentNumber === 1) return;
        
        const cell = e.target.closest('.cell');

        // NEW: Prevents instantly re-placing a number on the just-undone cell
        if (cell && cell.dataset.index == lastUndoneIndex) {
            return;
        }
        
        if (cell) {
            processMove(cell);
        }
    }
    
    // NEW FUNCTION: Resets the immunity of the undone cell when the mouse leaves it
    function handleCellMouseOut(e) {
        const cell = e.target.closest('.cell');
        if (cell && cell.dataset.index == lastUndoneIndex) {
            lastUndoneIndex = null;
        }
    }
    
    function processMove(cell) {
        const index = parseInt(cell.dataset.index);
        const row = Math.floor(index / GRID_SIZE);
        const col = index % GRID_SIZE;
        if (currentNumber === 1 && grid[row][col] === 0) {
            if (settings.soundEnabled && typeof Tone !== 'undefined' && Tone.context.state !== 'running') {
                Tone.start().catch(e => console.error("Tone.start() failed:", e));
            }
            placeNumber(cell, row, col);
            startTimer();
            instructionsElement.style.display = 'none';
            boardElement.classList.remove('start-mode');
        } 
        else if (currentNumber > 1 && isMoveLegal(row, col)) {
            placeNumber(cell, row, col);
        }
    }

    function isMoveLegal(targetRow, targetCol) {
        if (!lastPosition || grid[targetRow][targetCol] !== 0) {
            return false;
        }
        const legalMoves = getLegalMoves(lastPosition.row, lastPosition.col).legal;
        return legalMoves.some(move => move.row === targetRow && move.col === targetCol);
    }

    function placeNumber(cell, row, col) {
        // Rimuove la classe 'undoable' dalla cella precedente
        const oldUndoable = boardElement.querySelector('.undoable');
        if (oldUndoable) oldUndoable.classList.remove('undoable');

        gameHistory.push({ grid: JSON.parse(JSON.stringify(grid)), currentNumber, lastPosition, score });
        score += currentNumber * multiplier;
        updateScoreDisplay();
        grid[row][col] = currentNumber;
        cell.innerHTML = `<span>${currentNumber}</span>`;
        cell.classList.add('occupied');
        cell.classList.remove('placed');
        void cell.offsetWidth;
        cell.classList.add('placed');
        playSound();
        lastPosition = { row, col };
        currentNumber++;
        if (undoChances > 0) {
            undoBtn.disabled = false;
            cell.classList.add('undoable'); // Rende la nuova cella annullabile
        }
        updateVisualsAfterMove();
        checkGameState();
    }

    function getLegalMoves(row, col) {
        const moves = { legal: [], illegalOccupied: [] };
        const cardinalMoves = [{ r: -3, c: 0 }, { r: 3, c: 0 }, { r: 0, c: -3 }, { r: 0, c: 3 }];
        const diagonalMoves = [{ r: -2, c: -2 }, { r: -2, c: 2 }, { r: 2, c: -2 }, { r: 2, c: 2 }];
        const allPossibleMoves = [...cardinalMoves, ...diagonalMoves];
        for (const move of allPossibleMoves) {
            const newRow = row + move.r;
            const newCol = col + move.c;
            if (newRow >= 0 && newRow < GRID_SIZE && newCol >= 0 && newCol < GRID_SIZE) {
                if (grid[newRow][newCol] === 0) {
                    moves.legal.push({ row: newRow, col: newCol });
                } else {
                    moves.illegalOccupied.push({ row: newRow, col: newCol });
                }
            }
        }
        return moves;
    }

    function updateVisualsAfterMove() {
        document.querySelectorAll('.cell.legal, .cell.illegal-occupied').forEach(c => {
            c.classList.remove('legal', 'illegal-occupied');
        });
        if (!lastPosition) return;
        const moves = getLegalMoves(lastPosition.row, lastPosition.col);
        if (settings.showAssistedCells) {
            moves.legal.forEach(move => {
                const cell = boardElement.children[move.row * GRID_SIZE + move.col];
                cell.classList.add('legal');
            });
        }
        moves.illegalOccupied.forEach(move => {
            const cell = boardElement.children[move.row * GRID_SIZE + move.col];
            cell.classList.add('illegal-occupied');
        });
    }

    function checkGameState() {
        if (currentNumber > 100) {
            endGame('Vittoria!', `Hai completato la griglia in ${timerElement.textContent} con un punteggio di ${score}!`);
            return;
        }
        if (lastPosition) {
            const moves = getLegalMoves(lastPosition.row, lastPosition.col);
            if (moves.legal.length === 0) {
                endGame('Sconfitta!', `Sei arrivato al numero ${currentNumber - 1}. Non ci sono più mosse. Punteggio: ${score}.`);
            }
        }
    }
    
    function endGame(title, text) {
        isGameOver = true;
        stopTimer();
        undoBtn.disabled = true;
        const oldUndoable = boardElement.querySelector('.undoable');
        if (oldUndoable) oldUndoable.classList.remove('undoable');
        saveGameResult();
        loadGameHistory();
        showModal(title, text, 'Gioca Ancora', resetGameState);
    }

    function undoMove() {
        if (undoChances <= 0 || gameHistory.length === 0 || isGameOver) return;
        const prevState = gameHistory.pop();

        // NEW: Record the index of the cell we are about to clear
        if (prevState.lastPosition) {
            lastUndoneIndex = (prevState.lastPosition.row * GRID_SIZE) + prevState.lastPosition.col;
        }

        grid = prevState.grid;
        currentNumber = prevState.currentNumber;
        lastPosition = prevState.lastPosition;
        score = prevState.score;
        undoChances--;
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                const cell = boardElement.children[r * GRID_SIZE + c];
                const value = grid[r][c];
                cell.innerHTML = value !== 0 ? `<span>${value}</span>` : '';
                cell.className = 'cell'; // Resetta completamente le classi
                if (value !== 0) {
                    cell.classList.add('occupied');
                }
            }
        }
        updateScoreDisplay();
        updateVisualsAfterMove();
        undoBtn.disabled = true;
    }

    function startTimer() { startTime = Date.now(); timerInterval = setInterval(updateTimer, 250); }
    function stopTimer() { clearInterval(timerInterval); timerInterval = null; }
    function updateTimer() {
        const elapsed = (Date.now() - startTime) + elapsedTimeBeforePause;
        const totalSeconds = Math.floor(elapsed / 1000);
        const seconds = totalSeconds % 60;
        const minutes = Math.floor(totalSeconds / 60);
        timerElement.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        const tenSecondIntervals = Math.floor(totalSeconds / 10);
        multiplier = Math.max(1, 10 - tenSecondIntervals);
        updateScoreDisplay();
    }
    function updateScoreDisplay() { scoreElement.textContent = score; multiplierElement.textContent = `x${multiplier}`; }

    function togglePause() {
        if (isGameOver || currentNumber === 1) return;
        isPaused = !isPaused;
        if (isPaused) {
            stopTimer();
            elapsedTimeBeforePause += Date.now() - startTime;
            pauseBtn.textContent = 'Resume';
            showModal('Pausa', 'Il gioco è in pausa.', 'Riprendi', togglePause);
        } else {
            startTime = Date.now();
            startTimer();
            pauseBtn.textContent = 'Pausa';
            hideModal();
        }
    }

    function playSound() {
        if (!settings.soundEnabled || typeof Tone === 'undefined') return;
        try {
            if (!synth) { synth = new Tone.Synth().toDestination(); }
            const now = Tone.now();
            if (now - lastMoveTimestamp < 2) { streakCounter = (streakCounter + 1) % noteScale.length; } else { streakCounter = 0; }
            const note = noteScale[streakCounter];
            synth.triggerAttackRelease(note, "8n", now);
            lastMoveTimestamp = now;
        } catch (error) {
            console.error("Sound playback failed:", error);
            settings.soundEnabled = false;
        }
    }

    function showModal(title, text, buttonText, buttonAction) { modalTitle.textContent = title; modalText.textContent = text; modalButton.textContent = buttonText; modalButton.onclick = buttonAction; gameModal.classList.remove('hidden'); }
    function hideModal() { gameModal.classList.add('hidden'); }
    
    function saveGameResult() {
        const results = JSON.parse(localStorage.getItem('knightsPathHistory')) || [];
        const result = { score, lastNumber: currentNumber - 1, time: timerElement.textContent, date: new Date().toLocaleDateString() };
        results.unshift(result);
        if (results.length > 10) results.pop();
        localStorage.setItem('knightsPathHistory', JSON.stringify(results));
    }

    // **NUOVA FUNZIONE** per la cronologia compatta
    function loadGameHistory() {
        const results = JSON.parse(localStorage.getItem('knightsPathHistory')) || [];
        if (results.length === 0) {
            historyListElement.innerHTML = '<p>Le tue partite passate appariranno qui.</p>';
            return;
        }
        historyListElement.innerHTML = results.map(r => `
            <div class="history-item">
                <div class="history-number-cell">${r.lastNumber}</div>
                <div class="history-details">
                    <span><strong>Score:</strong> ${r.score}</span>
                    <span><strong>Time:</strong> ${r.time}</span>
                </div>
            </div>
        `).join('');
    }

    function loadSettings() {
        const savedSettings = JSON.parse(localStorage.getItem('knightsPathSettings'));
        if (savedSettings) { settings = savedSettings; }
        settings.playMode = 'hover'; // change to "click" se vuoi partire in modalità click
        applySettings();
    }
    function saveSettings() { localStorage.setItem('knightsPathSettings', JSON.stringify(settings)); }
    function applySettings() {
        document.querySelectorAll('.option-toggle').forEach(el => el.classList.remove('active'));
        document.querySelector(`[data-option="playMode"][data-value="${settings.playMode}"]`).classList.add('active');
        document.getElementById('assist-toggle').checked = settings.showAssistedCells;
        document.getElementById('sound-toggle').checked = settings.soundEnabled;
        updateVisualsAfterMove();
    }
    function setupOptionsListeners() {
        optionsCloseBtn.addEventListener('click', () => optionsModal.classList.add('hidden'));
        optionsModal.addEventListener('click', (e) => {
            if (e.target.matches('.option-toggle')) {
                const option = e.target.dataset.option;
                const value = e.target.dataset.value;
                settings[option] = value;
                saveSettings();
                applySettings();
            }
            if (e.target.matches('input[type="checkbox"]')) {
                const option = e.target.dataset.option;
                settings[option] = e.target.checked;
                saveSettings();
                applySettings();
            }
        });
    }

    function resetGameState() {
        grid = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0));
        currentNumber = 1; lastPosition = null; isGameOver = false; isPaused = false;
        score = 0; multiplier = 10; elapsedTimeBeforePause = 0; gameHistory = []; undoChances = 1;
        lastUndoneIndex = null; // NEW: Reset the undone cell index
        stopTimer();
        timerElement.textContent = '00:00';
        updateScoreDisplay();
        const cells = boardElement.querySelectorAll('.cell');
        cells.forEach(cell => { cell.innerHTML = ''; cell.className = 'cell'; });
        instructionsElement.style.display = 'block';
        pauseBtn.textContent = 'Pausa';
        undoBtn.disabled = true;
        hideModal();
        boardElement.classList.add('start-mode');
    }
    
    init();
});


