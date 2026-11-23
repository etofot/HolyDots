import { useGameStore } from '../store/useGameStore';
import { useUserStore } from '../store/useUserStore';
import { ArrowLeft, Flame, Zap, Shield, Battery, Bomb, Gem } from 'lucide-react';
import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

const UPGRADES = [
  { key: 'startTemp', name: 'Start Temp', icon: <Flame size={20} color="#FF8800" />, desc: '+5° spawn temp', costs: [500, 1000, 2000, 4000, 8000] },
  { key: 'heatSpeed', name: 'Heat Speed', icon: <Zap size={20} color="#FFD700" />, desc: '+3° per tap', costs: [300, 600, 1200, 2400, 4800] },
  { key: 'coolingResist', name: 'Heat Retain', icon: <Shield size={20} color="#0066FF" />, desc: '-4% cooling rate', costs: [400, 800, 1600, 3200, 6400] },
  { key: 'fuelCap', name: 'Fuel Cap', icon: <Battery size={20} color="#00FF00" />, desc: '+1 max fuel', costs: [1000, 2500, 5000] },
  { key: 'blastRadius', name: 'Blast Radius', icon: <Bomb size={20} color="#FF1100" />, desc: 'Hot ignites neighbors', costs: [2000, 5000, 10000] },
];

const SKINS = [
  { id: 'default', name: 'Default', price: 0 },
  { id: 'magma', name: 'Magma', price: 200, isPremium: true },
  { id: 'ice', name: 'Ice Block', price: 200, isPremium: true },
  { id: 'neon', name: 'Neon Frame', price: 400, isPremium: true }
];

export function Shop() {
  const { setGameState } = useGameStore();
  const { heatPoints, upgrades, crystals, skins, currentSkin, setUser, id } = useUserStore();
  const [tab, setTab] = useState<'upgrades' | 'skins' | 'premium'>('upgrades');
  
  // BUG-012 FIX: Guard against double-click race condition
  const isProcessing = useRef(false);

  const buyUpgrade = (key: keyof typeof upgrades) => {
    // BUG-012 FIX: Reject re-entrant calls (double-click protection)
    if (isProcessing.current) return;
    isProcessing.current = true;
    
    try {
      const level = upgrades[key];
      const def = UPGRADES.find(u => u.key === key);
      if (!def || level >= def.costs.length) return;
      
      const cost = def.costs[level];
      if (heatPoints >= cost) {
        const newUpgrades = { ...upgrades, [key]: level + 1 };
        setUser({ 
          heatPoints: heatPoints - cost, 
          upgrades: newUpgrades 
        });
        if (id) {
          const dbUpgrades = {
            start_temp: newUpgrades.startTemp,
            heat_speed: newUpgrades.heatSpeed,
            cooling_resist: newUpgrades.coolingResist,
            fuel_cap: newUpgrades.fuelCap,
            blast_radius: newUpgrades.blastRadius,
          };
          supabase.from('profiles').update({ 
            heat_points: heatPoints - cost, 
            upgrades: dbUpgrades 
          }).eq('id', id).then();
        }
      }
    } finally {
      // Release lock on next tick to allow legit subsequent buys
      setTimeout(() => { isProcessing.current = false; }, 300);
    }
  };

  const buySkin = (skinId: string, price: number) => {
    // BUG-012 FIX: Reject re-entrant calls (double-click protection)
    if (isProcessing.current) return;
    isProcessing.current = true;
    
    try {
      if (skins.includes(skinId)) {
        setUser({ currentSkin: skinId });
        if (id) supabase.from('profiles').update({ current_skin: skinId }).eq('id', id).then();
      } else if (crystals >= price) {
        const newSkins = [...skins, skinId];
        setUser({ 
          crystals: crystals - price,
          skins: newSkins,
          currentSkin: skinId 
        });
        if (id) {
          supabase.from('profiles').update({ 
            crystals: crystals - price,
            skins: newSkins,
            current_skin: skinId
          }).eq('id', id).then();
        }
      }
    } finally {
      setTimeout(() => { isProcessing.current = false; }, 300);
    }
  };

  return (
    <div className="absolute inset-0 bg-[#0A0A1A] z-50 text-white flex flex-col p-4">
      <div className="flex items-center justify-between mb-6 pt-4 px-2">
        <button onClick={() => setGameState('menu')} className="p-2 hover:bg-gray-800 rounded-full">
          <ArrowLeft size={28} />
        </button>
        <h2 className="text-2xl font-bold uppercase tracking-wider text-[#FFD700]">SHOP</h2>
        <div className="flex gap-4">
          <div className="flex items-center gap-1 font-bold"><Flame size={16} color="#FF8800"/> {heatPoints}</div>
          <div className="flex items-center gap-1 font-bold text-blue-300"><Gem size={16} /> {crystals}</div>
        </div>
      </div>

      <div className="flex gap-2 mb-6 px-2">
        <button onClick={() => setTab('upgrades')} className={`flex-1 py-2 rounded-lg font-bold text-sm ${tab === 'upgrades' ? 'bg-[#FF8800] text-black' : 'bg-gray-800'}`}>UPGRADES</button>
        <button onClick={() => setTab('skins')} className={`flex-1 py-2 rounded-lg font-bold text-sm ${tab === 'skins' ? 'bg-blue-600 text-white' : 'bg-gray-800'}`}>SKINS</button>
        <button onClick={() => setTab('premium')} className={`flex-1 py-2 rounded-lg font-bold text-sm ${tab === 'premium' ? 'bg-[#FFD700] text-black' : 'bg-gray-800'}`}>BUY 💎</button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-8 space-y-4">
        {tab === 'upgrades' && UPGRADES.map(u => {
          const level = upgrades[u.key as keyof typeof upgrades];
          const maxed = level >= u.costs.length;
          const cost = maxed ? 0 : u.costs[level];
          const canAfford = heatPoints >= cost;

          return (
            <div key={u.key} className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-gray-800 p-3 rounded-lg">{u.icon}</div>
                <div>
                  <div className="font-bold">{u.name}</div>
                  <div className="text-xs text-gray-400">{u.desc}</div>
                  <div className="text-xs text-[#FF8800] mt-1 font-mono">LVL {level}/{u.costs.length}</div>
                </div>
              </div>
              <button 
                onClick={() => buyUpgrade(u.key as any)}
                disabled={maxed || !canAfford}
                className={`px-4 py-2 rounded-lg font-bold flex items-center gap-1 ${maxed ? 'bg-gray-700 text-gray-500' : canAfford ? 'bg-[#FF8800] text-black hover:bg-[#FFD700]' : 'bg-gray-800 text-red-400'}`}
              >
                {maxed ? 'MAX' : <><Flame size={14}/> {cost}</>}
              </button>
            </div>
          );
        })}

        {tab === 'skins' && SKINS.map(s => {
          const owned = skins.includes(s.id);
          const active = currentSkin === s.id;
          
          return (
            <div key={s.id} className={`bg-gray-900 border ${active ? 'border-blue-500' : 'border-gray-800'} p-4 rounded-xl flex items-center justify-between`}>
              <div className="font-bold">{s.name}</div>
              <button 
                onClick={() => buySkin(s.id, s.price)}
                className={`px-4 py-2 rounded-lg font-bold flex items-center gap-1 ${active ? 'bg-blue-600 text-white' : owned ? 'bg-gray-700 text-white hover:bg-gray-600' : crystals >= s.price ? 'bg-blue-500 text-white hover:bg-blue-400' : 'bg-gray-800 text-red-400'}`}
              >
                {active ? 'EQUIPPED' : owned ? 'EQUIP' : <><Gem size={14}/> {s.price}</>}
              </button>
            </div>
          );
        })}

        {tab === 'premium' && (
          <>
            <div className="bg-gray-900 border border-blue-900 p-4 rounded-xl flex items-center justify-between">
              <div>
                <div className="font-bold text-blue-300">Handful of Crystals</div>
                <div className="text-sm text-gray-400">100 💎</div>
              </div>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-500">$0.99</button>
            </div>
            <div className="bg-gray-900 border border-blue-900 p-4 rounded-xl flex items-center justify-between">
              <div>
                <div className="font-bold text-blue-300">Pouch of Crystals</div>
                <div className="text-sm text-gray-400">500 💎</div>
              </div>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-500">$3.99</button>
            </div>
            <div className="bg-gray-900 border border-blue-900 p-4 rounded-xl flex items-center justify-between">
              <div>
                <div className="font-bold text-blue-300">Chest of Crystals</div>
                <div className="text-sm text-gray-400">2000 💎</div>
              </div>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-500">$9.99</button>
            </div>
            <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex items-center justify-between mt-8">
              <div>
                <div className="font-bold text-[#FFD700]">Remove Ads</div>
                <div className="text-sm text-gray-400">Permanent upgrade</div>
              </div>
              <button className="bg-[#FFD700] text-black px-4 py-2 rounded-lg font-bold hover:bg-yellow-400">$4.99</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}