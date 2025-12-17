// Tutorial Mode Component - Full interactive tutorial interface

import React, { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from './Scene';
import { useTutorial } from '../hooks/useTutorial';
import {
    ChevronLeft,
    ChevronRight,
    Lightbulb,
    RotateCcw,
    GraduationCap,
    CheckCircle,
    XCircle,
    ArrowLeft,
    Info
} from 'lucide-react';

interface TutorialModeProps {
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

const TutorialMode = ({ onExit }: TutorialModeProps) => {
    const {
        step,
        game,
        status,
        currentIndex,
        totalSteps,
        showHint,
        lastMove,
        hasNext,
        hasPrev,
        startTutorial,
        nextStep,
        prevStep,
        toggleHint,
        resetStep,
        makeMove
    } = useTutorial();

    useEffect(() => {
        startTutorial();
    }, [startTutorial]);

    if (!step) return null;

    // Convert game pieces to PieceState[] format for Scene/Board
    const pieces = game.board().flatMap((row, i) =>
        row.map((piece, j) => {
            if (!piece) return null;
            const square = String.fromCharCode(97 + j) + (8 - i);
            return {
                id: `${piece.type}-${square}-${piece.color}`,
                type: piece.type,
                color: piece.color,
                square: square as any,
                isNew: false
            };
        }).filter(p => p !== null)
    ) as any[];

    return (
        <div style={{
            width: '100vw',
            height: '100vh',
            background: '#1a1a2e',
            display: 'flex',
            position: 'relative',
            overflow: 'hidden',
            fontFamily: "'Inter', sans-serif"
        }}>
            {/* 3D Scene */}
            <div style={{ flex: 1, position: 'relative' }}>
                <Canvas shadows camera={{ position: [0, 8, 8], fov: 45 }}>
                    <Scene
                        onMove={(from, to) => {
                            makeMove(from, to);
                            return true;
                        }}
                        turn={game.turn()}
                        getPossibleMoves={(sq) => {
                            const moves = game.moves({ square: sq, verbose: true });
                            return moves.map(m => m.to);
                        }}
                        pieces={pieces}
                        lastMove={lastMove}
                        checkSquare={game.inCheck() ? (game.board().flatMap((row, i) =>
                            row.map((p, j) => (p?.type === 'k' && p?.color === game.turn()) ? String.fromCharCode(97 + j) + (8 - i) : null)
                        ).find(s => s !== null) as any) : null}
                        playerColor="w"
                        hintMove={showHint ? { from: step.targetMove.slice(0, 2) as any, to: step.targetMove.slice(2, 4) as any } : null}
                        attackedSquares={[]}
                        opponentSelection={null}
                        isSpectator={false}
                    />
                </Canvas>
            </div>

            {/* Side Panel */}
            <div style={{
                width: '400px',
                padding: '30px',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
                zIndex: 10,
                background: 'rgba(20, 20, 30, 0.8)',
                backdropFilter: 'blur(20px)',
                borderLeft: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <button onClick={onExit} style={{ ...buttonStyle, padding: '8px' }}>
                        <ArrowLeft size={20} />
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#60a5fa' }}>
                        <GraduationCap size={24} />
                        <span style={{ fontWeight: 600 }}>Tutorial</span>
                    </div>
                    <div style={{ fontSize: '14px', color: '#9ca3af' }}>
                        {currentIndex + 1} / {totalSteps}
                    </div>
                </div>

                {/* Progress Bar */}
                <div style={{ height: '4px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '2px' }}>
                    <div style={{
                        height: '100%',
                        width: `${((currentIndex + 1) / totalSteps) * 100}%`,
                        background: '#60a5fa',
                        borderRadius: '2px',
                        transition: 'width 0.3s ease'
                    }} />
                </div>

                {/* Step Content */}
                <div style={{ ...glassStyle, padding: '24px', flex: 1, overflowY: 'auto' }}>
                    <div style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        background: 'rgba(96, 165, 250, 0.2)',
                        color: '#60a5fa',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 600,
                        marginBottom: '12px'
                    }}>
                        {step.category}
                    </div>
                    <h2 style={{ color: 'white', fontSize: '24px', margin: '0 0 16px 0' }}>{step.title}</h2>
                    <p style={{ color: '#d1d5db', fontSize: '16px', lineHeight: '1.6', margin: '0 0 24px 0' }}>
                        {step.description}
                    </p>

                    {/* Feedback area */}
                    {status === 'correct' && (
                        <div style={{
                            background: 'rgba(74, 222, 128, 0.15)',
                            border: '1px solid rgba(74, 222, 128, 0.3)',
                            padding: '16px',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            color: '#4ade80',
                            animation: 'fadeIn 0.3s ease'
                        }}>
                            <CheckCircle size={24} />
                            <div>
                                <div style={{ fontWeight: 600 }}>Excellent!</div>
                                <div style={{ fontSize: '14px' }}>You've mastered this move.</div>
                            </div>
                        </div>
                    )}

                    {status === 'incorrect' && (
                        <div style={{
                            background: 'rgba(248, 113, 113, 0.15)',
                            border: '1px solid rgba(248, 113, 113, 0.3)',
                            padding: '16px',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            color: '#f87171'
                        }}>
                            <XCircle size={24} />
                            <div>
                                <div style={{ fontWeight: 600 }}>Not quite.</div>
                                <div style={{ fontSize: '14px' }}>Try again! Use the hint if you're stuck.</div>
                            </div>
                        </div>
                    )}

                    {status === 'completed' && (
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(96, 165, 250, 0.2), rgba(167, 139, 250, 0.2))',
                            padding: '24px',
                            borderRadius: '12px',
                            textAlign: 'center',
                            color: 'white',
                            marginTop: '20px'
                        }}>
                            <GraduationCap size={48} style={{ margin: '0 auto 12px', color: '#fbbf24' }} />
                            <h3 style={{ margin: '0 0 8px 0' }}>Tutorial Complete!</h3>
                            <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '16px' }}>
                                You now have a solid understanding of the basics.
                            </p>
                            <button onClick={onExit} style={{ ...buttonStyle, width: '100%', justifyContent: 'center', background: '#60a5fa' }}>
                                Finish Tutorial
                            </button>
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={toggleHint}
                            style={{
                                ...buttonStyle,
                                flex: 2,
                                background: showHint ? 'rgba(250, 204, 21, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                                borderColor: showHint ? 'rgba(250, 204, 21, 0.4)' : 'rgba(255, 255, 255, 0.2)',
                                color: showHint ? '#facc15' : 'white'
                            }}
                        >
                            <Lightbulb size={20} />
                            {showHint ? 'Hide Hint' : 'Show Hint'}
                        </button>
                        <button onClick={resetStep} style={{ ...buttonStyle, flex: 1, justifyContent: 'center' }}>
                            <RotateCcw size={20} />
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={prevStep}
                            disabled={!hasPrev}
                            style={{ ...buttonStyle, flex: 1, justifyContent: 'center', opacity: hasPrev ? 1 : 0.5 }}
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <button
                            onClick={nextStep}
                            disabled={!hasNext && status !== 'correct'}
                            style={{
                                ...buttonStyle,
                                flex: 2,
                                justifyContent: 'center',
                                background: status === 'correct' ? '#60a5fa' : 'rgba(255, 255, 255, 0.1)',
                                opacity: (hasNext || status === 'correct') ? 1 : 0.5
                            }}
                        >
                            {status === 'correct' && !hasNext ? 'Complete' : 'Next Step'}
                            <ChevronRight size={24} />
                        </button>
                    </div>
                </div>

                {/* Hint Text */}
                {showHint && (
                    <div style={{
                        background: 'rgba(250, 204, 21, 0.1)',
                        padding: '16px',
                        borderRadius: '12px',
                        border: '1px solid rgba(250, 204, 21, 0.2)',
                        display: 'flex',
                        gap: '12px',
                        color: '#facc15',
                        fontSize: '14px'
                    }}>
                        <Info size={20} style={{ flexShrink: 0 }} />
                        <div>{step.hint || 'Make the indicated move on the board.'}</div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TutorialMode;
