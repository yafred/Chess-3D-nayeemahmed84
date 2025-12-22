import { useMemo, useRef, useEffect, useState } from 'react';
import { Vector2, Vector3, Color, Mesh, Plane, BufferGeometry, Material } from 'three';
import { useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Square } from 'chess.js';
import { GLTF } from 'three-stdlib';
import { PieceTheme } from '../hooks/useChessGame';

interface PieceProps {
    id: string;
    type: string; // p, r, n, b, q, k
    color: 'w' | 'b';
    position: [number, number, number]; // target board position
    square: Square;
    isCaptured?: boolean;
    onDragStart: () => void;
    onDragEnd: (endSquare: Square | null) => void;
    onSelect: () => void;
    onInteractionStart: () => void;
    onInteractionEnd: () => void;
    theme?: PieceTheme;
    blindfoldMode?: boolean;
}

type GLTFResult = GLTF & {
    nodes: {
        [key: string]: Mesh;
    };
    materials: {
        [key: string]: Material;
    };
};

export const Piece = ({ type, color, position, isCaptured, onDragStart, onDragEnd, onSelect, onInteractionStart, onInteractionEnd, theme = 'glass', blindfoldMode = false }: PieceProps) => {
    const isWhite = color === 'w';
    const materialColor = isWhite ? '#ffffff' : '#555555';
    const { camera, raycaster, gl } = useThree();
    const [isDragging, setIsDragging] = useState(false);
    const groundPlane = useRef(new Plane(new Vector3(0, 1, 0), 0));

    // Load the chess model
    const { nodes } = useGLTF('https://raw.githubusercontent.com/jpbruyere/VkChess.net/master/data/models/chess.gltf') as GLTFResult;

    // Debug: Log available nodes to find correct names
    useEffect(() => {
        console.log('Available GLTF Nodes:', Object.keys(nodes));
    }, [nodes]);

    const geometry = useMemo(() => {
        let geo: BufferGeometry | undefined;

        // Helper to safely get geometry
        const getGeo = (name: string) => nodes[name]?.geometry;

        switch (type) {
            case 'p': geo = getGeo('Pawn') || getGeo('pawn'); break;
            case 'r': geo = getGeo('Rook') || getGeo('rook'); break;
            case 'n': geo = getGeo('Knight') || getGeo('knight') || getGeo('Horse') || getGeo('horse'); break;
            case 'b': geo = getGeo('Bishop') || getGeo('bishop'); break;
            case 'q': geo = getGeo('Queen') || getGeo('queen'); break;
            case 'k': geo = getGeo('King') || getGeo('king'); break;
            default: geo = getGeo('Pawn');
        }

        return geo;
    }, [type, nodes]);

    // Scale correction for this specific model if needed
    const scale = 0.4;
    const rotationY = isWhite ? -Math.PI / 2 : Math.PI / 2; // Adjust based on model orientation

    const meshRef = useRef<Mesh>(null);
    const trailRef = useRef<Mesh>(null);
    const startPos = useRef<Vector3>(new Vector3(...position));
    const targetPos = useRef<Vector3>(new Vector3(...position));
    const dragPos = useRef<Vector3>(new Vector3(...position));
    const progress = useRef(0);
    const animating = useRef(false);
    const timeSinceCaptured = useRef(0);
    const velocity = useRef(new Vector3(0, 0, 0));
    const rotationAxis = useRef(new Vector3(Math.random(), Math.random(), Math.random()).normalize());

    const pointerDownPos = useRef({ x: 0, y: 0 });
    const hasMoved = useRef(false);
    const dragStarted = useRef(false);

    const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
        if (isCaptured) return;
        e.stopPropagation(); // Stop propagation to prevent Board/Square click handlers
        onInteractionStart(); // Disable OrbitControls
        pointerDownPos.current = { x: e.clientX, y: e.clientY };
        hasMoved.current = false;
        dragStarted.current = false;
        setIsDragging(true);
        document.body.style.cursor = 'grabbing';
    };

    useEffect(() => {
        if (!isDragging) return;

        const canvas = gl.domElement;

        const handleGlobalPointerMove = (e: PointerEvent) => {
            const dx = e.clientX - pointerDownPos.current.x;
            const dy = e.clientY - pointerDownPos.current.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 5) {
                hasMoved.current = true;
                if (!dragStarted.current) {
                    dragStarted.current = true;
                    onDragStart();
                }
            }

            const rect = canvas.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(new Vector2(x, y), camera);

            const intersectionPoint = new Vector3();
            raycaster.ray.intersectPlane(groundPlane.current, intersectionPoint);

            if (intersectionPoint && hasMoved.current) {
                dragPos.current.set(intersectionPoint.x, 0.5, intersectionPoint.z);
            }
        };

        const handleGlobalPointerUp = () => {
            setIsDragging(false);
            onInteractionEnd(); // Re-enable OrbitControls
            document.body.style.cursor = 'auto';

            if (!hasMoved.current) {
                onSelect(); // Handle click selection
                dragPos.current.copy(targetPos.current);
                return;
            }

            const fileIndex = Math.round(dragPos.current.x + 3.5);
            const rankIndex = Math.round(dragPos.current.z + 3.5);

            if (fileIndex >= 0 && fileIndex <= 7 && rankIndex >= 0 && rankIndex <= 7) {
                const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
                const file = files[fileIndex];
                const rank = 8 - rankIndex;
                const squareName = `${file}${rank}` as Square;
                onDragEnd(squareName);
            } else {
                onDragEnd(null);
            }

            dragPos.current.copy(targetPos.current);
        };

        document.addEventListener('pointermove', handleGlobalPointerMove);
        document.addEventListener('pointerup', handleGlobalPointerUp);

        return () => {
            document.removeEventListener('pointermove', handleGlobalPointerMove);
            document.removeEventListener('pointerup', handleGlobalPointerUp);
        };
    }, [isDragging, raycaster, camera, gl, onDragEnd, onDragStart, onInteractionEnd, onSelect]);

    useEffect(() => {
        if (isDragging) return;

        const newTarget = new Vector3(...position);
        if (!meshRef.current) return;
        startPos.current.copy(meshRef.current.position);
        targetPos.current.copy(newTarget);
        dragPos.current.copy(newTarget);
        progress.current = 0;
        animating.current = true;

        if (trailRef.current) {
            const dir = newTarget.clone().sub(startPos.current);
            const length = dir.length();
            const mid = startPos.current.clone().add(dir.multiplyScalar(0.5));
            trailRef.current.position.copy(mid);
            trailRef.current.scale.set(length, 0.1, 1);
            trailRef.current.lookAt(newTarget);
            const mat = trailRef.current.material as any;
            mat.opacity = 0.6;
            mat.transparent = true;
            trailRef.current.visible = true;
        }
    }, [position, isDragging]);

    useEffect(() => {
        if (isCaptured) {
            velocity.current.set(
                (Math.random() - 0.5) * 2,
                5,
                (Math.random() - 0.5) * 2
            );
        }
    }, [isCaptured]);

    useFrame((_state, delta) => {
        if (isCaptured && meshRef.current) {
            timeSinceCaptured.current += delta;
            const t = timeSinceCaptured.current;
            const mat = meshRef.current.material as any;

            if (t < 0.8) {
                const red = new Color('#ff0000');
                mat.color.lerp(red, delta * 5);
                mat.emissive = new Color('#ff0000');
                mat.emissiveIntensity = Math.min(2, t * 4);
            }

            if (t > 0.1) {
                velocity.current.y -= delta * 8;
                meshRef.current.position.x += velocity.current.x * delta;
                meshRef.current.position.y += velocity.current.y * delta;
                meshRef.current.position.z += velocity.current.z * delta;
                meshRef.current.rotateOnAxis(rotationAxis.current, delta * 5);
            }

            if (t > 1.5) {
                mat.transparent = true;
                const fadeProgress = (t - 1.5);
                mat.opacity = Math.max(0, 1 - fadeProgress);
                const s = Math.max(0, 1 - fadeProgress);
                meshRef.current.scale.set(s, s, s);
            }

            return;
        }

        if (isDragging && meshRef.current && hasMoved.current) {
            meshRef.current.position.lerp(dragPos.current, 0.3);
            return;
        }

        if (!animating.current) return;
        progress.current += delta * 2.5;
        if (progress.current >= 1) {
            progress.current = 1;
            animating.current = false;
        }

        const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
        const lerpPos = startPos.current.clone().lerp(targetPos.current, easeOutCubic(progress.current));
        if (meshRef.current) meshRef.current.position.copy(lerpPos);

        if (trailRef.current && trailRef.current.visible) {
            const mat = trailRef.current.material as any;
            mat.opacity = Math.max(0, mat.opacity - delta * 1.5);
            if (mat.opacity <= 0) trailRef.current.visible = false;
        }
    });

    return (
        <group>
            <mesh ref={trailRef} visible={false}>
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial color={new Color('#a0a0ff')} transparent opacity={0.6} depthWrite={false} />
            </mesh>
            <mesh
                ref={meshRef}
                castShadow
                receiveShadow
                onPointerDown={handlePointerDown}
                onPointerEnter={() => !isCaptured && (document.body.style.cursor = 'grab')}
                onPointerLeave={() => !isDragging && (document.body.style.cursor = 'auto')}
                geometry={geometry}
                scale={[scale, scale, scale]}
                visible={!blindfoldMode}
                rotation={[0, rotationY, 0]}
            >
                {!geometry && <cylinderGeometry args={[0.5, 0.5, 1, 32]} />}
                {theme === 'glass' && (
                    <meshPhysicalMaterial
                        color={materialColor}
                        roughness={0.02}
                        metalness={0.1}
                        transmission={0.95}
                        thickness={1.0}
                        clearcoat={1}
                        clearcoatRoughness={0.02}
                        ior={1.5}
                        reflectivity={0.9}
                    />
                )}
                {theme === 'metal' && (
                    <meshPhysicalMaterial
                        color={isWhite ? '#ffd700' : '#c0c0c0'} // Gold for white, Silver for black
                        roughness={0.1}
                        metalness={1.0}
                        clearcoat={1}
                        clearcoatRoughness={0.1}
                    />
                )}
                {theme === 'marble' && (
                    <meshPhysicalMaterial
                        color={isWhite ? '#ffffff' : '#222222'}
                        roughness={0.05}
                        metalness={0.0}
                        clearcoat={1.0}
                        clearcoatRoughness={0.05}
                        reflectivity={0.5}
                    />
                )}
                {theme === 'wood' && (
                    <meshPhysicalMaterial
                        color={isWhite ? '#d2b48c' : '#4b3621'} // Tan for white, Dark brown for black
                        roughness={0.8}
                        metalness={0.0}
                        clearcoat={0.1}
                    />
                )}
            </mesh>
        </group>
    );
};

// Preload the model
useGLTF.preload('https://raw.githubusercontent.com/jpbruyere/VkChess.net/master/data/models/chess.gltf');
