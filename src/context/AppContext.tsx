import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from "react";
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

interface AppContextType {
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
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  authReady: boolean;
  setAuthReady: React.Dispatch<React.SetStateAction<boolean>>;
  cloudReady: boolean;
  setCloudReady: React.Dispatch<React.SetStateAction<boolean>>;
  cloudStatus: string;
  setCloudStatus: React.Dispatch<React.SetStateAction<string>>;
  cloudStatusVisual: CloudStatusVisual;
  setCloudStatusVisual: React.Dispatch<React.SetStateAction<CloudStatusVisual>>;
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
  cloudSyncTick: number;
  queueCloudSync: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profiles, setProfiles] = useState<Record<string, GrinderProfile>>({});
  const [records, setRecords] = useState<BrewRecord[]>([]);
  const [beans, setBeans] = useState<BeanInfo[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [recipes, setRecipes] = useState<RecipeInfo[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudStatus, setCloudStatus] = useState("로컬 모드");
  const [cloudStatusVisual, setCloudStatusVisual] = useState<CloudStatusVisual>("idle");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isAppBooting, setIsAppBooting] = useState(true);
  const [bootLogs, setBootLogs] = useState<string[]>([]);
  
  // Initialize from Local Storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.profiles) setProfiles(parsed.profiles);
        if (parsed.records) setRecords(parsed.records);
        if (parsed.beans) setBeans(parsed.beans);
        if (parsed.inventory) setInventory(parsed.inventory);
        if (parsed.recipes) setRecipes(parsed.recipes);
        if (parsed.settings) setSettings(parsed.settings);
        
        if (parsed.beanSortMode) setBeanSortMode(parsed.beanSortMode);
        if (parsed.beanSortOrder) setBeanSortOrder(parsed.beanSortOrder);
        if (parsed.inventorySortMode) setInventorySortMode(parsed.inventorySortMode);
        if (parsed.inventorySortOrder) setInventorySortOrder(parsed.inventorySortOrder);
        if (parsed.recipeSortMode) setRecipeSortMode(parsed.recipeSortMode);
        if (parsed.recipeSortOrder) setRecipeSortOrder(parsed.recipeSortOrder);
        console.log("📦 Local storage data hydrated");
      }
    } catch (e) {
      console.error("Failed to load local storage", e);
    }
  }, []);
  
  const [activePage, setActivePage] = useState<PageKey>("coffee-diary");
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [beanForm, setBeanForm] = useState<BeanInfo>(EMPTY_BEAN_FORM as BeanInfo);
  const [beanSortMode, setBeanSortMode] = useState("newest");
  const [beanSortOrder, setBeanSortOrder] = useState<"asc" | "desc">("desc");
  const [beanPreview, setBeanPreview] = useState<BeanInfo | null>(null);
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<BrewMethod | "All">("All");
  const [beanStorageView, setBeanStorageView] = useState<"list" | "edit">("list");
  const [inventoryForm, setInventoryForm] = useState<InventoryItem>(EMPTY_INVENTORY_FORM as InventoryItem);
  const [editingInventoryId, setEditingInventoryId] = useState<string | null>(null);
  const [inventoryInputValues, setInventoryInputValues] = useState<Record<string, string>>({});
  const [inventoryPreview, setInventoryPreview] = useState<InventoryItem | null>(null);
  const [inventorySortMode, setInventorySortMode] = useState("newest");
  const [inventorySortOrder, setInventorySortOrder] = useState<"asc" | "desc">("desc");
  const [showStockLog, setShowStockLog] = useState(false);
  const [unfreezeTarget, setUnfreezeTarget] = useState<{ id: string; nextStatus: InventoryStatus } | null>(null);
  const [inventoryStorageView, setInventoryStorageView] = useState<"list" | "edit">("list");
  const [recordPreview, setRecordPreview] = useState<BrewRecord | null>(null);
  const [recipeForm, setRecipeForm] = useState<RecipeInfo>(EMPTY_RECIPE_FORM as RecipeInfo);
  const [recipeSortMode, setRecipeSortMode] = useState("newest");
  const [recipeSortOrder, setRecipeSortOrder] = useState<"asc" | "desc">("desc");
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

  const queueCloudSync = () => {
    setCloudSyncTick(prev => prev + 1);
  };

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

  // Local Storage Debounced Sync
  const localSaveTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (localSaveTimerRef.current !== null) {
      window.clearTimeout(localSaveTimerRef.current);
    }
    localSaveTimerRef.current = window.setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedPayload));
      localSaveTimerRef.current = null;
    }, 500);
    return () => {
      if (localSaveTimerRef.current !== null) window.clearTimeout(localSaveTimerRef.current);
    };
  }, [persistedPayload]);

  // Theme apply — CSS 변수 및 root 스타일 동기화
  useThemeApplier(settings.theme);

  const value: AppContextType = {
    profiles, setProfiles,
    records, setRecords,
    beans, setBeans,
    inventory, setInventory,
    recipes, setRecipes,
    user, setUser,
    authReady, setAuthReady,
    cloudReady, setCloudReady,
    cloudStatus, setCloudStatus,
    cloudStatusVisual, setCloudStatusVisual,
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
    cloudSyncTick,
    queueCloudSync
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
};
