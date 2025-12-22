import { useState, useEffect } from 'react';
import { Chess, Move } from 'chess.js';

interface MoveAnalysis {
    move: Move;
    evaluation: number;
    classification: 'brilliant' | 'good' | 'inaccuracy' | 'mistake' | 'blunder' | 'book';
    bestMove?: string;
    evalDrop?: number;
}

interface GameAnalysisProps {
    pgn: string;
    winner: string | null;
    onClose: () => void;
    onNavigateToMove: (moveIndex: number) => void;
}

export const GameAnalysis = ({ pgn, winner, onClose, onNavigateToMove }: GameAnalysisProps) => {
    const [analyzing, setAnalyzing] = useState(true);
    const [moveAnalyses, setMoveAnalyses] = useState<MoveAnalysis[]>([]);
    const [whiteAccuracy, setWhiteAccuracy] = useState(0);
    const [blackAccuracy, setBlackAccuracy] = useState(0);
    const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);

    useEffect(() => {
        analyzeGame();
    }, [pgn]);

    const analyzeGame = async () => {
        setAnalyzing(true);
        const game = new Chess();
        game.loadPgn(pgn);
        const moves = game.history({ verbose: true });

        // Initialize worker for analysis
        const worker = new Worker(new URL('../workers/ai.worker.ts', import.meta.url), { type: 'module' });

        const analyses: MoveAnalysis[] = [];
        let previousEval = 0;

        // Analyze each position
        for (let i = 0; i < moves.length; i++) {
            const tempGame = new Chess();
            tempGame.loadPgn(pgn);
            const history = tempGame.history({ verbose: true });

            // Replay moves up to current position
            const replayGame = new Chess();
            for (let j = 0; j < i; j++) {
                replayGame.move(history[j].san);
            }

            // Get evaluation for this position
            const evaluation = await new Promise<number>((resolve) => {
                const timeout = setTimeout(() => resolve(previousEval), 3000);

                worker.onmessage = (e) => {
                    const { type, data } = e.data;
                    if (type === 'evaluation') {
                        clearTimeout(timeout);
                        let evalScore = data.value;
                        if (data.type === 'cp') {
                            evalScore = data.value;
                        } else if (data.type === 'mate') {
                            evalScore = data.value > 0 ? 10000 : -10000; // Large value for mate
                        }

                        // Flip if Black's turn in that position
                        if (replayGame.turn() === 'b') {
                            evalScore = -evalScore;
                        }
                        resolve(evalScore);
                    }
                };

                worker.postMessage({ type: 'init' }); // Ensure worker is ready
                const historyStr = replayGame.history({ verbose: true }).map(m => m.from + m.to + (m.promotion || '')).join(' ');
                worker.postMessage({ type: 'position', data: `startpos moves ${historyStr}` });
                worker.postMessage({ type: 'go', data: 'depth 10' }); // Fast depth for analysis
            });

            const evalDrop = Math.abs(evaluation - previousEval);
            const classification = classifyMove(evalDrop, i);

            analyses.push({
                move: moves[i],
                evaluation,
                classification,
                evalDrop
            });

            previousEval = evaluation;
            setMoveAnalyses([...analyses]);
        }

        worker.terminate();
        setMoveAnalyses(analyses);
        calculateAccuracy(analyses);
        setAnalyzing(false);
    };

    const classifyMove = (evalDrop: number, moveIndex: number): MoveAnalysis['classification'] => {
        if (moveIndex < 6) return 'book';
        if (evalDrop < 10) return 'brilliant';
        if (evalDrop < 30) return 'good';
        if (evalDrop < 80) return 'inaccuracy';
        if (evalDrop < 150) return 'mistake';
        return 'blunder';
    };

    const calculateAccuracy = (analyses: MoveAnalysis[]) => {
        const whiteMoves = analyses.filter((_, i) => i % 2 === 0);
        const blackMoves = analyses.filter((_, i) => i % 2 === 1);

        const calcAccuracy = (moves: MoveAnalysis[]) => {
            if (moves.length === 0) return 100;
            const totalError = moves.reduce((sum, m) => sum + (m.evalDrop || 0), 0);
            const avgError = totalError / moves.length;
            return Math.max(0, Math.min(100, 100 - avgError));
        };

        setWhiteAccuracy(Math.round(calcAccuracy(whiteMoves)));
        setBlackAccuracy(Math.round(calcAccuracy(blackMoves)));
    };

    const getClassificationColor = (classification: MoveAnalysis['classification']) => {
        switch (classification) {
            case 'brilliant': return '#00ff88';
            case 'good': return '#88ff88';
            case 'book': return '#888888';
            case 'inaccuracy': return '#ffcc00';
            case 'mistake': return '#ff8800';
            case 'blunder': return '#ff0000';
            default: return '#ffffff';
        }
    };

    const getClassificationSymbol = (classification: MoveAnalysis['classification']) => {
        switch (classification) {
            case 'brilliant': return '!!';
            case 'good': return '!';
            case 'inaccuracy': return '?!';
            case 'mistake': return '?';
            case 'blunder': return '??';
            default: return '';
        }
    };

    const getMoveStats = (color: 'w' | 'b') => {
        const moves = moveAnalyses.filter((_, i) =>
            color === 'w' ? i % 2 === 0 : i % 2 === 1
        );

        return {
            brilliant: moves.filter(m => m.classification === 'brilliant').length,
            good: moves.filter(m => m.classification === 'good').length,
            inaccuracy: moves.filter(m => m.classification === 'inaccuracy').length,
            mistake: moves.filter(m => m.classification === 'mistake').length,
            blunder: moves.filter(m => m.classification === 'blunder').length,
        };
    };

    if (analyzing) {
        return (
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000
            }}>
                <div style={{
                    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                    padding: '40px',
                    borderRadius: '20px',
                    textAlign: 'center',
                    border: '2px solid rgba(255, 255, 255, 0.1)'
                }}>
                    <div style={{
                        width: '60px',
                        height: '60px',
                        border: '4px solid rgba(255, 255, 255, 0.1)',
                        borderTop: '4px solid #00ff88',
                        borderRadius: '50%',
                        margin: '0 auto 20px',
                        animation: 'spin 1s linear infinite'
                    }} />
                    <h2 style={{ color: 'white', marginBottom: '10px' }}>Analyzing Game...</h2>
                    <p style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                        Evaluating {moveAnalyses.length} moves
                    </p>
                </div>
                <style>{`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }

    const whiteStats = getMoveStats('w');
    const blackStats = getMoveStats('b');

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.95)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
            overflow: 'auto'
        }}>
            <div style={{
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                borderRadius: '20px',
                maxWidth: '1200px',
                width: '100%',
                maxHeight: '90vh',
                overflow: 'auto',
                border: '2px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
            }}>
                <div style={{
                    padding: '30px',
                    borderBottom: '2px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div>
                        <h1 style={{ color: 'white', margin: 0, fontSize: '32px' }}>
                            📊 Game Analysis
                        </h1>
                        <p style={{ color: 'rgba(255, 255, 255, 0.6)', margin: '5px 0 0' }}>
                            Result: {winner === 'Draw' ? 'Draw' : `${winner} wins`}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255, 255, 255, 0.1)',
                            border: '2px solid rgba(255, 255, 255, 0.2)',
                            color: 'white',
                            padding: '12px 24px',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            fontSize: '16px',
                            transition: 'all 0.3s'
                        }}
                    >
                        ✕ Close
                    </button>
                </div>

                <div style={{
                    padding: '30px',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '20px'
                }}>
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        padding: '25px',
                        borderRadius: '15px',
                        border: '2px solid rgba(255, 255, 255, 0.1)'
                    }}>
                        <h3 style={{ color: 'white', margin: '0 0 15px', fontSize: '20px' }}>
                            ⚪ White
                        </h3>
                        <div style={{
                            fontSize: '48px',
                            fontWeight: 'bold',
                            color: '#00ff88',
                            marginBottom: '15px'
                        }}>
                            {whiteAccuracy}%
                        </div>
                        <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px' }}>
                            <div>✨ Brilliant: {whiteStats.brilliant}</div>
                            <div>✓ Good: {whiteStats.good}</div>
                            <div>⚠ Inaccuracies: {whiteStats.inaccuracy}</div>
                            <div>❌ Mistakes: {whiteStats.mistake}</div>
                            <div>💥 Blunders: {whiteStats.blunder}</div>
                        </div>
                    </div>

                    <div style={{
                        background: 'rgba(0, 0, 0, 0.3)',
                        padding: '25px',
                        borderRadius: '15px',
                        border: '2px solid rgba(255, 255, 255, 0.1)'
                    }}>
                        <h3 style={{ color: 'white', margin: '0 0 15px', fontSize: '20px' }}>
                            ⚫ Black
                        </h3>
                        <div style={{
                            fontSize: '48px',
                            fontWeight: 'bold',
                            color: '#00ff88',
                            marginBottom: '15px'
                        }}>
                            {blackAccuracy}%
                        </div>
                        <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px' }}>
                            <div>✨ Brilliant: {blackStats.brilliant}</div>
                            <div>✓ Good: {blackStats.good}</div>
                            <div>⚠ Inaccuracies: {blackStats.inaccuracy}</div>
                            <div>❌ Mistakes: {blackStats.mistake}</div>
                            <div>💥 Blunders: {blackStats.blunder}</div>
                        </div>
                    </div>
                </div>

                {/* Evaluation Graph */}
                <div style={{ padding: '0 30px 30px' }}>
                    <h3 style={{ color: 'white', marginBottom: '15px', fontSize: '20px' }}>
                        📈 Evaluation Graph
                    </h3>
                    <div style={{
                        background: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: '15px',
                        padding: '20px',
                        height: '200px',
                        position: 'relative'
                    }}>
                        {moveAnalyses.length > 0 && (
                            <svg width="100%" height="100%" viewBox="0 0 1000 200" preserveAspectRatio="none">
                                {/* Center line */}
                                <line x1="0" y1="100" x2="1000" y2="100" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />

                                {/* Evaluation polyline */}
                                <polyline
                                    points={moveAnalyses.map((m, i) => {
                                        const x = (i / Math.max(1, moveAnalyses.length - 1)) * 1000;
                                        const y = 100 - Math.min(100, Math.max(-100, m.evaluation / 2));
                                        return `${x},${y}`;
                                    }).join(' ')}
                                    fill="none"
                                    stroke="#00ff88"
                                    strokeWidth="2"
                                />

                                {/* Critical moments markers */}
                                {moveAnalyses.map((m, i) => {
                                    if ((m.evalDrop || 0) > 100) {
                                        const x = (i / Math.max(1, moveAnalyses.length - 1)) * 1000;
                                        const y = 100 - Math.min(100, Math.max(-100, m.evaluation / 2));
                                        return (
                                            <circle
                                                key={i}
                                                cx={x}
                                                cy={y}
                                                r="5"
                                                fill="#ff0000"
                                                opacity="0.7"
                                            />
                                        );
                                    }
                                    return null;
                                })}
                            </svg>
                        )}
                    </div>
                </div>

                <div style={{ padding: '0 30px 30px' }}>
                    <h3 style={{ color: 'white', marginBottom: '15px', fontSize: '20px' }}>
                        📝 Move by Move Analysis
                    </h3>
                    <div style={{
                        background: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: '15px',
                        padding: '20px',
                        maxHeight: '400px',
                        overflow: 'auto'
                    }}>
                        {moveAnalyses.map((analysis, index) => {
                            const moveNumber = Math.floor(index / 2) + 1;
                            const isWhite = index % 2 === 0;

                            return (
                                <div
                                    key={index}
                                    onClick={() => {
                                        setCurrentMoveIndex(index);
                                        onNavigateToMove(index);
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '12px',
                                        marginBottom: '8px',
                                        background: currentMoveIndex === index
                                            ? 'rgba(0, 255, 136, 0.2)'
                                            : 'rgba(255, 255, 255, 0.05)',
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        border: '2px solid',
                                        borderColor: currentMoveIndex === index
                                            ? '#00ff88'
                                            : 'transparent',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <div style={{
                                        width: '40px',
                                        color: 'rgba(255, 255, 255, 0.5)',
                                        fontSize: '14px'
                                    }}>
                                        {isWhite ? `${moveNumber}.` : ''}
                                    </div>
                                    <div style={{
                                        flex: 1,
                                        color: 'white',
                                        fontSize: '16px',
                                        fontWeight: '500'
                                    }}>
                                        {analysis.move.san}
                                    </div>
                                    <div style={{
                                        color: getClassificationColor(analysis.classification),
                                        fontSize: '18px',
                                        fontWeight: 'bold',
                                        marginRight: '10px'
                                    }}>
                                        {getClassificationSymbol(analysis.classification)}
                                    </div>
                                    <div style={{
                                        color: 'rgba(255, 255, 255, 0.6)',
                                        fontSize: '14px',
                                        minWidth: '60px',
                                        textAlign: 'right'
                                    }}>
                                        {analysis.evaluation > 0 ? '+' : ''}{(analysis.evaluation / 100).toFixed(1)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};
