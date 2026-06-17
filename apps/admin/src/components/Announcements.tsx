import React, { useState } from 'react';
import { SOCKET_EVENTS } from '@psalter/shared';

interface AnnouncementsProps {
  socket: any;
}

export const Announcements: React.FC<AnnouncementsProps> = ({ socket }) => {
  const [msg, setMsg] = useState('');

  const sendNotice = () => {
    if (!msg.trim()) return;
    socket.emit(SOCKET_EVENTS.GM_COMMAND, {
      command: 'announce',
      args: [msg]
    });
    setMsg('');
  };

  return (
    <div style={{ background: '#161b22', padding: '20px', borderRadius: '8px', border: '1px solid #30363d' }}>
      <h3 style={{ margin: '0 0 15px 0', color: '#ff7b72' }}>System-Wide Broadcast System</h3>
      <div style={{ display: 'flex', gap: '10px' }}>
        <input 
          type="text" 
          value={msg} 
          onChange={(e) => setMsg(e.target.value)} 
          placeholder="Type an announcement to send to all online players..."
          style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #30363d', background: '#0d0e12', color: '#fff' }}
        />
        <button 
          onClick={sendNotice}
          style={{ padding: '10px 20px', background: '#238636', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Broadcast
        </button>
      </div>
    </div>
  );
};
