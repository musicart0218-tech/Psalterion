import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { PlayerNetworkState, SOCKET_EVENTS } from '@psalter/shared';
import { PlayerList } from './components/PlayerList';
import { Announcements } from './components/Announcements';
import { WeaponForge } from './components/WeaponForge';

// Dynamically map host depending on environment (cloud iframe vs local testbed)
const targetUrl = (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1'))
  ? window.location.origin
  : 'http://localhost:3001';

const socket = io(targetUrl);

export const App: React.FC = () => {
  const [players, setPlayers] = useState<PlayerNetworkState[]>([]);

  useEffect(() => {
    socket.connect();
    
    // Simulate administrative handshake
    socket.emit(SOCKET_EVENTS.AUTH_REQUEST, { characterId: "admin-system-id" });

    socket.on(SOCKET_EVENTS.PLAYER_MOVE, (data: PlayerNetworkState[]) => {
      // Filter out dedicated administrative nodes from active tracking grid lists
      setPlayers(data.filter(p => p.characterName !== undefined));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div style={{ padding: '30px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ borderBottom: '1px solid #30363d', paddingBottom: '15px', marginBottom: '25px' }}>
        <h1 style={{ margin: 0, color: '#f0f6fc', display: 'flex', alignItems: 'center', gap: '10px' }}>
          🌌 Legends of Astra <span style={{ fontSize: '12px', background: '#8b949e33', color: '#8b949e', padding: '4px 8px', borderRadius: '12px' }}>GM Command Panel Alpha</span>
        </h1>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
        <Announcements socket={socket} />
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px' }}>
          <PlayerList players={players} />
          <WeaponForge />
        </div>
      </div>
    </div>
  );
};
