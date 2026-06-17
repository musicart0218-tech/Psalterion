import React from 'react';
import { PlayerNetworkState } from '@psalter/shared';

interface PlayerListProps {
  players: PlayerNetworkState[];
}

export const PlayerList: React.FC<PlayerListProps> = ({ players }) => {
  return (
    <div style={{ background: '#161b22', padding: '20px', borderRadius: '8px', border: '1px solid #30363d' }}>
      <h3 style={{ margin: '0 0 15px 0', color: '#58a6ff' }}>Active Players Online ({players.length})</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #30363d', color: '#8b949e' }}>
            <th style={{ padding: '8px' }}>Character</th>
            <th style={{ padding: '8px' }}>Class</th>
            <th style={{ padding: '8px' }}>Map Zone</th>
            <th style={{ padding: '8px' }}>Coordinates</th>
          </tr>
        </thead>
        <tbody>
          {players.length === 0 ? (
            <tr><td colSpan={4} style={{ padding: '15px', textAlign: 'center', color: '#8b949e' }}>No entities active in world spaces.</td></tr>
          ) : (
            players.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid #21262d' }}>
                <td style={{ padding: '8px', fontWeight: 'bold' }}>{p.characterName}</td>
                <td style={{ padding: '8px' }}><span style={{ fontSize: '11px', background: '#21262d', padding: '3px 6px', borderRadius: '4px' }}>{p.className}</span></td>
                <td style={{ padding: '8px', color: '#79c0ff' }}>{p.mapId}</td>
                <td style={{ padding: '8px', fontFamily: 'monospace' }}>X: {Math.round(p.position.x)}, Y: {Math.round(p.position.y)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
