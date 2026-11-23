import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useGameStore } from '../store/useGameStore';
import { useUserStore } from '../store/useUserStore';
import { ArrowLeft } from 'lucide-react';

export function Login() {
  const { setGameState } = useGameStore();
  const { setUser } = useUserStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isRegister) {
        if (!agreed) throw new Error('You must agree to the Terms of Service and Privacy Policy');
        if (!username) throw new Error('Username is required');

        const { data, error: err } = await supabase.auth.signUp({
          email: `${username}@heatrush.local`,
          password,
        });
        if (err) throw err;
        
        if (data.user) {
          await supabase.from('profiles').update({ username }).eq('id', data.user.id);
          setUser({ id: data.user.id, username });
        }
        
        setGameState('menu');
      } else {
        const { data, error: err } = await supabase.auth.signInWithPassword({
          email: `${username}@heatrush.local`,
          password,
        });
        if (err) throw err;
        
        if (data.user) {
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
          if (profile) {
            setUser({
              id: profile.id,
              role: profile.role,
              username: profile.username,
              heatPoints: profile.heat_points,
              crystals: profile.crystals,
              bestWave: profile.best_wave,
              bestScore: profile.best_score,
              totalGames: profile.total_games,
              upgrades: {
                startTemp: profile.upgrades?.start_temp || 0,
                heatSpeed: profile.upgrades?.heat_speed || 0,
                coolingResist: profile.upgrades?.cooling_resist || 0,
                fuelCap: profile.upgrades?.fuel_cap || 0,
                blastRadius: profile.upgrades?.blast_radius || 0,
              },
              skins: profile.skins || ['default'],
              currentSkin: profile.current_skin || 'default',
            });
          }
        }
        setGameState('menu');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-[#0A0A1A] z-50 text-white flex flex-col p-4 items-center justify-center">
      <div className="absolute top-8 left-6">
        <button onClick={() => setGameState('menu')} className="p-2 hover:bg-gray-800 rounded-full">
          <ArrowLeft size={28} />
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl w-full max-w-sm shadow-2xl">
        <h2 className="text-3xl font-bold uppercase tracking-wider text-[#FFD700] mb-8 text-center">
          {isRegister ? 'REGISTER' : 'LOGIN'}
        </h2>

        {error && <div className="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded-lg text-sm mb-6">{error}</div>}

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Username</label>
            <input 
              type="text" 
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:border-[#FFD700] outline-none"
              placeholder="Enter username"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:border-[#FFD700] outline-none"
              placeholder="Enter password"
            />
          </div>

          {isRegister && (
            <label className="flex items-start gap-2 text-sm text-gray-400 cursor-pointer mt-4">
              <input 
                type="checkbox" 
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                className="mt-1"
              />
              <span>I agree to the Terms of Service and Privacy Policy</span>
            </label>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[#FF8800] text-black py-4 rounded-xl font-bold text-lg hover:bg-[#FFD700] transition-colors mt-8 disabled:opacity-50"
          >
            {loading ? 'PLEASE WAIT...' : isRegister ? 'CREATE ACCOUNT' : 'LOGIN'}
          </button>
        </form>

        <div className="mt-8 text-center text-gray-400 text-sm">
          {isRegister ? 'Already have an account?' : 'Need an account?'}
          <button 
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
            className="ml-2 text-[#FFD700] hover:underline font-bold"
          >
            {isRegister ? 'Login here' : 'Register here'}
          </button>
        </div>
      </div>
    </div>
  );
}