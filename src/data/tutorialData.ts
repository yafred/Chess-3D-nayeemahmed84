// Interactive Tutorial Data
// Defines steps, instructions, and target moves for the chess tutorial

export type TutorialCategory = 'Basics' | 'Special Moves' | 'Tactics' | 'Objectives';

export interface TutorialStep {
    id: string;
    category: TutorialCategory;
    title: string;
    description: string;
    fen: string;
    targetMove: string; // UCI format (e.g., "e2e4")
    hint?: string;
    highlightSquares?: string[]; // Algebraic notation (e.g., ["e2", "e4"])
}

export const tutorialSteps: TutorialStep[] = [
    // ===== BASICS =====
    {
        id: 't001',
        category: 'Basics',
        title: 'The Pawn',
        description: 'Pawns move one square forward. On their first move, they can advance two squares. They capture diagonally.',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        targetMove: 'e2e4',
        hint: 'Try moving the pawn in front of your King two squares forward.',
        highlightSquares: ['e2', 'e4']
    },
    {
        id: 't002',
        category: 'Basics',
        title: 'The Knight',
        description: 'Knights move in an "L" shape: two squares in one direction and then one square perpendicular. They can jump over other pieces!',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        targetMove: 'g1f3',
        hint: 'Move your Kingside knight to the f3 square.',
        highlightSquares: ['g1', 'f3']
    },
    {
        id: 't003',
        category: 'Basics',
        title: 'The Bishop',
        description: 'Bishops move any number of squares diagonally. They always stay on squares of the same color they started on.',
        fen: 'rnbqkbnr/pppppp1p/8/6p1/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
        targetMove: 'f1c4',
        hint: 'Develop your light-squared bishop to c4.',
        highlightSquares: ['f1', 'c4']
    },
    {
        id: 't004',
        category: 'Basics',
        title: 'The Rook',
        description: 'Rooks move any number of squares horizontally or vertically.',
        fen: '4k3/8/8/8/8/8/R7/4K3 w - - 0 1',
        targetMove: 'a2a8',
        hint: 'Move your rook to the top of the board to check the King.',
        highlightSquares: ['a2', 'a8']
    },
    {
        id: 't005',
        category: 'Basics',
        title: 'The Queen',
        description: 'The Queen is the most powerful piece. She can move any number of squares horizontally, vertically, or diagonally.',
        fen: '4k3/8/8/8/8/8/4Q3/4K3 w - - 0 1',
        targetMove: 'e2e8',
        hint: 'Deliver a check with your Queen by moving it to the 8th rank.',
        highlightSquares: ['e2', 'e8']
    },
    {
        id: 't006',
        category: 'Basics',
        title: 'The King',
        description: 'The King moves only one square in any direction. Protect him at all costs!',
        fen: '8/8/8/3k4/8/8/3K4/8 w - - 0 1',
        targetMove: 'd2e3',
        hint: 'Move your King one square diagonally to e3.',
        highlightSquares: ['d2', 'e3']
    },

    // ===== SPECIAL MOVES =====
    {
        id: 't101',
        category: 'Special Moves',
        title: 'Castling (Kingside)',
        description: 'Castling allows you to move your King two squares toward a rook, and the rook hops over him. It\'s the only time you move two pieces at once!',
        fen: 'rnbqkbnr/pppp1ppp/8/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4',
        targetMove: 'e1g1', // chess.js handles the rook move
        hint: 'Move your King two squares to the right (to g1).',
        highlightSquares: ['e1', 'g1']
    },
    {
        id: 't102',
        category: 'Special Moves',
        title: 'En Passant',
        description: 'If an opponent\'s pawn moves two squares and lands next to yours, you can capture it "in passing" as if it had only moved one square.',
        fen: 'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3',
        targetMove: 'e5f6',
        hint: 'Capture the black pawn that just jumped past yours.',
        highlightSquares: ['e5', 'f6']
    },
    {
        id: 't103',
        category: 'Special Moves',
        title: 'Promotion',
        description: 'When a pawn reaches the opposite side of the board, it must be promoted to a Knight, Bishop, Rook, or Queen.',
        fen: '8/P5k1/8/8/8/8/6K1/8 w - - 0 1',
        targetMove: 'a7a8q',
        hint: 'Move your pawn to the last rank to promote it to a Queen.',
        highlightSquares: ['a7', 'a8']
    },

    // ===== OBJECTIVES =====
    {
        id: 't201',
        category: 'Objectives',
        title: 'Check',
        description: 'When a King is under attack, it is "in check". The player must move out of check, block the attack, or capture the attacking piece.',
        fen: '4k3/8/5R2/8/8/8/8/4K3 w - - 0 1',
        targetMove: 'f6e6',
        hint: 'Move your Rook to e6 to attack the Black King.',
        highlightSquares: ['f6', 'e6']
    },
    {
        id: 't202',
        category: 'Objectives',
        title: 'Checkmate',
        description: 'Checkmate happens when a King is in check and has no way to escape. This wins the game!',
        fen: '4k3/R7/4K3/8/8/8/8/8 w - - 0 1',
        targetMove: 'a7a8',
        hint: 'Deliver the final blow with your Rook.',
        highlightSquares: ['a7', 'a8']
    }
];

export function getStepsByCategory(category: TutorialCategory): TutorialStep[] {
    return tutorialSteps.filter(s => s.category === category);
}
