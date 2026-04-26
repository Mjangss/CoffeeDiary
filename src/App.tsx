import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAppContext } from "./context/AppContext";

// Components
import NavIcon from "./components/layout/NavIcon";
import BrewingForm from "./components/features/BrewingForm/BrewingForm";
import Inventory from "./components/features/Inventory/Inventory";
import RecipeStorage from "./components/features/RecipeStorage/RecipeStorage";
import RecordsList from "./components/features/RecordsList/RecordsList";
import BeanStorage from "./components/features/BeanStorage/BeanStorage";
import Settings from "./components/features/Settings/Settings";
import BrewingTimer from "./components/features/BrewingTimer/BrewingTimer";
import { useFirebase } from "./hooks/useFirebase";
import LogoDripAnimation from "./components/layout/LogoDripAnimation";

// Types
import { PageKey } from "./types";

declare const __BUILD_TIMESTAMP__: string;

const App = () => {
  const {
    activePage,
    setActivePage,
    settings,
    isAppBooting,
    showCloudSaveToast,
    user,
    cloudStatus,
    cloudStatusVisual,
    persistedPayload
  } = useAppContext();

  const [showUpdateAlert, setShowUpdateAlert] = useState(false);

  // Check for updates
  useEffect(() => {
    if (isAppBooting) return;

    const checkUpdate = async () => {
      try {
        const response = await fetch(`/version.json?t=${Date.now()}`, { 
          cache: "no-store",
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        });
        if (response.ok) {
          const data = await response.json();
          const remoteId = String(data.buildId);
          const localId = String(__BUILD_TIMESTAMP__);
          
          if (data.buildId && remoteId !== localId) {
            setShowUpdateAlert(true);
          }
        }
      } catch (e) {
        // Silent fail for background check
      }
    };

    // Delay slightly to ensure boot animation is finishing
    const timeout = setTimeout(checkUpdate, 2000);

    // Check when returning from background
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkUpdate();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isAppBooting]);

  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = async () => {
    setIsUpdating(true);
    // Give time for the scanning animation to play
    await new Promise(resolve => setTimeout(resolve, 1400));
    window.location.reload();
  };

  // Start Firebase Boot Sequence
  const { login, logout, saveToCloud, loadFromCloud } = useFirebase();

  if (isAppBooting) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black font-mono overflow-hidden">
        <LogoDripAnimation />
        <div className="mt-8 flex flex-col items-center gap-3">
          <h1 className="text-zinc-500 text-sm font-bold tracking-[0.4em] uppercase animate-pulse">Coffee_Diary_Core</h1>
          <div className="flex gap-1.5">
            <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1 h-1 bg-[var(--point-color)]" />
            <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1 h-1 bg-[var(--point-color)]" />
            <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1 h-1 bg-[var(--point-color)]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`min-h-screen transition-colors duration-500 ${settings.theme.isDarkMode ? "bg-[var(--bg-deep)] text-[var(--text-main)]" : "bg-zinc-50 text-zinc-900"}`}
      style={{
        '--ui-scale': settings.theme.uiScale || 1.0,
        '--text-scale': settings.theme.textScale || 1.0
      } as React.CSSProperties}
    >
      <header className="absolute top-0 w-full h-28 sm:h-24 z-40 px-6 sm:px-10 flex items-end pb-4 sm:items-center sm:pb-0 justify-between border-b border-[var(--border-main)]/30 backdrop-blur-md bg-[var(--bg-deep)]/50 pt-safe">
        <div className="flex items-center gap-4">
          <div className="scale-75 origin-left">
            <LogoDripAnimation />
          </div>
          <div className="flex flex-col justify-center">
            <h1 className="text-xl font-black tracking-tighter uppercase leading-none text-[var(--text-strong)]">Coffee Diary</h1>
            
            <div className="flex items-center gap-2 mt-2">
              {user ? (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={logout}
                    className="text-[9px] font-mono font-bold text-zinc-500 hover:text-[var(--point-color)] transition-colors border border-zinc-800 px-1.5 py-0.5 uppercase"
                  >
                    Logout
                  </button>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => saveToCloud(persistedPayload, { withVisual: true })}
                      className="p-1 px-2 text-zinc-500 hover:text-[var(--point-color)] transition-colors border border-zinc-800 group bg-zinc-900/30"
                      title="PUSH_TO_CLOUD"
                    >
                      <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter">
                        <path d="M12 19V5M5 12l7-7 7 7"/>
                      </svg>
                    </button>
                    <button 
                      onClick={() => loadFromCloud({ withVisual: true })}
                      className="p-1 px-2 text-zinc-500 hover:text-[var(--point-color)] transition-colors border border-zinc-800 group bg-zinc-900/30"
                      title="PULL_FROM_CLOUD"
                    >
                      <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter">
                        <path d="M12 5v14M5 12l7 7 7-7"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={login}
                  className="text-[9px] font-mono font-bold text-[var(--point-color)] hover:bg-[var(--point-color)] hover:text-black transition-all border border-[var(--point-color)]/30 px-1.5 py-0.5 uppercase"
                >
                  Login
                </button>
              )}
              
              <div className="h-2 w-[1px] bg-zinc-800" />
              
              <div className="flex items-center gap-1.5 overflow-hidden">
                <div 
                  className={`w-1.5 h-1.5 rounded-full transition-colors duration-500 ${
                    cloudStatusVisual === 'loading' ? 'bg-amber-500 animate-pulse' :
                    cloudStatusVisual === 'success' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                    cloudStatusVisual === 'error' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' :
                    'bg-zinc-700'
                  }`}
                />
                <span className="text-[9px] font-mono tracking-tight text-[var(--text-muted)] uppercase truncate max-w-[100px] sm:max-w-[200px]">
                  {cloudStatus}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="hidden sm:flex flex-col items-end opacity-40 font-mono text-[9px] uppercase tracking-widest text-[var(--text-muted)]">
          <span>{new Date().toISOString().split('T')[0].replace(/-/g, '.')}</span>
          <span>SYSTEM_ACCESS_OK</span>
        </div>
      </header>

      <main className="pt-36 sm:pt-32 pb-32">
        <AnimatePresence mode="wait">
           {activePage === "coffee-diary" && <BrewingForm key="page-brew" />}
           {activePage === "coffee-diary-records" && <RecordsList key="page-records" />}
           {activePage === "bean-storage" && <BeanStorage key="page-bean" />}
           {activePage === "recipe-storage" && <RecipeStorage key="page-recipe" />}
           {activePage === "inventory" && <Inventory key="page-inventory" />}
           {activePage === "settings" && <Settings key="page-settings" />}
           {activePage === "brewing-timer" && <BrewingTimer key="page-timer" />}
        </AnimatePresence>
      </main>

      {/* 하단 플로팅 내비게이션 도크 */}
      <div className="fixed inset-x-0 bottom-8 z-50 flex justify-center px-6 pointer-events-none">
        <motion.nav 
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="pointer-events-auto flex items-center justify-around gap-1 sm:gap-4 bg-[var(--bg-base)]/80 backdrop-blur-2xl border border-[var(--border-main)]/50 px-3 py-2.5 rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] max-w-full sm:w-auto"
        >
          {[
            { key: "coffee-diary", label: "기록" },
            { key: "coffee-diary-records", label: "일기" },
            { key: "bean-storage", label: "원두" },
            { key: "recipe-storage", label: "레시피" },
            { key: "inventory", label: "곶간" },
            { key: "settings", label: "설정" },
          ].map((item) => {
            const isActive = activePage === item.key;
            
            return (
              <button
                key={item.key}
                onClick={() => setActivePage(item.key as PageKey)}
                className="group relative flex flex-col items-center justify-center min-w-[60px] cursor-pointer touch-manipulation"
              >
                {isActive && (
                  <motion.div 
                    layoutId="activeTab"
                    className="absolute inset-0 bg-white/5 rounded-xl -z-10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                
                <motion.div
                  whileHover={typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches ? { scale: 1.1, y: -2 } : {}}
                  whileTap={{ scale: 0.9 }}
                  animate={isActive ? { y: -2 } : { y: 0 }}
                  className={`flex transition-colors duration-300 ${isActive ? "" : "text-[var(--text-muted)]"}`}
                  style={isActive ? { color: 'var(--point-color)' } : {}}
                >
                  <NavIcon type={item.key as PageKey} active={isActive} />
                </motion.div>
                
                <span 
                  className={`mt-1 text-[10px] font-medium transition-all duration-300 ${isActive ? "opacity-100" : "opacity-40"}`}
                  style={isActive ? { color: 'var(--point-color)' } : {}}
                >
                  {item.label}
                </span>

                {isActive && (
                  <motion.div 
                    layoutId="activeDot"
                    className="absolute -bottom-1 h-1 w-1 rounded-full"
                    style={{ backgroundColor: 'var(--point-color)' }}
                  />
                )}
              </button>
            );
          })}
        </motion.nav>
      </div>

      <AnimatePresence>
        {showUpdateAlert && (
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            className="fixed top-28 right-6 z-[110] max-w-[280px] bg-[var(--bg-surface)] border-2 border-[var(--point-color)] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col gap-3"
          >
            <div className="flex items-start gap-3">
              <div className="mt-1 h-2 w-2 rounded-full bg-[var(--point-color)] animate-ping" />
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-mono font-bold text-[var(--point-color)] tracking-widest uppercase">System_Update_Available</span>
                <p className="text-xs text-[var(--text-main)] leading-relaxed">새로운 기능과 안정성 패치가 포함된 빌드가 준비되었습니다.</p>
              </div>
            </div>
            <button 
              onClick={handleUpdate}
              disabled={isUpdating}
              className="w-full h-10 bg-[var(--point-color)] text-[var(--point-foreground)] text-[10px] font-black uppercase tracking-widest relative overflow-hidden transition-all active:scale-95"
            >
              <AnimatePresence mode="wait">
                {!isUpdating ? (
                  <motion.span 
                    key="update-ready"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    [ Update_Now ]
                  </motion.span>
                ) : (
                  <motion.span 
                    key="updating"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: [0, 1, 0.5, 1], y: 0 }}
                    transition={{ repeat: Infinity, duration: 0.4 }}
                    className="flex items-center justify-center gap-2"
                  >
                    <span className="w-1.5 h-1.5 bg-black rounded-full animate-ping" />
                    SYNCING_CORE...
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Scanning Bar Animation */}
              {isUpdating && (
                <motion.div 
                  initial={{ top: "-10%" }}
                  animate={{ top: "110%" }}
                  transition={{ repeat: Infinity, duration: 0.6, ease: "linear" }}
                  className="absolute left-0 w-full h-1 bg-white/70 blur-[2px] z-20 shadow-[0_0_15px_white]"
                />
              )}
              
              {/* Noise overlay during update */}
              {isUpdating && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.3, 0.1, 0.4, 0] }}
                  transition={{ repeat: Infinity, duration: 0.15 }}
                  className="absolute inset-0 bg-white pointer-events-none z-10 mix-blend-overlay"
                />
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCloudSaveToast && (
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="fixed top-28 right-6 z-[100] bg-black/95 border-l-4 border-[var(--point-color)] px-6 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.8)] flex items-center gap-5 overflow-hidden"
          >
            <div className="relative shrink-0">
              <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="var(--point-color)" strokeWidth="1.2">
                {/* Vault Case */}
                <rect x="4" y="6" width="16" height="14" />
                <path d="M4 10h16M4 14h16" strokeWidth="0.5" opacity="0.3" />
                
                {/* Tactical Corner Enforcement */}
                <path d="M4 9V6h3M20 9V6h-3M4 17v3h3M20 17v3h-3" strokeWidth="2" />
                
                {/* Vault Center Lock */}
                <circle cx="12" cy="13" r="3" fill="var(--point-color)" fillOpacity="0.1" />
                <path d="M12 11.5v3M10.5 13h3" strokeWidth="1.5" />
                
                {/* Dynamic Scan Line */}
                <motion.line 
                  x1="5" y1="7" x2="19" y2="7" 
                  stroke="white" 
                  strokeWidth="0.8" 
                  animate={{ y: [0, 12, 0] }} 
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                />
                
                {/* Link Status LED */}
                <motion.circle 
                  cx="18" cy="8" r="0.8" 
                  fill="white" 
                  animate={{ opacity: [1, 0, 1] }} 
                  transition={{ duration: 0.6, repeat: Infinity }} 
                />
              </svg>
              <div className="absolute inset-0 bg-[var(--point-color)]/10 blur-[8px] animate-pulse" />
            </div>

            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-mono font-black text-[var(--point-color)] tracking-[0.3em] uppercase">
                Cloud_Synchronization
              </span>
              <span className="text-xs font-bold text-white tracking-widest uppercase">
                Data_Success_Stored
              </span>
            </div>
            
            {/* Tactical Progress Gauge */}
            <motion.div 
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 3, ease: "linear" }}
              className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--point-color)] origin-left"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
