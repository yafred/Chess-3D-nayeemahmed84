// Puzzle Mode Component - Full puzzle solving interface

import React, { useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from './Scene';
import { usePuzzle } from '../hooks/usePuzzle';
import { Square } from 'chess.js';
import { PieceState } from '../hooks/useChessGame';
import {
    ChevronLeft,
    ChevronRight,
    Lightbulb,
    RotateCcw,
    Trophy,
    Target,
    CheckCircle,
    XCircle,
    ArrowLeft,
    Filter,
    Zap
} from 'lucide-react';
import { puzzleThemeLabels, PuzzleTheme, difficultyLevels } from '../data/puzzleData';

interface PuzzleModeProps {
    onExit: () => void;
}

// Glassmorphism styles
const glassStyle: React.CSSProperties = {
    background: 'rgba(30, 30, 40, 0.85)',
    backdropFilter: 'blur(10px)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
};

const buttonStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '8px',
    color: 'white',
    padding: '8px 16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s ease'
};

export function PuzzleMode({ onExit }: PuzzleModeProps) {
    const {
        puzzle,
        game,
        status,
        currentMoveIndex,
        attempts,
        showingHint,
        lastMove,
        isCorrectMove,
        currentIndex,
        totalPuzzles,
        hasNext,
        hasPrev,
        stats,
        getDifficultyInfo,
        isPuzzleSolved,
        filters,
        applyFilters,
        startPuzzles,
        showHint,
        nextPuzzle,
        prevPuzzle,
        resetPuzzle,
        makeMove
    } = usePuzzle();

    const [showFilters, setShowFilters] = React.useState(false);

    // Start puzzles on mount
    useEffect(() => {
        startPuzzles();
    }, [startPuzzles]);

    const difficultyInfo = getDifficultyInfo();

    // Build board data for Scene - properly typed as PieceState[]
    const getPieces = useCallback((): PieceState[] => {
        if (!game) return [];
        const board = game.board();
        const pieces: PieceState[] = [];

        board.forEach((row, rowIndex) => {
            row.forEach((piece, colIndex) => {
                if (piece) {
                    const file = String.fromCharCode(97 + colIndex);
                    const rank = String(8 - rowIndex);
                    const square = `${file}${rank}` as Square;
                    pieces.push({
                        id: `${piece.color}${piece.type}${square}`,
                        type: piece.type,
                        color: piece.color,
                        square
                    });
                }
            });
        });

        return pieces;
    }, [game]);

    // Get valid moves for Scene (returns string[] of squares)
    const getPossibleMoves = useCallback((square: Square): string[] => {
        if (!game || !puzzle || status !== 'playing') return [];
        // Only allow player color's pieces
        const piece = game.get(square);
        if (!piece || piece.color !== puzzle.playerColor) return [];
        const moves = game.moves({ square, verbose: true });
        return moves.map(m => m.to);
    }, [game, puzzle, status]);

    // Handle move from Scene (from, to)
    const handleMove = useCallback((from: Square, to: Square): boolean => {
        if (status !== 'playing' || !puzzle) return false;
        // Only allow player color to move
        const piece = game.get(from);
        if (!piece || piece.color !== puzzle.playerColor) return false;
        makeMove(from, to);
        return true;
    }, [status, puzzle, game, makeMove]);

    // Get hint move for highlighting
    const getHintMove = useCallback(() => {
        if (!puzzle || !showingHint || status !== 'playing') return null;
        const expectedMove = puzzle.moves[currentMoveIndex];
        if (!expectedMove) return null;
        const from = expectedMove.slice(0, 2) as Square;
        const to = expectedMove.slice(2, 4) as Square;
        return { from, to };
    }, [puzzle, showingHint, status, currentMoveIndex]);

    // Get check square
    const getCheckSquare = useCallback((): Square | null => {
        if (!game || !game.isCheck()) return null;
        const board = game.board();
        const kingColor = game.turn();
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = board[r][c];
                if (piece && piece.type === 'k' && piece.color === kingColor) {
                    return `${String.fromCharCode(97 + c)}${8 - r}` as Square;
                }
            }
        }
        return null;
    }, [game]);

    // Theme filter buttons
    const themeOptions: PuzzleTheme[] = [
        'mateIn1', 'mateIn2', 'fork', 'pin', 'skewer',
        'discoveredAttack', 'backRankMate', 'sacrifice'
    ];

    return (
        <div style={{ width: '100vw', height: '100vh', display: 'flex', background: '#111' }}>
            {/* Left Panel - Puzzle Info */}
            <div style={{
                width: '320px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                overflowY: 'auto'
            }}>
                {/* Header */}
                <div style={{ ...glassStyle, padding: '16px' }}>
                    <button
                        onClick={onExit}
                        style={{
                            ...buttonStyle,
                            background: 'transparent',
                            border: 'none',
                            padding: '4px 8px',
                            marginBottom: '12px'
                        }}
                    >
                        <ArrowLeft size={18} />
                        Back to Training
                    </button>
                    <h2 style={{
                        margin: 0,
                        color: 'white',
                        fontSize: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <Target size={24} style={{ color: '#60a5fa' }} />
                        Chess Puzzles
                    </h2>
                </div>

                {/* Current Puzzle Info */}
                {puzzle && (
                    <div style={{ ...glassStyle, padding: '16px' }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '12px'
                        }}>
                            <span style={{ color: '#9ca3af', fontSize: '14px' }}>
                                Puzzle {currentIndex + 1} of {totalPuzzles}
                            </span>
                            {isPuzzleSolved(puzzle.id) && (
                                <CheckCircle size={18} style={{ color: '#4ade80' }} />
                            )}
                        </div>

                        {puzzle.title && (
                            <h3 style={{ margin: '0 0 12px 0', color: 'white', fontSize: '18px' }}>
                                {puzzle.title}
                            </h3>
                        )}

                        {difficultyInfo && (
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                background: `${difficultyInfo.color}22`,
                                border: `1px solid ${difficultyInfo.color}44`,
                                marginBottom: '12px'
                            }}>
                                <Zap size={14} style={{ color: difficultyInfo.color }} />
                                <span style={{ color: difficultyInfo.color, fontSize: '13px' }}>
                                    {difficultyInfo.label} ({puzzle.rating})
                                </span>
                            </div>
                        )}

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {puzzle.themes.map(theme => (
                                <span key={theme} style={{
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    background: 'rgba(96, 165, 250, 0.2)',
                                    color: '#60a5fa',
                                    fontSize: '12px'
                                }}>
                                    {puzzleThemeLabels[theme] || theme}
                                </span>
                            ))}
                        </div>

                        <div style={{
                            marginTop: '12px',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: puzzle.playerColor === 'w' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.3)',
                            color: 'white',
                            fontSize: '14px'
                        }}>
                            {puzzle.playerColor === 'w' ? '⬜ White to play' : '⬛ Black to play'}
                        </div>
                    </div>
                )}

                {/* Status Message */}
                <div style={{ ...glassStyle, padding: '16px', textAlign: 'center' }}>
                    {status === 'playing' && !showingHint && (
                        <p style={{ color: '#9ca3af', margin: 0 }}>Find the best move!</p>
                    )}
                    {status === 'playing' && showingHint && (
                        <p style={{ color: '#facc15', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <Lightbulb size={16} />Hint: Move highlighted piece
                        </p>
                    )}
                    {status === 'correct' && (
                        <p style={{ color: '#4ade80', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <CheckCircle size={16} />Correct! Waiting for response...
                        </p>
                    )}
                    {status === 'incorrect' && (
                        <p style={{ color: '#f87171', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <XCircle size={16} />Not quite, try again!
                        </p>
                    )}
                    {status === 'completed' && (
                        <div>
                            <p style={{ color: '#4ade80', margin: '0 0 8px 0', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                <Trophy size={20} />Puzzle Solved!
                            </p>
                            <p style={{ color: '#9ca3af', margin: 0, fontSize: '13px' }}>
                                {attempts === 0 ? '🌟 Perfect! First try!' : `Completed in ${attempts + 1} attempts`}
                            </p>
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div style={{ ...glassStyle, padding: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                        <button onClick={showHint} disabled={status !== 'playing'}
                            style={{ ...buttonStyle, flex: 1, justifyContent: 'center', opacity: status !== 'playing' ? 0.5 : 1 }}>
                            <Lightbulb size={16} />Hint
                        </button>
                        <button onClick={resetPuzzle} style={{ ...buttonStyle, flex: 1, justifyContent: 'center' }}>
                            <RotateCcw size={16} />Reset
                        </button>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={prevPuzzle} disabled={!hasPrev}
                            style={{ ...buttonStyle, flex: 1, justifyContent: 'center', opacity: !hasPrev ? 0.5 : 1 }}>
                            <ChevronLeft size={16} />Prev
                        </button>
                        <button onClick={nextPuzzle} disabled={!hasNext}
                            style={{
                                ...buttonStyle, flex: 1, justifyContent: 'center',
                                background: status === 'completed' ? 'rgba(74, 222, 128, 0.2)' : undefined,
                                opacity: !hasNext ? 0.5 : 1
                            }}>
                            Next<ChevronRight size={16} />
                        </button>
                    </div>
                </div>

                {/* Filter Toggle */}
                <button onClick={() => setShowFilters(!showFilters)}
                    style={{ ...glassStyle, ...buttonStyle, width: '100%', justifyContent: 'center', padding: '12px' }}>
                    <Filter size={16} />{showFilters ? 'Hide Filters' : 'Filter Puzzles'}
                </button>

                {/* Filters Panel */}
                {showFilters && (
                    <div style={{ ...glassStyle, padding: '16px' }}>
                        <h4 style={{ color: 'white', margin: '0 0 12px 0' }}>Difficulty</h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                            <button onClick={() => applyFilters({ ...filters, difficulty: undefined })}
                                style={{
                                    ...buttonStyle, padding: '4px 10px', fontSize: '13px',
                                    background: !filters.difficulty ? 'rgba(96, 165, 250, 0.3)' : undefined
                                }}>All</button>
                            {Object.entries(difficultyLevels).map(([key, { label, color }]) => (
                                <button key={key} onClick={() => applyFilters({ ...filters, difficulty: key as keyof typeof difficultyLevels })}
                                    style={{
                                        ...buttonStyle, padding: '4px 10px', fontSize: '13px',
                                        background: filters.difficulty === key ? `${color}33` : undefined,
                                        borderColor: filters.difficulty === key ? color : undefined,
                                        color: filters.difficulty === key ? color : 'white'
                                    }}>{label}</button>
                            ))}
                        </div>
                        <h4 style={{ color: 'white', margin: '0 0 12px 0' }}>Theme</h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            <button onClick={() => applyFilters({ ...filters, theme: undefined })}
                                style={{
                                    ...buttonStyle, padding: '4px 10px', fontSize: '13px',
                                    background: !filters.theme ? 'rgba(96, 165, 250, 0.3)' : undefined
                                }}>All</button>
                            {themeOptions.map(theme => (
                                <button key={theme} onClick={() => applyFilters({ ...filters, theme })}
                                    style={{
                                        ...buttonStyle, padding: '4px 10px', fontSize: '13px',
                                        background: filters.theme === theme ? 'rgba(96, 165, 250, 0.3)' : undefined
                                    }}>
                                    {puzzleThemeLabels[theme]}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Stats */}
                <div style={{ ...glassStyle, padding: '16px' }}>
                    <h4 style={{ color: 'white', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Trophy size={16} style={{ color: '#facc15' }} />Your Progress
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ color: '#4ade80', fontSize: '24px', fontWeight: 'bold' }}>{stats.puzzles.solved.length}</div>
                            <div style={{ color: '#9ca3af', fontSize: '12px' }}>Solved</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ color: '#60a5fa', fontSize: '24px', fontWeight: 'bold' }}>{stats.puzzles.bestStreak}</div>
                            <div style={{ color: '#9ca3af', fontSize: '12px' }}>Best Streak</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ color: '#facc15', fontSize: '24px', fontWeight: 'bold' }}>{stats.puzzles.streak}</div>
                            <div style={{ color: '#9ca3af', fontSize: '12px' }}>Current Streak</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ color: '#a78bfa', fontSize: '24px', fontWeight: 'bold' }}>
                                {stats.puzzles.attempted > 0 ? Math.round((stats.puzzles.correctOnFirstTry / stats.puzzles.attempted) * 100) : 0}%
                            </div>
                            <div style={{ color: '#9ca3af', fontSize: '12px' }}>Accuracy</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Panel - Chess Board */}
            <div style={{ flex: 1, position: 'relative' }}>
                <Canvas shadows camera={{ position: [0, 8, 8], fov: 45 }} style={{ background: 'transparent' }}>
                    <color attach="background" args={['#1a1a1a']} />
                    <React.Suspense fallback={null}>
                        <Scene
                            onMove={handleMove}
                            turn={puzzle?.playerColor || 'w'}
                            getPossibleMoves={getPossibleMoves}
                            pieces={getPieces()}
                            lastMove={lastMove}
                            checkSquare={getCheckSquare()}
                            playerColor={puzzle?.playerColor || 'w'}
                            hintMove={getHintMove()}
                            attackedSquares={[]}
                            opponentSelection={null}
                            isSpectator={status !== 'playing'}
                            chatHighlightSquares={[]}
                            pieceTheme="glass"
                            environmentPreset="forest"
                            blindfoldMode={false}
                        />
                    </React.Suspense>
                </Canvas>

                {/* Correct/Incorrect Overlay */}
                {isCorrectMove !== null && (
                    <div style={{
                        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        padding: '20px 40px', borderRadius: '16px',
                        background: isCorrectMove ? 'rgba(74, 222, 128, 0.9)' : 'rgba(248, 113, 113, 0.9)',
                        color: 'white', fontSize: '24px', fontWeight: 'bold',
                        display: 'flex', alignItems: 'center', gap: '12px',
                        animation: 'fadeInOut 1s ease-in-out', pointerEvents: 'none'
                    }}>
                        {isCorrectMove ? (<><CheckCircle size={32} />Correct!</>) : (<><XCircle size={32} />Try Again</>)}
                    </div>
                )}
            </div>

            <style>{`
                @keyframes fadeInOut {
                    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                    20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                }
            `}</style>
        </div>
    );
}

export default PuzzleMode;
