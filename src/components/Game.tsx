import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from './Scene';
import { useChessGame } from '../hooks/useChessGame';
import { GameAnalysis } from './GameAnalysis';
import { SaveLoadModal } from './SaveLoadModal';
import { PGNModal } from './PGNModal';
import { CapturedPieces } from './CapturedPieces';
import { MultiplayerMenu } from './MultiplayerMenu';
import { TrainingMenu, TrainingMode } from './TrainingMenu';
import { PuzzleMode } from './PuzzleMode';
import TutorialMode from './TutorialMode';
import { RotateCcw, RotateCw, Trophy, ChevronLeft, ChevronRight, Volume2, VolumeX, Maximize, Minimize, Save, Upload, Check, AlertTriangle, X, Download, Users, GraduationCap } from 'lucide-react';
import { open } from '@tauri-apps/plugin-shell';
import Chat from './Chat';
const animationStyles = `
@keyframes victoryBounce {
    0%, 100% { transform: translateY(0) scale(1); }
    25% { transform: translateY(-20px) scale(1.1); }
    50% { transform: translateY(0) scale(1); }
    75% { transform: translateY(-10px) scale(1.05); }
}

@keyframes victoryPulse {
    0%, 100% { filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.6)); }
    50% { filter: drop-shadow(0 0 40px rgba(255, 215, 0, 1)); }
}

@keyframes drawFloat {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-15px); }
}

@keyframes lossShake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
    20%, 40%, 60%, 80% { transform: translateX(5px); }
}
`;

const Game = () => {
    const {
        makeMove, turn, isGameOver, winner, resetGame, getPossibleMoves, pieces,
        difficulty, setDifficulty, history, evaluation, whiteTime, blackTime, undoMove, redoMove,
        promotionPending, onPromotionSelect, lastMove, checkSquare, playerColor, setPlayerColor,
        hintMove, showHint, showThreats, setShowThreats, attackedSquares, requestHint,
        volume, setVolume, isMuted, toggleMute,
        saveGame, loadGame, deleteSave, hasSavedGame, game, navigateToMove, importPGN,
        gameMode, setGameMode, capturedPieces, materialAdvantage, initialTime, setInitialTime,
        opening, opponentSelection, isOpponentConnected, isSpectator, setIsSpectator, members, myId,
        pieceTheme, setPieceTheme, environment, setEnvironment,
        stats
    } = useChessGame();

    const [isPanelVisible, setIsPanelVisible] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showAnalysis, setShowAnalysis] = useState(false);
    const [saveLoadMode, setSaveLoadMode] = useState<'save' | 'load' | null>(null);
    const [pgnMode, setPGNMode] = useState<'export' | 'import' | null>(null);
    const [showMultiplayerMenu, setShowMultiplayerMenu] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [notification, setNotification] = useState<{ type: 'success' | 'confirm' | 'error', message: string, onConfirm?: () => void } | null>(null);
    const [connectionStatusMessage, setConnectionStatusMessage] = useState<'connected' | 'disconnected' | null>(null);
    const [trainingMode, setTrainingMode] = useState<TrainingMode>('menu');
    const [showTraining, setShowTraining] = useState(false);
    const [chatHighlightSquares, setChatHighlightSquares] = useState<any[]>([]);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => {
                setIsFullscreen(true);
            }).catch(() => { });
        } else {
            document.exitFullscreen().then(() => {
                setIsFullscreen(false);
            }).catch(() => { });
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Auto-hide panel after first move
    useEffect(() => {
        // Only auto-hide once when history reaches 1-2 moves
        // Don't include isPanelVisible in dependencies to avoid re-hiding when user manually shows it
        if (history.length > 0 && history.length <= 2) {
            const timer = setTimeout(() => {
                setIsPanelVisible(false);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [history.length]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger shortcuts if user is typing in an input or if modals are open
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
                return;
            }

            // Escape key - close modals
            if (e.key === 'Escape') {
                if (notification) {
                    setNotification(null);
                    return;
                }
            }

            // Don't allow other shortcuts during promotion or when modals are open
            if (promotionPending || notification) {
                return;
            }

            switch (e.key.toLowerCase()) {
                case 'arrowleft':
                    e.preventDefault();
                    undoMove();
                    break;
                case 'arrowright':
                    e.preventDefault();
                    redoMove();
                    break;
                case 'h':
                    e.preventDefault();
                    requestHint();
                    break;
                case 'r':
                    e.preventDefault();
                    resetGame();
                    break;
                case 's':
                    e.preventDefault();
                    if (saveGame()) {
                        setNotification({
                            type: 'success',
                            message: 'Game Saved Successfully!'
                        });
                        setTimeout(() => setNotification(null), 2000);
                    }
                    break;
                case 'l':
                    e.preventDefault();
                    if (hasSavedGame) {
                        setNotification({
                            type: 'confirm',
                            message: 'Load saved game? Current progress will be lost.',
                            onConfirm: () => {
                                if (loadGame()) {
                                    setNotification({
                                        type: 'success',
                                        message: 'Game Loaded Successfully!'
                                    });
                                    setTimeout(() => setNotification(null), 2000);
                                } else {
                                    setNotification({
                                        type: 'error',
                                        message: 'Failed to load game.'
                                    });
                                    setTimeout(() => setNotification(null), 2000);
                                }
                            }
                        });
                    }
                    break;
                case 't':
                    e.preventDefault();
                    setShowThreats(!showThreats);
                    break;
                case 'f':
                    e.preventDefault();
                    toggleFullscreen();
                    break;
                case 'p':
                    e.preventDefault();
                    setIsPanelVisible(!isPanelVisible);
                    break;
                case 'm':
                    e.preventDefault();
                    toggleMute();
                    break;
                case 'a':
                    if (isGameOver) {
                        e.preventDefault();
                        setShowAnalysis(true);
                    }
                    break;
                case '1':
                    if (gameMode === 'ai') { e.preventDefault(); setDifficulty('Easy'); }
                    break;
                case '2':
                    if (gameMode === 'ai') { e.preventDefault(); setDifficulty('Medium'); }
                    break;
                case '3':
                    if (gameMode === 'ai') { e.preventDefault(); setDifficulty('Hard'); }
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undoMove, redoMove, requestHint, resetGame, saveGame, loadGame, hasSavedGame, showThreats, setShowThreats, promotionPending, notification, toggleFullscreen, isPanelVisible]);

    // Connection status message auto-hide
    useEffect(() => {
        if (connectionStatusMessage) {
            const timer = setTimeout(() => {
                setConnectionStatusMessage(null);
            }, 3000); // Show for 3 seconds then hide
            return () => clearTimeout(timer);
        }
    }, [connectionStatusMessage]);

    // Handle move highlights from chat
    useEffect(() => {
        const handleMoveHighlight = (e: any) => {
            const moveNotation = e.detail;
            try {
                // Find potential squares for this notation
                const moves = game.moves({ verbose: true });
                const targetMove = moves.find(m => m.san === moveNotation);

                if (targetMove) {
                    setChatHighlightSquares([targetMove.from, targetMove.to]);
                    setTimeout(() => setChatHighlightSquares([]), 3000);
                } else {
                    // Coordinates detection (like 'e4')
                    const coordRegex = /^[a-h][1-8]$/;
                    if (coordRegex.test(moveNotation)) {
                        setChatHighlightSquares([moveNotation]);
                        setTimeout(() => setChatHighlightSquares([]), 3000);
                    }
                }
            } catch (err) {
                console.error('Highlight error:', err);
            }
        };

        window.addEventListener('chess-chat-move-highlight' as any, handleMoveHighlight);
        return () => window.removeEventListener('chess-chat-move-highlight' as any, handleMoveHighlight);
    }, [game]);

    // Watch for connection status changes
    useEffect(() => {
        if (gameMode === 'online') {
            if (isOpponentConnected) {
                setConnectionStatusMessage('connected');
            } else {
                setConnectionStatusMessage('disconnected');
            }
        }
    }, [isOpponentConnected, gameMode]);



    // Spectator Mode Banner
    const SpectatorBanner = () => (
        <div style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(10px)',
            padding: '10px 20px',
            borderRadius: '30px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            zIndex: 1000,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
        }}>
            <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#FFD700',
                boxShadow: '0 0 10px #FFD700'
            }} />
            <span style={{ color: 'white', fontWeight: 600, fontSize: '14px' }}>Spectator Mode</span>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>• You are watching</span>
        </div>
    );
    // Show Training Menu if active
    if (showTraining) {
        if (trainingMode === 'puzzles') {
            return <PuzzleMode onExit={() => {
                setTrainingMode('menu');
            }} />;
        }
        if (trainingMode === 'tutorial') {
            return <TutorialMode onExit={() => {
                setTrainingMode('menu');
            }} />;
        }
        return <TrainingMenu
            onSelectMode={(mode) => {
                if (mode === 'menu') {
                    setShowTraining(false);
                } else {
                    setTrainingMode(mode);
                }
            }}
            onExit={() => {
                setShowTraining(false);
                setTrainingMode('menu');
            }}
        />;
    }

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative', background: '#1a1a1a' }}>
            {isSpectator && <SpectatorBanner />}
            <Canvas shadows camera={{ position: [0, 8, 8], fov: 45 }}>
                <color attach="background" args={['#1a1a1a']} />
                <React.Suspense fallback={null}>
                    <Scene
                        onMove={makeMove}
                        turn={turn}
                        getPossibleMoves={getPossibleMoves}
                        pieces={pieces}
                        lastMove={lastMove}
                        checkSquare={checkSquare}
                        playerColor={playerColor}
                        hintMove={hintMove}
                        attackedSquares={attackedSquares}
                        opponentSelection={opponentSelection}
                        isSpectator={isSpectator}
                        chatHighlightSquares={chatHighlightSquares}
                        pieceTheme={pieceTheme}
                        environmentPreset={environment}
                    />
                </React.Suspense>
            </Canvas>

            {/* Evaluation Bar */}
            <div style={{
                position: 'absolute',
                left: '20px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '20px',
                height: '60vh',
                background: '#333',
                borderRadius: '10px',
                overflow: 'hidden',
                border: '2px solid rgba(255,255,255,0.2)',
                boxShadow: '0 0 20px rgba(0,0,0,0.5)'
            }}>
                <div style={{
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(to top, #000 0%, #fff 100%)',
                    opacity: 0.2,
                    position: 'absolute'
                }} />
                {/* White bar height based on eval. Eval 0 = 50%, ±20 = 0-100% */}
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    width: '100%',
                    height: `${Math.min(100, Math.max(0, 50 + (evaluation * 2.5)))}%`,
                    background: '#fff',
                    transition: 'height 0.5s ease'
                }} />
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: 0,
                    width: '100%',
                    height: '2px',
                    background: 'rgba(255,0,0,0.5)',
                    zIndex: 10
                }} />
                <div style={{ position: 'absolute', top: '5px', width: '100%', textAlign: 'center', fontSize: '10px', color: '#000', fontWeight: 'bold', zIndex: 11, pointerEvents: 'none' }}>W</div>
                <div style={{ position: 'absolute', bottom: '5px', width: '100%', textAlign: 'center', fontSize: '10px', color: '#fff', fontWeight: 'bold', zIndex: 11, pointerEvents: 'none' }}>B</div>
            </div>

            {/* Floating Show Panel Button (when hidden) */}
            {!isPanelVisible && (
                <button
                    onClick={() => setIsPanelVisible(true)}
                    style={{
                        position: 'absolute',
                        top: 30,
                        left: 20,
                        background: 'rgba(255, 255, 255, 0.1)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '8px',
                        padding: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s',
                        zIndex: 100,
                        boxShadow: '0 4px 16px 0 rgba(0, 0, 0, 0.37)'
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                        e.currentTarget.style.transform = 'scale(1.05)';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                        e.currentTarget.style.transform = 'scale(1)';
                    }}
                    title="Show Panel (P)"
                >
                    <ChevronRight size={20} color="white" />
                </button>
            )}

            {/* Glassmorphism UI Overlay - Left Panel (Controls) */}
            <div style={{
                position: 'absolute',
                top: 30,
                left: isPanelVisible ? 60 : -400,
                color: 'white',
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                padding: '24px',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
                fontFamily: "'Inter', sans-serif",
                minWidth: '200px',
                transition: 'left 0.3s ease',
                zIndex: 100,
                maxHeight: 'calc(100vh - 60px)',
                overflowY: 'auto',
                scrollbarWidth: 'none', // Hide scrollbar for Firefox
                msOverflowStyle: 'none',  // Hide scrollbar for IE/Edge
                boxSizing: 'border-box'
            }}>
                <style>{`
                    div::-webkit-scrollbar {
                        display: none; /* Hide scrollbar for Chrome/Safari/Opera */
                    }
                `}</style>
                {/* Toggle Button */}
                <button
                    onClick={() => setIsPanelVisible(!isPanelVisible)}
                    style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '6px',
                        padding: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s',
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                    }}
                    title="Hide Panel (P)"
                >
                    <ChevronLeft size={16} />
                </button>

                {/* Fullscreen Button */}
                <button
                    onClick={toggleFullscreen}
                    style={{
                        position: 'absolute',
                        top: '12px',
                        right: '44px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '6px',
                        padding: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s',
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                    }}
                    title={isFullscreen ? "Exit Fullscreen (F)" : "Enter Fullscreen (F)"}
                >
                    {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                </button>
                <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', fontWeight: 600, letterSpacing: '-0.5px' }}>Chess 3D</h2>

                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: turn === 'w' ? '#fff' : '#333',
                        border: turn === 'w' ? 'none' : '1px solid #666',
                        marginRight: '10px',
                        boxShadow: turn === 'w' ? '0 0 10px rgba(255,255,255,0.5)' : 'none'
                    }} />
                    <span style={{ fontSize: '16px', fontWeight: 500 }}>
                        {turn === 'w' ? "White's Turn" : "Black's Turn"}
                    </span>
                </div>

                {/* Clocks */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', gap: '10px' }}>
                    <div style={{
                        background: turn === 'w' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                        padding: '8px', borderRadius: '8px', flex: 1, textAlign: 'center',
                        border: turn === 'w' ? '1px solid rgba(255,255,255,0.5)' : '1px solid transparent'
                    }}>
                        <div style={{ fontSize: '10px', opacity: 0.7 }}>White</div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{formatTime(whiteTime)}</div>
                        <div style={{ marginTop: '4px' }}>
                            <CapturedPieces pieces={capturedPieces.white} score={materialAdvantage > 0 ? materialAdvantage : undefined} />
                        </div>
                    </div>
                    <div style={{
                        background: turn === 'b' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                        padding: '8px', borderRadius: '8px', flex: 1, textAlign: 'center',
                        border: turn === 'b' ? '1px solid rgba(255,255,255,0.5)' : '1px solid transparent'
                    }}>
                        <div style={{ fontSize: '10px', opacity: 0.7 }}>Black</div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{formatTime(blackTime)}</div>
                        <div style={{ marginTop: '4px' }}>
                            <CapturedPieces pieces={capturedPieces.black} score={materialAdvantage < 0 ? -materialAdvantage : undefined} />
                        </div>
                    </div>
                </div>

                {/* Connection Status - Permanent indicator in left panel */}
                {gameMode === 'online' && (
                    <div style={{
                        marginBottom: '12px',
                        padding: '8px 12px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: isOpponentConnected ? '#4ade80' : '#ef4444',
                            boxShadow: isOpponentConnected ? '0 0 8px #4ade80' : 'none',
                            transition: 'all 0.3s ease'
                        }} />
                        <div style={{
                            fontSize: '12px',
                            opacity: 0.8
                        }}>
                            {isOpponentConnected ? 'Connected' : 'Waiting...'}
                        </div>
                    </div>
                )}

                {/* Opening Display */}
                {opening && (
                    <div style={{
                        marginBottom: '16px',
                        padding: '8px 12px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '10px', opacity: 0.6, marginBottom: '2px' }}>Opening</div>
                        <div style={{ fontSize: '13px', fontWeight: 500 }}>{opening.name}</div>
                        <div style={{ fontSize: '10px', opacity: 0.5, marginTop: '2px' }}>{opening.eco}</div>
                    </div>
                )}

                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>Game Mode</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={() => setGameMode('ai')}
                            style={{
                                flex: 1,
                                padding: '8px',
                                background: gameMode === 'ai' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
                                color: 'white',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '14px'
                            }}
                        >
                            vs AI
                        </button>
                        <button
                            onClick={() => setGameMode('local')}
                            style={{
                                flex: 1,
                                padding: '8px',
                                background: gameMode === 'local' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
                                color: 'white',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '14px'
                            }}
                        >
                            vs Friend
                        </button>
                        <button
                            onClick={() => setShowMultiplayerMenu(true)}
                            style={{
                                flex: 1,
                                padding: '8px',
                                background: gameMode === 'online' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
                                color: 'white',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px'
                            }}
                        >
                            <Users size={14} />
                            Online
                        </button>
                    </div>
                    {/* Training Button */}
                    <button
                        onClick={() => setShowTraining(true)}
                        style={{
                            width: '100%',
                            marginTop: '8px',
                            padding: '10px',
                            background: 'linear-gradient(135deg, rgba(96, 165, 250, 0.3), rgba(167, 139, 250, 0.3))',
                            color: 'white',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 500,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, rgba(96, 165, 250, 0.5), rgba(167, 139, 250, 0.5))'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, rgba(96, 165, 250, 0.3), rgba(167, 139, 250, 0.3))'}
                    >
                        <GraduationCap size={16} />
                        Training Center
                    </button>
                </div>

                {gameMode === 'ai' && (
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>Difficulty</label>
                        <select
                            value={difficulty}
                            onChange={(e) => setDifficulty(e.target.value as any)}
                            style={{
                                width: '100%',
                                padding: '8px',
                                background: 'rgba(0, 0, 0, 0.3)',
                                color: 'white',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                borderRadius: '8px',
                                outline: 'none',
                                cursor: 'pointer',
                                fontSize: '14px'
                            }}
                        >
                            <option value="Easy">Easy</option>
                            <option value="Medium">Medium</option>
                            <option value="Hard">Hard</option>
                        </select>
                    </div>
                )}

                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>Time Control</label>
                    <select
                        value={initialTime}
                        onChange={(e) => {
                            const newTime = parseInt(e.target.value);
                            setInitialTime(newTime);
                            // Optional: Automatically reset game or notify user that it applies to next game
                            // For now, let's just update the state. The user has to click Reset to apply it if game is in progress.
                        }}
                        style={{
                            width: '100%',
                            padding: '8px',
                            background: 'rgba(0, 0, 0, 0.3)',
                            color: 'white',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '8px',
                            outline: 'none',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        <option value={60}>1 min (Bullet)</option>
                        <option value={180}>3 min (Blitz)</option>
                        <option value={300}>5 min (Blitz)</option>
                        <option value={600}>10 min (Rapid)</option>
                        <option value={1800}>30 min (Classical)</option>
                        <option value={3600}>60 min</option>
                    </select>
                </div>

                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>Volume</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                            onClick={toggleMute}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'white',
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                            title={isMuted ? "Unmute" : "Mute"}
                        >
                            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                        </button>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={isMuted ? 0 : volume}
                            onChange={(e) => {
                                if (isMuted) toggleMute();
                                setVolume(parseFloat(e.target.value));
                            }}
                            style={{
                                flex: 1,
                                cursor: 'pointer',
                                accentColor: '#4CAF50'
                            }}
                        />
                    </div>


                </div>

                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>Piece Theme</label>
                    <select
                        value={pieceTheme}
                        onChange={(e) => setPieceTheme(e.target.value as any)}
                        style={{
                            width: '100%',
                            padding: '8px',
                            background: 'rgba(0, 0, 0, 0.3)',
                            color: 'white',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '8px',
                            outline: 'none',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        <option value="glass">Glass (Default)</option>
                        <option value="metal">Metallic (Gold/Silver)</option>
                        <option value="marble">Marble (Classic)</option>
                        <option value="wood">Wooden (Natural)</option>
                    </select>
                </div>

                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>Environment</label>
                    <select
                        value={environment}
                        onChange={(e) => setEnvironment(e.target.value as any)}
                        style={{
                            width: '100%',
                            padding: '8px',
                            background: 'rgba(0, 0, 0, 0.3)',
                            color: 'white',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '8px',
                            outline: 'none',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        <option value="apartment">Apartment</option>
                        <option value="city">City</option>
                        <option value="dawn">Dawn</option>
                        <option value="forest">Forest</option>
                        <option value="lobby">Lobby</option>
                        <option value="night">Night</option>
                        <option value="park">Park</option>
                        <option value="studio">Studio</option>
                        <option value="sunset">Sunset</option>
                        <option value="warehouse">Warehouse</option>
                    </select>
                </div>

                <div style={{
                    marginBottom: '24px',
                    padding: '16px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Trophy size={16} className="text-yellow-500" />
                        Your Statistics
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Wins</p>
                            <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#4ade80' }}>{stats.wins}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Losses</p>
                            <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#f87171' }}>{stats.losses}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Draws</p>
                            <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#a78bfa' }}>{stats.draws}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Total</p>
                            <p style={{ fontSize: '18px', fontWeight: 'bold', color: 'white' }}>{stats.totalGames}</p>
                        </div>
                    </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>
                        {gameMode === 'ai' ? 'Play As' : 'Board Orientation'}
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={() => setPlayerColor('w')}
                            style={{
                                flex: 1,
                                padding: '8px',
                                background: playerColor === 'w' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
                                color: 'white',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '14px'
                            }}
                        >
                            White
                        </button>
                        <button
                            onClick={() => setPlayerColor('b')}
                            style={{
                                flex: 1,
                                padding: '8px',
                                background: playerColor === 'b' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
                                color: 'white',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '14px'
                            }}
                        >
                            Black
                        </button>
                    </div>
                </div>

                {/* Game Controls - Hide in Spectator Mode */}
                {!isSpectator && (
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                        <button
                            onClick={undoMove}
                            title="Undo Move (←)"
                            style={{
                                flex: 1, padding: '8px', cursor: 'pointer',
                                background: 'rgba(255, 255, 255, 0.1)', color: 'white',
                                border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '8px',
                                display: 'flex', justifyContent: 'center', alignItems: 'center'
                            }}
                        >
                            <RotateCcw size={14} />
                        </button>
                        <button
                            onClick={redoMove}
                            title="Redo Move (→)"
                            style={{
                                flex: 1, padding: '8px', cursor: 'pointer',
                                background: 'rgba(255, 255, 255, 0.1)', color: 'white',
                                border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '8px',
                                display: 'flex', justifyContent: 'center', alignItems: 'center'
                            }}
                        >
                            <RotateCw size={14} />
                        </button>
                    </div>
                )}

                {/* Hint & Analysis Controls */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <button
                        onClick={requestHint}
                        title="Get a Hint (H)"
                        style={{
                            flex: 1, padding: '8px', cursor: 'pointer',
                            background: showHint ? 'rgba(255, 215, 0, 0.5)' : 'rgba(255, 215, 0, 0.2)',
                            color: '#FFD700',
                            border: showHint ? '1px solid rgba(255, 215, 0, 0.8)' : '1px solid rgba(255, 215, 0, 0.4)',
                            borderRadius: '8px',
                            display: 'flex', justifyContent: 'center', alignItems: 'center',
                            fontSize: '14px', fontWeight: 600,
                            boxShadow: showHint ? '0 0 10px rgba(255, 215, 0, 0.3)' : 'none'
                        }}
                    >
                        {showHint ? 'Hide Hint' : '💡 Hint'}
                    </button>
                    <button
                        onClick={() => setShowThreats(!showThreats)}
                        title="Toggle Threat Indicators (T)"
                        style={{
                            flex: 1, padding: '8px', cursor: 'pointer',
                            background: showThreats ? 'rgba(255, 50, 50, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                            color: showThreats ? '#ffaaaa' : 'white',
                            border: showThreats ? '1px solid rgba(255, 50, 50, 0.5)' : '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '8px',
                            display: 'flex', justifyContent: 'center', alignItems: 'center',
                            fontSize: '14px'
                        }}
                    >
                        {showThreats ? 'Hide Threats' : 'Show Threats'}
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <button
                        onClick={() => setSaveLoadMode('save')}
                        title="Save Game (S)"
                        style={{
                            flex: 1, padding: '8px', cursor: 'pointer',
                            background: 'rgba(255, 255, 255, 0.1)', color: 'white',
                            border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '8px',
                            display: 'flex', justifyContent: 'center', alignItems: 'center',
                            fontSize: '14px', fontWeight: 500
                        }}
                    >
                        <Save size={16} style={{ marginRight: '6px' }} />
                        Save
                    </button>
                    <button
                        onClick={() => setSaveLoadMode('load')}
                        title="Load Game (L)"
                        style={{
                            flex: 1, padding: '8px', cursor: hasSavedGame ? 'pointer' : 'not-allowed',
                            background: hasSavedGame ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                            color: hasSavedGame ? '#81c784' : 'rgba(255, 255, 255, 0.5)',
                            border: hasSavedGame ? '1px solid rgba(76, 175, 80, 0.4)' : '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '8px',
                            display: 'flex', justifyContent: 'center', alignItems: 'center',
                            fontSize: '14px', fontWeight: 500
                        }}
                        disabled={!hasSavedGame}
                    >
                        <Upload size={16} style={{ marginRight: '6px' }} />
                        Load
                    </button>
                </div>

                {!isSpectator && (
                    <button
                        onClick={resetGame}
                        title="Reset Game (R)"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                            padding: '8px 12px',
                            cursor: 'pointer',
                            background: 'rgba(255, 255, 255, 0.1)',
                            color: 'white',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '8px',
                            fontWeight: 500,
                            fontSize: '14px',
                            transition: 'all 0.2s ease',
                            marginBottom: '12px'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                    >
                        <RotateCcw size={14} style={{ marginRight: '8px' }} />
                        Reset Game
                    </button>
                )}

                {/* PGN Import/Export */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <button
                        onClick={() => setPGNMode('export')}
                        title="Export PGN"
                        style={{
                            flex: 1, padding: '8px', cursor: 'pointer',
                            background: 'rgba(255, 255, 255, 0.1)', color: 'white',
                            border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '8px',
                            display: 'flex', justifyContent: 'center', alignItems: 'center',
                            fontSize: '14px', fontWeight: 500
                        }}
                    >
                        <Download size={16} style={{ marginRight: '6px' }} />
                        Export
                    </button>
                    <button
                        onClick={() => setPGNMode('import')}
                        title="Import PGN"
                        style={{
                            flex: 1, padding: '8px', cursor: 'pointer',
                            background: 'rgba(255, 255, 255, 0.1)', color: 'white',
                            border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '8px',
                            display: 'flex', justifyContent: 'center', alignItems: 'center',
                            fontSize: '14px', fontWeight: 500
                        }}
                    >
                        <Upload size={16} style={{ marginRight: '6px' }} />
                        Import
                    </button>
                </div>
            </div>

            {/* Right Panel - Move History */}
            <div style={{
                position: 'absolute',
                top: 30,
                right: 30,
                width: '200px',
                maxHeight: '200px',
                color: 'white',
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                padding: '20px',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
                fontFamily: "'Inter', sans-serif",
                display: 'flex',
                flexDirection: 'column'
            }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>Move History</h3>
                <div className="glass-scrollbar" style={{ overflowY: 'auto', flex: 1, paddingRight: '5px' }}>
                    <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                        <tbody>
                            {Array.from({ length: Math.ceil(history.length / 2) }).map((_, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '4px', color: 'rgba(255,255,255,0.5)', width: '30px' }}>{i + 1}.</td>
                                    <td style={{ padding: '4px' }}>{history[i * 2]}</td>
                                    <td style={{ padding: '4px' }}>{history[i * 2 + 1] || ''}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {history.length === 0 && <div style={{ textAlign: 'center', opacity: 0.5, padding: '20px' }}>No moves yet</div>}
                </div>
            </div>

            {/* Promotion Modal - Centered on Screen */}
            {
                promotionPending && (
                    <div style={{
                        position: 'fixed',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        background: 'rgba(0, 0, 0, 0.6)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        padding: '30px',
                        borderRadius: '20px',
                        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        zIndex: 1000,
                        textAlign: 'center'
                    }}>
                        <h3 style={{ margin: '0 0 20px 0', color: '#fff', fontSize: '24px', fontWeight: 'bold' }}>Promote Pawn</h3>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            {[
                                { type: 'q', symbol: '♛', color: 'linear-gradient(135deg, #FFD700, #FFA500)', name: 'Queen' },
                                { type: 'r', symbol: '♜', color: 'linear-gradient(135deg, #4169E1, #1E90FF)', name: 'Rook' },
                                { type: 'b', symbol: '♝', color: 'linear-gradient(135deg, #9370DB, #8A2BE2)', name: 'Bishop' },
                                { type: 'n', symbol: '♞', color: 'linear-gradient(135deg, #32CD32, #228B22)', name: 'Knight' }
                            ].map((piece) => (
                                <button
                                    key={piece.type}
                                    onClick={() => onPromotionSelect(piece.type)}
                                    title={piece.name}
                                    style={{
                                        padding: '0',
                                        fontSize: '36px',
                                        cursor: 'pointer',
                                        background: piece.color,
                                        border: '3px solid rgba(255, 255, 255, 0.3)',
                                        borderRadius: '12px',
                                        width: '70px',
                                        height: '70px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s',
                                        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
                                        color: '#fff',
                                        textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)'
                                    }}
                                    onMouseOver={(e) => {
                                        e.currentTarget.style.transform = 'scale(1.1)';
                                        e.currentTarget.style.boxShadow = '0 6px 25px rgba(255, 255, 255, 0.3)';
                                    }}
                                    onMouseOut={(e) => {
                                        e.currentTarget.style.transform = 'scale(1)';
                                        e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3)';
                                    }}
                                >
                                    {piece.symbol}
                                </button>
                            ))}
                        </div>
                    </div>
                )
            }

            {/* Notification Modal */}
            {
                notification && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        background: 'rgba(0, 0, 0, 0.6)',
                        backdropFilter: 'blur(5px)',
                        zIndex: 3000,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        animation: 'modalScale 0.3s ease-out'
                    }}>
                        <div style={{
                            background: 'rgba(30, 30, 30, 0.9)',
                            backdropFilter: 'blur(20px)',
                            padding: '30px',
                            borderRadius: '20px',
                            border: `2px solid ${notification.type === 'success' ? '#4CAF50' : notification.type === 'error' ? '#f44336' : '#FFD700'}`,
                            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
                            textAlign: 'center',
                            minWidth: '300px',
                            maxWidth: '400px'
                        }}>
                            <div style={{
                                width: '60px',
                                height: '60px',
                                borderRadius: '50%',
                                background: notification.type === 'success' ? 'rgba(76, 175, 80, 0.2)' : notification.type === 'error' ? 'rgba(244, 67, 54, 0.2)' : 'rgba(255, 215, 0, 0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 20px auto',
                                color: notification.type === 'success' ? '#4CAF50' : notification.type === 'error' ? '#f44336' : '#FFD700'
                            }}>
                                {notification.type === 'success' ? <Check size={32} /> : notification.type === 'error' ? <X size={32} /> : <AlertTriangle size={32} />}
                            </div>

                            <h3 style={{ margin: '0 0 10px 0', fontSize: '20px', color: 'white' }}>
                                {notification.type === 'success' ? 'Success' : notification.type === 'error' ? 'Error' : 'Confirm Action'}
                            </h3>

                            <p style={{ margin: '0 0 24px 0', color: 'rgba(255, 255, 255, 0.8)', fontSize: '16px' }}>
                                {notification.message}
                            </p>

                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                                {notification.type === 'confirm' ? (
                                    <>
                                        <button
                                            onClick={() => setNotification(null)}
                                            style={{
                                                padding: '10px 20px',
                                                borderRadius: '8px',
                                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                                background: 'transparent',
                                                color: 'white',
                                                cursor: 'pointer',
                                                fontSize: '14px',
                                                fontWeight: 500
                                            }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={() => {
                                                notification.onConfirm?.();
                                                // Don't close immediately if we want to show success message
                                            }}
                                            style={{
                                                padding: '10px 20px',
                                                borderRadius: '8px',
                                                border: 'none',
                                                background: '#FFD700',
                                                color: 'black',
                                                cursor: 'pointer',
                                                fontSize: '14px',
                                                fontWeight: 600
                                            }}
                                        >
                                            Confirm
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => setNotification(null)}
                                        style={{
                                            padding: '10px 30px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            background: notification.type === 'success' ? '#4CAF50' : '#f44336',
                                            color: 'white',
                                            cursor: 'pointer',
                                            fontSize: '14px',
                                            fontWeight: 600
                                        }}
                                    >
                                        Close
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Game Over Modal */}
            {
                isGameOver && !showAnalysis && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        background: 'rgba(0, 0, 0, 0.7)',
                        backdropFilter: 'blur(8px)',
                        zIndex: 2000,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}>
                        <div style={{
                            background: 'rgba(20, 20, 20, 0.9)',
                            backdropFilter: 'blur(20px)',
                            padding: '50px 70px',
                            borderRadius: '24px',
                            border: '2px solid rgba(255, 255, 255, 0.15)',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
                            textAlign: 'center'
                        }}>
                            {/* Inject CSS animations */}
                            <style>{animationStyles}</style>

                            <Trophy size={80} style={{
                                marginBottom: '20px',
                                color: winner === 'Draw' ? '#AAA' : '#FFD700',
                                animation: winner === 'Draw'
                                    ? 'drawFloat 3s ease-in-out infinite'
                                    : winner === 'White' || winner === 'Black'
                                        ? 'victoryBounce 2s ease-in-out infinite, victoryPulse 2s ease-in-out infinite'
                                        : 'lossShake 0.5s ease-in-out infinite'
                            }} />

                            <h2 style={{
                                fontSize: '48px',
                                fontWeight: '800',
                                margin: '0 0 10px 0',
                                background: 'linear-gradient(135deg, #FFF 0%, #CCC 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                letterSpacing: '-1px'
                            }}>
                                {winner === 'Draw' ? 'Draw!' : 'Victory!'}
                            </h2>

                            <p style={{
                                fontSize: '24px',
                                color: 'rgba(255, 255, 255, 0.8)',
                                margin: '0 0 40px 0',
                                fontWeight: '500'
                            }}>
                                {winner === 'Draw' ? 'Game ended in a draw' : `${winner} wins the game!`}
                            </p>

                            <button
                                onClick={resetGame}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 12px 24px rgba(76, 175, 80, 0.4)';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                                }}
                                style={{
                                    background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
                                    color: 'white',
                                    border: 'none',
                                    padding: '18px 40px',
                                    fontSize: '18px',
                                    fontWeight: '600',
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    transition: 'all 0.2s ease',
                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                                    marginRight: '15px'
                                }}
                            >
                                <RotateCcw size={20} />
                                Play Again
                            </button>

                            <button
                                onClick={() => setShowAnalysis(true)}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 12px 24px rgba(33, 150, 243, 0.4)';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                                }}
                                style={{
                                    background: 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)',
                                    color: 'white',
                                    border: 'none',
                                    padding: '18px 40px',
                                    fontSize: '18px',
                                    fontWeight: '600',
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    transition: 'all 0.2s ease',
                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
                                }}
                            >
                                📊 Analyze Game
                            </button>
                        </div>
                    </div>
                )
            }

            {/* Game Analysis Modal */}
            {
                showAnalysis && (
                    <GameAnalysis
                        pgn={game.pgn()}
                        winner={winner}
                        onClose={() => setShowAnalysis(false)}
                        onNavigateToMove={navigateToMove}
                    />
                )
            }

            <div style={{
                position: 'absolute',
                bottom: 20,
                right: 20,
                color: 'rgba(255,255,255,0.5)',
                fontSize: '12px',
                fontFamily: 'monospace'
            }}>
                Made with 💖 by{' '}
                <span
                    onClick={async () => {
                        try {
                            console.log('Attempting to open URL...');
                            await open('https://www.facebook.com/LegendCoder');
                            console.log('URL opened successfully');
                        } catch (error) {
                            console.error('Error opening URL:', error);
                            alert('Error opening link: ' + error);
                        }
                    }}
                    style={{
                        color: 'rgba(255,255,255,0.8)',
                        cursor: 'pointer',
                        textDecoration: 'underline'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.color = 'rgba(255,255,255,1)'}
                    onMouseOut={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
                >
                    Nayeem
                </span>
            </div>

            {/* Save/Load Modal */}
            {
                saveLoadMode && (
                    <SaveLoadModal
                        mode={saveLoadMode}
                        onClose={() => setSaveLoadMode(null)}
                        onSave={(slotIndex) => {
                            if (saveGame(slotIndex)) {
                                setNotification({
                                    type: 'success',
                                    message: `Game saved to Slot ${slotIndex + 1}!`
                                });
                                setTimeout(() => setNotification(null), 2000);
                            }
                            setSaveLoadMode(null);
                        }}
                        onLoad={(slotIndex) => {
                            if (loadGame(slotIndex)) {
                                setNotification({
                                    type: 'success',
                                    message: `Game loaded from Slot ${slotIndex + 1}!`
                                });
                                setTimeout(() => setNotification(null), 2000);
                            } else {
                                setNotification({
                                    type: 'error',
                                    message: 'Failed to load game.'
                                });
                                setTimeout(() => setNotification(null), 2000);
                            }
                            setSaveLoadMode(null);
                        }}
                        onDelete={(slotIndex) => {
                            deleteSave(slotIndex);
                            setNotification({
                                type: 'success',
                                message: `Slot ${slotIndex + 1} deleted!`
                            });
                            setTimeout(() => setNotification(null), 2000);
                        }}
                    />
                )
            }

            {/* PGN Modal */}
            {
                pgnMode && (
                    <PGNModal
                        mode={pgnMode}
                        currentPGN={game.pgn()}
                        onClose={() => setPGNMode(null)}
                        onImport={(pgn) => {
                            const success = importPGN(pgn);
                            if (success) {
                                setNotification({
                                    type: 'success',
                                    message: 'Game imported successfully!'
                                });
                                setTimeout(() => setNotification(null), 2000);
                            }
                            return success;
                        }}
                    />
                )
            }
            {/* Multiplayer Menu */}
            {
                showMultiplayerMenu && (
                    <MultiplayerMenu
                        onClose={() => setShowMultiplayerMenu(false)}
                        onGameStart={(isHost, role) => {
                            setShowMultiplayerMenu(false);
                            setGameMode('online');

                            if (role === 'spectator') {
                                setIsSpectator(true);
                                // Spectators usually watch from white's perspective or neutral?
                                // Let's default to white for now, or maybe we can add a toggle later.
                                setPlayerColor('w');
                            } else {
                                setIsSpectator(false);
                                setPlayerColor(isHost ? 'w' : 'b');
                            }

                            resetGame();
                            setNotification({
                                type: 'success',
                                message: role === 'spectator' ? 'Joined as Spectator' : (isHost ? 'Game Started! You are White.' : 'Connected! You are Black.')
                            });
                            setTimeout(() => setNotification(null), 3000);
                        }}
                    />
                )
            }

            {/* Temporary Connection Status Popup - Right side, shows for 3 seconds */}
            {
                gameMode === 'online' && connectionStatusMessage && (
                    <div style={{
                        position: 'fixed',
                        top: '20px',
                        right: '20px',
                        background: connectionStatusMessage === 'connected'
                            ? 'linear-gradient(135deg, rgba(76, 175, 80, 0.25), rgba(76, 175, 80, 0.15))'
                            : 'linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(239, 68, 68, 0.15))',
                        backdropFilter: 'blur(10px)',
                        padding: '12px 18px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        color: 'white',
                        fontSize: '14px',
                        fontWeight: 600,
                        border: `2px solid ${connectionStatusMessage === 'connected' ? 'rgba(76, 175, 80, 0.5)' : 'rgba(239, 68, 68, 0.5)'}`,
                        boxShadow: connectionStatusMessage === 'connected'
                            ? '0 4px 20px rgba(76, 175, 80, 0.3)'
                            : '0 4px 20px rgba(239, 68, 68, 0.3)',
                        zIndex: 3000
                    }}>
                        <div style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: connectionStatusMessage === 'connected' ? '#4ade80' : '#ef4444',
                            boxShadow: connectionStatusMessage === 'connected'
                                ? '0 0 12px #4ade80'
                                : '0 0 12px #ef4444'
                        }} />
                        <span style={{
                            color: connectionStatusMessage === 'connected' ? '#4ade80' : '#ef4444'
                        }}>
                            {connectionStatusMessage === 'connected' ? 'Opponent Connected' : 'Opponent Disconnected'}
                        </span>
                    </div>
                )
            }

            {/* Encrypted Chat */}
            {
                gameMode === 'online' && (
                    <Chat
                        isOpen={isChatOpen}
                        onToggle={() => setIsChatOpen(!isChatOpen)}
                        isOpponentConnected={isOpponentConnected}
                        members={members}
                        myId={myId}
                    />
                )
            }
        </div >
    );
};

export default Game;
