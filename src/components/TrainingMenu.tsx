// Training Menu - Main hub for all training modes

import React from 'react';
import {
    Target,
    BookOpen,
    Flag,
    Brain,
    Trophy,
    ChevronRight,
    Zap,
    GraduationCap
} from 'lucide-react';
import { loadTrainingStats, getTrainingSummary } from '../data/trainingStats';
import { puzzles } from '../data/puzzleData';

export type TrainingMode = 'menu' | 'puzzles' | 'openings' | 'endgames' | 'trainer' | 'tutorial';

interface TrainingMenuProps {
    onSelectMode: (mode: TrainingMode) => void;
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

interface TrainingCardProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    stats?: string;
    progress?: number;
    onClick: () => void;
    available?: boolean;
}

function TrainingCard({
    title,
    description,
    icon,
    color,
    stats,
    progress,
    onClick,
    available = true
}: TrainingCardProps) {
    return (
        <button
            onClick={onClick}
            disabled={!available}
            style={{
                ...glassStyle,
                padding: '24px',
                width: '100%',
                textAlign: 'left',
                cursor: available ? 'pointer' : 'not-allowed',
                transition: 'all 0.3s ease',
                opacity: available ? 1 : 0.5,
                position: 'relative',
                overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
                if (available) {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = `0 12px 40px rgba(0, 0, 0, 0.4), 0 0 20px ${color}22`;
                }
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.3)';
            }}
        >
            {/* Progress bar background */}
            {progress !== undefined && (
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '4px',
                    background: 'rgba(255, 255, 255, 0.1)'
                }}>
                    <div style={{
                        height: '100%',
                        width: `${progress}%`,
                        background: color,
                        transition: 'width 0.5s ease'
                    }} />
                </div>
            )}

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                {/* Icon */}
                <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '12px',
                    background: `${color}22`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                }}>
                    {icon}
                </div>

                {/* Content */}
                <div style={{ flex: 1 }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '8px'
                    }}>
                        <h3 style={{
                            margin: 0,
                            color: 'white',
                            fontSize: '20px',
                            fontWeight: 600
                        }}>
                            {title}
                        </h3>
                        {available && (
                            <ChevronRight size={20} style={{ color: '#9ca3af' }} />
                        )}
                    </div>

                    <p style={{
                        margin: '0 0 12px 0',
                        color: '#9ca3af',
                        fontSize: '14px',
                        lineHeight: '1.5'
                    }}>
                        {description}
                    </p>

                    {stats && (
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: '8px',
                            background: `${color}22`,
                            color: color,
                            fontSize: '13px'
                        }}>
                            <Zap size={14} />
                            {stats}
                        </div>
                    )}

                    {!available && (
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: '8px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            color: '#9ca3af',
                            fontSize: '13px'
                        }}>
                            Coming Soon
                        </div>
                    )}
                </div>
            </div>
        </button>
    );
}

export function TrainingMenu({ onSelectMode, onExit }: TrainingMenuProps) {
    const stats = loadTrainingStats();
    const summary = getTrainingSummary(stats);
    const puzzleProgress = Math.round((stats.puzzles.solved.length / puzzles.length) * 100);

    return (
        <div style={{
            width: '100vw',
            height: '100vh',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px'
        }}>
            <div style={{ maxWidth: '800px', width: '100%' }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <h1 style={{
                        color: 'white',
                        fontSize: '36px',
                        margin: '0 0 12px 0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px'
                    }}>
                        <Brain size={40} style={{ color: '#60a5fa' }} />
                        Training Center
                    </h1>
                    <p style={{ color: '#9ca3af', fontSize: '16px', margin: 0 }}>
                        Sharpen your chess skills with focused practice
                    </p>
                </div>

                {/* Quick Stats */}
                <div style={{
                    ...glassStyle,
                    padding: '20px',
                    marginBottom: '24px',
                    display: 'flex',
                    justifyContent: 'space-around'
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#4ade80', fontSize: '28px', fontWeight: 'bold' }}>
                            {summary.puzzlesSolved}
                        </div>
                        <div style={{ color: '#9ca3af', fontSize: '13px' }}>Puzzles Solved</div>
                    </div>
                    <div style={{
                        width: '1px',
                        background: 'rgba(255, 255, 255, 0.1)'
                    }} />
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#facc15', fontSize: '28px', fontWeight: 'bold' }}>
                            {stats.puzzles.bestStreak}
                        </div>
                        <div style={{ color: '#9ca3af', fontSize: '13px' }}>Best Streak</div>
                    </div>
                    <div style={{
                        width: '1px',
                        background: 'rgba(255, 255, 255, 0.1)'
                    }} />
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#a78bfa', fontSize: '28px', fontWeight: 'bold' }}>
                            {summary.puzzleAccuracy}%
                        </div>
                        <div style={{ color: '#9ca3af', fontSize: '13px' }}>Accuracy</div>
                    </div>
                </div>

                {/* Training Cards */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '16px'
                }}>
                    <TrainingCard
                        title="Interactive Tutorial"
                        description="Learn the basics of chess and master special moves with step-by-step guidance."
                        icon={<GraduationCap size={28} style={{ color: '#60a5fa' }} />}
                        color="#60a5fa"
                        stats="Learn basics & rules"
                        onClick={() => onSelectMode('tutorial')}
                    />

                    <TrainingCard
                        title="Chess Puzzles"
                        description="Solve tactical puzzles to improve pattern recognition and calculation skills."
                        icon={<Target size={28} style={{ color: '#4ade80' }} />}
                        color="#4ade80"
                        stats={`${stats.puzzles.solved.length}/${puzzles.length} solved`}
                        progress={puzzleProgress}
                        onClick={() => onSelectMode('puzzles')}
                    />

                    <TrainingCard
                        title="Opening Explorer"
                        description="Learn popular openings with interactive move-by-move guidance."
                        icon={<BookOpen size={28} style={{ color: '#a78bfa' }} />}
                        color="#a78bfa"
                        stats={`${summary.openingsPracticed} practiced`}
                        onClick={() => onSelectMode('openings')}
                        available={false}
                    />

                    <TrainingCard
                        title="Endgame Practice"
                        description="Master essential endgame techniques and checkmate patterns."
                        icon={<Flag size={28} style={{ color: '#facc15' }} />}
                        color="#facc15"
                        stats={`${summary.endgamesCompleted} completed`}
                        onClick={() => onSelectMode('endgames')}
                        available={false}
                    />

                    <TrainingCard
                        title="Move Trainer"
                        description="Test your skills by finding the best moves in critical positions."
                        icon={<Trophy size={28} style={{ color: '#f87171' }} />}
                        color="#f87171"
                        stats={`${summary.trainerAccuracy}% accuracy`}
                        onClick={() => onSelectMode('trainer')}
                        available={false}
                    />
                </div>

                {/* Back Button */}
                <button
                    onClick={onExit}
                    style={{
                        ...glassStyle,
                        width: '100%',
                        marginTop: '24px',
                        padding: '14px',
                        color: 'white',
                        fontSize: '16px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(30, 30, 40, 0.85)';
                    }}
                >
                    ← Back to Game
                </button>
            </div>
        </div>
    );
}

export default TrainingMenu;
