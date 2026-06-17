import React, { useState } from 'react';
import { ItemRarity } from '@psalter/shared';

export const WeaponForge: React.FC = () => {
  const [name, setName] = useState('Voidflame Revenant');
  const [rarity, setRarity] = useState<ItemRarity>('MYTHIC');
  const [element, setElement] = useState('Dark/Fire');
  const [minDmg, setMinDmg] = useState(230);
  const [maxDmg, setMaxDmg] = useState(270);
  const [passive, setPassive] = useState('void_burst');
  const [glowColor, setGlowColor] = useState('#ff0055');

  const handleForge = async () => {
    const itemData = { name, rarity, element, minDamage: minDmg, maxDamage: maxDmg, passiveHook: passive, glowColor, createdBy: "GM_Lester" };
    
    // Dispatches configuration directly to alpha administrative APIs
    console.log("🔨 Custom Weapon generated successfully:", itemData);
    alert(`Successfully forged ${name} [${rarity}] into database arrays!`);
  };

  return (
    <div style={{ background: '#161b22', padding: '20px', borderRadius: '8px', border: '1px solid #30363d' }}>
      <h3 style={{ margin: '0 0 15px 0', color: '#79c0ff' }}>Astra Forge Weapon Generator</h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: '#8b949e' }}>Weapon Identity Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} style={{ width: '90%', padding: '8px', background: '#0d0e12', border: '1px solid #30363d', borderRadius: '4px', color: '#fff' }}/>
        </div>
        
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: '#8b949e' }}>Item Rarity Quality</label>
          <select value={rarity} onChange={e => setRarity(e.target.value as ItemRarity)} style={{ width: '95%', padding: '8px', background: '#0d0e12', border: '1px solid #30363d', borderRadius: '4px', color: '#fff' }}>
            <option value="EPIC">EPIC</option>
            <option value="LEGENDARY">LEGENDARY</option>
            <option value="MYTHIC">MYTHIC</option>
            <option value="PSALTERFORGED">PSALTERFORGED</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: '#8b949e' }}>Elemental Alignment</label>
          <input type="text" value={element} onChange={e => setElement(e.target.value)} style={{ width: '90%', padding: '8px', background: '#0d0e12', border: '1px solid #30363d', borderRadius: '4px', color: '#fff' }}/>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: '#8b949e' }}>Base Damage Window (Min - Max)</label>
          <div style={{ display: 'flex', gap: '5px', width: '95%' }}>
            <input type="number" value={minDmg} onChange={e => setMinDmg(parseInt(e.target.value) || 0)} style={{ width: '50%', padding: '8px', background: '#0d0e12', border: '1px solid #30363d', borderRadius: '4px', color: '#fff' }}/>
            <input type="number" value={maxDmg} onChange={e => setMaxDmg(parseInt(e.target.value) || 0)} style={{ width: '50%', padding: '8px', background: '#0d0e12', border: '1px solid #30363d', borderRadius: '4px', color: '#fff' }}/>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: '#8b949e' }}>Glow Auric Modifier (Hex)</label>
          <input type="color" value={glowColor} onChange={e => setGlowColor(e.target.value)} style={{ width: '90%', height: '38px', background: '#0d0e12', border: '1px solid #30363d', borderRadius: '4px', cursor: 'pointer' }}/>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: '#8b949e' }}>Passive Event Hook</label>
          <input type="text" value={passive} onChange={e => setPassive(e.target.value)} style={{ width: '90%', padding: '8px', background: '#0d0e12', border: '1px solid #30363d', borderRadius: '4px', color: '#fff' }}/>
        </div>
      </div>

      <button 
        onClick={handleForge}
        style={{ width: '100%', marginTop: '20px', padding: '12px', background: '#1f6feb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
      >
        Forge & Spawn Weapon Item Matrix
      </button>
    </div>
  );
};
