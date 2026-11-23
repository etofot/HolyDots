import { useEffect, useState } from 'react';
import { PhaserGame } from './components/PhaserGame';
import { GameUI } from './components/GameUI';
import { MainMenu } from './components/MainMenu';
import { Settings } from './components/Settings';
import { Leaderboard } from './components/Leaderboard';
import { Login } from './components/Login';
import { ToastViewport } from './components/ToastViewport';
import { useGameStore } from './store/useGameStore';
import { useUserStore } from './store/useUserStore';
import { installGlobalErrorHandler, useUIStore } from './store/useUIStore';
import { supabase } from './lib/supabase';

function App() {
  const { gameState } = useGameStore();
  const { setUser } = useUserStore();
  const [init, setInit] = useState(false);

  // BUG-013 FIX: Install global error handlers as early as possible
  useEffect(() => {
    installGlobalErrorHandler();
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
          if (data) {
            setUser({
              id: data.id,
              role: data.role,
              username: data.username,
              heatPoints: data.heat_points,
              crystals: data.crystals,
              bestWave: data.best_wave,
              bestScore: data.best_score,
              totalGames: data.total_games,
              upgrades: {
                startTemp: data.upgrades?.start_temp || 0,
                heatSpeed: data.upgrades?.heat_speed || 0,
                coolingResist: data.upgrades?.cooling_resist || 0,
                fuelCap: data.upgrades?.fuel_cap || 0,
                blastRadius: data.upgrades?.blast_radius || 0,
              },
              skins: data.skins || ['default'],
              currentSkin: data.current_skin || 'default',
            });
          }
        }
      } catch (e) {
        console.warn('Supabase not configured, running offline');
        // BUG-013: Show user-visible toast only for genuine auth errors,
        // not for missing config. Detect by checking for placeholder URL.
        const url = (import.meta as any).env?.VITE_SUPABASE_URL;
        if (url && !url.includes('your-project')) {
          useUIStore.getState().addToast('Auth server unavailable. Progress will not be saved.', 'warning', 5000);
        }
      }
      setInit(true);
    };

    initAuth();

    supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser({ id: null, role: 'user', username: '', heatPoints: 0, crystals: 0 });
      }
    });
  }, []);

  if (!init) {
    return (
      <div className="bg-[#0A0A1A] w-screen h-screen flex flex-col items-center justify-center text-white gap-3">
        <div className="text-3xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-[#FFD700] to-[#FF4500]">
          HEAT RUSH
        </div>
        <div className="text-xs uppercase tracking-[0.35em] text-white/40">Loading</div>
        <div className="w-40 h-1 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full w-1/2 bg-gradient-to-r from-[#FFD700] to-[#FF4500] animate-pulse" />
        </div>
      </div>
    );
  }

  // N9: letterbox-safe playfield — 540×1080 aspect box so React HUD docks align with Phaser FIT canvas
  return (
    <div className="w-screen h-screen overflow-hidden bg-[#050510] flex items-center justify-center select-none">
      <div
        className="relative h-full max-h-screen w-full max-w-[min(100vw,calc(100vh*540/1080))] aspect-[540/1080] overflow-hidden bg-[#0A0A1A] shadow-[0_0_40px_rgba(0,0,0,0.65)]"
        data-playfield="heat-lock"
      >
        <PhaserGame />
        <GameUI />
        {gameState === 'menu' && <MainMenu />}
        {/* Shop deferred for HEAT LOCK prototype — upgrades were unwired */}
        {gameState === 'settings' && <Settings />}
        {gameState === 'leaderboard' && <Leaderboard />}
        {gameState === 'login' && <Login />}
        <ToastViewport />
      </div>
    </div>
  );
}

export default App;