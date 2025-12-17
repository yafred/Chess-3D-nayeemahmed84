import Peer, { DataConnection } from 'peerjs';

export interface MultiplayerData {
    type: 'move' | 'game_start' | 'game_over' | 'chat' | 'interaction' | 'heartbeat' | 'typing' | 'reaction' | 'image' | 'chat_clear' | 'chat_delete' | 'chat_read' | 'chat_edit' | 'game_state_request' | 'game_state_sync' | 'sync_members' | 'evaluation_sync';
    payload: any;
}

export interface ConnectionMetadata {
    role: 'player' | 'spectator';
    username?: string;
    id?: string;
}

class MultiplayerService {
    private peer: Peer | null = null;
    // We now support multiple connections (Host -> [Opponent, Spectator1, Spectator2...])
    private connections: DataConnection[] = [];

    private onDataCallbacks: ((data: MultiplayerData, conn: DataConnection) => void)[] = [];
    private onConnectCallbacks: ((conn: DataConnection) => void)[] = [];
    private onDisconnectCallbacks: ((conn: DataConnection) => void)[] = [];

    private heartbeatInterval: number | null = null;
    private heartbeatTimeoutId: number | null = null;
    private lastHeartbeatReceived: Map<string, number> = new Map();
    private memberList: ConnectionMetadata[] = [];
    private myMetadata: ConnectionMetadata = { role: 'player', username: 'Host' };

    public myId: string = '';
    private onErrorCallbacks: ((error: string) => void)[] = [];

    initialize(onId: (id: string) => void) {
        if (this.peer) {
            if (this.myId) {
                onId(this.myId);
            }
            return;
        }

        this.peer = new Peer();
        console.log('[MultiplayerService] Initializing new Peer...');

        this.peer.on('open', (id) => {
            console.log('[MultiplayerService] ✓ Peer initialized successfully. My ID:', id);
            this.myId = id;
            onId(id);
        });

        this.peer.on('connection', (conn) => {
            console.log('[MultiplayerService] ✓ Incoming connection from:', conn.peer, 'Metadata:', conn.metadata);
            this.handleConnection(conn);
        });

        this.peer.on('error', (err) => {
            console.error('[MultiplayerService] ✗ PeerJS error:', err);
            console.error('[MultiplayerService] Error type:', err.type);
            this.triggerError(`Connection failed: ${err.type || 'Unknown error'}`);
        });
    }

    connect(peerId: string, metadata: ConnectionMetadata = { role: 'player' }) {
        if (!this.peer) {
            console.error('[MultiplayerService] Cannot connect: Peer not initialized');
            this.triggerError('Peer service not initialized. Please refresh and try again.');
            return;
        }

        if (this.peer.disconnected) {
            console.error('[MultiplayerService] Cannot connect: Peer is disconnected from server');
            this.triggerError('Not connected to server. Please wait a moment and try again.');
            return;
        }

        if (!this.myId) {
            console.error('[MultiplayerService] Cannot connect: myId not set yet');
            this.triggerError('Still initializing. Please wait a moment and try again.');
            return;
        }

        console.log('[MultiplayerService] My ID:', this.myId);
        console.log('[MultiplayerService] Connecting to peer ID:', peerId, 'as', metadata.role);

        const conn = this.peer.connect(peerId, {
            metadata: metadata
        });

        if (!conn) {
            console.error('[MultiplayerService] peer.connect() returned undefined');
            this.triggerError('Failed to create connection. Please check the Room ID and try again.');
            return;
        }

        this.handleConnection(conn);
    }

    setMyMetadata(metadata: Partial<ConnectionMetadata>) {
        this.myMetadata = { ...this.myMetadata, ...metadata, id: this.myId };
    }

    getMyMetadata() {
        return this.myMetadata;
    }

    private handleConnection(conn: DataConnection) {
        this.connections.push(conn);

        conn.on('open', () => {
            console.log(`Connection established with ${conn.peer}!`);
            this.onConnectCallbacks.forEach(cb => cb(conn));
            this.startHeartbeat();
        });

        conn.on('data', (data) => {
            const typedData = data as MultiplayerData;

            if (typedData.type === 'heartbeat') {
                this.lastHeartbeatReceived.set(conn.peer, Date.now());
                return;
            }

            // Global event dispatching for chat/game events that don't need specific handling
            if (typedData.type === 'chat') { window.dispatchEvent(new CustomEvent('chess-chat-message', { detail: typedData.payload })); }
            if (typedData.type === 'typing') { window.dispatchEvent(new CustomEvent('chess-chat-typing', { detail: typedData.payload })); }
            if (typedData.type === 'reaction') { window.dispatchEvent(new CustomEvent('chess-chat-reaction', { detail: typedData.payload })); }
            if (typedData.type === 'image') { window.dispatchEvent(new CustomEvent('chess-chat-image', { detail: typedData.payload })); }
            if (typedData.type === 'chat_clear') { window.dispatchEvent(new CustomEvent('chess-chat-clear', { detail: typedData.payload })); }
            if (typedData.type === 'chat_delete') { window.dispatchEvent(new CustomEvent('chess-chat-delete', { detail: typedData.payload })); }
            if (typedData.type === 'chat_read') { window.dispatchEvent(new CustomEvent('chess-chat-read', { detail: typedData.payload })); }
            if (typedData.type === 'chat_edit') { window.dispatchEvent(new CustomEvent('chess-chat-edit', { detail: typedData.payload })); }

            if (typedData.type === 'sync_members') {
                this.memberList = typedData.payload;
                window.dispatchEvent(new CustomEvent('chess-members-update', { detail: this.memberList }));
            }

            this.onDataCallbacks.forEach(cb => cb(typedData, conn));
        });

        conn.on('close', () => {
            console.log(`Connection closed with ${conn.peer}`);
            this.removeConnection(conn.peer);
        });

        conn.on('error', (err) => {
            console.error(`Connection error with ${conn.peer}:`, err);
            this.removeConnection(conn.peer);
            this.triggerError(err.message || 'Connection Error');
        });

        // If we are Host and a new person connects, rebuild the member list and broadcast
        conn.on('open', () => {
            if (this.isHost()) {
                this.updateAndBroadcastMembers();
            }
        });
    }

    private isHost() {
        // Simple heuristic: if we have open connections and we were the one who initialized without connecting to someone else first...
        // Actually, let's just use the metadata. If we are Host, we didn't 'connect' to anyone, they connected to us.
        // But let's just check if we have multiple connections or if we are the one receiving connections.
        return true; // The one accepting connections is the Host in this P2P mesh
    }

    private updateAndBroadcastMembers() {
        const members: ConnectionMetadata[] = [this.myMetadata];
        this.connections.forEach(c => {
            if (c.open && c.metadata) {
                members.push({ ...c.metadata, id: c.peer });
            }
        });
        this.memberList = members;
        this.broadcast({ type: 'sync_members', payload: members });
        window.dispatchEvent(new CustomEvent('chess-members-update', { detail: this.memberList }));
    }

    private removeConnection(peerId: string) {
        const conn = this.connections.find(c => c.peer === peerId);
        this.connections = this.connections.filter(c => c.peer !== peerId);
        this.lastHeartbeatReceived.delete(peerId);

        if (conn) {
            this.onDisconnectCallbacks.forEach(cb => cb(conn));
        }

        if (this.connections.length === 0) {
            this.stopHeartbeat();
        }
    }

    private triggerError(error: string) {
        this.onErrorCallbacks.forEach(cb => cb(error));
    }

    onError(callback: (error: string) => void) {
        this.onErrorCallbacks.push(callback);
        return () => {
            this.onErrorCallbacks = this.onErrorCallbacks.filter(cb => cb !== callback);
        };
    }

    private startHeartbeat() {
        if (this.heartbeatInterval) return; // Already running

        // Send heartbeat every 3 seconds to ALL connections
        this.heartbeatInterval = window.setInterval(() => {
            this.connections.forEach(conn => {
                if (conn.open) {
                    conn.send({ type: 'heartbeat', payload: null });
                }
            });
        }, 3000);

        // Check for missing heartbeats every 8 seconds
        this.heartbeatTimeoutId = window.setInterval(() => {
            const now = Date.now();
            this.connections.forEach(conn => {
                const last = this.lastHeartbeatReceived.get(conn.peer) || now;
                if (now - last > 10000) {
                    console.log(`[Heartbeat] Timeout for ${conn.peer} - triggering disconnect`);
                    conn.close(); // This will trigger 'close' event which calls removeConnection
                }
            });
        }, 8000);
    }

    private stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        if (this.heartbeatTimeoutId) {
            clearInterval(this.heartbeatTimeoutId);
            this.heartbeatTimeoutId = null;
        }
    }

    // Send data to a specific connection or all
    sendData(data: MultiplayerData, targetPeerId?: string) {
        if (targetPeerId) {
            const conn = this.connections.find(c => c.peer === targetPeerId);
            if (conn && conn.open) {
                conn.send(data);
            }
        } else {
            // Broadcast to all
            this.connections.forEach(conn => {
                if (conn.open) {
                    conn.send(data);
                }
            });
        }
    }

    // Broadcast to all EXCEPT one (useful for relaying chat/moves if we were a true server, 
    // but here Host is the source of truth usually)
    broadcast(data: MultiplayerData, excludePeerId?: string) {
        this.connections.forEach(conn => {
            if (conn.open && conn.peer !== excludePeerId) {
                conn.send(data);
            }
        });
    }

    onData(callback: (data: MultiplayerData, conn: DataConnection) => void) {
        this.onDataCallbacks.push(callback);
        return () => {
            this.onDataCallbacks = this.onDataCallbacks.filter(cb => cb !== callback);
        };
    }

    onConnect(callback: (conn: DataConnection) => void) {
        this.onConnectCallbacks.push(callback);
        // If already connected, fire for existing connections
        this.connections.forEach(conn => {
            if (conn.open) callback(conn);
        });
        return () => {
            this.onConnectCallbacks = this.onConnectCallbacks.filter(cb => cb !== callback);
        };
    }

    onDisconnect(callback: (conn: DataConnection) => void) {
        this.onDisconnectCallbacks.push(callback);
        return () => {
            this.onDisconnectCallbacks = this.onDisconnectCallbacks.filter(cb => cb !== callback);
        };
    }

    isConnected(): boolean {
        return this.connections.some(c => c.open);
    }

    // Get connection by ID
    getConnection(peerId: string) {
        return this.connections.find(c => c.peer === peerId);
    }

    disconnect() {
        this.stopHeartbeat();
        this.connections.forEach(conn => conn.close());
        this.connections = [];
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
    }
}

export const multiplayerService = new MultiplayerService();
