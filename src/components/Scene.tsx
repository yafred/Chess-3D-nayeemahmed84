import { OrbitControls, Environment } from '@react-three/drei';
import { Board } from './Board';
import { Square } from 'chess.js';
import { useThree } from '@react-three/fiber';
import { useEffect, useState } from 'react';

import { PieceState } from '../hooks/useChessGame';

interface SceneProps {
    onMove: (from: Square, to: Square) => boolean;
    turn: string;
    getPossibleMoves: (square: Square) => string[];
    pieces: PieceState[];
    lastMove: { from: Square; to: Square } | null;
    checkSquare: Square | null;
    playerColor: 'w' | 'b';
    hintMove: { from: Square; to: Square } | null;
    attackedSquares: Square[];
    opponentSelection: Square | null;
    isSpectator: boolean;
    chatHighlightSquares: Square[];
}

const CameraController = ({ playerColor }: { playerColor: 'w' | 'b' }) => {
    const { camera } = useThree();
    useEffect(() => {
        if (playerColor === 'b') {
            camera.position.set(0, 8, -8);
            camera.lookAt(0, 0, 0);
        } else {
            camera.position.set(0, 8, 8);
            camera.lookAt(0, 0, 0);
        }
    }, [playerColor, camera]);
    return null;
};

export const Scene = ({ onMove, turn, getPossibleMoves, pieces, lastMove, checkSquare, playerColor, hintMove, attackedSquares, opponentSelection, isSpectator, chatHighlightSquares }: SceneProps) => {
    const [isInteracting, setIsInteracting] = useState(false);

    return (
        <>
            <CameraController playerColor={playerColor} />
            {/* Disable OrbitControls when interacting with board/pieces */}
            <OrbitControls
                enabled={!isInteracting}
                minPolarAngle={0}
                maxPolarAngle={Math.PI / 2.1}
            />
            <ambientLight intensity={0.2} />
            <pointLight position={[10, 10, 10]} intensity={1.5} castShadow />
            <Environment preset="forest" background blur={0.5} />

            <Board
                onMove={onMove}
                turn={turn}
                getPossibleMoves={getPossibleMoves}
                pieces={pieces}
                lastMove={lastMove}
                checkSquare={checkSquare}
                hintMove={hintMove}
                attackedSquares={attackedSquares}
                opponentSelection={opponentSelection}
                onInteractionChange={setIsInteracting}
                isSpectator={isSpectator}
                chatHighlightSquares={chatHighlightSquares}
            />
        </>
    );
};