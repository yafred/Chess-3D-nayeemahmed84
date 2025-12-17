import { useMemo, useState } from 'react';
import { Square } from 'chess.js';
import { RoundedBox } from '@react-three/drei';
import { Piece } from './Piece';
import { PieceState } from '../hooks/useChessGame';

interface BoardProps {
    onMove: (from: Square, to: Square) => boolean;
    turn: string;
    getPossibleMoves: (square: Square) => string[];
    lastMove: { from: Square; to: Square } | null;
    checkSquare: Square | null;
    pieces: PieceState[];
    hintMove: { from: Square; to: Square } | null;
    attackedSquares: Square[];
    opponentSelection: Square | null;
    onInteractionChange: (isInteracting: boolean) => void;
    isSpectator: boolean;
    chatHighlightSquares: Square[];
}

export const Board = ({ onMove, turn, getPossibleMoves, pieces, lastMove, checkSquare, hintMove, attackedSquares, opponentSelection, onInteractionChange, isSpectator, chatHighlightSquares }: BoardProps) => {
    const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
    const [possibleMoves, setPossibleMoves] = useState<string[]>([]);
    const [draggedPiece, setDraggedPiece] = useState<{ id: string, type: string, color: string, startSquare: Square } | null>(null);

    const squares = useMemo(() => {
        const sqs = [];
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const isBlack = (rank + file) % 2 === 1;
                const squareName = `${files[file]}${8 - rank}` as Square;
                sqs.push({
                    x: file - 3.5,
                    z: rank - 3.5,
                    color: isBlack ? '#333' : '#eee', // Darker black, lighter white for contrast
                    name: squareName,
                    isBlack
                });
            }
        }
        return sqs;
    }, []);

    // Helper to get coordinates from square name
    const getSquareCoords = (square: Square) => {
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const file = files.indexOf(square[0]);
        const rank = 8 - parseInt(square[1]);
        return { x: file - 3.5, z: rank - 3.5 };
    };

    const handleSquareClick = (squareName: Square) => {
        if (isSpectator) return;

        if (selectedSquare) {
            if (selectedSquare === squareName) {
                setSelectedSquare(null);
                setPossibleMoves([]);
                return;
            }
            if (possibleMoves.includes(squareName)) {
                const success = onMove(selectedSquare, squareName);
                if (success) {
                    setSelectedSquare(null);
                    setPossibleMoves([]);
                    return;
                }
            }
        }

        const piece = pieces.find(p => p.square === squareName);
        if (piece && piece.color === turn) {
            setSelectedSquare(squareName);
            setPossibleMoves(getPossibleMoves(squareName));
        } else {
            setSelectedSquare(null);
            setPossibleMoves([]);
        }
    };

    const handlePieceInteractionStart = () => {
        if (isSpectator) return;
        onInteractionChange(true);
    };

    const handlePieceInteractionEnd = () => {
        if (isSpectator) return;
        onInteractionChange(false);
    };

    const handleDragStart = (piece: { id: string, type: string, color: string, square: Square }) => {
        if (isSpectator) return;
        if (piece.color !== turn) return;
        // onInteractionChange(true); // Handled by onInteractionStart
        setDraggedPiece({ ...piece, startSquare: piece.square });
        setSelectedSquare(piece.square);
        setPossibleMoves(getPossibleMoves(piece.square));
    };

    const handleDragEnd = (_pieceId: string, endSquare: Square | null) => {
        if (isSpectator) return;
        if (draggedPiece && endSquare && possibleMoves.includes(endSquare)) {
            onMove(draggedPiece.startSquare, endSquare);
        }
        setDraggedPiece(null);
        setSelectedSquare(null);
        setPossibleMoves([]);
        // onInteractionChange(false); // Handled by onInteractionEnd
    };

    return (
        <group>
            {/* Board Frame */}
            <mesh position={[0, -0.2, 0]} receiveShadow>
                <boxGeometry args={[9, 0.4, 9]} />
                <meshStandardMaterial color="#3d2b1f" roughness={0.6} />
            </mesh>

            {/* Inner Board Border */}
            <mesh position={[0, -0.05, 0]} receiveShadow>
                <boxGeometry args={[8.2, 0.15, 8.2]} />
                <meshStandardMaterial color="#1a1a1a" roughness={0.5} />
            </mesh>

            {/* Board Squares */}
            {squares.map((sq) => {
                const isSelected = selectedSquare === sq.name;
                const isPossibleMove = possibleMoves.includes(sq.name);
                const isLastMove = lastMove && (lastMove.from === sq.name || lastMove.to === sq.name);
                const isCheck = checkSquare === sq.name;
                const isOpponentSelected = opponentSelection === sq.name;

                let color = sq.color;
                let emissive = '#000000';
                let emissiveIntensity = 0;
                let height = 0.1;
                let radius = 0; // No bevel by default
                let smoothness = 1;

                if (isCheck) {
                    color = '#ff3333';
                    emissive = '#ff0000';
                    emissiveIntensity = 0.5;
                } else if (isPossibleMove) {
                    // Darker blue for white squares to make it visible
                    // Deep blue for black squares
                    color = sq.isBlack ? '#003366' : '#0066cc';
                    emissive = '#0088ff';
                    emissiveIntensity = 0.6;

                    // 3D Bevel/Emboss effect
                    height = 0.12; // Slightly raised
                    radius = 0.05; // Beveled edges
                    smoothness = 4;
                } else if (isSelected) {
                    color = '#4488ff';
                    emissive = '#4488ff';
                    emissiveIntensity = 0.4;
                    height = 0.11;
                    radius = 0.02;
                } else if (isLastMove) {
                    // Dark purple transparent with bevel/emboss
                    color = sq.isBlack ? '#4d1a66' : '#7733aa';
                    emissive = '#9944dd';
                    emissiveIntensity = 0.5;

                    // 3D Bevel/Emboss effect (same as possible moves)
                    height = 0.12; // Slightly raised
                    radius = 0.05; // Beveled edges
                    smoothness = 4;
                } else if (chatHighlightSquares.includes(sq.name)) {
                    // Chat highlight - Cyan/Light Blue
                    color = sq.isBlack ? '#003344' : '#006688';
                    emissive = '#00ffff';
                    emissiveIntensity = 0.5;
                    height = 0.12;
                    radius = 0.05;
                    smoothness = 4;
                } else if (hintMove && (hintMove.from === sq.name || hintMove.to === sq.name)) {
                    // Hint move - Greenish/Gold
                    color = sq.isBlack ? '#1a4d1a' : '#338833';
                    emissive = '#00ff00';
                    emissiveIntensity = 0.4;
                    height = 0.12;
                    radius = 0.05;
                    smoothness = 4;
                } else if (attackedSquares.includes(sq.name)) {
                    // Attacked square - Red tint
                    color = sq.isBlack ? '#4d1a1a' : '#883333';
                    emissive = '#ff0000';
                    emissiveIntensity = 0.2;
                } else if (attackedSquares.includes(sq.name)) {
                    // Attacked square - Red tint
                    color = sq.isBlack ? '#4d1a1a' : '#883333';
                    emissive = '#ff0000';
                    emissiveIntensity = 0.2;
                } else if (isOpponentSelected) {
                    // Opponent selection - Yellow/Orange
                    color = '#ffaa00';
                    emissive = '#ffaa00';
                    emissiveIntensity = 0.5;
                    height = 0.11;
                    radius = 0.02;
                }

                return (
                    <RoundedBox
                        key={sq.name}
                        args={[1, height, 1]} // Width, Height, Depth
                        radius={radius}
                        smoothness={smoothness}
                        position={[sq.x, (height - 0.1) / 2, sq.z]} // Adjust position to keep bottom aligned
                        onClick={(e) => {
                            e.stopPropagation();
                            handleSquareClick(sq.name);
                        }}
                        receiveShadow
                    >
                        <meshPhysicalMaterial
                            color={color}
                            emissive={emissive}
                            emissiveIntensity={emissiveIntensity}
                            roughness={isPossibleMove ? 0.1 : 0.2}
                            metalness={isPossibleMove ? 0.3 : 0.1}
                            clearcoat={0.5}
                            clearcoatRoughness={0.1}
                        />
                    </RoundedBox>
                );
            })}

            {/* Pieces */}
            {pieces.map((p) => {
                const { x, z } = getSquareCoords(p.square);
                return (
                    <Piece
                        key={p.id} // Stable ID for animation
                        id={p.id}
                        type={p.type}
                        color={p.color}
                        position={[x, 0.05, z]}
                        square={p.square}
                        isCaptured={p.isCaptured}
                        onDragStart={() => handleDragStart(p)}
                        onDragEnd={(endSquare) => handleDragEnd(p.id, endSquare)}
                        onSelect={() => handleSquareClick(p.square)}
                        onInteractionStart={handlePieceInteractionStart}
                        onInteractionEnd={handlePieceInteractionEnd}
                    />
                );
            })}
        </group>
    );
};
