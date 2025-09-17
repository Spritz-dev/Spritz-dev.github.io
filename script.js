document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTI WELCOME SCREEN ---
    const welcomeScreen = document.getElementById('welcome-screen');
    const freePlayBtn = document.getElementById('free-play-btn');
    const dailyChallengeBtn = document.getElementById('daily-challenge-btn');
    const rulesBtn = document.getElementById('rules-btn');
    const aboutBtn = document.getElementById('about-btn');
    const mainMenu = document.getElementById('main-menu');
    const rulesPanel = document.getElementById('rules-panel');
    const aboutPanel = document.getElementById('about-panel');
    const backBtns = document.querySelectorAll('.back-btn');

    // --- ELEMENTI GIOCO ---
    const gameTitleElement = document.getElementById('game-title');
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

    // Elementi per la traccia
    const trailCanvas = document.getElementById('trail-canvas');
    const ctx = trailCanvas.getContext('2d');
    let trailPoints = [];
    let boardRect = boardElement.getBoundingClientRect(); // Posizione della griglia

    // --- COSTANTI DI GIOCO ---
    const GRID_SIZE = 10;
    const CHALLENGE_HELP_LOOKAHEAD = 5;
    // MODIFICA QUESTO VALORE per aumentare/diminuire l'area di tocco. 1.1 = 110% (10% più grande)
    const LEGAL_CELL_TRIGGER_SCALE = 1.7;

    // --- STATO GIOCO ---
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
    let lastUndoneIndex = null;
    let gameMode = 'free';
    let challengeGoal = null;
    let challengePathAchieved = false;

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
        setupTrailCanvas();
        requestAnimationFrame(drawTrail);
    }

    function setupWelcomeScreenListeners() {
        freePlayBtn.addEventListener('click', () => startGame('free'));
        dailyChallengeBtn.addEventListener('click', () => startGame('challenge'));
        rulesBtn.addEventListener('click', () => { mainMenu.classList.add('hidden'); rulesPanel.classList.remove('hidden'); });
        aboutBtn.addEventListener('click', () => { mainMenu.classList.add('hidden'); aboutPanel.classList.remove('hidden'); });
        backBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                rulesPanel.classList.add('hidden');
                aboutPanel.classList.add('hidden');
                mainMenu.classList.remove('hidden');
            });
        });
    }

    function setupTrailCanvas() {
        trailCanvas.width = window.innerWidth;
        trailCanvas.height = window.innerHeight;
        window.addEventListener('resize', () => {
            trailCanvas.width = window.innerWidth;
            trailCanvas.height = window.innerHeight;
            boardRect = boardElement.getBoundingClientRect();
        });
    }
    
    function startGame(mode) {
        gameMode = mode;
        resetGameState();
        if(gameMode === 'challenge') {
            setupDailyChallenge();
            gameTitleElement.textContent = "Daily Challenge";
        } else {
            gameTitleElement.textContent = "Queen's Path";
            instructionsElement.textContent = 'Clicca su una cella per iniziare posizionando il numero 1.';
            boardElement.classList.add('start-mode');
        }
        welcomeScreen.classList.add('fade-out');
        setTimeout(() => {
            boardRect = boardElement.getBoundingClientRect();
        }, 500);
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
        boardElement.addEventListener('mouseout', handleCellMouseOut);
        
        document.addEventListener('mousemove', handlePointerMove);
        document.addEventListener('touchmove', handlePointerMove, { passive: false });
        
        // NUOVO: Ricalcola la posizione della griglia all'inizio del tocco per precisione
        document.addEventListener('touchstart', () => {
            boardRect = boardElement.getBoundingClientRect();
        }, { passive: true });

        newGameBtn.addEventListener('click', () => {
             welcomeScreen.classList.remove('fade-out');
             resetGameState();
        });
        pauseBtn.addEventListener('click', togglePause);
        optionsBtn.addEventListener('click', () => optionsModal.classList.add('hidden'));
        undoBtn.addEventListener('click', undoMove);
    }

    // --- LOGICA GIOCO ---
    function handleCellClick(e) {
        if (isGameOver || isPaused) return;
        const cell = e.target.closest('.cell');
        if (!cell) return;
        if (currentNumber === 1 && gameMode === 'free') {
            processMove(cell);
            return;
        }
        if (settings.playMode === 'click') {
            processMove(cell);
        }
    }

    // NUOVA FUNZIONE: Trova la cella target con tolleranza per l'area di tocco
    function findTargetCell(x, y) {
        // 1. Cerca prima tra le celle legali con un'area di tocco più grande
        const legalCells = boardElement.querySelectorAll('.cell.legal');
        for (const cell of legalCells) {
            const rect = cell.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const width = rect.width * LEGAL_CELL_TRIGGER_SCALE;
            const height = rect.height * LEGAL_CELL_TRIGGER_SCALE;
            
            if (x >= centerX - width / 2 && x <= centerX + width / 2 &&
                y >= centerY - height / 2 && y <= centerY + height / 2) {
                return cell;
            }
        }
        
        // 2. Fallback: trova l'elemento esatto sotto il puntatore per altri casi
        const targetElement = document.elementFromPoint(x, y);
        return targetElement ? targetElement.closest('.cell') : null;
    }

    function handlePointerMove(e) {
        const touch = e.touches ? e.touches[0] : null;
        const x = touch ? touch.clientX : e.clientX;
        const y = touch ? touch.clientY : e.clientY;

        const isInsideBoard = (x >= boardRect.left && x <= boardRect.right && y >= boardRect.top && y <= boardRect.bottom);

        if (isInsideBoard) {
            trailPoints.push({ x, y, life: 20 });
            if (e.type === 'touchmove') {
                e.preventDefault();
            }
        }

        if (settings.playMode !== 'hover' || isGameOver || isPaused || currentNumber === 1) return;
        
        if(isInsideBoard) {
            const cell = findTargetCell(x, y); // USA LA NUOVA FUNZIONE
            
            if (cell && cell.dataset.index == lastUndoneIndex) { return; }
            if (cell) { processMove(cell); }
        }
    }
    
    function handleCellMouseOut(e) {
        const cell = e.target.closest('.cell');
        if (cell && cell.dataset.index == lastUndoneIndex) { lastUndoneIndex = null; }
    }
    
    function processMove(cell) {
        const index = parseInt(cell.dataset.index);
        const row = Math.floor(index / GRID_SIZE);
        const col = index % GRID_SIZE;
        if (currentNumber === 1 && gameMode === 'free' && grid[row][col] === 0) {
            if (settings.soundEnabled && typeof Tone !== 'undefined' && Tone.context.state !== 'running') {
                Tone.start().catch(err => console.error("Tone.start() failed:", err));
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
        if (!lastPosition || grid[targetRow][targetCol] !== 0) { return false; }
        const legalMoves = getLegalMoves(lastPosition.row, lastPosition.col).legal;
        return legalMoves.some(move => move.row === targetRow && move.col === targetCol);
    }

    function placeNumber(cell, row, col) {
        gameHistory.push({ grid: JSON.parse(JSON.stringify(grid)), currentNumber, lastPosition, score, challengeGoal, challengePathAchieved });
        if (cell.classList.contains('challenge-path')) { challengePathAchieved = true; }
        score += currentNumber * multiplier;
        updateScoreDisplay();
        grid[row][col] = currentNumber;
        cell.innerHTML = `<span>${currentNumber}</span>`;
        cell.classList.add('occupied', 'placed');
        playSound();
        lastPosition = { row, col };
        currentNumber++;
        if (undoChances > 0) { undoBtn.disabled = false; }
        updateVisualsAfterMove();
        checkGameState();
    }
    
    function checkGameState() {
        if (currentNumber > 100) {
            endGame('Vittoria!', `Hai completato la griglia in ${timerElement.textContent} con un punteggio di ${score}!`);
            return;
        }
        if (lastPosition) {
            const moves = getLegalMoves(lastPosition.row, lastPosition.col);
            if (gameMode === 'challenge' && currentNumber === challengeGoal.number) {
                const canReachGoal = moves.legal.some(m => m.row === challengeGoal.row && m.col === challengeGoal.col);
                if (canReachGoal) {
                    const goalCellElement = boardElement.children[challengeGoal.row * GRID_SIZE + challengeGoal.col];
                    boardElement.style.pointerEvents = 'none';
                    setTimeout(() => {
                        if(goalCellElement.querySelector('.challenge-marker')) {
                           goalCellElement.querySelector('.challenge-marker').remove();
                        }
                        goalCellElement.classList.remove('challenge-goal', 'challenge-path');
                        placeNumber(goalCellElement, challengeGoal.row, challengeGoal.col);
                        boardElement.style.pointerEvents = 'auto';
                    }, 400);
                    return;
                } else {
                    endGame('Sfida Fallita!', `Non puoi raggiungere il numero ${challengeGoal.number}. Punteggio: ${score}.`);
                    return;
                }
            }
            if (moves.legal.length === 0) {
                endGame('Sconfitta!', `Sei arrivato al numero ${currentNumber - 1}. Punteggio: ${score}.`);
            }
        }
    }

    function setupDailyChallenge() {
        const goalNumber = Math.floor(Math.random() * (55 - 20 + 1)) + 20;
        let goalRow, goalCol;
        do { goalRow = Math.floor(Math.random() * GRID_SIZE); goalCol = Math.floor(Math.random() * GRID_SIZE); } while (false);
        challengeGoal = { number: goalNumber, row: goalRow, col: goalCol };
        const goalCell = boardElement.children[goalRow * GRID_SIZE + goalCol];
        grid[goalRow][goalCol] = goalNumber;
        goalCell.innerHTML = `<span>${goalNumber}</span><div class="challenge-marker"></div>`;
        goalCell.classList.add('occupied', 'challenge-goal');
        let startRow, startCol;
        do { startRow = Math.floor(Math.random() * GRID_SIZE); startCol = Math.floor(Math.random() * GRID_SIZE); } while (grid[startRow][startCol] !== 0);
        const startCell = boardElement.children[startRow * GRID_SIZE + startCol];
        grid[startRow][startCol] = 1;
        startCell.innerHTML = `<span>1</span>`;
        startCell.classList.add('occupied', 'placed');
        lastPosition = { row: startRow, col: startCol };
        currentNumber = 2;
        startTimer();
        instructionsElement.style.display = 'none';
        updateVisualsAfterMove();
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
                } else if (gameMode === 'challenge' && newRow === challengeGoal.row && newCol === challengeGoal.col && currentNumber === challengeGoal.number) {
                    moves.legal.push({ row: newRow, col: newCol });
                } else {
                    moves.illegalOccupied.push({ row: newRow, col: newCol });
                }
            }
        }
        return moves;
    }

    function highlightChallengePaths() {
        if (!challengeGoal) return;
        const { row, col } = challengeGoal;
        const cardinalMoves = [{ r: -3, c: 0 }, { r: 3, c: 0 }, { r: 0, c: -3 }, { r: 0, c: 3 }];
        const diagonalMoves = [{ r: -2, c: -2 }, { r: -2, c: 2 }, { r: 2, c: -2 }, { r: 2, c: 2 }];
        const allPossibleMoves = [...cardinalMoves, ...diagonalMoves];
        for (const move of allPossibleMoves) {
            const fromRow = row - move.r;
            const fromCol = col - move.c;
            if (fromRow >= 0 && fromRow < GRID_SIZE && fromCol >= 0 && fromCol < GRID_SIZE) {
                if (grid[fromRow][fromCol] === 0) {
                    boardElement.children[fromRow * GRID_SIZE + fromCol].classList.add('challenge-path');
                }
            }
        }
    }
    
    function updateVisualsAfterMove() {
        document.querySelectorAll('.cell.legal, .cell.illegal-occupied, .cell.challenge-path').forEach(c => {
            c.classList.remove('legal', 'illegal-occupied', 'challenge-path');
        });
        if (!lastPosition) return;
        const moves = getLegalMoves(lastPosition.row, lastPosition.col);
        if (settings.showAssistedCells) {
            moves.legal.forEach(move => {
                boardElement.children[move.row * GRID_SIZE + move.col].classList.add('legal');
            });
        }
        moves.illegalOccupied.forEach(move => {
            boardElement.children[move.row * GRID_SIZE + move.col].classList.add('illegal-occupied');
        });
        if (gameMode === 'challenge' && challengeGoal && !challengePathAchieved && currentNumber >= challengeGoal.number - CHALLENGE_HELP_LOOKAHEAD) {
            highlightChallengePaths();
        }
    }

    function drawTrail() {
        ctx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
        for (let i = 0; i < trailPoints.length; i++) {
            const point = trailPoints[i];
            point.life--;
            if (point.life <= 0) {
                trailPoints.splice(i, 1);
                i--;
                continue;
            }
            if (i > 0) {
                const prevPoint = trailPoints[i - 1];
                ctx.beginPath();
                ctx.moveTo(prevPoint.x, prevPoint.y);
                ctx.lineTo(point.x, point.y);
                ctx.strokeStyle = `rgba(139, 92, 246, ${0.5 * (point.life / 20)})`;
                ctx.lineWidth = 5 + (point.life / 10);
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.stroke();
            }
        }
        requestAnimationFrame(drawTrail);
    }
    
    function endGame(title, text) {
        isGameOver = true;
        stopTimer();
        undoBtn.disabled = true;
        saveGameResult();
        loadGameHistory();
        showModal(title, text, 'Menu Principale', () => {
             welcomeScreen.classList.remove('fade-out');
             resetGameState();
        });
    }

    function undoMove() {
        if (undoChances <= 0 || gameHistory.length === 0 || isGameOver) return;
        const prevState = gameHistory.pop();
        if (prevState.lastPosition) { lastUndoneIndex = (prevState.lastPosition.row * GRID_SIZE) + prevState.lastPosition.col; }
        grid = prevState.grid;
        currentNumber = prevState.currentNumber;
        lastPosition = prevState.lastPosition;
        score = prevState.score;
        challengeGoal = prevState.challengeGoal;
        challengePathAchieved = prevState.challengePathAchieved;
        undoChances--;
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                const cell = boardElement.children[r * GRID_SIZE + c];
                const value = grid[r][c];
                cell.innerHTML = value !== 0 ? `<span>${value}</span>` : '';
                cell.className = 'cell';
                if (value !== 0) {
                    cell.classList.add('occupied');
                    if(gameMode === 'challenge' && challengeGoal && r === challengeGoal.row && c === challengeGoal.col) {
                         cell.innerHTML = `<span>${value}</span><div class="challenge-marker"></div>`;
                         cell.classList.add('challenge-goal');
                    }
                }
            }
        }
        updateScoreDisplay();
        updateVisualsAfterMove();
        undoBtn.disabled = true;
    }

    function resetGameState() {
        grid = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0));
        currentNumber = 1; lastPosition = null; isGameOver = false; isPaused = false;
        score = 0; multiplier = 10; elapsedTimeBeforePause = 0; gameHistory = []; undoChances = 1;
        lastUndoneIndex = null;
        challengeGoal = null;
        challengePathAchieved = false;
        stopTimer();
        timerElement.textContent = '00:00';
        updateScoreDisplay();
        const cells = boardElement.querySelectorAll('.cell');
        cells.forEach(cell => { cell.innerHTML = ''; cell.className = 'cell'; });
        instructionsElement.style.display = 'block';
        instructionsElement.textContent = 'Scegli una modalità dal menu principale.';
        pauseBtn.textContent = 'Pausa';
        undoBtn.disabled = true;
        hideModal();
        boardElement.classList.remove('start-mode');
    }

    function startTimer() { startTime = Date.now(); timerInterval = setInterval(updateTimer, 250); }
    function stopTimer() { clearInterval(timerInterval); timerInterval = null; }
    function updateTimer() { const elapsed = (Date.now() - startTime) + elapsedTimeBeforePause; const totalSeconds = Math.floor(elapsed / 1000); const seconds = totalSeconds % 60; const minutes = Math.floor(totalSeconds / 60); timerElement.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`; const tenSecondIntervals = Math.floor(totalSeconds / 10); multiplier = Math.max(1, 10 - tenSecondIntervals); updateScoreDisplay(); }
    function updateScoreDisplay() { scoreElement.textContent = score; multiplierElement.textContent = `x${multiplier}`; }
    function togglePause() { if (isGameOver || currentNumber === 1 && gameMode === 'free') return; isPaused = !isPaused; if (isPaused) { stopTimer(); elapsedTimeBeforePause += Date.now() - startTime; pauseBtn.textContent = 'Resume'; showModal('Pausa', 'Il gioco è in pausa.', 'Riprendi', togglePause); } else { startTime = Date.now(); startTimer(); pauseBtn.textContent = 'Pausa'; hideModal(); } }
    function playSound() { if (!settings.soundEnabled || typeof Tone === 'undefined') return; try { if (!synth) { synth = new Tone.Synth().toDestination(); } const now = Tone.now(); if (now - lastMoveTimestamp < 2) { streakCounter = (streakCounter + 1) % noteScale.length; } else { streakCounter = 0; } const note = noteScale[streakCounter]; synth.triggerAttackRelease(note, "8n", now); lastMoveTimestamp = now; } catch (error) { console.error("Sound playback failed:", error); settings.soundEnabled = false; } }
    function showModal(title, text, buttonText, buttonAction) { modalTitle.textContent = title; modalText.textContent = text; modalButton.textContent = buttonText; modalButton.onclick = buttonAction; gameModal.classList.remove('hidden'); }
    function hideModal() { gameModal.classList.add('hidden'); }
    function saveGameResult() { const results = JSON.parse(localStorage.getItem('knightsPathHistory')) || []; const result = { score, lastNumber: currentNumber - 1, time: timerElement.textContent, date: new Date().toLocaleDateString() }; results.unshift(result); if (results.length > 10) results.pop(); localStorage.setItem('knightsPathHistory', JSON.stringify(results)); }
    function loadGameHistory() { const results = JSON.parse(localStorage.getItem('knightsPathHistory')) || []; if (results.length === 0) { historyListElement.innerHTML = '<p>Le tue partite passate appariranno qui.</p>'; return; } historyListElement.innerHTML = results.map(r => ` <div class="history-item"> <div class="history-number-cell">${r.lastNumber}</div> <div class="history-details"> <span><strong>Score:</strong> ${r.score}</span> <span><strong>Time:</strong> ${r.time}</span> </div> </div> `).join(''); }
    function loadSettings() { const savedSettings = JSON.parse(localStorage.getItem('knightsPathSettings')); if (savedSettings) { settings = savedSettings; } settings.playMode = 'hover'; applySettings(); }
    function saveSettings() { localStorage.setItem('knightsPathSettings', JSON.stringify(settings)); }
    function applySettings() { document.querySelectorAll('.option-toggle').forEach(el => el.classList.remove('active')); document.querySelector(`[data-option="playMode"][data-value="${settings.playMode}"]`).classList.add('active'); document.getElementById('assist-toggle').checked = settings.showAssistedCells; document.getElementById('sound-toggle').checked = settings.soundEnabled; updateVisualsAfterMove(); }
    function setupOptionsListeners() { optionsCloseBtn.addEventListener('click', () => optionsModal.classList.add('hidden')); optionsModal.addEventListener('click', (e) => { if (e.target.matches('.option-toggle')) { const option = e.target.dataset.option; const value = e.target.dataset.value; settings[option] = value; saveSettings(); applySettings(); } if (e.target.matches('input[type="checkbox"]')) { const option = e.target.dataset.option; settings[option] = e.target.checked; saveSettings(); applySettings(); } }); }
    
    init();
});

