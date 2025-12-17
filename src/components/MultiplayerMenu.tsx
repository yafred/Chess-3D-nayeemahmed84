import React, { useState, useEffect } from 'react';
import { multiplayerService } from '../services/MultiplayerService';
import { Copy, Check, Users, LogIn, Eye } from 'lucide-react';

interface MultiplayerMenuProps {
    onGameStart: (isHost: boolean, role: 'player' | 'spectator') => void;
    onClose: () => void;
}

export const MultiplayerMenu: React.FC<MultiplayerMenuProps> = ({ onGameStart, onClose }) => {
    const [myId, setMyId] = useState<string>('');
    const [peerIdInput, setPeerIdInput] = useState('');
    const [status, setStatus] = useState<'idle' | 'connecting' | 'connected'>('idle');
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [joinMode, setJoinMode] = useState<'player' | 'spectator'>('player');
    const [username, setUsername] = useState('');

    useEffect(() => {
        multiplayerService.initialize((id) => {
            setMyId(id);
        });

        // Listen for incoming connections (Host logic)
        const cleanupConnect = multiplayerService.onConnect((_conn) => {
            // Only auto-start if we are NOT the one joining (i.e., we are the host)
            // And if the connected peer is a player (not a spectator, unless we want to start for spectators too?)
            // Actually, for host, we just want to know someone connected.
            // If we are idle, we are host.
            if (status === 'idle') {
                setStatus('connected');
                setTimeout(() => {
                    // Update host metadata if they didn't set one?
                    if (!username.trim()) {
                        multiplayerService.setMyMetadata({ role: 'player', username: 'Host' });
                    } else {
                        multiplayerService.setMyMetadata({ role: 'player', username: username.trim() });
                    }
                    onGameStart(true, 'player');
                }, 1000);
            }
        });

        const cleanupError = multiplayerService.onError((err) => {
            console.error('Multiplayer Error:', err);
            setError(err);
            setStatus('idle');
        });

        return () => {
            cleanupConnect();
            cleanupError();
        };
    }, [status, onGameStart]);

    const handleCopyId = () => {
        navigator.clipboard.writeText(myId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleJoin = (role: 'player' | 'spectator') => {
        if (!peerIdInput) {
            setError('Please enter a Room ID');
            return;
        }
        setStatus('connecting');
        setJoinMode(role);
        setError(null);

        const nameToUse = username.trim() || `User_${Math.floor(Math.random() * 1000)}`;
        multiplayerService.setMyMetadata({ role, username: nameToUse });

        multiplayerService.connect(peerIdInput, { role, username: nameToUse });

        // Add timeout - if not connected in 10 seconds, show error
        setTimeout(() => {
            if (!multiplayerService.isConnected()) {
                setError('Connection timed out. Please check the Room ID and try again.');
                setStatus('idle');
            } else {
                // Connected successfully as client
                setStatus('connected');
                setTimeout(() => {
                    onGameStart(false, role);
                }, 1000);
            }
        }, 2000); // Short wait to allow connection to establish before checking/transitioning
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
        }}>
            <div style={{
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                padding: '30px',
                borderRadius: '20px',
                width: '400px',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                color: 'white',
                fontFamily: "'Inter', sans-serif"
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Users size={24} color="#4CAF50" />
                        Online Multiplayer
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '20px' }}>×</button>
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Your Nickname
                    </label>
                    <input
                        type="text"
                        placeholder="Enter your name..."
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        style={{
                            width: '100%',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            padding: '12px',
                            color: 'white',
                            fontSize: '16px',
                            outline: 'none',
                            boxSizing: 'border-box'
                        }}
                    />
                </div>

                {status === 'connected' ? (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        <div style={{ fontSize: '40px', marginBottom: '20px' }}>🎮</div>
                        <h3>Connected!</h3>
                        <p>{joinMode === 'spectator' ? 'Joining as Spectator...' : 'Starting game...'}</p>
                    </div>
                ) : (
                    <>
                        <div style={{ marginBottom: '30px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                Your Room ID
                            </label>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <div style={{
                                    flex: 1,
                                    background: 'rgba(0,0,0,0.3)',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    fontFamily: 'monospace',
                                    fontSize: '16px',
                                    border: '1px solid rgba(255,255,255,0.1)'
                                }}>
                                    {myId || 'Generating...'}
                                </div>
                                <button
                                    onClick={handleCopyId}
                                    disabled={!myId}
                                    style={{
                                        background: copied ? '#4CAF50' : 'rgba(255,255,255,0.1)',
                                        border: 'none',
                                        borderRadius: '8px',
                                        width: '44px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s'
                                    }}
                                    title="Copy ID"
                                >
                                    {copied ? <Check size={20} color="white" /> : <Copy size={20} color="white" />}
                                </button>
                            </div>
                            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}>
                                Share this ID with your friend so they can join.
                            </p>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', margin: '20px 0' }}>
                            <div style={{ height: '1px', flex: 1, background: 'rgba(255,255,255,0.1)' }} />
                            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>OR</span>
                            <div style={{ height: '1px', flex: 1, background: 'rgba(255,255,255,0.1)' }} />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                Join a Room
                            </label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <input
                                    type="text"
                                    placeholder="Enter Friend's ID"
                                    value={peerIdInput}
                                    onChange={(e) => {
                                        setPeerIdInput(e.target.value);
                                        setError(null);
                                    }}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: error ? '1px solid #ff4444' : '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px',
                                        padding: '12px',
                                        color: 'white',
                                        fontSize: '16px',
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                />
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        onClick={() => handleJoin('player')}
                                        disabled={status === 'connecting' || !peerIdInput}
                                        style={{
                                            flex: 1,
                                            background: '#4CAF50',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '8px',
                                            padding: '12px',
                                            cursor: 'pointer',
                                            fontWeight: 600,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            opacity: (!peerIdInput || status === 'connecting') ? 0.5 : 1
                                        }}
                                    >
                                        {status === 'connecting' && joinMode === 'player' ? '...' : <><LogIn size={18} /> Join Game</>}
                                    </button>
                                    <button
                                        onClick={() => handleJoin('spectator')}
                                        disabled={status === 'connecting' || !peerIdInput}
                                        style={{
                                            flex: 1,
                                            background: 'rgba(255, 255, 255, 0.1)',
                                            color: 'white',
                                            border: '1px solid rgba(255, 255, 255, 0.2)',
                                            borderRadius: '8px',
                                            padding: '12px',
                                            cursor: 'pointer',
                                            fontWeight: 600,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            opacity: (!peerIdInput || status === 'connecting') ? 0.5 : 1
                                        }}
                                    >
                                        {status === 'connecting' && joinMode === 'spectator' ? '...' : <><Eye size={18} /> Watch</>}
                                    </button>
                                </div>
                            </div>
                            {error && <p style={{ color: '#ff4444', fontSize: '12px', marginTop: '8px' }}>{error}</p>}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
