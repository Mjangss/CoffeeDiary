import { 
  BeanInfo, 
  BrewRecord, 
  InventoryItem, 
  RecipeInfo, 
  AppSettings, 
  GrinderProfile,
  InventoryStatus,
  PourSwitchState,
  RecipePour,
  CupScores,
  BrewMethod,
  Grinder,
  BrewWater,
  Dripper,
  RoastLevel
} from "../types";
import { 
  DEFAULT_SETTINGS, 
  DEFAULT_CUP_SCORES
} from "../constants";
import { 
  safeNum, 
  normalizeClock, 
  clamp, 
  enforceLinkedPourStarts, 
  normalizeCupScoreValue, 
  round 
} from "./index";

/**
 * Validates and migrates raw data from storage (local or cloud) 
 * to ensure it matches the current app version's data structures.
 */
export const hydratePersistedData = (
  source: Record<string, unknown>,
  setters: {
    setProfiles: (p: Record<string, GrinderProfile>) => void;
    setBeans: (b: BeanInfo[]) => void;
    setSettings: (s: AppSettings) => void;
    setInventory: (i: InventoryItem[]) => void;
    setRecipes: (r: RecipeInfo[]) => void;
    setRecords: (r: BrewRecord[]) => void;
    dispatchBrewForm: (action: any) => void;
  }
) => {
  const loadedProfiles = (source.profiles as Record<string, GrinderProfile>) ?? {};
  const loadedBeans = Array.isArray(source.beans) ? (source.beans as BeanInfo[]) : [];
  const loadedRawInventory = Array.isArray(source.inventory) ? (source.inventory as Array<Record<string, unknown>>) : [];
  const loadedRawRecords = Array.isArray(source.records) ? (source.records as Array<Record<string, unknown>>) : [];
  const loadedRawRecipes = Array.isArray(source.recipes) ? (source.recipes as Array<Record<string, unknown>>) : [];
  const rawSettings = (source.settings as Partial<AppSettings>) ?? {};
  
  const loadedSettings: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...rawSettings,
    units: { ...DEFAULT_SETTINGS.units, ...rawSettings.units },
    theme: { ...DEFAULT_SETTINGS.theme, ...rawSettings.theme },
    roastLabels: { ...DEFAULT_SETTINGS.roastLabels, ...rawSettings.roastLabels },
    grinders: rawSettings.grinders ?? DEFAULT_SETTINGS.grinders,
    drippers: rawSettings.drippers ?? DEFAULT_SETTINGS.drippers,
    waters: rawSettings.waters ?? DEFAULT_SETTINGS.waters,
    filters: rawSettings.filters ?? DEFAULT_SETTINGS.filters,
  };

  setters.setProfiles(loadedProfiles);
  setters.setBeans(loadedBeans);
  setters.setSettings(loadedSettings);

  const loadedInventory = loadedRawInventory.map((item) => {
    return {
      id: String(item.id ?? crypto.randomUUID()),
      beanName: String(item.beanName ?? ""),
      roastery: String(item.roastery ?? ""),
      purchaseDate: String(item.purchaseDate ?? new Date().toISOString().split("T")[0]),
      roastDate: String(item.roastDate ?? new Date().toISOString().split("T")[0]),
      initialWeight: Number(item.initialWeight ?? 200),
      remainingWeight: Number(item.remainingWeight ?? 200),
      status: (item.status as InventoryStatus) ?? "RESTING",
      memo: String(item.memo ?? ""),
      createdAt: String(item.createdAt ?? new Date().toISOString()),
      frozenDurationMs: Number(item.frozenDurationMs ?? 0),
      lastFrozenAt: item.lastFrozenAt ? String(item.lastFrozenAt) : undefined,
      manualLogs: Array.isArray(item.manualLogs) ? item.manualLogs : [],
    } as InventoryItem;
  });
  setters.setInventory(loadedInventory);

  const loadedRecipes = loadedRawRecipes.map((item) => {
    const rawPours = Array.isArray(item.pours) ? (item.pours as Array<Record<string, unknown>>) : [];

    // Only hydrate pours that actually exist in saved data — do NOT pad with empty template slots
    const normalizedPours: RecipePour[] = rawPours
      .map((fromRaw): RecipePour => {
        const switchState: PourSwitchState = fromRaw.switchState === "열림" ? "열림" : "닫힘";
        return {
          order: safeNum(fromRaw.order, 0),
          start: normalizeClock(String(fromRaw.start ?? "00:00")),
          end: normalizeClock(String(fromRaw.end ?? "00:00")),
          waterMl: clamp(safeNum(fromRaw.waterMl, 0), 0, 2000),
          switchState,
        };
      })
      // Filter out any pours that have no meaningful data (end is 00:00)
      .filter(p => p.end !== "00:00")
      // Sort by start time for consistency
      .sort((a, b) => {
        const [am, as_] = a.start.split(":").map(Number);
        const [bm, bs] = b.start.split(":").map(Number);
        return (am * 60 + as_) - (bm * 60 + bs);
      })
      // Re-assign order sequentially
      .map((p, idx) => ({ ...p, order: idx + 1 }));

    const linkedPours = enforceLinkedPourStarts(normalizedPours);

    return {
      id: String(item.id ?? crypto.randomUUID()),
      createdAt: String(item.createdAt ?? new Date().toISOString()),
      name: String(item.name ?? "이름 없는 레시피"),
      drinkType: item.drinkType === "ice" ? "ice" : "hot",
      dose: clamp(safeNum(item.dose, 20), 1, 100),
      method: String(item.method ?? "Brew"),
      useSwitch: Boolean(item.useSwitch),
      pours: linkedPours,
      dilutionGuide: String(item.dilutionGuide ?? "").trim(),
      memo: String(item.memo ?? "").trim(),
      oxoUpperFilter: String(item.oxoUpperFilter ?? "종이"),
      oxoLowerFilter: String(item.oxoLowerFilter ?? "종이"),
    } as RecipeInfo;
  });
  setters.setRecipes(loadedRecipes);

  const loadedRecords = loadedRawRecords.map((record) => {
    const oldScore = normalizeCupScoreValue(record.score, DEFAULT_CUP_SCORES.acidity);
    const loadedScores = (record.cupScores as Partial<CupScores>) ?? {};
    const normalizedScores: CupScores = {
      acidity: normalizeCupScoreValue(loadedScores.acidity, oldScore),
      sweetness: normalizeCupScoreValue(loadedScores.sweetness, oldScore),
      body: normalizeCupScoreValue(loadedScores.body, oldScore),
      cleanCup: normalizeCupScoreValue(loadedScores.cleanCup, oldScore),
      balance: normalizeCupScoreValue(loadedScores.balance, oldScore),
      flavorIntensity: normalizeCupScoreValue(loadedScores.flavorIntensity, oldScore),
      aftertaste: normalizeCupScoreValue(loadedScores.aftertaste, oldScore),
      texture: normalizeCupScoreValue(loadedScores.texture, oldScore),
    };
    const average =
      typeof record.scoreAverage === "number"
        ? normalizeCupScoreValue(record.scoreAverage, oldScore)
        : round(Object.values(normalizedScores).reduce((acc, value) => acc + value, 0) / Object.keys(normalizedScores).length, 1);

    const parsedBrewWaterTemp = clamp(safeNum(record.brewWaterTemp, 92), 80, 100);
    const parsedImmersion = record.immersionWaterTemp;
    const normalizedImmersion = typeof parsedImmersion === "number" ? clamp(parsedImmersion, 50, 100) : null;
    const rawRecipe = String(record.recipe ?? "").trim();
    const normalizedRecipeName = rawRecipe.includes(" / ") ? rawRecipe.split(" / ")[0].trim() : rawRecipe;

    return {
      id: String(record.id ?? crypto.randomUUID()),
      createdAt: String(record.createdAt ?? new Date().toISOString()),
      bean: String(record.bean ?? "Unknown bean"),
      method: (record.method as BrewMethod) ?? "Espresso",
      grinder: (record.grinder as Grinder) ?? "Millab M01",
      brewWater: (record.brewWater as BrewWater) ?? "평창수",
      brewWaterTemp: parsedBrewWaterTemp,
      immersionWaterTemp: normalizedImmersion,
      dripper: (record.dripper as Dripper) ?? "V60",
      filterPaper: String(record.filterPaper ?? "하리오 기본"),
      switchApplied: Boolean(record.switchApplied),
      roastLevel: (record.roastLevel as RoastLevel) ?? "중배전",
      scoreAverage: average,
      cupScores: normalizedScores,
      restDays: safeNum(record.restDays, 0),
      brewSec: safeNum(record.brewSec, 0),
      recipe: normalizedRecipeName,
      baseClick: safeNum(record.baseClick, 1.5),
      memo: String(record.memo ?? ""),
      inventoryId: record.inventoryId ? String(record.inventoryId) : undefined,
      dose: Number(record.dose ?? 20),
    } as BrewRecord;
  });

  setters.setRecords(loadedRecords);
};

/**
 * Deeply removes all undefined fields from an object,
 * as Firestore does not allow them.
 */
export const deepClean = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(deepClean);
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    const res: any = {};
    Object.keys(obj).forEach(k => {
      const v = obj[k];
      if (v !== undefined) res[k] = deepClean(v);
    });
    return res;
  }
  return obj;
};
