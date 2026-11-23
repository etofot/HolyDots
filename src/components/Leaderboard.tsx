import { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { ArrowLeft, Trophy } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LeaderboardEntry {
  id: string;
  username: string;
  best_score: number;
  best_wave: number;
}

export function Leaderboard() {
  const { setGameState } = useGameStore();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase
          .from('public_profiles')
          .select('*')
          .order('best_score', { ascending: false })
          .limit(100);
        
        if (data) setEntries(data);
      } catch (e) {
        console.warn('Leaderboard not available');
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="absolute inset-0 bg-[#0A0A1A] z-50 text-white flex flex-col p-4">
      <div className="flex items-center justify-between mb-6 pt-4 px-2">
        <button onClick={() => setGameState('menu')} className="p-2 hover:bg-gray-800 rounded-full">
          <ArrowLeft size={28} />
        </button>
        <h2 className="text-2xl font-bold uppercase tracking-wider text-[#FFD700] flex items-center gap-2">
          <Trophy size={24} /> LEADERBOARD
        </h2>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-8">
        {loading ? (
          <div className="text-center text-gray-500 mt-10">Loading...</div>
        ) : (
          <div className="space-y-2">
            {entries.map((e, i) => (
              <div key={e.id} className="flex items-center justify-between bg-gray-900 border border-gray-800 p-4 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className={`w-8 text-center font-bold ${i === 0 ? 'text-[#FFD700]' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-gray-500'}`}>
                    #{i + 1}
                  </div>
                  <div className="font-medium text-lg">{e.username || 'Anonymous'}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-[#FFD700]">{e.best_score}</div>
                  <div className="text-xs text-[#FF8800]">Wave {e.best_wave}</div>
                </div>
              </div>
            ))}
            {entries.length === 0 && (
              <div className="text-center text-gray-500 mt-10">No entries yet.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}