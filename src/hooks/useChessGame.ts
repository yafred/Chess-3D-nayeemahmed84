import { useState, useCallback, useEffect } from 'react';
import { Chess, Square, Move } from 'chess.js';
import moveSoundUrl from '../assets/sounds/move.mp3';
import captureSoundUrl from '../assets/sounds/capture.mp3';
import checkmateSoundUrl from '../assets/sounds/checkmate.mp3';
import { openings, normalizeFen } from '../data/openings';

export interface PieceState {
    id: string;
    type: string;
    color: 'w' | 'b';
    square: Square;
    isCaptured?: boolean;
}

export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type GameMode = 'ai' | 'local' | 'online';
export type PieceTheme = 'glass' | 'metal' | 'marble' | 'wood';
export type EnvironmentPreset = 'apartment' | 'city' | 'dawn' | 'forest' | 'lobby' | 'night' | 'park' | 'studio' | 'sunset' | 'warehouse';

export interface PlayerStats {
    wins: number;
    losses: number;
    draws: number;
    totalGames: number;
}

import { multiplayerService } from '../services/MultiplayerService';

interface SavedGame {
    fen: string;
    pgn: string; // To restore history properly
    turn: 'w' | 'b';
    isGameOver: boolean;
    winner: string | null;
    difficulty: Difficulty;
    history: string[];
    undoneMoves: string[];
    evaluation: number;
    whiteTime: number;
    blackTime: number;
    playerColor: 'w' | 'b';
    volume: number;
    isMuted: boolean;
    gameMode: GameMode;
    pieceTheme: PieceTheme;
    environment: EnvironmentPreset;
    initialTime?: number;
}

const PIECE_VALUES: Record<string, number> = {
    p: 1,
    n: 3,
    b: 3,
    r: 5,
    q: 9,
    k: 0, // King value not needed for material sum usually, or set high
};

const evaluateBoard = (game: Chess): number => {
    let score = 0;
    const board = game.board();
    for (const row of board) {
        for (const piece of row) {
            if (piece) {
                const value = PIECE_VALUES[piece.type] || 0;
                score += piece.color === 'w' ? value : -value;
            }
        }
    }
    return score;
};



export const useChessGame = (gameModeProp: 'local' | 'ai' = 'ai') => {
    const [game, setGame] = useState(new Chess());
    const [fen, setFen] = useState(game.fen());
    const [turn, setTurn] = useState<'w' | 'b'>('w');
    const [isGameOver, setIsGameOver] = useState(false);
    const [winner, setWinner] = useState<string | null>(null);
    const [pieces, setPieces] = useState<PieceState[]>([]);
    const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
    const [history, setHistory] = useState<string[]>([]);
    const [undoneMoves, setUndoneMoves] = useState<string[]>([]); // Stack for redo
    const [evaluation, setEvaluation] = useState(0); // Centipawns
    const [opening, setOpening] = useState<{ name: string, eco: string } | null>(null);

    // Gameplay improvements state
    const [promotionPending, setPromotionPending] = useState<{ from: Square; to: Square; color: 'w' | 'b' } | null>(null);
    const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
    const [checkSquare, setCheckSquare] = useState<Square | null>(null);
    const [hintMove, setHintMove] = useState<{ from: Square; to: Square } | null>(null);
    const [showHint, setShowHint] = useState(false);
    const [showThreats, setShowThreats] = useState(false);
    const [attackedSquares, setAttackedSquares] = useState<Square[]>([]);
    const [hasSavedGame, setHasSavedGame] = useState(false);
    const [opponentSelection, setOpponentSelection] = useState<Square | null>(null);
    const [isOpponentConnected, setIsOpponentConnected] = useState(false);
    const [isSpectator, setIsSpectator] = useState(false);
    const [members, setMembers] = useState<any[]>([]);
    const [myId, setMyId] = useState(multiplayerService.myId);

    const [capturedPieces, setCapturedPieces] = useState<{ white: string[], black: string[] }>({ white: [], black: [] });
    const [materialAdvantage, setMaterialAdvantage] = useState(0);

    // Volume state
    const [volume, setVolume] = useState(1.0);
    const [isMuted, setIsMuted] = useState(false);

    // Timer state (in seconds) - Default 10 minutes
    const [initialTime, setInitialTime] = useState(600);
    const [whiteTime, setWhiteTime] = useState(600);
    const [blackTime, setBlackTime] = useState(600);
    const [timerActive, setTimerActive] = useState(false);

    const [gameMode, setGameMode] = useState<GameMode>(gameModeProp);
    const [pieceTheme, setPieceTheme] = useState<PieceTheme>('glass');
    const [environment, setEnvironment] = useState<EnvironmentPreset>('forest');
    const [stats, setStats] = useState<PlayerStats>({ wins: 0, losses: 0, draws: 0, totalGames: 0 });

    // Play as Black state
    const [playerColor, setPlayerColor] = useState<'w' | 'b'>('w');
    const [worker, setWorker] = useState<Worker | null>(null);

    // Initialize Web Worker
    useEffect(() => {
        const newWorker = new Worker(new URL('../workers/stockfish.worker.ts', import.meta.url), { type: 'module' });
        newWorker.postMessage({ type: 'init' });
        setWorker(newWorker);
        return () => {
            newWorker.postMessage({ type: 'quit' });
            newWorker.terminate();
        };
    }, []);



    // Audio assets are imported at the top of the file

    const playSound = (url: string) => {
        if (isMuted) return;
        const audio = new Audio(url);
        audio.volume = volume;
        audio.play().catch(() => { });
    };

    const toggleMute = useCallback(() => {
        setIsMuted(prev => !prev);
    }, []);

    // Initialize pieces with stable IDs
    useEffect(() => {
        const initialPieces: PieceState[] = [];
        const board = game.board();
        let idCounter = 0;
        board.forEach((row) => {
            row.forEach((piece) => {
                if (piece) {
                    initialPieces.push({
                        id: `${piece.type}-${piece.color}-${idCounter++}`,
                        type: piece.type,
                        color: piece.color,
                        square: piece.square,
                    });
                }
            });
        });
        setPieces(initialPieces);
        setEvaluation(evaluateBoard(game));

        // Check for saved games in any slot on mount
        const hasAnySave = Array.from({ length: 5 }, (_, i) =>
            localStorage.getItem(`chess_save_slot_${i}`)
        ).some(save => save !== null);
        setHasSavedGame(hasAnySave);

        // Load stats
        const savedStats = localStorage.getItem('chess_player_stats');
        if (savedStats) {
            setStats(JSON.parse(savedStats));
        }
    }, []);

    // Timer Logic
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        let lastTime = Date.now();

        if (timerActive && !isGameOver) {
            interval = setInterval(() => {
                const now = Date.now();
                const delta = (now - lastTime) / 1000;
                lastTime = now;

                if (turn === 'w') {
                    setWhiteTime((prev) => {
                        const newVal = prev - delta;
                        if (newVal <= 0) {
                            setIsGameOver(true);
                            setWinner('Black');
                            setTimerActive(false);
                            return 0;
                        }
                        return newVal;
                    });
                } else {
                    setBlackTime((prev) => {
                        const newVal = prev - delta;
                        if (newVal <= 0) {
                            setIsGameOver(true);
                            setWinner('White');
                            setTimerActive(false);
                            return 0;
                        }
                        return newVal;
                    });
                }
            }, 100);
        }
        return () => clearInterval(interval);
    }, [timerActive, turn, isGameOver]);

    // Update current timers when initialTime changes (only if game hasn't started)
    useEffect(() => {
        if (history.length === 0 && !timerActive) {
            setWhiteTime(initialTime);
            setBlackTime(initialTime);
        }
    }, [initialTime, history.length, timerActive]);

    // Update pieces helper (reused for move, undo, redo)
    const syncPiecesWithBoard = (currentBoard: ReturnType<Chess['board']>) => {
        setPieces(() => {
            const newPieces: PieceState[] = [];
            let idCounter = 0;
            currentBoard.forEach((row) => {
                row.forEach((piece) => {
                    if (piece) {
                        newPieces.push({
                            id: `${piece.type}-${piece.color}-${idCounter++}`,
                            type: piece.type,
                            color: piece.color,
                            square: piece.square,
                        });
                    }
                });
            });
            return newPieces;
        });
    };

    const updatePieces = (move: Move) => {
        setPieces((prevPieces) => {
            const newPieces = [...prevPieces];

            // 1. Handle Capture
            if (move.captured) {
                let capturedSquare = move.to;
                if (move.flags.includes('e')) { // En passant
                    const file = move.to[0];
                    const rank = move.from[1];
                    capturedSquare = (file + rank) as Square;
                }

                const capturedIndex = newPieces.findIndex(p => p.square === capturedSquare && !p.isCaptured);
                if (capturedIndex !== -1) {
                    newPieces[capturedIndex] = { ...newPieces[capturedIndex], isCaptured: true };
                    setTimeout(() => {
                        setPieces(current => current.filter(p => p.id !== newPieces[capturedIndex].id));
                    }, 500);
                }
            }

            // 2. Move the piece
            const pieceIndex = newPieces.findIndex(p => p.square === move.from && !p.isCaptured);
            if (pieceIndex !== -1) {
                newPieces[pieceIndex] = {
                    ...newPieces[pieceIndex],
                    square: move.to,
                    type: move.promotion ? move.promotion : newPieces[pieceIndex].type
                };
            }

            // 3. Handle Castling
            if (move.flags.includes('k') || move.flags.includes('q')) {
                let rookFrom: Square | null = null;
                let rookTo: Square | null = null;

                if (move.color === 'w') {
                    if (move.flags.includes('k')) { rookFrom = 'h1'; rookTo = 'f1'; }
                    if (move.flags.includes('q')) { rookFrom = 'a1'; rookTo = 'd1'; }
                } else {
                    if (move.flags.includes('k')) { rookFrom = 'h8'; rookTo = 'f8'; }
                    if (move.flags.includes('q')) { rookFrom = 'a8'; rookTo = 'd8'; }
                }

                if (rookFrom && rookTo) {
                    const rookIndex = newPieces.findIndex(p => p.square === rookFrom && !p.isCaptured);
                    if (rookIndex !== -1) {
                        newPieces[rookIndex] = {
                            ...newPieces[rookIndex],
                            square: rookTo
                        };
                    }
                }
            }

            return newPieces;
        });
    };

    const handleMoveSound = (move: Move, newGame: Chess) => {
        if (newGame.isCheckmate()) {
            playSound(checkmateSoundUrl);
        } else if (newGame.isCheck()) {
            playSound(moveSoundUrl); // Using move sound for check
        } else if (move.captured) {
            playSound(captureSoundUrl);
        } else {
            playSound(moveSoundUrl);
        }
    };

    const makeMove = useCallback((from: Square, to: Square, promotion: string = 'q', isAI = false) => {
        // Block moves for spectators unless it's an incoming move (treated as AI/External)
        if (isSpectator && !isAI) {
            return false;
        }


        try {
            const gameCopy = new Chess();
            gameCopy.loadPgn(game.pgn());

            // Check for promotion
            const piece = gameCopy.get(from);
            if (
                !isAI && gameMode === 'ai' &&
                piece?.type === 'p' &&
                ((piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1'))
            ) {
                setPromotionPending({ from, to, color: piece.color });
                return false; // Wait for user selection
            }

            const move = gameCopy.move({ from, to, promotion });

            if (move) {
                updatePieces(move);
                setGame(gameCopy);
                setFen(gameCopy.fen());
                setTurn(gameCopy.turn());
                console.log("[MakeMove] Turn changed to:", gameCopy.turn());
                setHistory(gameCopy.history());
                setUndoneMoves([]); // Clear redo stack on new move
                setEvaluation(evaluateBoard(gameCopy));

                // Calculate captured pieces
                const history = gameCopy.history({ verbose: true });
                const capturedW: string[] = [];
                const capturedB: string[] = [];
                let scoreW = 0;
                let scoreB = 0;

                history.forEach(move => {
                    if (move.captured) {
                        if (move.color === 'w') {
                            capturedW.push(move.captured);
                            scoreW += PIECE_VALUES[move.captured];
                        } else {
                            capturedB.push(move.captured);
                            scoreB += PIECE_VALUES[move.captured];
                        }
                    }
                });

                setCapturedPieces({ white: capturedW, black: capturedB });
                setMaterialAdvantage(scoreW - scoreB);

                setTimerActive(true); // Start timer on first move

                // Update visual hints
                setLastMove({ from, to });
                setCheckSquare(gameCopy.inCheck() ? gameCopy.board().flat().find(p => p?.type === 'k' && p.color === gameCopy.turn())?.square as Square : null);

                handleMoveSound(move, gameCopy);

                if (!isAI && gameMode === 'online') {
                    handleMultiplayerMove(from, to, promotion);
                }

                if (gameCopy.isGameOver()) {
                    setIsGameOver(true);
                    setTimerActive(false);
                    let result: 'win' | 'loss' | 'draw' = 'draw';
                    if (gameCopy.isCheckmate()) {
                        const playerWon = gameCopy.turn() !== playerColor;
                        setWinner(gameCopy.turn() === 'w' ? 'Black' : 'White');
                        result = playerWon ? 'win' : 'loss';
                    } else {
                        setWinner('Draw');
                        result = 'draw';
                    }

                    // Update stats
                    setStats(prev => {
                        const newStats = {
                            ...prev,
                            wins: result === 'win' ? prev.wins + 1 : prev.wins,
                            losses: result === 'loss' ? prev.losses + 1 : prev.losses,
                            draws: result === 'draw' ? prev.draws + 1 : prev.draws,
                            totalGames: prev.totalGames + 1
                        };
                        localStorage.setItem('chess_player_stats', JSON.stringify(newStats));
                        return newStats;
                    });
                }

                return true;
            }
        } catch (e) {
            return false;
        }
        return false;
    }, [game, worker, gameMode]);

    // Multiplayer Move Listener
    useEffect(() => {
        const cleanupData = multiplayerService.onData((data, conn) => {
            if (data.type === 'move') {
                const { from, to, promotion } = data.payload;
                console.log('[Multiplayer] Received move:', from, to);
                makeMove(from, to, promotion, true);
            } else if (data.type === 'interaction') {
                const { type, square } = data.payload;
                if (type === 'select') {
                    setOpponentSelection(square);
                } else if (type === 'deselect') {
                    setOpponentSelection(null);
                }
            } else if (data.type === 'game_state_request') {
                // We are Host, and a client (spectator or player) requested state
                console.log('[Multiplayer] Received game state request from', conn.peer);

                // Send current state
                const currentFen = game.fen();
                const currentHistory = game.history();
                const currentTurn = game.turn();

                multiplayerService.sendData({
                    type: 'game_state_sync',
                    payload: {
                        fen: currentFen,
                        history: currentHistory,
                        turn: currentTurn,
                        whiteTime,
                        blackTime,
                        capturedPieces,
                        materialAdvantage,
                        isGameOver,
                        winner,
                        evaluation: evaluation
                    }
                }, conn.peer);
            } else if (data.type === 'game_state_sync') {
                // We are Client (Spectator/Player) receiving state from Host
                console.log('[Multiplayer] Received game state sync');
                const { fen, history, turn, whiteTime: wTime, blackTime: bTime, capturedPieces: caps, materialAdvantage: mat, isGameOver: over, winner: win } = data.payload;

                const newGame = new Chess(fen);
                setGame(newGame);
                setFen(fen);
                setTurn(turn);
                setHistory(history);
                setWhiteTime(wTime);
                setBlackTime(bTime);
                setCapturedPieces(caps);
                setMaterialAdvantage(mat);
                setIsGameOver(over);
                setWinner(win);
                setEvaluation(data.payload.evaluation || evaluateBoard(newGame));
                syncPiecesWithBoard(newGame.board());
            } else if (data.type === 'evaluation_sync') {
                setEvaluation(data.payload);
            }
        });

        const cleanupConnect = multiplayerService.onConnect((conn) => {
            console.log('[useChessGame] Peer connected:', conn.peer, 'Metadata:', conn.metadata);

            // Check if we are a spectator based on connection metadata if possible, 
            // or rely on the fact that if we joined as spectator, we set the state elsewhere?
            // Actually, `MultiplayerMenu` calls `connect`. 
            // We need a way to set `isSpectator` when we join.
            // We can expose a setter or handle it via a new method in the hook.
            // For now, let's assume the component sets it via a prop or we infer it.
            // Wait, `MultiplayerMenu` is outside `useChessGame`. 
            // We need to expose `setIsSpectator` or a `joinGame` function.

            // Let's check the metadata of the *outgoing* connection if we are the client.
            // But PeerJS doesn't easily expose "my outgoing connection metadata" on the connection object itself in a unified way for all cases.
            // However, we passed it in `connect`.

            // Simpler: We'll add a `joinGame(id, role)` function to `useChessGame` 
            // and move the connect logic there, OR just expose `setIsSpectator`.
            // Exposing `setIsSpectator` is easiest for now given the structure.

            setIsOpponentConnected(true);

            // If we are client (we have a connection and we are not host... how to know?), request state.
            // We can just always request state on connect. Host will ignore if they are the one who accepted?
            // Actually, `onConnect` fires for both.
            // We can send 'game_state_request'.
            multiplayerService.sendData({ type: 'game_state_request', payload: null }, conn.peer);
        });

        const cleanupDisconnect = multiplayerService.onDisconnect(() => {
            console.log('[useChessGame] Peer disconnected');
            if (!multiplayerService.isConnected()) {
                setIsOpponentConnected(false);
            }
        });

        const handleMembersUpdate = (e: any) => {
            setMembers(e.detail);
        };

        const onId = (id: string) => {
            setMyId(id);
        };
        const cleanupId = multiplayerService.onOpen(onId);

        window.addEventListener('chess-members-update', handleMembersUpdate);

        // Initialize connection state
        setIsOpponentConnected(multiplayerService.isConnected());
        setMembers(multiplayerService.getMembers());

        return () => {
            cleanupData();
            cleanupConnect();
            cleanupDisconnect();
            cleanupId();
            window.removeEventListener('chess-members-update', handleMembersUpdate);
        };
    }, [makeMove, game, whiteTime, blackTime, capturedPieces, materialAdvantage, isGameOver, winner]);

    // Send move if online
    const handleMultiplayerMove = (from: Square, to: Square, promotion?: string) => {
        if (gameMode === 'online' && !isSpectator) {
            multiplayerService.sendData({
                type: 'move',
                payload: { from, to, promotion }
            });
            // Also clear selection on move
            multiplayerService.sendData({
                type: 'interaction',
                payload: { type: 'deselect' }
            });
        }
    };

    const handleSquareSelect = (square: Square | null) => {
        if (gameMode === 'online' && !isSpectator) {
            if (square) {
                multiplayerService.sendData({
                    type: 'interaction',
                    payload: { type: 'select', square }
                });
            } else {
                multiplayerService.sendData({
                    type: 'interaction',
                    payload: { type: 'deselect' }
                });
            }
        }
    };


    const handleWorkerMessage = useCallback((e: MessageEvent) => {
        const { type, move, data } = e.data;

        console.log('[useChessGame] Worker message received:', { type, move, data });

        if (type === 'evaluation') {
            // data.value is in centipawns (e.g. 100 = 1 pawn)
            // If it's mate, value might be different or handled separately in parsing
            // For now assuming cp
            if (data.type === 'cp') {
                // normalize to -20 to +20 range roughly for the bar
                // The bar expects roughly -20 to +20? 
                // Existing evaluateBoard returns material difference (e.g. +1, +3).
                // Stockfish returns centipawns (e.g. +100, +300).
                // So we divide by 100.
                let evalScore = data.value / 100;

                // Stockfish evaluation is usually from side-to-move perspective.
                // We need it from White's perspective.
                if (game.turn() === 'b') {
                    evalScore = -evalScore;
                }

                setEvaluation(evalScore);

                // Broadcast evaluation to spectators if we are the one running the engine
                if (gameMode === 'online' && !isSpectator) {
                    multiplayerService.sendData({ type: 'evaluation_sync', payload: evalScore });
                }
            } else if (data.type === 'mate') {
                // Mate in X
                // If positive, side to move wins.
                let evalScore = data.value > 0 ? 100 : -100;
                if (game.turn() === 'b') {
                    evalScore = -evalScore;
                }
                setEvaluation(evalScore);
            }
            return;
        }

        if (type === 'bestmove') {
            console.log('[useChessGame] Best move received:', move, 'Current turn:', game.turn(), 'Player color:', playerColor, 'Game mode:', gameMode);
            // move is string like "e2e4" or "a7a8q"
            if (move) {
                const from = move.substring(0, 2) as Square;
                const to = move.substring(2, 4) as Square;
                const promotion = move.length === 5 ? move[4] : undefined;

                // If it's player's turn and we have a hint, update hint
                if (game.turn() === playerColor || gameMode === 'local') {
                    if (showHint) {
                        setHintMove({ from, to });
                    }
                } else if (gameMode === 'ai') {
                    // AI Turn - make the move
                    console.log('[useChessGame] Making AI move from', from, 'to', to);
                    makeMove(from, to, promotion || 'q', true);
                }
            }
        }
    }, [game, makeMove, playerColor, gameMode, showHint]);

    useEffect(() => {
        if (worker) {
            worker.onmessage = handleWorkerMessage;
        }
    }, [worker, handleWorkerMessage]);

    // Calculate attacked squares whenever game state changes or showThreats changes
    useEffect(() => {
        if (!showThreats) {
            setAttackedSquares([]);
            return;
        }

        const squares: Square[] = [];
        const opponentColor = game.turn() === 'w' ? 'b' : 'w';

        // Iterate over all squares to check if they are attacked by opponent
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        for (let rank = 1; rank <= 8; rank++) {
            for (const file of files) {
                const square = `${file}${rank}` as Square;
                try {
                    // @ts-ignore
                    if (game.isAttacked(square, opponentColor)) {
                        squares.push(square);
                    }
                } catch (e) {
                    // Fallback or ignore if method doesn't exist
                }
            }
        }
        setAttackedSquares(squares);
    }, [game, showThreats, fen]);

    // Opening detection - update opening name based on current position
    useEffect(() => {
        const currentFen = normalizeFen(fen);
        const detectedOpening = openings[currentFen];

        if (detectedOpening) {
            setOpening(detectedOpening);
        } else if (game.history().length === 0) {
            // Reset opening at start
            setOpening(null);
        }
        // Keep the last detected opening if current position not in database
    }, [fen, game]);

    const requestHint = useCallback(() => {
        setShowHint(prev => !prev);
    }, []);

    // Auto-update hint when game state changes or showHint is toggled
    useEffect(() => {
        if (showHint && !isGameOver && worker) {
            // Construct moves string for UCI
            const moves = game.history({ verbose: true }).map(m => {
                let moveStr = m.from + m.to;
                if (m.promotion) moveStr += m.promotion;
                return moveStr;
            }).join(' ');

            worker.postMessage({ type: 'position', data: `startpos moves ${moves}` });
            worker.postMessage({ type: 'go', data: 'depth 15' }); // High depth for hint
        } else {
            setHintMove(null);
        }
    }, [showHint, game, isGameOver, worker]);

    const onPromotionSelect = useCallback((pieceType: string) => {
        if (promotionPending) {
            makeMove(promotionPending.from, promotionPending.to, pieceType, true); // Treat as AI move to bypass check
            setPromotionPending(null);
        }
    }, [promotionPending, makeMove]);

    const undoMove = useCallback(() => {
        console.log("Undo called. Current turn:", game.turn(), "History:", game.history().length);
        const gameCopy = new Chess();
        gameCopy.loadPgn(game.pgn());
        const move1 = gameCopy.undo();
        console.log("Undo 1 result:", move1);
        let move2: Move | null = null;

        if (move1) {
            // If we just undid an AI move, we must also undo Player's move
            if (move1.color !== playerColor) {
                move2 = gameCopy.undo();
                console.log("Undo 2 result (AI compensation):", move2);
            }

            setGame(gameCopy);
            setFen(gameCopy.fen());
            setTurn(gameCopy.turn());
            setHistory(gameCopy.history());

            setUndoneMoves(prev => {
                const newMoves = [...prev];
                if (move1) newMoves.unshift(move1.san);
                if (move2) newMoves.unshift(move2.san);
                return newMoves;
            });

            setEvaluation(evaluateBoard(gameCopy));
            syncPiecesWithBoard(gameCopy.board());

            // Recalculate captured pieces on undo
            const history = gameCopy.history({ verbose: true });
            const capturedW: string[] = [];
            const capturedB: string[] = [];
            let scoreW = 0;
            let scoreB = 0;

            history.forEach(move => {
                if (move.captured) {
                    if (move.color === 'w') {
                        capturedW.push(move.captured);
                        scoreW += PIECE_VALUES[move.captured];
                    } else {
                        capturedB.push(move.captured);
                        scoreB += PIECE_VALUES[move.captured];
                    }
                }
            });
            setCapturedPieces({ white: capturedW, black: capturedB });
            setMaterialAdvantage(scoreW - scoreB);

            // Update visual hints
            const hist = gameCopy.history({ verbose: true });
            if (hist.length > 0) {
                const lastHistMove = hist[hist.length - 1];
                setLastMove({ from: lastHistMove.from, to: lastHistMove.to });
            } else {
                setLastMove(null);
            }
            setCheckSquare(gameCopy.inCheck() ? gameCopy.board().flat().find(p => p?.type === 'k' && p.color === gameCopy.turn())?.square as Square : null);

            if (isGameOver) {
                setIsGameOver(false);
                setWinner(null);
                setTimerActive(true);
            }
        }
    }, [game, isGameOver, playerColor]);

    const redoMove = useCallback(() => {
        console.log("Redo called. Stack:", undoneMoves);
        if (undoneMoves.length === 0) return;

        const moveSan = undoneMoves[0];
        console.log("Redoing move:", moveSan);
        const gameCopy = new Chess();
        gameCopy.loadPgn(game.pgn());
        const move = gameCopy.move(moveSan);

        if (move) {
            // Double redo logic
            if (move.color === playerColor && undoneMoves.length > 1) {
                const nextMoveSan = undoneMoves[1];
                const move2 = gameCopy.move(nextMoveSan);
                if (move2) {
                    setUndoneMoves(prev => prev.slice(2));
                } else {
                    setUndoneMoves(prev => prev.slice(1));
                }
            } else {
                setUndoneMoves(prev => prev.slice(1));
            }

            setGame(gameCopy);
            setFen(gameCopy.fen());
            setTurn(gameCopy.turn());
            setHistory(gameCopy.history());
            setEvaluation(evaluateBoard(gameCopy));
            syncPiecesWithBoard(gameCopy.board());
            handleMoveSound(move, gameCopy);

            // Recalculate captured pieces on redo
            const history = gameCopy.history({ verbose: true });
            const capturedW: string[] = [];
            const capturedB: string[] = [];
            let scoreW = 0;
            let scoreB = 0;

            history.forEach(move => {
                if (move.captured) {
                    if (move.color === 'w') {
                        capturedW.push(move.captured);
                        scoreW += PIECE_VALUES[move.captured];
                    } else {
                        capturedB.push(move.captured);
                        scoreB += PIECE_VALUES[move.captured];
                    }
                }
            });
            setCapturedPieces({ white: capturedW, black: capturedB });
            setMaterialAdvantage(scoreW - scoreB);
        }
    }, [game, undoneMoves, playerColor]);

    const makeAIMove = useCallback(() => {
        if (game.turn() === playerColor || isGameOver || !worker || gameMode === 'local') {
            return;
        }

        // Construct moves string for UCI
        const moves = game.history({ verbose: true }).map(m => {
            let moveStr = m.from + m.to;
            if (m.promotion) moveStr += m.promotion;
            return moveStr;
        }).join(' ');

        worker.postMessage({ type: 'position', data: `startpos moves ${moves}` });

        // Determine depth/time based on difficulty
        let depth = 5;
        let movetime = 1000;

        switch (difficulty) {
            case 'Easy':
                depth = 2;
                movetime = 500;
                break;
            case 'Medium':
                depth = 8;
                movetime = 2000;
                break;
            case 'Hard':
                depth = 15; // Strong but fast enough
                movetime = 5000;
                break;
        }

        // We can use 'go depth X' or 'go movetime Y'
        // Using depth is more consistent for difficulty, movetime is better for UX.
        // Let's use depth for now as it's a proxy for skill.
        worker.postMessage({ type: 'go', data: `depth ${depth} movetime ${movetime}` });

    }, [game, playerColor, isGameOver, worker, difficulty, gameMode]);

    // AI Move Effect - White always moves first (standard chess)
    useEffect(() => {
        const isAITurn = !isGameOver && game.turn() !== playerColor && gameMode === 'ai';
        const canAIMove = game.history().length > 0 || (playerColor === 'b' && game.history().length === 0);

        if (isAITurn && canAIMove) {
            console.log('[AI Effect] Triggering AI move. Turn:', game.turn(), 'Player:', playerColor);
            // Move immediately for the first move to avoid delay perception, else wait for realism
            const delay = game.history().length === 0 ? 100 : 500;
            const timer = setTimeout(() => {
                console.log('[AI Effect] Executing makeAIMove...');
                makeAIMove();
            }, delay);
            return () => clearTimeout(timer);
        }
    }, [game, isGameOver, playerColor, makeAIMove, gameMode]);

    const resetGame = useCallback(() => {
        const newGame = new Chess();
        setGame(newGame);
        setFen(newGame.fen());
        setTurn(newGame.turn());
        setIsGameOver(false);
        setWinner(null);
        setHistory([]);
        setUndoneMoves([]);
        setEvaluation(0);
        setLastMove(null);
        setCheckSquare(null);
        setHintMove(null);
        setPromotionPending(null);
        setPromotionPending(null);
        setWhiteTime(initialTime);
        setBlackTime(initialTime);
        setTimerActive(false);
        setCapturedPieces({ white: [], black: [] });
        setMaterialAdvantage(0);

        const initialPieces: PieceState[] = [];
        const board = newGame.board();
        let idCounter = 0;
        board.forEach((row) => {
            row.forEach((piece) => {
                if (piece) {
                    initialPieces.push({
                        id: `${piece.type}-${piece.color}-${idCounter++}`,
                        type: piece.type,
                        color: piece.color,
                        square: piece.square,
                    });
                }
            });
        });
        setPieces(initialPieces);

    }, []);

    const getPossibleMoves = useCallback((square: Square) => {
        return game.moves({ square, verbose: true }).map((move) => move.to);
    }, [game]);

    const saveGame = useCallback((slotIndex: number = 0) => {
        const gameState: SavedGame = {
            fen: game.fen(),
            pgn: game.pgn(),
            turn: game.turn(),
            isGameOver,
            winner,
            difficulty,
            history,
            undoneMoves,
            evaluation,
            whiteTime,
            blackTime,
            playerColor,
            volume,
            isMuted,
            gameMode,
            pieceTheme,
            environment,
            initialTime
        };

        // Add metadata
        const savedGame = {
            ...gameState,
            savedAt: Date.now(),
            moveCount: history.length
        };

        localStorage.setItem(`chess_save_slot_${slotIndex}`, JSON.stringify(savedGame));

        // Update hasSavedGame flag
        const hasAnySave = Array.from({ length: 5 }, (_, i) =>
            localStorage.getItem(`chess_save_slot_${i}`)
        ).some(save => save !== null);
        setHasSavedGame(hasAnySave);

        return true;
    }, [game, isGameOver, winner, difficulty, history, undoneMoves, evaluation, whiteTime, blackTime, playerColor, volume, isMuted, gameMode, pieceTheme, initialTime]);

    const loadGame = useCallback((slotIndex: number = 0) => {
        const savedData = localStorage.getItem(`chess_save_slot_${slotIndex}`);
        if (!savedData) return false;

        try {
            const state: SavedGame = JSON.parse(savedData);

            // Restore Game Logic
            const loadedGame = new Chess();
            loadedGame.loadPgn(state.pgn);
            if (state.pgn === '') loadedGame.load(state.fen);

            setGame(loadedGame);
            setFen(loadedGame.fen());
            setTurn(loadedGame.turn());
            setIsGameOver(state.isGameOver);
            setWinner(state.winner);
            setDifficulty(state.difficulty);
            setHistory(state.history);
            setUndoneMoves(state.undoneMoves);
            setEvaluation(state.evaluation);
            setWhiteTime(state.whiteTime);
            setBlackTime(state.blackTime);
            setPlayerColor(state.playerColor);
            setVolume(state.volume);
            setIsMuted(state.isMuted);
            setGameMode(state.gameMode || 'ai');
            setPieceTheme(state.pieceTheme || 'glass');
            setEnvironment(state.environment || 'forest'); // Corrected and added environment loading
            if (state.initialTime) setInitialTime(state.initialTime);

            // Restore Pieces Visuals
            syncPiecesWithBoard(loadedGame.board());

            // Restore Timer State
            setTimerActive(!state.isGameOver);

            // Clear any pending states
            setLastMove(null);
            setCheckSquare(null);
            setHintMove(null);
            setPromotionPending(null);

            return true;
        } catch (e) {
            console.error("Failed to load game", e);
            return false;
        }
    }, []);

    const deleteSave = useCallback((slotIndex: number) => {
        localStorage.removeItem(`chess_save_slot_${slotIndex}`);

        // Update hasSavedGame flag
        const hasAnySave = Array.from({ length: 5 }, (_, i) =>
            localStorage.getItem(`chess_save_slot_${i}`)
        ).some(save => save !== null);
        setHasSavedGame(hasAnySave);
    }, []);

    const navigateToMove = useCallback((moveIndex: number) => {
        const gameCopy = new Chess();
        const moves = game.history({ verbose: true });

        // Replay moves up to the specified index
        for (let i = 0; i <= moveIndex && i < moves.length; i++) {
            gameCopy.move(moves[i].san);
        }

        setFen(gameCopy.fen());
        syncPiecesWithBoard(gameCopy.board());

        // Update visual hints
        if (moveIndex >= 0 && moveIndex < moves.length) {
            const move = moves[moveIndex];
            setLastMove({ from: move.from, to: move.to });
        } else {
            setLastMove(null);
        }

        setCheckSquare(gameCopy.inCheck() ? gameCopy.board().flat().find(p => p?.type === 'k' && p.color === gameCopy.turn())?.square as Square : null);
    }, [game]);

    const importPGN = useCallback((pgn: string) => {
        try {
            const newGame = new Chess();
            newGame.loadPgn(pgn);

            setGame(newGame);
            setFen(newGame.fen());
            setTurn(newGame.turn());
            setHistory(newGame.history());
            setUndoneMoves([]);
            setEvaluation(evaluateBoard(newGame));

            // Recalculate captured pieces on import
            const history = newGame.history({ verbose: true });
            const capturedW: string[] = [];
            const capturedB: string[] = [];
            let scoreW = 0;
            let scoreB = 0;

            history.forEach(move => {
                if (move.captured) {
                    if (move.color === 'w') {
                        capturedW.push(move.captured);
                        scoreW += PIECE_VALUES[move.captured];
                    } else {
                        capturedB.push(move.captured);
                        scoreB += PIECE_VALUES[move.captured];
                    }
                }
            });
            setCapturedPieces({ white: capturedW, black: capturedB });
            setMaterialAdvantage(scoreW - scoreB);

            // Reset game state
            setIsGameOver(newGame.isGameOver());
            if (newGame.isGameOver()) {
                setTimerActive(false);
                if (newGame.isCheckmate()) {
                    setWinner(newGame.turn() === 'w' ? 'Black' : 'White');
                } else {
                    setWinner('Draw');
                }
            } else {
                setWinner(null);
                setTimerActive(false); // Don't auto-start timer for imported games
            }

            // Update pieces
            syncPiecesWithBoard(newGame.board());

            // Clear visual hints
            setLastMove(null);
            setCheckSquare(newGame.inCheck() ? newGame.board().flat().find(p => p?.type === 'k' && p.color === newGame.turn())?.square as Square : null);
            setHintMove(null);
            setPromotionPending(null);

            return true;
        } catch (e) {
            console.error("Failed to import PGN", e);
            return false;
        }
    }, []);

    return {
        game,
        fen,
        turn,
        isGameOver,
        winner,
        pieces,
        difficulty,
        history,
        evaluation,
        whiteTime,
        blackTime,
        promotionPending,
        lastMove,
        checkSquare,
        setDifficulty,
        makeMove,
        onPromotionSelect,
        undoMove,
        redoMove,
        resetGame,
        getPossibleMoves,
        playerColor,
        setPlayerColor,
        gameMode,
        setGameMode,
        hintMove,
        showHint,
        showThreats,
        setShowThreats,
        attackedSquares,
        requestHint,
        capturedPieces,
        materialAdvantage,
        volume,
        setVolume,
        isMuted,
        toggleMute,
        saveGame,
        loadGame,
        deleteSave,
        hasSavedGame,
        navigateToMove,
        importPGN,
        initialTime, setInitialTime,
        opening,
        opponentSelection,
        isOpponentConnected,
        isSpectator,
        setIsSpectator,
        handleSquareSelect,
        members,
        myId,
        pieceTheme,
        setPieceTheme,
        environment,
        setEnvironment,
        stats
    };
};
