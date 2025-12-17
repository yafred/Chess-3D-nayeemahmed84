import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, X, MessageCircle, Lock, Shield, Smile, Paperclip, Trash2, Loader, Download, ZoomIn, ZoomOut, Reply, Edit2, Check, CheckCheck, Eye, Search, Phone, Video, PhoneOff, Mic, MicOff, VideoOff } from 'lucide-react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { multiplayerService } from '../services/MultiplayerService';
import messageSoundUrl from '../assets/sounds/message.mp3';
import heic2any from 'heic2any';

interface Reaction {
    emoji: string;
    count: number;
    userReacted: boolean;
}

interface Message {
    id: string;
    sender: 'me' | 'opponent' | 'spectator';
    senderName?: string;
    senderRole?: 'host' | 'player' | 'spectator';
    text?: string;
    image?: string;
    timestamp: number;
    reactions: { [emoji: string]: Reaction };
    read?: boolean;
    edited?: boolean;
    replyTo?: {
        id: string;
        text: string;
        sender: string;
    };
}

interface ChatProps {
    isOpen: boolean;
    onToggle: () => void;
    isOpponentConnected: boolean;
    members?: any[];
    myId?: string;
}

const isOnlyEmojis = (text: string) => {
    if (!text) return false;
    const noSpace = text.replace(/\s/g, '');
    if (noSpace.length === 0) return false;
    // Enhanced regex for emojis
    const emojiRegex = /^(\ud83c[\udf00-\udfff]|\ud83d[\udc00-\ude4f\ude80-\udeff]|\ud83e[\udd00-\uddff]|\ud83c[\udde6-\uddef]|\u2600-\u26FF|[\u2700-\u27BF]|\u200D|\uFE0F|\u20E3)+$/;
    return emojiRegex.test(noSpace);
};

const chatStyles = `
@keyframes floatEmoji {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    25% { transform: translateY(-10px) rotate(5deg); }
    50% { transform: translateY(-5px) rotate(-5deg); }
    75% { transform: translateY(-12px) rotate(3deg); }
}

@keyframes pulseBig {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.1); opacity: 0.9; }
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes pulse {
    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
    70% { transform: scale(1.05); box-shadow: 0 0 0 15px rgba(59, 130, 246, 0); }
    100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
}

@keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
}
`;

const stripMetadata = (file: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
            URL.revokeObjectURL(img.src);
        };
        img.onerror = (e) => {
            URL.revokeObjectURL(img.src);
            reject(e);
        };
        img.src = URL.createObjectURL(file);
    });
};

const Chat: React.FC<ChatProps> = ({ isOpen, onToggle, isOpponentConnected, members: initialMembers, myId }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [members, setMembers] = useState<any[]>(initialMembers || []);
    const [inputText, setInputText] = useState('');
    const [unreadCount, setUnreadCount] = useState(0);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isTyping, setIsTyping] = useState(false);
    const typingTimeoutRef = useRef<number | null>(null);
    const notificationSound = useRef(new Audio(messageSoundUrl));

    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // Call state
    const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'incoming' | 'active'>('idle');
    const [isMicMuted, setIsMicMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const [incomingCallData, setIncomingCallData] = useState<any>(null);
    const [selectedImage, setSelectedImage] = useState<{ src: string, id: string } | null>(null);
    const [zoom, setZoom] = useState(1);
    const [isPanning, setIsPanning] = useState(false);
    const [startPan, setStartPan] = useState({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
    const imageContainerRef = useRef<HTMLDivElement>(null);
    const hasPanningMoved = useRef(false);

    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);


    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setSelectedImage(null);
                setZoom(1);
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    // Auto-focus input when chat opens
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen, isTyping]);

    useEffect(() => {
        if (isOpen) {
            setUnreadCount(0);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleMembersUpdate = (e: any) => {
            setMembers(e.detail);
        };
        window.addEventListener('chess-members-update', handleMembersUpdate);
        return () => window.removeEventListener('chess-members-update', handleMembersUpdate);
    }, []);

    useEffect(() => {
        if (isOpen && messages.length > 0) {
            const unreadMessages = messages
                .filter(m => m.sender === 'opponent' && !m.read)
                .map(m => m.id);

            if (unreadMessages.length > 0) {
                // Optimistically update
                setMessages(prev => prev.map(msg =>
                    unreadMessages.includes(msg.id) ? { ...msg, read: true } : msg
                ));

                multiplayerService.sendData({
                    type: 'chat_read',
                    payload: { messageIds: unreadMessages }
                });
            }
        }
    }, [isOpen, messages.length]);

    const playSound = () => {
        try {
            const audio = notificationSound.current;
            audio.currentTime = 0;
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => console.log('Audio play failed:', e));
            }
        } catch (error) {
            console.log('Sound playback error:', error);
        }
    };

    useEffect(() => {
        const handleChatEvent = (e: CustomEvent<{ text: string, id: string, timestamp: number, senderName?: string, senderRole?: any, replyTo?: any, edited?: boolean }>) => {
            const newMessage: Message = {
                id: e.detail.id,
                sender: 'opponent', // Fallback
                senderName: e.detail.senderName,
                senderRole: e.detail.senderRole,
                text: e.detail.text,
                timestamp: e.detail.timestamp,
                reactions: {},
                replyTo: e.detail.replyTo,
                edited: e.detail.edited
            };
            setMessages(prev => [...prev, newMessage]);
            playSound();
            if (!isOpen) {
                setUnreadCount(prev => prev + 1);
            } else {
                // If chat is open, mark as read immediately
                setTimeout(() => {
                    multiplayerService.sendData({
                        type: 'chat_read',
                        payload: { messageIds: [newMessage.id] }
                    });
                }, 100);
            }
            setIsTyping(false);
        };

        const handleImageEvent = (e: CustomEvent<{ image: string, id: string, timestamp: number }>) => {
            const newMessage: Message = {
                id: e.detail.id,
                sender: 'opponent',
                image: e.detail.image,
                timestamp: e.detail.timestamp,
                reactions: {}
            };
            setMessages(prev => [...prev, newMessage]);
            playSound();
            if (!isOpen) {
                setUnreadCount(prev => prev + 1);
            } else {
                setTimeout(() => {
                    multiplayerService.sendData({
                        type: 'chat_read',
                        payload: { messageIds: [newMessage.id] }
                    });
                }, 100);
            }
            setIsTyping(false);
        };

        const handleTypingEvent = (e: CustomEvent<boolean>) => {
            setIsTyping(e.detail);
        };

        const handleReactionEvent = (e: CustomEvent<{ messageId: string, emoji: string, remove?: boolean }>) => {
            const { messageId, emoji, remove } = e.detail;
            if (remove) {
                setMessages(prev => prev.map(msg => {
                    if (msg.id === messageId && msg.reactions[emoji]) {
                        const newCount = msg.reactions[emoji].count - 1;
                        if (newCount === 0) {
                            const { [emoji]: removed, ...remainingReactions } = msg.reactions;
                            return { ...msg, reactions: remainingReactions };
                        }
                        return {
                            ...msg,
                            reactions: {
                                ...msg.reactions,
                                [emoji]: {
                                    ...msg.reactions[emoji],
                                    count: newCount
                                }
                            }
                        };
                    }
                    return msg;
                }));
            } else {
                addReaction(messageId, emoji, false);
            }
            playSound();
        };

        const handleClearHistoryEvent = () => {
            setMessages([]);
        };

        const handleReadEvent = (e: CustomEvent<{ messageIds: string[] }>) => {
            setMessages(prev => prev.map(msg =>
                e.detail.messageIds.includes(msg.id) ? { ...msg, read: true } : msg
            ));
        };

        const handleEditEvent = (e: CustomEvent<{ id: string, text: string }>) => {
            setMessages(prev => prev.map(msg =>
                msg.id === e.detail.id ? { ...msg, text: e.detail.text, edited: true } : msg
            ));
        };

        const handleDeleteMessageEvent = (e: CustomEvent<string>) => {
            setMessages(prev => prev.filter(msg => msg.id !== e.detail));
        };

        window.addEventListener('chess-chat-message' as any, handleChatEvent as any);
        window.addEventListener('chess-chat-image' as any, handleImageEvent as any);
        window.addEventListener('chess-chat-typing' as any, handleTypingEvent as any);
        window.addEventListener('chess-chat-reaction' as any, handleReactionEvent as any);
        window.addEventListener('chess-chat-clear' as any, handleClearHistoryEvent as any);
        window.addEventListener('chess-chat-delete' as any, handleDeleteMessageEvent as any);
        window.addEventListener('chess-chat-read' as any, handleReadEvent as any);
        window.addEventListener('chess-chat-edit' as any, handleEditEvent as any);

        // Call event listeners
        const handleIncomingCall = (e: any) => {
            setIncomingCallData(e.detail);
            setCallStatus('incoming');
        };

        const onCall = (stream: MediaStream) => {
            setRemoteStream(stream);
            setCallStatus('active');
        };

        const onCallEnd = () => {
            setCallStatus('idle');
            setRemoteStream(null);
            setLocalStream(null);
            setIncomingCallData(null);
        };

        window.addEventListener('chess-incoming-call' as any, handleIncomingCall);
        const unbindCall = multiplayerService.onCall(onCall);
        const unbindCallEnd = multiplayerService.onCallEnd(onCallEnd);

        return () => {
            window.removeEventListener('chess-chat-message' as any, handleChatEvent as any);
            window.removeEventListener('chess-chat-image' as any, handleImageEvent as any);
            window.removeEventListener('chess-chat-typing' as any, handleTypingEvent as any);
            window.removeEventListener('chess-chat-reaction' as any, handleReactionEvent as any);
            window.removeEventListener('chess-chat-clear' as any, handleClearHistoryEvent as any);
            window.removeEventListener('chess-chat-delete' as any, handleDeleteMessageEvent as any);
            window.removeEventListener('chess-chat-read' as any, handleReadEvent as any);
            window.removeEventListener('chess-chat-edit' as any, handleEditEvent as any);
            window.removeEventListener('chess-incoming-call' as any, handleIncomingCall);
            unbindCall();
            unbindCallEnd();
        };
    }, [isOpen]);

    // Effect to attach streams to video elements
    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream, callStatus]);

    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream, callStatus]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputText(e.target.value);
        sendTypingStatus(true);
    };

    const sendTypingStatus = (isTyping: boolean) => {
        if (isOpponentConnected) {
            multiplayerService.sendData({ type: 'typing', payload: isTyping });

            if (typingTimeoutRef.current) {
                window.clearTimeout(typingTimeoutRef.current);
            }

            if (isTyping) {
                typingTimeoutRef.current = window.setTimeout(() => {
                    multiplayerService.sendData({ type: 'typing', payload: false });
                }, 1000);
            }
        }
    };

    const handleSend = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputText.trim() || !isOpponentConnected) return;

        if (editingMessageId) {
            // Handle Edit
            setMessages(prev => prev.map(msg =>
                msg.id === editingMessageId ? { ...msg, text: inputText.trim(), edited: true } : msg
            ));

            multiplayerService.sendData({
                type: 'chat_edit',
                payload: { id: editingMessageId, text: inputText.trim() }
            });

            setEditingMessageId(null);
            setInputText('');
            return;
        }

        const messageId = Date.now().toString();
        const timestamp = Date.now();
        const myMeta = multiplayerService.getMyMetadata();
        const newMessage: Message = {
            id: messageId,
            sender: 'me',
            senderName: myMeta.username,
            senderRole: myMeta.role as any,
            text: inputText.trim(),
            timestamp: timestamp,
            reactions: {},
            replyTo: replyingTo ? {
                id: replyingTo.id,
                text: replyingTo.text || '[Image]',
                sender: replyingTo.sender
            } : undefined
        };

        setMessages(prev => [...prev, newMessage]);
        multiplayerService.sendData({
            type: 'chat',
            payload: {
                text: inputText.trim(),
                id: messageId,
                timestamp: timestamp,
                senderName: myMeta.username,
                senderRole: myMeta.role,
                replyTo: replyingTo ? {
                    id: replyingTo.id,
                    text: replyingTo.text || '[Image]',
                    sender: replyingTo.sender
                } : undefined
            }
        });
        setInputText('');
        setReplyingTo(null);
        setShowEmojiPicker(false);
    };

    const onEmojiClick = (emojiData: EmojiClickData) => {
        setInputText(prev => prev + emojiData.emoji);
        setShowEmojiPicker(false);
    };

    const processFile = async (file: File) => {
        if (!isOpponentConnected) return;
        setIsUploading(true);

        try {
            let blobToProcess: Blob = file;

            // Handle HEIC/HEIF conversion
            if (file.type === 'image/heic' ||
                file.type === 'image/heif' ||
                file.name.toLowerCase().endsWith('.heic') ||
                file.name.toLowerCase().endsWith('.heif')) {
                try {
                    const convertedBlob = await heic2any({
                        blob: file,
                        toType: 'image/jpeg',
                        quality: 0.8
                    });
                    blobToProcess = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
                } catch (error) {
                    console.error('HEIC conversion failed:', error);
                }
            }

            // Strip metadata and get base64
            const base64String = await stripMetadata(blobToProcess);

            const messageId = Date.now().toString();
            const timestamp = Date.now();

            const newMessage: Message = {
                id: messageId,
                sender: 'me',
                image: base64String,
                timestamp: timestamp,
                reactions: {}
            };
            setMessages(prev => [...prev, newMessage]);
            multiplayerService.sendData({
                type: 'image',
                payload: { image: base64String, id: messageId, timestamp: timestamp }
            });
        } catch (error) {
            console.error('Error processing image:', error);
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const file = e.dataTransfer.files[0];
        if (file && (file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name))) {
            processFile(file);
        }
    };

    const addReaction = (messageId: string, emoji: string, isMe: boolean) => {
        setMessages(prev => prev.map(msg => {
            if (msg.id === messageId) {
                const existingReaction = msg.reactions[emoji];

                if (isMe && existingReaction && existingReaction.userReacted) {
                    const newCount = existingReaction.count - 1;
                    if (newCount === 0) {
                        const { [emoji]: removed, ...remainingReactions } = msg.reactions;
                        return {
                            ...msg,
                            reactions: remainingReactions
                        };
                    }
                    return {
                        ...msg,
                        reactions: {
                            ...msg.reactions,
                            [emoji]: {
                                ...existingReaction,
                                count: newCount,
                                userReacted: isMe ? false : existingReaction.userReacted
                            }
                        }
                    };
                }

                return {
                    ...msg,
                    reactions: {
                        ...msg.reactions,
                        [emoji]: {
                            emoji,
                            count: (existingReaction?.count || 0) + 1,
                            userReacted: isMe ? true : (existingReaction?.userReacted || false)
                        }
                    }
                };
            }
            return msg;
        }));
    };

    const handleReactionClick = (messageId: string, emoji: string) => {
        if (!isOpponentConnected) return;

        const message = messages.find(m => m.id === messageId);
        const hasReacted = message?.reactions[emoji]?.userReacted;

        addReaction(messageId, emoji, true);
        multiplayerService.sendData({
            type: 'reaction',
            payload: { messageId, emoji, remove: hasReacted }
        });
    };

    const handleClearHistory = () => {
        if (!isOpponentConnected) return;
        setMessages([]);
        multiplayerService.sendData({ type: 'chat_clear', payload: true });
    };

    const handleDeleteMessage = (messageId: string) => {
        setMessages(prev => prev.filter(msg => msg.id !== messageId));
        if (isOpponentConnected) {
            multiplayerService.sendData({ type: 'chat_delete', payload: messageId });
        }
    };



    const handleMouseDown = (e: React.MouseEvent) => {
        if (zoom > 1 && imageContainerRef.current) {
            setIsPanning(true);
            hasPanningMoved.current = false;
            setStartPan({
                x: e.clientX,
                y: e.clientY,
                scrollLeft: imageContainerRef.current.scrollLeft,
                scrollTop: imageContainerRef.current.scrollTop
            });
            e.preventDefault();
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isPanning || !imageContainerRef.current) return;
        e.preventDefault();
        const x = e.clientX - startPan.x;
        const y = e.clientY - startPan.y;

        if (Math.abs(x) > 5 || Math.abs(y) > 5) {
            hasPanningMoved.current = true;
        }

        imageContainerRef.current.scrollLeft = startPan.scrollLeft - x;
        imageContainerRef.current.scrollTop = startPan.scrollTop - y;
    };

    const handleMouseUp = () => {
        setIsPanning(false);
    };

    // --- Call Actions ---
    const startCall = async (video: boolean) => {
        const opponent = members.find(m => m.role === 'player' && m.id !== myId);

        if (!isOpponentConnected) {
            alert('Cannot start call: Opponent is not connected.');
            return;
        }
        if (!opponent || !opponent.id) {
            console.log('[Chat] Opponent search debug:', { members, myId: multiplayerService.myId });
            alert('Cannot start call: Your opponent could not be identified.');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: video,
                audio: true
            });
            setLocalStream(stream);
            setCallStatus('calling');
            setIsVideoOff(!video);
            multiplayerService.startCall(opponent.id, stream);
        } catch (err) {
            console.error('Failed to get media stream:', err);
            alert('Could not access camera or microphone. Please check permissions.');
        }
    };

    const answerCall = async () => {
        if (!incomingCallData) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true, // Answer with both by default, user can toggle
                audio: true
            });
            setLocalStream(stream);
            multiplayerService.answerCall(stream);
            setCallStatus('active');
        } catch (err) {
            console.error('Failed to answer call:', err);
            multiplayerService.endCall();
        }
    };

    const endCall = () => {
        multiplayerService.endCall();
        setCallStatus('idle');
        setLocalStream(null);
        setRemoteStream(null);
        setIncomingCallData(null);
    };

    const toggleMic = () => {
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMicMuted(!audioTrack.enabled);
            }
        }
    };

    const toggleVideo = () => {
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoOff(!videoTrack.enabled);
            }
        }
    };

    return (
        <>
            <style>
                {`
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`}
            </style>
            <button
                onClick={onToggle}
                style={{
                    position: 'absolute',
                    bottom: '20px',
                    left: '20px',
                    width: '50px',
                    height: '50px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'white',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                    zIndex: 100
                }}
                onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
            >
                <MessageCircle size={24} />
                {unreadCount > 0 && (
                    <div style={{
                        position: 'absolute',
                        top: '-5px',
                        right: '-5px',
                        background: '#ef4444',
                        color: 'white',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid #1a1a1a'
                    }}>
                        {unreadCount}
                    </div>
                )}
            </button>

            {isOpen && (
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    style={{
                        position: 'absolute',
                        bottom: '80px',
                        left: '20px',
                        width: '320px',
                        height: '450px',
                        background: isDragging ? 'rgba(20, 20, 20, 0.98)' : 'rgba(20, 20, 20, 0.95)',
                        backdropFilter: 'blur(20px)',
                        borderRadius: '16px',
                        border: isDragging ? '2px dashed #4ade80' : '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                        zIndex: 100,
                        animation: 'slideUp 0.3s ease-out',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <style>{chatStyles}</style>

                    {/* Call Overlay / Active Call UI */}
                    {callStatus !== 'idle' && (
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0,0,0,0.9)',
                            zIndex: 400,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '20px',
                            animation: 'fadeIn 0.3s ease'
                        }}>
                            {callStatus === 'incoming' && (
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ marginBottom: '20px' }}>
                                        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyItems: 'center', margin: '0 auto 15px' }}>
                                            <Phone size={40} color="#4ade80" style={{ margin: 'auto' }} />
                                        </div>
                                        <h3 style={{ color: 'white', margin: 0 }}>Incoming Call</h3>
                                        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>Opponent is calling you...</p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '15px' }}>
                                        <button onClick={answerCall} style={{ background: '#4ade80', color: 'black', border: 'none', borderRadius: '50%', width: '50px', height: '50px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Phone size={24} />
                                        </button>
                                        <button onClick={endCall} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '50px', height: '50px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <PhoneOff size={24} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {callStatus === 'calling' && (
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyItems: 'center', margin: '0 auto 15px', animation: 'pulse 2s infinite' }}>
                                        <Phone size={40} color="#3b82f6" style={{ margin: 'auto' }} />
                                    </div>
                                    <h3 style={{ color: 'white' }}>Calling...</h3>
                                    <button onClick={endCall} style={{ marginTop: '20px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '50px', height: '50px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <PhoneOff size={24} />
                                    </button>
                                </div>
                            )}

                            {callStatus === 'active' && (
                                <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                                    {/* Remote Video (Main) */}
                                    <div style={{ flex: 1, background: '#000', borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
                                        <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        <div style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', color: 'white' }}>Opponent</div>
                                    </div>

                                    {/* Local Video (Preview) */}
                                    <div style={{ position: 'absolute', top: '10px', right: '10px', width: '80px', height: '110px', background: '#222', borderRadius: '8px', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.2)', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                                        <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                                        {isVideoOff && (
                                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <VideoOff size={20} color="rgba(255,255,255,0.4)" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Call Controls */}
                                    <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', padding: '15px 0' }}>
                                        <button onClick={toggleMic} style={{ background: isMicMuted ? '#ef4444' : 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {isMicMuted ? <MicOff size={20} /> : <Mic size={20} />}
                                        </button>
                                        <button onClick={toggleVideo} style={{ background: isVideoOff ? '#ef4444' : 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
                                        </button>
                                        <button onClick={endCall} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <PhoneOff size={20} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {isDragging && (
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(74, 222, 128, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 300,
                            pointerEvents: 'none',
                            backdropFilter: 'blur(4px)'
                        }}>
                            <div style={{
                                background: 'rgba(0,0,0,0.8)',
                                padding: '20px',
                                borderRadius: '16px',
                                color: '#4ade80',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '12px',
                                border: '1px solid #4ade80'
                            }}>
                                <Paperclip size={48} />
                                <span style={{ fontWeight: 'bold' }}>Drop image to share</span>
                            </div>
                        </div>
                    )}
                    <div style={{
                        padding: '16px',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'rgba(255, 255, 255, 0.02)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 600, fontSize: '14px', color: 'white' }}>#{members.length} Online</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.6 }}>
                                <Eye size={12} />
                                <span style={{ fontSize: '11px' }}>{members.filter(m => m.role === 'spectator').length}</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {isOpponentConnected && members.some(m => m.role === 'player' && m.id !== myId) && callStatus === 'idle' && (
                                <>
                                    <button
                                        onClick={() => startCall(false)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: 'rgba(255,255,255,0.5)',
                                            cursor: 'pointer',
                                            padding: '4px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            transition: 'color 0.2s'
                                        }}
                                        onMouseOver={e => e.currentTarget.style.color = '#4ade80'}
                                        onMouseOut={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
                                        title="Start Voice Call"
                                    >
                                        <Phone size={16} />
                                    </button>
                                    <button
                                        onClick={() => startCall(true)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: 'rgba(255,255,255,0.5)',
                                            cursor: 'pointer',
                                            padding: '4px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            transition: 'color 0.2s'
                                        }}
                                        onMouseOver={e => e.currentTarget.style.color = '#3b82f6'}
                                        onMouseOut={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
                                        title="Start Video Call"
                                    >
                                        <Video size={16} />
                                    </button>
                                </>
                            )}
                            <button
                                onClick={() => {
                                    setIsSearching(!isSearching);
                                    if (!isSearching) setSearchQuery('');
                                }}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: isSearching ? '#3b82f6' : 'rgba(255,255,255,0.5)',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                                title="Search messages"
                            >
                                <Search size={16} />
                            </button>
                            <button
                                onClick={handleClearHistory}
                                disabled={!isOpponentConnected || messages.length === 0}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: messages.length > 0 && isOpponentConnected ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)',
                                    cursor: messages.length > 0 && isOpponentConnected ? 'pointer' : 'not-allowed',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                                title="Clear chat history"
                            >
                                <Trash2 size={16} />
                            </button>
                            <button
                                onClick={onToggle}
                                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    <div style={{
                        padding: '8px',
                        background: 'rgba(74, 222, 128, 0.1)',
                        fontSize: '10px',
                        color: '#4ade80',
                        textAlign: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                    }}>
                        <Lock size={10} />
                        Messages are end-to-end encrypted and not saved.
                    </div>

                    {isSearching && (
                        <div style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            <input
                                type="text"
                                placeholder="Search messages..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                autoFocus
                                style={{
                                    width: '100%',
                                    background: 'rgba(0,0,0,0.2)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    padding: '6px 12px',
                                    color: 'white',
                                    fontSize: '12px',
                                    outline: 'none'
                                }}
                            />
                        </div>
                    )}

                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                    }}>
                        {messages.length === 0 ? (
                            <div style={{ textAlign: 'center', marginTop: '40px', opacity: 0.3, fontSize: '13px' }}>
                                <MessageCircle size={32} style={{ marginBottom: '8px' }} />
                                <p>No messages yet.</p>
                                <p>Say hello! 👋</p>
                            </div>
                        ) : (
                            messages
                                .filter(msg => {
                                    if (!isSearching || !searchQuery) return true;
                                    const content = msg.text?.toLowerCase() || '';
                                    const sender = msg.senderName?.toLowerCase() || '';
                                    const query = searchQuery.toLowerCase();
                                    return content.includes(query) || sender.includes(query);
                                })
                                .map(msg => (
                                    <div
                                        key={msg.id}
                                        style={{
                                            alignSelf: msg.sender === 'me' ? 'flex-end' : 'flex-start',
                                            maxWidth: '80%',
                                            position: 'relative'
                                        }}
                                        onMouseEnter={() => setHoveredMessageId(msg.id)}
                                        onMouseLeave={() => setHoveredMessageId(null)}
                                        onDoubleClick={() => {
                                            setReplyingTo(msg);
                                            inputRef.current?.focus();
                                        }}
                                    >
                                        <div style={{
                                            background: (!msg.image && msg.text && isOnlyEmojis(msg.text)) ? 'transparent' : (msg.sender === 'me' ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)'),
                                            padding: (!msg.image && msg.text && isOnlyEmojis(msg.text)) ? '0' : (msg.image ? '4px' : '8px 12px'),
                                            borderRadius: msg.sender === 'me' ? '12px 12px 0 12px' : '12px 12px 12px 0',
                                            fontSize: (!msg.image && msg.text && isOnlyEmojis(msg.text)) ? '48px' : '13px',
                                            lineHeight: (!msg.image && msg.text && isOnlyEmojis(msg.text)) ? '1.2' : '1.5',
                                            color: 'white',
                                            wordBreak: 'break-word',
                                            position: 'relative',
                                            marginBottom: Object.values(msg.reactions).length > 0 ? '14px' : '0'
                                        }}>
                                            {msg.sender !== 'me' && (
                                                <div style={{
                                                    fontSize: '10px',
                                                    fontWeight: 700,
                                                    marginBottom: '4px',
                                                    color: msg.senderRole === 'host' ? '#facc15' : 'rgba(255,255,255,0.7)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}>
                                                    {msg.senderName || 'Anonymous'}
                                                    {msg.senderRole === 'host' && <Shield size={10} />}
                                                    <span style={{
                                                        fontSize: '9px',
                                                        opacity: 0.5,
                                                        textTransform: 'uppercase',
                                                        padding: '1px 4px',
                                                        background: 'rgba(255,255,255,0.1)',
                                                        borderRadius: '4px'
                                                    }}>
                                                        {msg.senderRole}
                                                    </span>
                                                </div>
                                            )}
                                            {msg.image ? (
                                                <img
                                                    src={msg.image}
                                                    alt="Shared"
                                                    style={{ maxWidth: '100%', borderRadius: '8px', cursor: 'zoom-in', display: 'block' }}
                                                    onClick={() => { setSelectedImage({ src: msg.image!, id: msg.id }); setZoom(1); }}
                                                />
                                            ) : (
                                                msg.text && (
                                                    <div style={{
                                                        fontSize: (!msg.image && msg.text && isOnlyEmojis(msg.text)) ? '80px' : '13px',
                                                        lineHeight: (!msg.image && msg.text && isOnlyEmojis(msg.text)) ? '1.1' : '1.5',
                                                        animation: (!msg.image && msg.text && isOnlyEmojis(msg.text)) ? 'floatEmoji 3s ease-in-out infinite, pulseBig 2s ease-in-out infinite' : 'none',
                                                        filter: (!msg.image && msg.text && isOnlyEmojis(msg.text)) ? 'drop-shadow(0 0 15px rgba(255, 255, 255, 0.3))' : 'none',
                                                        display: 'flex',
                                                        flexDirection: 'column'
                                                    }}>
                                                        {msg.replyTo && (
                                                            <div style={{
                                                                borderLeft: '2px solid rgba(255,255,255,0.3)',
                                                                paddingLeft: '8px',
                                                                marginBottom: '6px',
                                                                fontSize: '11px',
                                                                opacity: 0.7
                                                            }}>
                                                                <div style={{ fontWeight: 'bold' }}>{msg.replyTo.sender === 'me' ? 'You' : 'Opponent'}</div>
                                                                <div style={{
                                                                    whiteSpace: 'nowrap',
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    maxWidth: '150px'
                                                                }}>
                                                                    {msg.replyTo.text}
                                                                </div>
                                                            </div>
                                                        )}
                                                        <ReactMarkdown
                                                            components={{
                                                                p: ({ children }) => {
                                                                    const myUsername = multiplayerService.getMyMetadata().username;

                                                                    // Function to process content for mentions and moves
                                                                    const processContent = (text: string) => {
                                                                        const parts: (string | React.ReactNode)[] = [];
                                                                        let lastIndex = 0;

                                                                        // Combined regex for @username and chess moves (e4, Nf3, O-O, O-O-O, etc.)
                                                                        const regex = /(@\w+)|([NBRQK]?[a-h]?[1-8]?x?[a-h][1-8](?:\=[NBRQK])?[+#]?)|(O-O(?:-O)?)/g;

                                                                        let match;
                                                                        while ((match = regex.exec(text)) !== null) {
                                                                            // Add text before match
                                                                            if (match.index > lastIndex) {
                                                                                parts.push(text.substring(lastIndex, match.index));
                                                                            }

                                                                            const mention = match[1];
                                                                            const move = match[2] || match[3];

                                                                            if (mention) {
                                                                                const isMe = mention === `@${myUsername} `;
                                                                                parts.push(
                                                                                    <span key={match.index} style={{
                                                                                        color: isMe ? '#facc15' : '#60a5fa',
                                                                                        fontWeight: 600,
                                                                                        background: isMe ? 'rgba(250, 204, 21, 0.1)' : 'transparent',
                                                                                        padding: isMe ? '0 4px' : '0',
                                                                                        borderRadius: '4px'
                                                                                    }}>
                                                                                        {mention}
                                                                                    </span>
                                                                                );
                                                                            } else if (move) {
                                                                                parts.push(
                                                                                    <span
                                                                                        key={match.index}
                                                                                        onClick={() => {
                                                                                            window.dispatchEvent(new CustomEvent('chess-chat-move-highlight', { detail: move }));
                                                                                        }}
                                                                                        style={{
                                                                                            color: '#4ade80',
                                                                                            cursor: 'pointer',
                                                                                            fontWeight: 600,
                                                                                            textDecoration: 'underline',
                                                                                            textDecorationStyle: 'dotted'
                                                                                        }}
                                                                                        title={`Highlight ${move} on board`}
                                                                                    >
                                                                                        {move}
                                                                                    </span>
                                                                                );
                                                                            }

                                                                            lastIndex = regex.lastIndex;
                                                                        }

                                                                        // Add remaining text
                                                                        if (lastIndex < text.length) {
                                                                            parts.push(text.substring(lastIndex));
                                                                        }

                                                                        return parts;
                                                                    };

                                                                    const renderChildren = (child: any): any => {
                                                                        if (typeof child === 'string') {
                                                                            return processContent(child);
                                                                        }
                                                                        if (Array.isArray(child)) {
                                                                            return child.map(renderChildren);
                                                                        }
                                                                        return child;
                                                                    };

                                                                    return <p style={{ margin: 0 }}>{renderChildren(children)}</p>;
                                                                },
                                                                code: ({ children }) => <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 4px', borderRadius: '4px', fontFamily: 'monospace' }}>{children}</code>,
                                                                pre: ({ children }) => <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '4px', overflowX: 'auto', margin: '4px 0' }}>{children}</pre>,
                                                                a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', textDecoration: 'underline' }}>{children}</a>
                                                            }}
                                                        >
                                                            {msg.text}
                                                        </ReactMarkdown>
                                                        {msg.edited && (
                                                            <span style={{ fontSize: '10px', opacity: 0.5, marginLeft: '4px', fontStyle: 'italic' }}>
                                                                (edited)
                                                            </span>
                                                        )}
                                                    </div>
                                                )
                                            )}

                                            {Object.values(msg.reactions).length > 0 && (
                                                <div style={{
                                                    position: 'absolute',
                                                    bottom: '-18px',
                                                    right: msg.sender === 'me' ? '0' : 'auto',
                                                    left: msg.sender === 'me' ? 'auto' : '0',
                                                    display: 'flex',
                                                    gap: '4px',
                                                    background: 'rgba(0, 0, 0, 0.6)',
                                                    backdropFilter: 'blur(4px)',
                                                    borderRadius: '16px',
                                                    padding: '4px 8px',
                                                    fontSize: '13px',
                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                                                    alignItems: 'center',
                                                    border: '1px solid rgba(255,255,255,0.1)'
                                                }}>
                                                    {Object.values(msg.reactions).map(r => (
                                                        <span key={r.emoji} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                            <span style={{ fontSize: '14px' }}>{r.emoji}</span>
                                                            {r.count > 1 && <span style={{ fontSize: '11px', fontWeight: 'bold' }}>{r.count}</span>}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {hoveredMessageId === msg.id && (
                                            <div style={{
                                                position: 'absolute',
                                                bottom: '-35px',
                                                left: msg.sender === 'me' ? 'auto' : '0',
                                                right: msg.sender === 'me' ? '0' : 'auto',
                                                background: 'rgba(20, 20, 20, 0.9)',
                                                backdropFilter: 'blur(8px)',
                                                borderRadius: '24px',
                                                padding: '4px 8px',
                                                display: 'flex',
                                                gap: '6px',
                                                zIndex: 20,
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                                border: '1px solid rgba(255,255,255,0.1)'
                                            }}>
                                                {['👍', '❤️', '😂', '😮'].map(emoji => (
                                                    <button
                                                        key={emoji}
                                                        onClick={() => handleReactionClick(msg.id, emoji)}
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            fontSize: '24px',
                                                            padding: '4px',
                                                            transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                                            lineHeight: 1
                                                        }}
                                                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.3)'}
                                                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                                    >
                                                        {emoji}
                                                    </button>
                                                ))}

                                                {msg.sender === 'me' && (
                                                    <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
                                                )}


                                                {/* Reply button - available for all messages */}
                                                <button
                                                    onClick={() => {
                                                        setReplyingTo(msg);
                                                        inputRef.current?.focus();
                                                    }}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        color: 'rgba(255, 255, 255, 0.8)',
                                                        padding: '4px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        transition: 'transform 0.2s ease'
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                                                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                                    title="Reply"
                                                >
                                                    <Reply size={18} />
                                                </button>
                                                {msg.sender === 'me' && (
                                                    <button
                                                        onClick={() => {
                                                            setEditingMessageId(msg.id);
                                                            setInputText(msg.text || '');
                                                            inputRef.current?.focus();
                                                        }}
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            color: 'rgba(255, 255, 255, 0.8)',
                                                            padding: '4px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            transition: 'transform 0.2s ease'
                                                        }}
                                                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                                                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                                        title="Edit"
                                                    >
                                                        <Edit2 size={18} />
                                                    </button>
                                                )}


                                                {msg.sender === 'me' && (
                                                    <button
                                                        onClick={() => handleDeleteMessage(msg.id)}
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            color: '#ef4444',
                                                            padding: '4px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            transition: 'transform 0.2s ease'
                                                        }}
                                                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                                                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                                        title="Delete for everyone"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        <div style={{
                                            fontSize: '10px',
                                            opacity: 0.4,
                                            marginTop: '4px',
                                            textAlign: msg.sender === 'me' ? 'right' : 'left',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: msg.sender === 'me' ? 'flex-end' : 'flex-start',
                                            gap: '4px'
                                        }}>
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            {msg.sender === 'me' && (
                                                msg.read ? <CheckCheck size={12} color="#60a5fa" /> : <Check size={12} />
                                            )}
                                        </div>
                                    </div>
                                ))
                        )}

                        {isTyping && (
                            <div style={{
                                alignSelf: 'flex-start',
                                background: 'rgba(255, 255, 255, 0.05)',
                                padding: '8px 12px',
                                borderRadius: '12px 12px 12px 0',
                                fontSize: '12px',
                                color: 'rgba(255, 255, 255, 0.7)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                animation: 'fadeIn 0.2s ease'
                            }}>
                                <span style={{ animation: 'bounce 1s infinite', animationDelay: '0s' }}>•</span>
                                <span style={{ animation: 'bounce 1s infinite', animationDelay: '0.2s' }}>•</span>
                                <span style={{ animation: ' bounce 1s infinite', animationDelay: '0.4s' }}>•</span>
                            </div>
                        )}

                        {isUploading && (
                            <div style={{
                                alignSelf: 'flex-end',
                                background: 'rgba(59, 130, 246, 0.2)',
                                padding: '8px 12px',
                                borderRadius: '12px 12px 0 12px',
                                fontSize: '12px',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                animation: 'fadeIn 0.2s ease',
                                marginBottom: '8px'
                            }}>
                                <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
                                <span>Sending image...</span>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    <div style={{
                        padding: '12px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                        background: 'rgba(0, 0, 0, 0.2)',
                        position: 'relative'
                    }}>
                        {replyingTo && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: 'rgba(255,255,255,0.1)',
                                padding: '8px',
                                borderRadius: '8px',
                                marginBottom: '8px',
                                fontSize: '12px',
                                color: 'rgba(255,255,255,0.8)'
                            }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span style={{ fontWeight: 'bold', color: '#60a5fa' }}>
                                        Replying to {replyingTo.sender === 'me' ? 'yourself' : 'opponent'}
                                    </span>
                                    <span style={{
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        maxWidth: '200px'
                                    }}>
                                        {replyingTo.text || '[Image]'}
                                    </span>
                                </div>
                                <button
                                    onClick={() => setReplyingTo(null)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'rgba(255,255,255,0.5)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                        {editingMessageId && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: 'rgba(255,255,255,0.1)',
                                padding: '8px',
                                borderRadius: '8px',
                                marginBottom: '8px',
                                fontSize: '12px',
                                color: 'rgba(255,255,255,0.8)'
                            }}>
                                <span style={{ fontWeight: 'bold', color: '#facc15' }}>Editing message</span>
                                <button
                                    onClick={() => {
                                        setEditingMessageId(null);
                                        setInputText('');
                                    }}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'rgba(255,255,255,0.5)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                        {showEmojiPicker && (
                            <div style={{ position: 'absolute', bottom: '60px', left: '10px', zIndex: 200 }}>
                                <EmojiPicker
                                    onEmojiClick={onEmojiClick}
                                    theme={'dark' as any}
                                    width={280}
                                    height={300}
                                />
                            </div>
                        )}


                        <form onSubmit={handleSend} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowEmojiPicker(!showEmojiPicker);
                                }}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: showEmojiPicker ? '#facc15' : 'rgba(255,255,255,0.6)',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    flexShrink: 0,
                                    transition: 'color 0.2s'
                                }}
                            >
                                <Smile size={18} />
                            </button>

                            <input
                                type="file"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                accept="image/*"
                                onChange={handleFileUpload}
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'rgba(255,255,255,0.6)',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    flexShrink: 0
                                }}
                            >
                                <Paperclip size={18} />
                            </button>

                            <input
                                ref={inputRef}
                                type="text"
                                value={inputText}
                                onChange={handleInputChange}
                                placeholder={isOpponentConnected ? "Type a message..." : "Opponent disconnected"}
                                disabled={!isOpponentConnected}
                                style={{
                                    flex: 1,
                                    minWidth: 0,
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '20px',
                                    padding: '8px 12px',
                                    color: 'white',
                                    fontSize: '13px',
                                    outline: 'none'
                                }}
                            />
                            <button
                                type="submit"
                                disabled={!inputText.trim() || !isOpponentConnected}
                                style={{
                                    background: inputText.trim() && isOpponentConnected ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)',
                                    border: 'none',
                                    minWidth: '36px',
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    cursor: inputText.trim() && isOpponentConnected ? 'pointer' : 'not-allowed',
                                    transition: 'all 0.2s ease',
                                    flexShrink: 0
                                }}
                            >
                                <Send size={16} />
                            </button>
                        </form>
                    </div>

                    {/* Image Popup */}
                    {selectedImage && (
                        <div style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0,0,0,0.95)',
                            zIndex: 1000,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            animation: 'fadeIn 0.2s ease',
                            backdropFilter: 'blur(5px)',
                            overflow: 'hidden'
                        }} onClick={() => { setSelectedImage(null); setZoom(1); }}>

                            {/* Controls */}
                            <div style={{
                                position: 'fixed',
                                bottom: '40px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                background: 'rgba(20, 20, 20, 0.8)',
                                backdropFilter: 'blur(12px)',
                                padding: '12px 24px',
                                borderRadius: '24px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '20px',
                                zIndex: 1002,
                                border: '1px solid rgba(255,255,255,0.1)',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                            }} onClick={e => e.stopPropagation()}>
                                <button
                                    onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                                    style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '4px', display: 'flex' }}
                                    title="Zoom Out"
                                >
                                    <ZoomOut size={20} />
                                </button>
                                <span style={{ color: 'white', fontSize: '14px', fontWeight: 600, minWidth: '40px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                                    {Math.round(zoom * 100)}%
                                </span>
                                <button
                                    onClick={() => setZoom(z => Math.min(3, z + 0.25))}
                                    style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '4px', display: 'flex' }}
                                    title="Zoom In"
                                >
                                    <ZoomIn size={20} />
                                </button>
                                <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)' }} />
                                <a
                                    href={selectedImage.src}
                                    download={`chess_image_${selectedImage.id}.jpg`}
                                    style={{ color: '#4ade80', display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}
                                    title="Download"
                                >
                                    <Download size={18} />
                                    <span>Save</span>
                                </a>
                            </div>

                            {/* Close Button */}
                            <button
                                onClick={() => { setSelectedImage(null); setZoom(1); }}
                                style={{
                                    position: 'fixed',
                                    top: '30px',
                                    right: '30px',
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    border: 'none',
                                    color: 'white',
                                    cursor: 'pointer',
                                    padding: '12px',
                                    borderRadius: '50%',
                                    zIndex: 1002,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s ease',
                                    backdropFilter: 'blur(4px)'
                                }}
                                onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; e.currentTarget.style.transform = 'rotate(90deg)'; }}
                                onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.transform = 'rotate(0deg)'; }}
                            >
                                <X size={24} />
                            </button>

                            {/* Image */}
                            <div
                                ref={imageContainerRef}
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseUp}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    overflow: 'auto',
                                    cursor: zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default',
                                    userSelect: 'none'
                                }}
                            >
                                <img
                                    src={selectedImage.src}
                                    alt="Full size"
                                    style={{
                                        maxWidth: zoom === 1 ? '90vw' : 'none',
                                        maxHeight: zoom === 1 ? '85vh' : 'none',
                                        height: zoom === 1 ? 'auto' : `${zoom * 85}vh`,
                                        borderRadius: '8px',
                                        boxShadow: '0 0 40px rgba(0,0,0,0.5)',
                                        transition: isPanning ? 'none' : 'all 0.2s ease',
                                    }}
                                    onClick={e => {
                                        e.stopPropagation();
                                        if (!hasPanningMoved.current) {
                                            setZoom(z => z === 1 ? 2 : 1);
                                        }
                                    }}
                                    draggable={false}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

export default Chat;
