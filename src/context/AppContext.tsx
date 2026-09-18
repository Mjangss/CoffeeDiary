import React, { createContext, useContext, useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from "react";
import { type User } from "firebase/auth";
import { 
  BeanInfo, 
  BrewRecord, 
  InventoryItem, 
  RecipeInfo, 
  AppSettings, 
  GrinderProfile,
  PageKey,
  CloudStatusVisual,
  InventoryStatus,
  PersistedPayload,
  BrewMethod
} from "../types";
import { 
  DEFAULT_SETTINGS, 
  STORAGE_KEY, 
  EMPTY_BEAN_FORM, 
  EMPTY_INVENTORY_FORM, 
  EMPTY_RECIPE_FORM,
} from "../constants";
import { useThemeApplier } from "../hooks/useThemeApplier";
import { emptyDiary, hasDiaryData, legacyImportedKey, localDiaryKey, parseDiary, serializeDiary } from "../lib/localDiary";

const legacyAvailableFor = (uid: string | null) => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw || localStorage.getItem(legacyImportedKey(uid))) return false;
    try { return hasDiaryData(parseDiary(raw)); }
    catch { return true; }
  } catch {
    return false;
  }
};

export interface AppContextType {
  // Data States
  profiles: Record<string, GrinderProfile>;
  setProfiles: React.Dispatch<React.SetStateAction<Record<string, GrinderProfile>>>;
  records: BrewRecord[];
  setRecords: React.Dispatch<React.SetStateAction<BrewRecord[]>>;
  beans: BeanInfo[];
  setBeans: React.Dispatch<React.SetStateAction<BeanInfo[]>>;
  inventory: InventoryItem[];
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  recipes: RecipeInfo[];
  setRecipes: React.Dispatch<React.SetStateAction<RecipeInfo[]>>;
  
  // App Growth/Meta States
  user: User | null; // Firebase User
  switchAccount: (user: User | null) => void;
  legacyAvailable: boolean;
  importLegacyData: () => boolean;
  importDiaryBackup: (raw: string) => void;
  authReady: boolean;
  setAuthReady: React.Dispatch<React.SetStateAction<boolean>>;
  cloudReady: boolean;
  setCloudReady: React.Dispatch<React.SetStateAction<boolean>>;
  cloudStatus: string;
  setCloudStatus: React.Dispatch<React.SetStateAction<string>>;
  cloudStatusVisual: CloudStatusVisual;
  setCloudStatusVisual: React.Dispatch<React.SetStateAction<CloudStatusVisual>>;
  localSaveError: string;
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  
  // UI Navigation/View States
  activePage: PageKey;
  setActivePage: React.Dispatch<React.SetStateAction<PageKey>>;
  isAppBooting: boolean;
  setIsAppBooting: React.Dispatch<React.SetStateAction<boolean>>;
  bootLogs: string[];
  setBootLogs: React.Dispatch<React.SetStateAction<string[]>>;
  
  // Feature Specific States (Modal/View management)
  editingRecordId: string | null;
  setEditingRecordId: React.Dispatch<React.SetStateAction<string | null>>;
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  methodFilter: BrewMethod | "All";
  setMethodFilter: React.Dispatch<React.SetStateAction<BrewMethod | "All">>;
  beanStorageView: "list" | "edit";
  setBeanStorageView: React.Dispatch<React.SetStateAction<"list" | "edit">>;
  beanForm: BeanInfo;
  setBeanForm: React.Dispatch<React.SetStateAction<BeanInfo>>;
  beanSortMode: string;
  setBeanSortMode: React.Dispatch<React.SetStateAction<string>>;
  beanSortOrder: "asc" | "desc";
  setBeanSortOrder: React.Dispatch<React.SetStateAction<"asc" | "desc">>;
  beanPreview: BeanInfo | null;
  setBeanPreview: React.Dispatch<React.SetStateAction<BeanInfo | null>>;
  inventoryStorageView: "list" | "edit";
  setInventoryStorageView: React.Dispatch<React.SetStateAction<"list" | "edit">>;
  editingInventoryId: string | null;
  setEditingInventoryId: React.Dispatch<React.SetStateAction<string | null>>;
  inventoryInputValues: Record<string, string>;
  setInventoryInputValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  inventoryForm: InventoryItem;
  setInventoryForm: React.Dispatch<React.SetStateAction<InventoryItem>>;
  inventoryPreview: InventoryItem | null;
  setInventoryPreview: React.Dispatch<React.SetStateAction<InventoryItem | null>>;
  inventorySortMode: string;
  setInventorySortMode: React.Dispatch<React.SetStateAction<string>>;
  inventorySortOrder: "asc" | "desc";
  setInventorySortOrder: React.Dispatch<React.SetStateAction<"asc" | "desc">>;
  showStockLog: boolean;
  setShowStockLog: React.Dispatch<React.SetStateAction<boolean>>;
  unfreezeTarget: { id: string; nextStatus: InventoryStatus } | null;
  setUnfreezeTarget: React.Dispatch<React.SetStateAction<{ id: string; nextStatus: InventoryStatus } | null>>;
  recordPreview: BrewRecord | null;
  setRecordPreview: React.Dispatch<React.SetStateAction<BrewRecord | null>>;
  recipeStorageView: "list" | "edit";
  setRecipeStorageView: React.Dispatch<React.SetStateAction<"list" | "edit">>;
  recipeSortMode: string;
  setRecipeSortMode: React.Dispatch<React.SetStateAction<string>>;
  recipeSortOrder: "asc" | "desc";
  setRecipeSortOrder: React.Dispatch<React.SetStateAction<"asc" | "desc">>;
  recipeForm: RecipeInfo;
  setRecipeForm: React.Dispatch<React.SetStateAction<RecipeInfo>>;
  recipePreview: RecipeInfo | null;
  setRecipePreview: React.Dispatch<React.SetStateAction<RecipeInfo | null>>;
  activeRecipeForTimer: RecipeInfo | null;
  setActiveRecipeForTimer: React.Dispatch<React.SetStateAction<RecipeInfo | null>>;
  
  // Shared Actions/Utils
  triggerCloudSaveToast: () => void;
  showCloudSaveToast: boolean;
  setShowCloudSaveToast: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Persisted Payload Helper
  persistedPayload: PersistedPayload;
  replacePersistedPayload: (payload: PersistedPayload) => void;
  localHydrated: boolean;
  cloudSyncTick: number;
  queueCloudSync: () => void;
}

export type DiaryDataContextType = Pick<AppContextType,
  "profiles" | "setProfiles" | "records" | "setRecords" | "beans" | "setBeans" |
  "inventory" | "setInventory" | "recipes" | "setRecipes" | "settings" | "setSettings" |
  "persistedPayload" | "replacePersistedPayload" | "localHydrated"
>;

const DiaryDataContext = createContext<DiaryDataContextType | undefined>(undefined);
const CloudSyncContext = createContext<Pick<AppContextType, "queueCloudSync"> | undefined>(undefined);

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [initialLocal] = useState(() => {
    try {
      const raw = localStorage.getItem(localDiaryKey(null));
      return { data: raw ? parseDiary(raw) : emptyDiary(), ready: true };
    } catch (error) {
      console.error("Failed to load guest data", error);
      return { data: emptyDiary(), ready: false };
    }
  });
  const [profiles, setProfiles] = useState<Record<string, GrinderProfile>>(initialLocal.data.profiles);
  const [records, setRecords] = useState<BrewRecord[]>(initialLocal.data.records);
  const [beans, setBeans] = useState<BeanInfo[]>(initialLocal.data.beans);
  const [inventory, setInventory] = useState<InventoryItem[]>(initialLocal.data.inventory ?? []);
  const [recipes, setRecipes] = useState<RecipeInfo[]>(initialLocal.data.recipes);
  const [user, setUserState] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudStatus, setCloudStatus] = useState(initialLocal.ready ? "로컬 모드" : "게스트 로컬 데이터를 읽을 수 없습니다");
  const [cloudStatusVisual, setCloudStatusVisual] = useState<CloudStatusVisual>(initialLocal.ready ? "idle" : "error");
  const [localSaveError, setLocalSaveError] = useState(initialLocal.ready ? "" : "로컬 데이터를 읽을 수 없습니다. 원본은 보존했습니다.");
  const [settings, setSettings] = useState<AppSettings>(initialLocal.data.settings ?? DEFAULT_SETTINGS);
  const [localHydrated, setLocalHydrated] = useState(initialLocal.ready);
  const [legacyAvailable, setLegacyAvailable] = useState(() => legacyAvailableFor(null));
  const [isAppBooting, setIsAppBooting] = useState(true);
  const [bootLogs, setBootLogs] = useState<string[]>([]);
  
  const [activePage, setActivePage] = useState<PageKey>("coffee-diary");
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [beanForm, setBeanForm] = useState<BeanInfo>(EMPTY_BEAN_FORM as BeanInfo);
  const [beanSortMode, setBeanSortMode] = useState(initialLocal.data.beanSortMode ?? "newest");
  const [beanSortOrder, setBeanSortOrder] = useState<"asc" | "desc">(initialLocal.data.beanSortOrder ?? "desc");
  const [beanPreview, setBeanPreview] = useState<BeanInfo | null>(null);
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<BrewMethod | "All">("All");
  const [beanStorageView, setBeanStorageView] = useState<"list" | "edit">("list");
  const [inventoryForm, setInventoryForm] = useState<InventoryItem>(EMPTY_INVENTORY_FORM as InventoryItem);
  const [editingInventoryId, setEditingInventoryId] = useState<string | null>(null);
  const [inventoryInputValues, setInventoryInputValues] = useState<Record<string, string>>({});
  const [inventoryPreview, setInventoryPreview] = useState<InventoryItem | null>(null);
  const [inventorySortMode, setInventorySortMode] = useState(initialLocal.data.inventorySortMode ?? "newest");
  const [inventorySortOrder, setInventorySortOrder] = useState<"asc" | "desc">(initialLocal.data.inventorySortOrder ?? "desc");
  const [showStockLog, setShowStockLog] = useState(false);
  const [unfreezeTarget, setUnfreezeTarget] = useState<{ id: string; nextStatus: InventoryStatus } | null>(null);
  const [inventoryStorageView, setInventoryStorageView] = useState<"list" | "edit">("list");
  const [recordPreview, setRecordPreview] = useState<BrewRecord | null>(null);
  const [recipeForm, setRecipeForm] = useState<RecipeInfo>(EMPTY_RECIPE_FORM as RecipeInfo);
  const [recipeSortMode, setRecipeSortMode] = useState(initialLocal.data.recipeSortMode ?? "newest");
  const [recipeSortOrder, setRecipeSortOrder] = useState<"asc" | "desc">(initialLocal.data.recipeSortOrder ?? "desc");
  const [recipePreview, setRecipePreview] = useState<RecipeInfo | null>(null);
  const [activeRecipeForTimer, setActiveRecipeForTimer] = useState<RecipeInfo | null>(null);
  const [recipeStorageView, setRecipeStorageView] = useState<"list" | "edit">("list");
  const [showCloudSaveToast, setShowCloudSaveToast] = useState(false);
  const [cloudSyncTick, setCloudSyncTick] = useState(0);
  
  const cloudSaveToastTimerRef = useRef<number | null>(null);

  const persistedPayload: PersistedPayload = useMemo(
    () => ({ 
      profiles, records, beans, inventory, recipes, settings,
      beanSortMode, beanSortOrder,
      inventorySortMode, inventorySortOrder,
      recipeSortMode, recipeSortOrder
    }),
    [
      profiles, records, beans, inventory, recipes, settings,
      beanSortMode, beanSortOrder,
      inventorySortMode, inventorySortOrder,
      recipeSortMode, recipeSortOrder
    ],
  );
  const accountRef = useRef<string | null>(null);
  const readyRef = useRef(localHydrated);
  readyRef.current = localHydrated;
  const persistedRef = useRef(persistedPayload);
  persistedRef.current = persistedPayload;

  const replacePersistedPayload = (payload: PersistedPayload) => {
    setProfiles(payload.profiles);
    setRecords(payload.records);
    setBeans(payload.beans);
    setInventory(payload.inventory ?? []);
    setRecipes(payload.recipes);
    setSettings(payload.settings ?? DEFAULT_SETTINGS);
    setBeanSortMode(payload.beanSortMode ?? "newest");
    setBeanSortOrder(payload.beanSortOrder ?? "desc");
    setInventorySortMode(payload.inventorySortMode ?? "newest");
    setInventorySortOrder(payload.inventorySortOrder ?? "desc");
    setRecipeSortMode(payload.recipeSortMode ?? "newest");
    setRecipeSortOrder(payload.recipeSortOrder ?? "desc");
  };

  const switchAccount = (nextUser: User | null) => {
    const nextUid = nextUser?.uid ?? null;
    if (accountRef.current === nextUid) {
      setUserState(nextUser);
      return;
    }
    try {
      if (readyRef.current) localStorage.setItem(localDiaryKey(accountRef.current), serializeDiary(persistedRef.current));
    } catch (error) {
      console.error("Failed to save previous account", error);
      setCloudStatus("이전 계정 로컬 저장 실패 — 브라우저 저장 공간을 확인하세요");
      setCloudStatusVisual("error");
    }
    try {
      const raw = localStorage.getItem(localDiaryKey(nextUid));
      replacePersistedPayload(raw ? parseDiary(raw) : emptyDiary());
      readyRef.current = true;
      setLocalHydrated(true);
      setLocalSaveError("");
    } catch (error) {
      console.error("Failed to switch local diary", error);
      replacePersistedPayload(emptyDiary());
      readyRef.current = false;
      setLocalHydrated(false);
      setLocalSaveError("계정 로컬 데이터를 읽을 수 없습니다. 원본은 보존했습니다.");
      setCloudStatus("계정 로컬 데이터를 읽을 수 없습니다. 원본은 보존했습니다.");
      setCloudStatusVisual("error");
    }
    accountRef.current = nextUid;
    setUserState(nextUser);
    setLegacyAvailable(legacyAvailableFor(nextUid));
    setActivePage("coffee-diary");
    setSearch("");
    setMethodFilter("All");
    setEditingRecordId(null);
    setRecordPreview(null);
    setBeanStorageView("list");
    setBeanForm(EMPTY_BEAN_FORM as BeanInfo);
    setBeanPreview(null);
    setInventoryStorageView("list");
    setEditingInventoryId(null);
    setInventoryInputValues({});
    setInventoryForm(EMPTY_INVENTORY_FORM as InventoryItem);
    setInventoryPreview(null);
    setShowStockLog(false);
    setUnfreezeTarget(null);
    setRecipeStorageView("list");
    setRecipeForm(EMPTY_RECIPE_FORM as RecipeInfo);
    setRecipePreview(null);
    setActiveRecipeForTimer(null);
    setShowCloudSaveToast(false);
  };

  const importLegacyData = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const imported = parseDiary(raw);
      if (!hasDiaryData(imported)) return false;
      const key = localDiaryKey(accountRef.current);
      const existing = localStorage.getItem(key);
      if (existing || hasDiaryData(persistedRef.current)) {
        localStorage.setItem(`${key}:before-import:${Date.now()}`, existing ?? serializeDiary(persistedRef.current));
      }
      localStorage.setItem(key, serializeDiary(imported));
      localStorage.setItem(legacyImportedKey(accountRef.current), "1");
      replacePersistedPayload(imported);
      readyRef.current = true;
      setLocalHydrated(true);
      setLocalSaveError("");
      setLegacyAvailable(false);
      setCloudStatus("이전 로컬 데이터 가져오기 완료");
      return true;
    } catch (error) {
      console.error("Failed to import old local data", error);
      setCloudStatus("이전 데이터 가져오기 실패 · 원본은 보존됨");
      setCloudStatusVisual("error");
      return false;
    }
  };

  const importDiaryBackup = (raw: string) => {
    const imported = parseDiary(raw);
    const key = localDiaryKey(accountRef.current);
    const existing = localStorage.getItem(key);
    if (existing || hasDiaryData(persistedRef.current)) {
      localStorage.setItem(`${key}:before-import:${Date.now()}`, existing ?? serializeDiary(persistedRef.current));
    }
    localStorage.setItem(key, serializeDiary(imported));
    replacePersistedPayload(imported);
    readyRef.current = true;
    setLocalHydrated(true);
    setLocalSaveError("");
    setCloudStatus("백업 파일 가져오기 완료");
    setCloudStatusVisual("success");
  };

  const triggerCloudSaveToast = () => {
    if (cloudSaveToastTimerRef.current !== null) {
      window.clearTimeout(cloudSaveToastTimerRef.current);
    }
    setShowCloudSaveToast(true);
    cloudSaveToastTimerRef.current = window.setTimeout(() => {
      setShowCloudSaveToast(false);
      cloudSaveToastTimerRef.current = null;
    }, 3000);
  };

  const queueCloudSync = useCallback(() => {
    setCloudSyncTick(prev => prev + 1);
  }, []);

  // Boot Sequence Sync
  useEffect(() => {
    console.log(`⏱ Boot Status -> Auth: ${authReady}, Cloud: ${cloudReady}`);
    if (authReady && cloudReady) {
      console.log("🏁 All systems ready. Preparing to launch...");
      const timer = setTimeout(() => {
        setIsAppBooting(false);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [authReady, cloudReady]);

  // Safety Timeout: Force open after 5 seconds
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      if (isAppBooting) {
        console.warn("⚠️ Safety Timeout Triggered: Forcing launch after 5s");
        setIsAppBooting(false);
      }
    }, 5000);
    return () => clearTimeout(safetyTimer);
  }, [isAppBooting]);

  // A committed edit must survive an immediate refresh. Wait for initial hydration
  // so the empty default state never overwrites the previously saved snapshot.
  useLayoutEffect(() => {
    if (!localHydrated || !authReady || accountRef.current !== (user?.uid ?? null)) return;
    try {
      localStorage.setItem(localDiaryKey(accountRef.current), serializeDiary(persistedPayload));
      setLocalSaveError("");
    } catch (error) {
      console.error("Failed to save local storage", error);
      setLocalSaveError("로컬 저장 실패 — 현재 변경이 이 기기에 저장되지 않았습니다. JSON 백업을 내보내세요.");
      setCloudStatus("로컬 저장 실패 — 브라우저 저장 공간을 확인하세요");
      setCloudStatusVisual("error");
    }
  }, [authReady, localHydrated, persistedPayload, user]);

  // Theme apply — CSS 변수 및 root 스타일 동기화
  useThemeApplier(settings.theme);

  const value: AppContextType = {
    profiles, setProfiles,
    records, setRecords,
    beans, setBeans,
    inventory, setInventory,
    recipes, setRecipes,
    user, switchAccount, legacyAvailable, importLegacyData, importDiaryBackup,
    authReady, setAuthReady,
    cloudReady, setCloudReady,
    cloudStatus, setCloudStatus,
    cloudStatusVisual, setCloudStatusVisual, localSaveError,
    settings, setSettings,
    activePage, setActivePage,
    editingRecordId, setEditingRecordId,
    search, setSearch,
    methodFilter, setMethodFilter,
    isAppBooting, setIsAppBooting,
    bootLogs, setBootLogs,
    beanStorageView, setBeanStorageView,
    beanForm, setBeanForm,
    beanSortMode, setBeanSortMode,
    beanSortOrder, setBeanSortOrder,
    beanPreview, setBeanPreview,
    inventoryStorageView, setInventoryStorageView,
    editingInventoryId, setEditingInventoryId,
    inventoryInputValues, setInventoryInputValues,
    inventoryForm, setInventoryForm,
    inventoryPreview, setInventoryPreview,
    inventorySortMode, setInventorySortMode,
    inventorySortOrder, setInventorySortOrder,
    showStockLog, setShowStockLog,
    unfreezeTarget, setUnfreezeTarget,
    recordPreview, setRecordPreview,
    recipeForm, setRecipeForm,
    recipeSortMode, setRecipeSortMode,
    recipeSortOrder, setRecipeSortOrder,
    recipePreview, setRecipePreview,
    activeRecipeForTimer, setActiveRecipeForTimer,
    recipeStorageView, setRecipeStorageView,
    triggerCloudSaveToast,
    showCloudSaveToast, setShowCloudSaveToast,
    persistedPayload,
    replacePersistedPayload,
    localHydrated,
    cloudSyncTick,
    queueCloudSync
  };

  const diaryValue = useMemo<DiaryDataContextType>(() => ({
    profiles, setProfiles, records, setRecords, beans, setBeans, inventory, setInventory,
    recipes, setRecipes, settings, setSettings, persistedPayload, replacePersistedPayload, localHydrated,
  }), [profiles, records, beans, inventory, recipes, settings, persistedPayload, localHydrated]);

  return <DiaryDataContext.Provider value={diaryValue}>
    <CloudSyncContext.Provider value={{ queueCloudSync }}>
      <AppContext.Provider value={value}>{children}</AppContext.Provider>
    </CloudSyncContext.Provider>
  </DiaryDataContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
};

export const useDiaryData = () => {
  const context = useContext(DiaryDataContext);
  if (!context) throw new Error("useDiaryData must be used within an AppProvider");
  return context;
};

export const useCloudSync = () => {
  const context = useContext(CloudSyncContext);
  if (!context) throw new Error("useCloudSync must be used within an AppProvider");
  return context;
};
