import React, { useState } from "react";
import { motion } from "framer-motion";
import { useAppContext } from "../../../context/AppContext";
import { useBrewContext } from "../../../context/BrewContext";
import { 
  getTransitionVariants,
} from "../../../utils";
import MechanicalButton from "../../common/MechanicalButton";
import ColorSpectrumPicker from "../../common/ColorSpectrumPicker";
import { useFirebaseActions } from "../../../context/FirebaseContext";
import { validGrinderRange } from "../../../utils/validation";
import { serializeDiary } from "../../../lib/localDiary";

const Settings: React.FC = () => {
  const {
    settings,
    setSettings,
    setProfiles,
    setBeans,
    setInventory,
    setRecipes,
    setRecords,
    user,
    cloudStatus,
    cloudStatusVisual,
    localSaveError,
    queueCloudSync,
    persistedPayload,
    legacyAvailable,
    importLegacyData,
    importDiaryBackup
  } = useAppContext();

  const { dispatch } = useBrewContext();
  const { saveToCloud, loadFromCloud } = useFirebaseActions();
  const [settingsKey, setSettingsKey] = useState(0);
  const [backupError, setBackupError] = useState("");
  const payloadSizeBytes = new TextEncoder().encode(serializeDiary(persistedPayload)).length;
  const payloadSizeWarning = payloadSizeBytes >= 950_000 ? "클라우드 저장 한도에 가까워졌습니다. 백업 후 오래된 기록·로그를 정리하세요." : payloadSizeBytes >= 850_000 ? "저장 데이터가 커지고 있습니다. 클라우드 저장 한도에 도달하기 전에 백업을 권장합니다." : "";

  const exportBackup = () => {
    const url = URL.createObjectURL(new Blob([serializeDiary(persistedPayload)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `coffee-diary-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importBackup = async (file?: File) => {
    if (!file || !window.confirm("현재 데이터를 백업하고 파일의 데이터로 교체할까요? 로그인 중이라면 클라우드에도 반영될 수 있습니다.")) return;
    try {
      importDiaryBackup(await file.text());
      setBackupError("");
    } catch (error) {
      setBackupError("백업 파일을 가져오지 못했습니다. 파일 형식과 브라우저 저장 공간을 확인하세요. 기존 데이터는 유지됩니다.");
      console.error("Failed to import backup", error);
    }
  };

  // 그라인더 추가 폼 로컬 상태
  const [newGrinderName, setNewGrinderName] = useState("");
  const [newGrinderMin, setNewGrinderMin] = useState("");
  const [newGrinderMax, setNewGrinderMax] = useState("");
  const [newGrinderStep, setNewGrinderStep] = useState("");
  const [grinderAttempted, setGrinderAttempted] = useState(false);
  const grinderName = newGrinderName.trim();
  const grinderError = !grinderName ? "장비 이름을 입력하세요."
    : !newGrinderMin || !newGrinderMax || !newGrinderStep ||
      !validGrinderRange(Number(newGrinderMin), Number(newGrinderMax), Number(newGrinderStep))
      ? "최소·최대는 올바른 순서여야 하고 간격은 양수여야 합니다." : "";

  const handleResetData = () => {
    if (window.confirm("⚠️ 모든 데이터를 초기화하시겠습니까? 클라우드 데이터도 삭제될 수 있습니다.")) {
      setProfiles({});
      setBeans([]);
      setInventory([]);
      setRecipes([]);
      setRecords([]);
      dispatch({ type: "RESET_FORM" });
      alert("데이터가 초기화되었습니다. 로그인 상태라면 클라우드에도 자동 반영됩니다.");
    }
  };

  const handleLegacyImport = () => {
    const destination = user?.email ?? "게스트 저장소";
    if (!window.confirm(`이전 버전의 로컬 데이터를 ${destination}에 가져올까요? 현재 데이터는 백업한 뒤 교체되며, 로그인 중이라면 클라우드에도 반영될 수 있습니다.`)) return;
    if (!importLegacyData()) alert("이전 데이터를 가져오지 못했습니다. 원본은 그대로 보관되어 있습니다.");
  };

  return (
    <motion.section 
      key={`settings-${settingsKey}`}
      variants={getTransitionVariants(settings.theme.pageTransition, 1000)}
      initial="initial"
      animate="animate"
      exit="exit"
      id="settings" 
      className="mx-auto w-full max-w-6xl px-6 pt-10 pb-20 md:px-10"
    >
      <div className="mb-6 flex flex-wrap items-end justify-between border-b border-[var(--border-main)] pb-4 gap-4">
        <div className="flex flex-col">
          <span className="text-[10px] sm:text-xs font-mono font-bold tracking-[0.2em]" style={{ color: 'var(--point-color)' }}>SYSTEM_CONFIG</span>
          <h2 className="text-3xl font-bold uppercase tracking-tight text-[var(--text-strong)] mt-1">설정</h2>
        </div>
      </div>
      
      <div className="space-y-10 py-2">
        {payloadSizeWarning && <div role="alert" className="border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">{payloadSizeWarning} 현재 약 {(payloadSizeBytes / 1024).toFixed(0)}KB입니다.</div>}
        {/* 테마 및 디자인 */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)] pl-2 border-l-2" style={{ borderColor: 'var(--point-color)' }}>테마 및 디자인 (THEME_UI)</h3>
          <div className="grid gap-6 p-5 border border-[var(--border-main)] bg-[var(--bg-base)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold tracking-tight text-[var(--text-strong)]">다크 모드 (DARK_MODE)</p>
                <p className="text-[10px] text-[var(--text-muted)] font-mono tracking-widest mt-1">배경색을 어둡게 설정</p>
              </div>
              <button 
                onClick={() => setSettings(s => ({ ...s, theme: { ...s.theme, isDarkMode: !s.theme.isDarkMode } }))}
                className="relative inline-flex h-6 w-11 items-center transition-colors border border-[var(--border-hover)] focus:outline-none"
                style={{ backgroundColor: settings.theme.isDarkMode ? 'var(--point-color)' : 'var(--bg-surface)' }}
              >
                <span className={`${settings.theme.isDarkMode ? 'translate-x-5' : 'translate-x-1'} inline-block h-4 w-4 transform transition-transform`} style={{ backgroundColor: settings.theme.isDarkMode ? '#000' : '#fff' }} />
              </button>
            </div>
            
            <div className="space-y-4 pt-4 border-t border-[var(--border-main)]/50">
              <div className="flex items-center justify-between">
                <p className="text-xs font-mono uppercase tracking-widest text-[var(--text-dim)]">포인트 컬러 (ACCENT_COLOR)</p>
                <div className="w-6 h-6 border border-[var(--border-hover)]" style={{ backgroundColor: 'var(--point-color)' }} />
              </div>
              <ColorSpectrumPicker value={settings.theme.pointColor} onChange={(newColor) => setSettings(s => ({ ...s, theme: { ...s.theme, pointColor: newColor } }))} />
              
              <div className="space-y-6 pt-8 mt-6 border-t border-[var(--border-main)]/50">
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-mono tracking-widest uppercase">
                    <span>INTERFACE_SCALE</span>
                    <span style={{ color: 'var(--point-color)' }}>[{(settings.theme.uiScale || 1.0).toFixed(2)}]x</span>
                  </div>
                  <input type="range" min="0.8" max="1.2" step="0.05" value={settings.theme.uiScale || 1.0} className="w-full h-1 appearance-none bg-zinc-800 accent-[var(--point-color)]" onChange={(e) => setSettings(s => ({ ...s, theme: { ...s.theme, uiScale: parseFloat(e.target.value) } }))} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-mono tracking-widest uppercase">
                    <span>TEXT_SCALE</span>
                    <span style={{ color: 'var(--point-color)' }}>[{(settings.theme.textScale || 1.0).toFixed(2)}]x</span>
                  </div>
                  <input type="range" min="0.8" max="1.25" step="0.05" value={settings.theme.textScale || 1.0} className="w-full h-1 appearance-none bg-zinc-800 accent-[var(--point-color)]" onChange={(e) => setSettings(s => ({ ...s, theme: { ...s.theme, textScale: parseFloat(e.target.value) } }))} />
                </div>
                <div className="space-y-3 pt-4 border-t border-[var(--border-main)]">
                  <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">TRANSITION_FX</p>
                  <div className="grid grid-cols-3 gap-2">
                    {["scan", "glitch", "vanguard", "shutter", "cascade"].map(fx => (
                      <button key={fx} onClick={() => { setSettings(s => ({ ...s, theme: { ...s.theme, pageTransition: fx as any } })); setSettingsKey(k => k + 1); }} className={`py-2 text-[10px] font-mono font-bold uppercase border transition-all ${settings.theme.pageTransition === fx ? 'border-[var(--point-color)] text-[var(--point-color)] bg-[var(--point-color)]/10' : 'border-[var(--border-main)] text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>{fx.toUpperCase()}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 하드웨어 관리 */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)] pl-2 border-l-2" style={{ borderColor: 'var(--point-color)' }}>하드웨어 관리 (HARDWARE_CFG)</h3>
          <div className="p-5 border border-[var(--border-main)] bg-[var(--bg-base)] space-y-6">
            <div className="space-y-4">
               <p className="text-sm font-bold uppercase tracking-tight text-[var(--text-strong)]">GRINDERS</p>
               <div className="grid gap-2">
                 {Object.entries(settings.grinders).map(([name, range]) => (
                   <div key={name} className="flex items-center justify-between p-3 bg-[var(--bg-surface)] border border-[var(--border-main)]">
                     <div>
                       <p className="text-sm font-bold uppercase">{name}</p>
                       <p className="text-[9px] font-mono text-[var(--text-muted)] mt-1">RANGE: {range.min}-{range.max} / STEP: {range.step}</p>
                     </div>
                     <button onClick={() => { const grinders = { ...settings.grinders }; const grinderCalibrations = { ...settings.grinderCalibrations }; delete grinders[name]; delete grinderCalibrations[name]; setSettings(s => ({ ...s, grinders, grinderCalibrations })); queueCloudSync(); }} className="text-[10px] font-mono text-rose-500 hover:underline">DELETE</button>
                   </div>
                 ))}
               </div>
               <div className="pt-4 border-t border-[var(--border-main)] grid gap-2">
                 <input 
                   value={newGrinderName}
                   onChange={(e) => setNewGrinderName(e.target.value)}
                   placeholder="GRINDER_NAME" 
                   className="bg-[var(--bg-surface)] border border-[var(--border-main)] p-2 text-xs font-mono outline-none focus:border-[var(--point-color)]" 
                 />
                 <div className="grid grid-cols-3 gap-2 text-center">
                   <div className="space-y-1"><span className="text-[9px] font-mono text-[var(--text-muted)]">MIN</span><input value={newGrinderMin} onChange={(e) => setNewGrinderMin(e.target.value)} type="number" step="0.1" className="bg-[var(--bg-surface)] border border-[var(--border-main)] p-2 w-full text-xs font-mono outline-none" placeholder="0" /></div>
                   <div className="space-y-1"><span className="text-[9px] font-mono text-[var(--text-muted)]">MAX</span><input value={newGrinderMax} onChange={(e) => setNewGrinderMax(e.target.value)} type="number" step="0.1" className="bg-[var(--bg-surface)] border border-[var(--border-main)] p-2 w-full text-xs font-mono outline-none" placeholder="100" /></div>
                   <div className="space-y-1"><span className="text-[9px] font-mono text-[var(--text-muted)]">STEP</span><input value={newGrinderStep} onChange={(e) => setNewGrinderStep(e.target.value)} type="number" step="0.1" className="bg-[var(--bg-surface)] border border-[var(--border-main)] p-2 w-full text-xs font-mono outline-none" placeholder="0.5" /></div>
                 </div>
                 {(grinderAttempted || newGrinderName || newGrinderMin || newGrinderMax || newGrinderStep) && grinderError &&
                   <p role="alert" className="text-xs text-rose-500">{grinderError}</p>}
                 <MechanicalButton onClick={() => {
                   setGrinderAttempted(true);
                   if (!grinderError) {
                     setSettings(s => ({ ...s, grinders: { ...s.grinders, [grinderName]: { min: Number(newGrinderMin), max: Number(newGrinderMax), step: Number(newGrinderStep) } } }));
                     setNewGrinderName(""); setNewGrinderMin(""); setNewGrinderMax(""); setNewGrinderStep("");
                     setGrinderAttempted(false);
                     queueCloudSync();
                   }
                 }} className="py-2 text-[10px] font-bold" style={{ backgroundColor: 'var(--point-color)' }}>ADD_GRINDER</MechanicalButton>
               </div>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 pt-4 border-t border-[var(--border-main)]">
               {["drippers", "waters", "filters"].map((type) => (
                 <div key={type} className="space-y-3">
                   <p className="text-[10px] font-mono uppercase text-[var(--text-muted)] tracking-widest">{type.toUpperCase()}</p>
                   <div className="flex flex-wrap gap-2">
                     {(settings[type as keyof typeof settings] as string[]).map((v, i) => (
                       <span key={i} className="flex items-center gap-1.5 px-2 py-1 bg-[var(--bg-surface)] border border-[var(--border-main)] text-[10px] font-mono">
                         {v}<button onClick={() => { setSettings(s => ({ ...s, [type]: (s[type as keyof typeof s] as string[]).filter((_, idx) => idx !== i) })); queueCloudSync(); }} className="hover:text-rose-500">×</button>
                       </span>
                     ))}
                   </div>
                   <div className="flex gap-1 pt-2">
                     <input id={`new-${type}`} className="flex-1 bg-[var(--bg-surface)] border border-[var(--border-main)] p-2 text-[10px] font-mono outline-none" placeholder={`NEW_${type.toUpperCase().slice(0,-1)}`} />
                     <button onClick={() => { const input = document.getElementById(`new-${type}`) as HTMLInputElement; if (input.value) { setSettings(s => ({ ...s, [type]: [...(s[type as keyof typeof s] as string[]), input.value] })); input.value = ''; queueCloudSync(); }}} className="bg-[var(--point-color)] text-black px-3 text-[10px] font-bold">ADD</button>
                   </div>
                 </div>
               ))}
            </div>
          </div>
        </div>

        {/* 클라우드 및 계정 */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)] pl-2 border-l-2" style={{ borderColor: 'var(--point-color)' }}>클라우드 및 계정 (CLOUD_SYST)</h3>
          <div className="p-5 border border-[var(--border-main)] bg-[var(--bg-base)] space-y-6">
            <div className="flex items-center justify-between">
               <div><p className="text-sm font-bold">계정 상태</p><p className="text-[10px] font-mono text-[var(--text-muted)] mt-1">{user ? user.email : "게스트 모드 (오프라인)"}</p></div>
               <div className="flex items-center gap-3"><span className={`text-[10px] font-mono font-bold ${cloudStatusVisual === 'error' ? 'text-rose-500' : 'text-emerald-500'}`}>{cloudStatus.toUpperCase()}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-[var(--border-main)]">
               <MechanicalButton onClick={() => saveToCloud(persistedPayload, { withVisual: true })} className="py-4 text-xs font-bold transition-all" style={{ backgroundColor: 'var(--point-color)' }}>클라우드에 저장</MechanicalButton>
               <MechanicalButton onClick={() => loadFromCloud()} className="py-4 text-xs font-bold text-[var(--text-strong)] border border-[var(--border-main)]">클라우드에서 불러오기</MechanicalButton>
            </div>
            <p className="text-[9px] text-center font-mono text-[var(--text-muted)] leading-tight">변경 사항은 로컬에 먼저 보관한 뒤 자동 동기화됩니다.<br/>다른 기기와 충돌하면 자동 덮어쓰기를 멈추고 상태를 표시합니다.</p>
            {localSaveError && <p role="alert" className="text-xs text-rose-500">{localSaveError}</p>}
            <div className="flex flex-wrap gap-3 border-t border-[var(--border-main)] pt-4">
              <button type="button" onClick={exportBackup} className="border border-[var(--border-main)] px-3 py-2 text-xs">JSON 백업 내보내기</button>
              <input type="file" accept="application/json,.json" aria-label="JSON 백업 가져오기"
                className="max-w-full border border-[var(--border-main)] px-3 py-2 text-xs"
                onChange={(event) => {
                  void importBackup(event.target.files?.[0]);
                  event.target.value = "";
                }} />
            </div>
            {backupError && <p role="alert" className="text-xs text-rose-500">{backupError}</p>}
            {legacyAvailable && <button type="button" onClick={handleLegacyImport} className="w-full border border-amber-500/50 px-3 py-3 text-left text-xs text-amber-400 hover:bg-amber-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400">이전 버전 로컬 데이터 가져오기</button>}
            {cloudStatus.includes("충돌") && <p className="text-[10px] text-rose-500 leading-relaxed">충돌 해결: PUSH는 이 기기 데이터를 클라우드에 반영하고, FETCH는 클라우드 데이터를 불러옵니다. 어느 쪽이든 교체되는 데이터는 먼저 이 브라우저에 백업됩니다.</p>}
          </div>
        </div>

        {/* 데이터 초기화 */}
        <div className="pt-10 border-t border-[var(--border-main)] flex justify-center">
           <button onClick={handleResetData} className="text-[10px] font-mono font-bold text-rose-500 hover:text-rose-400 p-2 border border-rose-900/30 transition-colors uppercase tracking-widest">
             [ !!_DANGER_DOMAIN_!! ] FACTORY_DATA_RESET
           </button>
        </div>
      </div>
    </motion.section>
  );
};

export default Settings;
