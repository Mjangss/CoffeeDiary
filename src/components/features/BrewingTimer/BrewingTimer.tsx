import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "../../../context/AppContext";
import { triggerHaptic, HAPTIC_PATTERNS } from "../../../utils/haptics";
import { parseTimeToSeconds } from "../../../utils";
import MechanicalButton from "../../common/MechanicalButton";

const BrewingTimer: React.FC = () => {
  const { 
    activeRecipeForTimer, 
    setActiveRecipeForTimer, 
    setActivePage,
  } = useAppContext();

  const [elapsedMs, setElapsedMs] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(-1); // -1: Ready, >=0: Steps
  const [isFinished, setIsFinished] = useState(false);

  const startTimeRef = useRef<number | null>(null);
  const requestRef = useRef<number | null>(null);

  // Process recipe pours into steps with absolute times
  const missionSteps = useMemo(() => {
    if (!activeRecipeForTimer) return [];
    return activeRecipeForTimer.pours.map((p) => ({
      ...p,
      startSec: parseTimeToSeconds(p.start),
      endSec: parseTimeToSeconds(p.end),
    })).sort((a, b) => a.startSec - b.startSec);
  }, [activeRecipeForTimer]);

  const totalDurationSec = useMemo(() => {
    if (missionSteps.length === 0) return 0;
    return Math.max(...missionSteps.map(s => s.endSec));
  }, [missionSteps]);

  // Current Mission State
  const currentTotalSec = elapsedMs / 1000;
  
  const activeStep = useMemo(() => {
    return missionSteps.find(s => currentTotalSec >= s.startSec && currentTotalSec < s.endSec);
  }, [missionSteps, currentTotalSec]);

  const stageProgress = useMemo(() => {
    if (!activeStep) return 0;
    const duration = activeStep.endSec - activeStep.startSec;
    if (duration <= 0) return 0;
    return Math.min(100, ((currentTotalSec - activeStep.startSec) / duration) * 100);
  }, [activeStep, currentTotalSec]);

  const nextStep = useMemo(() => {
    return missionSteps.find(s => s.startSec > currentTotalSec);
  }, [missionSteps, currentTotalSec]);

  // Handle Transitions & Haptics
  useEffect(() => {
    if (!isRunning) return;

    // Detect step start
    const stepIdx = missionSteps.findIndex(s => currentTotalSec >= s.startSec && currentTotalSec < s.endSec);
    if (stepIdx !== currentStepIdx) {
      if (stepIdx !== -1) {
        triggerHaptic(HAPTIC_PATTERNS.INJECTION_GO);
      } else if (currentStepIdx !== -1) {
        triggerHaptic(HAPTIC_PATTERNS.CUT_OFF_SIGNAL);
      }
      setCurrentStepIdx(stepIdx);
    }

    // Countdown alerts (3, 2, 1)
    if (nextStep) {
      const timeToNext = nextStep.startSec - currentTotalSec;
      if (timeToNext <= 3.05 && timeToNext >= 2.95) triggerHaptic(HAPTIC_PATTERNS.PRE_STAGE_ALERT);
      if (timeToNext <= 2.05 && timeToNext >= 1.95) triggerHaptic(HAPTIC_PATTERNS.PRE_STAGE_ALERT);
      if (timeToNext <= 1.05 && timeToNext >= 0.95) triggerHaptic(HAPTIC_PATTERNS.PRE_STAGE_ALERT);
    }

    // Finish detection
    if (currentTotalSec >= totalDurationSec && totalDurationSec > 0) {
      setIsRunning(false);
      setIsFinished(true);
      triggerHaptic(HAPTIC_PATTERNS.MISSION_ACCOMPLISHED);
    }
  }, [currentTotalSec, isRunning, missionSteps, currentStepIdx, nextStep, totalDurationSec]);

  // Timer Core
  const animate = (time: number) => {
    if (startTimeRef.current === null) startTimeRef.current = time - elapsedMs;
    const delta = time - startTimeRef.current;
    setElapsedMs(delta);
    requestRef.current = requestAnimationFrame(animate);
  };

  const toggleTimer = () => {
    if (isRunning) {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      setIsRunning(false);
      startTimeRef.current = null;
      triggerHaptic(HAPTIC_PATTERNS.ABORT_WARNING);
    } else {
      triggerHaptic(HAPTIC_PATTERNS.MISSION_IGNITION);
      requestRef.current = requestAnimationFrame(animate);
      setIsRunning(true);
    }
  };

  const resetTimer = () => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    setIsRunning(false);
    setIsFinished(false);
    setElapsedMs(0);
    setCurrentStepIdx(-1);
    startTimeRef.current = null;
    triggerHaptic(HAPTIC_PATTERNS.PRE_STAGE_ALERT);
  };

  const abortMission = () => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    triggerHaptic(HAPTIC_PATTERNS.ABORT_WARNING);
    setActiveRecipeForTimer(null);
    setActivePage("recipe-storage");
  };

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const dec = Math.floor((ms % 1000) / 100);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${dec}`;
  };

  if (!activeRecipeForTimer) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
      className="fixed inset-0 z-[200] bg-black text-white flex flex-col font-mono overflow-hidden"
    >
      {/* Tactical Background Elements */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-10 bg-[length:100%_2px,3px_100%]" />
      </div>

      {/* Header */}
      <div className="p-6 pt-safe border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50 backdrop-blur-md z-20">
        <div className="flex flex-col">
          <span className="text-[10px] text-[var(--point-color)] font-bold tracking-[0.3em] animate-pulse">MISSION_ACTIVE</span>
          <h2 className="text-xl font-black uppercase tracking-tighter truncate max-w-[200px]">{activeRecipeForTimer.name}</h2>
        </div>
        <button 
          onClick={abortMission}
          className="px-4 py-2 border border-rose-900/50 text-rose-500 text-[10px] font-bold hover:bg-rose-500/10 transition-colors uppercase"
        >
          [ ABORT_MISSION ]
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 z-20 custom-scrollbar">
        {/* Main Display */}
        <div className="flex flex-col items-center justify-center space-y-4 py-10 relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-[var(--point-color)]/5 rounded-full blur-[100px] pointer-events-none" />
          
          <span className="text-xs text-zinc-500 tracking-widest uppercase">Total_Elapsed_Time</span>
          <div className="text-7xl sm:text-8xl font-black tabular-nums tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
            {formatTime(elapsedMs)}
          </div>
          
          {/* Progress Bars */}
          <div className="w-full max-w-md space-y-2 mt-4">
            {/* Total Progress */}
            <div className="h-2 bg-zinc-900 border border-zinc-800 overflow-hidden relative">
              <motion.div 
                className="h-full bg-white opacity-20"
                animate={{ width: `${Math.min(100, (currentTotalSec / totalDurationSec) * 100)}%` }}
                transition={{ ease: "linear", duration: 0.1 }}
              />
            </div>
            {/* Stage Progress (Active Pour) */}
            <div className="h-1 bg-zinc-900/50 overflow-hidden relative">
              <motion.div 
                className="h-full bg-[var(--point-color)]"
                animate={{ width: `${stageProgress}%` }}
                transition={{ ease: "linear", duration: 0.1 }}
              />
            </div>
          </div>
        </div>

        {/* Current Instruction Card */}
        <AnimatePresence mode="wait">
          {activeStep ? (
            <motion.div 
              key={activeStep.order}
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              className="bg-[var(--point-color)]/10 border border-[var(--point-color)]/30 p-6 space-y-4"
            >
              <div className="flex justify-between items-center">
                <span className="text-[10px] bg-[var(--point-color)] text-black px-2 py-0.5 font-bold uppercase">Executing: Pour_{activeStep.order}</span>
                <span className="text-xs text-[var(--point-color)] font-bold animate-pulse">● INJECTION_ACTIVE</span>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase block mb-1">Target_Volume</span>
                  <span className="text-4xl font-black">{activeStep.waterMl}ml</span>
                </div>
                {activeRecipeForTimer.useSwitch && (
                  <div className="text-right">
                    <span className="text-[10px] text-zinc-500 uppercase block mb-1">Valve_State</span>
                    <span className={`text-xl font-bold border-b-2 ${activeStep.switchState === '열림' ? 'border-emerald-500 text-emerald-500' : 'border-rose-500 text-rose-500'}`}>
                      {activeStep.switchState === '열림' ? 'VALVE_OPEN' : 'VALVE_CLOSED'}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          ) : isFinished ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-emerald-500/10 border border-emerald-500/30 p-8 text-center space-y-3"
            >
              <h3 className="text-2xl font-black text-emerald-500 uppercase">Mission Accomplished</h3>
              <p className="text-xs text-zinc-400 font-mono uppercase tracking-widest">추출 작전이 성공적으로 종료되었습니다.</p>
              <div className="pt-4">
                <MechanicalButton 
                  onClick={abortMission}
                  className="px-8 py-3 bg-emerald-500 text-black text-xs font-bold uppercase"
                >
                  Return to Base
                </MechanicalButton>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-zinc-900/50 border border-zinc-800 p-6 flex flex-col items-center justify-center space-y-2 opacity-60"
            >
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest">
                {nextStep ? `Waiting for next stage (in ${(nextStep.startSec - currentTotalSec).toFixed(1)}s)` : "Stabilizing Grounds..."}
              </span>
              <div className="flex gap-1">
                {[1, 2, 3].map(i => (
                  <motion.div 
                    key={i}
                    animate={{ opacity: [0.2, 1, 0.2] }}
                    transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                    className="w-1.5 h-1.5 bg-zinc-600 rounded-full"
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step List */}
        <div className="space-y-3">
          <h4 className="text-[10px] text-zinc-500 uppercase tracking-[0.3em] mb-4">Mission_Protocol_List</h4>
          {missionSteps.map((s, idx) => {
            const isPast = currentTotalSec >= s.endSec;
            const isActive = currentTotalSec >= s.startSec && currentTotalSec < s.endSec;
            
            return (
              <div 
                key={idx} 
                className={`flex flex-col p-3 border transition-all relative overflow-hidden ${
                  isActive ? "border-[var(--point-color)] bg-[var(--point-color)]/5" : 
                  isPast ? "border-zinc-800 opacity-30" : "border-zinc-900 bg-zinc-950/30"
                }`}
              >
                {/* Mini Progress Bar for Each Step */}
                <div className="absolute bottom-0 left-0 h-[2px] bg-[var(--point-color)]/30 w-full">
                  <motion.div 
                    className="h-full bg-[var(--point-color)]"
                    initial={{ width: 0 }}
                    animate={{ 
                      width: isActive ? `${stageProgress}%` : isPast ? "100%" : "0%" 
                    }}
                    transition={{ ease: "linear", duration: 0.1 }}
                  />
                </div>

                <div className="flex items-center justify-between w-full z-10">
                  <div className="flex items-center gap-3">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 border ${isActive ? 'bg-[var(--point-color)] text-black border-[var(--point-color)]' : 'text-zinc-600 border-zinc-800'}`}>
                      {idx + 1}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-tight">{s.start} - {s.end}</span>
                      <span className="text-[8px] text-zinc-600 uppercase tracking-widest">
                        {activeRecipeForTimer.useSwitch ? s.switchState : 'DRIP_INJECTION'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-baseline gap-1 bg-zinc-900/50 px-3 py-1 border border-zinc-800/50">
                    <span className={`text-lg font-black leading-none ${isActive ? 'text-[var(--point-color)]' : 'text-zinc-400'}`}>
                      {s.waterMl}
                    </span>
                    <span className="text-[8px] font-bold text-zinc-600">ML</span>
                  </div>
                </div>

                {isActive && (
                  <motion.div 
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="absolute inset-0 bg-[var(--point-color)]/5 pointer-events-none"
                  />
                )}
                {isPast && (
                  <span className="text-emerald-500">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Controls */}
      <div className="p-8 bg-zinc-950 border-t border-zinc-900 grid grid-cols-[1fr_auto] gap-4 z-20">
        <MechanicalButton 
          onClick={toggleTimer}
          className={`py-5 text-sm font-black uppercase tracking-widest transition-all ${
            isRunning || isFinished ? "bg-zinc-800 text-zinc-100" : "text-black"
          } ${isFinished ? "opacity-80 scale-95" : "scale-100"}`}
          style={{ 
            backgroundColor: (!isRunning && !isFinished) ? 'var(--point-color)' : undefined,
            border: isFinished ? '1px inset rgba(255,255,255,0.1)' : undefined
          }}
        >
          {isRunning ? "[ PAUSE_SYSTEM ]" : isFinished ? "[ MISSION_HALTED ]" : elapsedMs > 0 ? "[ RESUME_SESSION ]" : "[ START_EXTRACTION ]"}
        </MechanicalButton>
        
        {!isRunning && (elapsedMs > 0 || isFinished) && (
          <MechanicalButton 
            onClick={resetTimer}
            className="px-6 bg-rose-500/20 border border-rose-500/50 text-rose-500 text-xs font-bold uppercase"
          >
            RESET
          </MechanicalButton>
        )}
        
        <p className="col-span-2 text-[9px] text-zinc-600 text-center uppercase tracking-widest animate-pulse mt-2">
          Tactical_Feedback_Active | Screen_Lock_Engaged
        </p>
      </div>
    </motion.div>
  );
};

export default BrewingTimer;
