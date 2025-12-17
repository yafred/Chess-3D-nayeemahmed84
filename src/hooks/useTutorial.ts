// Tutorial Mode Hook - Manages tutorial steps and progress
import { useState, useCallback, useEffect, useRef } from 'react';
import { Chess, Square } from 'chess.js';
import { TutorialStep, tutorialSteps } from '../data/tutorialData';

// Sound URLs (reusing existing sounds)
import moveSoundUrl from '../assets/sounds/move.mp3';
import captureSoundUrl from '../assets/sounds/capture.mp3';
import checkmateSoundUrl from '../assets/sounds/checkmate.mp3';

export type TutorialStatus = 'introduction' | 'playing' | 'correct' | 'incorrect' | 'completed';

export interface TutorialState {
    step: TutorialStep | null;
    status: TutorialStatus;
    game: Chess;
    showHint: boolean;
}

export interface UseTutorialReturn {
    step: TutorialStep | null;
    game: Chess;
    status: TutorialStatus;
    currentIndex: number;
    totalSteps: number;
    showHint: boolean;
    selectedSquare: Square | null;
    validMoves: Square[];
    lastMove: { from: Square; to: Square } | null;
    isCorrectMove: boolean | null;
    hasNext: boolean;
    hasPrev: boolean;
    startTutorial: () => void;
    handleSquareSelect: (square: Square) => void;
    makeMove: (from: Square, to: Square) => void;
    nextStep: () => void;
    prevStep: () => void;
    toggleHint: () => void;
    resetStep: () => void;
}

export function useTutorial(): UseTutorialReturn {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [state, setState] = useState<TutorialState>({
        step: null,
        status: 'introduction',
        game: new Chess(),
        showHint: false
    });
    const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
    const [validMoves, setValidMoves] = useState<Square[]>([]);
    const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
    const [isCorrectMove, setIsCorrectMove] = useState<boolean | null>(null);

    // Audio refs
    const moveSoundRef = useRef<HTMLAudioElement | null>(null);
    const captureSoundRef = useRef<HTMLAudioElement | null>(null);
    const successSoundRef = useRef<HTMLAudioElement | null>(null);

    // Initialize audio
    useEffect(() => {
        moveSoundRef.current = new Audio(moveSoundUrl);
        captureSoundRef.current = new Audio(captureSoundUrl);
        successSoundRef.current = new Audio(checkmateSoundUrl);
    }, []);

    const playSound = useCallback((type: 'move' | 'capture' | 'success') => {
        const sound = type === 'move' ? moveSoundRef.current
            : type === 'capture' ? captureSoundRef.current
                : successSoundRef.current;
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(() => { });
        }
    }, []);

    const loadStep = useCallback((index: number) => {
        if (index < 0 || index >= tutorialSteps.length) return;

        const step = tutorialSteps[index];
        const game = new Chess(step.fen);

        setCurrentIndex(index);
        setState({
            step,
            status: 'playing',
            game,
            showHint: false
        });
        setSelectedSquare(null);
        setValidMoves([]);
        setLastMove(null);
        setIsCorrectMove(null);
    }, []);

    const startTutorial = useCallback(() => {
        loadStep(0);
    }, [loadStep]);

    const getValidMovesForSquare = useCallback((square: Square): Square[] => {
        const moves = state.game.moves({ square, verbose: true });
        return moves.map(m => m.to as Square);
    }, [state.game]);

    const handleSquareSelect = useCallback((square: Square) => {
        if (state.status !== 'playing' || !state.step) return;

        const piece = state.game.get(square);
        // In tutorial, player is always white for simplicity, but let's check game turn
        const turn = state.game.turn();

        if (piece && piece.color === turn) {
            setSelectedSquare(square);
            setValidMoves(getValidMovesForSquare(square));
            return;
        }

        if (selectedSquare && validMoves.includes(square)) {
            makeMove(selectedSquare, square);
        } else {
            setSelectedSquare(null);
            setValidMoves([]);
        }
    }, [state, selectedSquare, validMoves, getValidMovesForSquare]);

    const makeMove = useCallback((from: Square, to: Square) => {
        if (state.status !== 'playing' || !state.step) return;

        const attemptedMove = `${from}${to}`;
        const targetMove = state.step.targetMove;

        // Simple validation: does attemptedMove match targetMove?
        // Note: targetMove might be 'a7a8q', attemptedMove might be 'a7a8'
        const isCorrect = attemptedMove === targetMove || (targetMove.startsWith(attemptedMove) && targetMove.length > 4);

        if (isCorrect) {
            try {
                // If it's a promotion target, extract promotion piece
                const promotion = targetMove.length > 4 ? (targetMove[4] as any) : 'q';
                const move = state.game.move({ from, to, promotion });

                if (move) {
                    playSound(move.captured ? 'capture' : 'move');
                    setLastMove({ from, to });
                    setSelectedSquare(null);
                    setValidMoves([]);
                    setIsCorrectMove(true);

                    playSound('success');
                    setState(prev => ({ ...prev, status: 'correct' }));

                    // Delay before next step or showing summary
                    setTimeout(() => {
                        if (currentIndex < tutorialSteps.length - 1) {
                            // Automatically go to next step? Or wait for user?
                            // Let's mark as correct and wait for user to click "Next"
                        } else {
                            setState(prev => ({ ...prev, status: 'completed' }));
                        }
                    }, 1500);
                }
            } catch (e) {
                console.error('Tutorial move error:', e);
            }
        } else {
            setIsCorrectMove(false);
            setState(prev => ({ ...prev, status: 'incorrect' }));
            setTimeout(() => {
                setIsCorrectMove(null);
                setState(prev => ({ ...prev, status: 'playing' }));
            }, 1000);
        }
    }, [state, currentIndex, playSound]);

    const nextStep = useCallback(() => {
        if (currentIndex < tutorialSteps.length - 1) {
            loadStep(currentIndex + 1);
        }
    }, [currentIndex, loadStep]);

    const prevStep = useCallback(() => {
        if (currentIndex > 0) {
            loadStep(currentIndex - 1);
        }
    }, [currentIndex, loadStep]);

    const toggleHint = useCallback(() => {
        setState(prev => ({ ...prev, showHint: !prev.showHint }));
    }, []);

    return {
        step: state.step,
        game: state.game,
        status: state.status,
        currentIndex,
        totalSteps: tutorialSteps.length,
        showHint: state.showHint,
        selectedSquare,
        validMoves,
        lastMove,
        isCorrectMove,
        hasNext: currentIndex < tutorialSteps.length - 1,
        hasPrev: currentIndex > 0,
        startTutorial,
        handleSquareSelect,
        makeMove,
        nextStep,
        prevStep,
        toggleHint,
        resetStep: () => loadStep(currentIndex)
    };
}
