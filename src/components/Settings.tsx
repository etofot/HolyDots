import { useGameStore } from '../store/useGameStore';
import { ArrowLeft, User, Volume2, VolumeX } from 'lucide-react';
import { useUserStore } from '../store/useUserStore';
import { supabase } from '../lib/supabase';
import { useState } from 'react';
import { isMuted, setMuted, playSfx, unlockAudio } from '../game/audio';

export function Settings() {
  const { setGameState } = useGameStore();
  const { id, username, setUser } = useUserStore();
  const [newUsername, setNewUsername] = useState(username || '');
  const [muted, setMutedUi] = useState(isMuted());
  const [status, setStatus] = useState('');

  const handleUpdate = async () => {
    if (!id || !newUsername.trim()) {
      setStatus('Login required to save username.');
      return;
    }
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ username: newUsername.trim() })
        .eq('id', id);
      if (error) {
        setStatus(`Save failed: ${error.message}`);
        return;
      }
      setUser({ username: newUsername.trim() });
      setStatus('Username saved.');
      playSfx('ui');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Save failed');
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUser({ id: null, username: '' });
      setStatus('Logged out.');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Logout failed');
    }
  };

  const toggleSound = () => {
    unlockAudio();
    const next = !muted;
    setMuted(next);
    setMutedUi(next);
    if (!next) playSfx('ui');
  };

  return (
    <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A1A] via-[#120808] to-[#0A0A1A] z-50 text-white flex flex-col p-4">
      <div className="flex items-center justify-between mb-6 pt-4 px-2">
        <button
          type="button"
          onClick={() => setGameState('menu')}
          className="p-2 hover:bg-gray-800 rounded-full border border-white/10"
        >
          <ArrowLeft size={28} />
        </button>
        <h2 className="text-2xl font-black uppercase tracking-wider text-[#FFD700]">Settings</h2>
        <div className="w-10" />
      </div>

      <div className="flex-1 px-4 space-y-6 overflow-y-auto">
        <div className="bg-gray-950/80 border border-gray-800 p-6 rounded-2xl shadow-lg">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <User size={20} className="text-[#FFD700]" /> Account
          </h3>

          {id ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Username</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:border-[#FFD700] outline-none"
                    placeholder="Enter username"
                  />
                  <button
                    type="button"
                    onClick={() => void handleUpdate()}
                    className="bg-[#FF8800] text-black px-4 rounded-lg font-bold"
                  >
                    Save
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="text-red-400 border border-red-400/60 px-4 py-2 rounded-lg font-bold w-full hover:bg-red-400 hover:text-black transition-colors"
              >
                Logout
              </button>
            </div>
          ) : (
            <div>
              <p className="text-gray-400 text-sm mb-4">
                Offline mode works fully. Login only for cloud leaderboards.
              </p>
              <button
                type="button"
                onClick={() => setGameState('login')}
                className="bg-gradient-to-r from-[#FF8800] to-[#FF4500] text-black w-full py-3 rounded-xl font-black hover:brightness-110"
              >
                LOGIN / REGISTER
              </button>
            </div>
          )}
        </div>

        <div className="bg-gray-950/80 border border-gray-800 p-6 rounded-2xl shadow-lg">
          <h3 className="text-lg font-bold mb-4">Audio</h3>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} className="text-[#FFD700]" />}
              Sound Effects
            </span>
            <button
              type="button"
              onClick={toggleSound}
              className={`px-4 py-1.5 rounded-lg font-black text-sm ${
                muted ? 'bg-gray-700 text-gray-300' : 'bg-green-600 text-white'
              }`}
            >
              {muted ? 'OFF' : 'ON'}
            </button>
          </div>
          <p className="text-xs text-white/35 mt-3">
            Procedural SFX via Web Audio. Preference saved locally.
          </p>
        </div>

        <div className="bg-gray-950/80 border border-gray-800 p-6 rounded-2xl shadow-lg">
          <h3 className="text-lg font-bold mb-2 text-[#FFD700]">How to play</h3>
          <ul className="text-sm text-white/60 space-y-2 list-disc pl-4">
            <li>TAP fuse cubes to recolor (4 shapes / colors)</li>
            <li>Q or RMB reverse-cycles colors faster</li>
            <li>HEAT (H) spends a charge to make a wild ★</li>
            <li>Amber HOT = one recolor from boom; gold ARMED = SEND now</li>
            <li>Matches explode only when the fuse locks into the stack</li>
            <li>Chain ARMED detonations for STREAK bonuses</li>
            <li>Death = stack invades the fuse zone (y ≤ 3)</li>
          </ul>
        </div>

        {status && (
          <div className="text-center text-sm text-[#FFD700] bg-black/40 py-2 rounded-lg border border-[#FFD700]/20">
            {status}
          </div>
        )}
      </div>
    </div>
  );
}
