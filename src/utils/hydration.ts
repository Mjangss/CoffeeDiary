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
  RecipeSnapshot,
  CupScores,
  BrewMethod,
  Grinder,
  BrewWater,
  Dripper,
  RoastLevel,
  PersistedPayload
} from "../types";
import { 
  DEFAULT_SETTINGS, 
  DEFAULT_CUP_SCORES,
  DATA_SCHEMA_VERSION
} from "../constants";
import { 
  safeNum, 
  normalizeClock, 
  clamp, 
  normalizeCupScoreValue, 
  round 
} from "./index";
import { localDateString } from "./date";

/**
 * Validates and migrates raw data from storage (local or cloud) 
 * to ensure it matches the current app version's data structures.
 */
export const hydratePersistedData = (
  source: Record<string, unknown>
): PersistedPayload => {
  const loadedProfiles = (source.profiles as Record<string, GrinderProfile>) ?? {};
  const loadedRawBeans = Array.isArray(source.beans) ? (source.beans as Array<Record<string, unknown>>) : [];
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
    grinderCalibrations: rawSettings.grinderCalibrations ?? DEFAULT_SETTINGS.grinderCalibrations,
    drippers: rawSettings.drippers ?? DEFAULT_SETTINGS.drippers,
    waters: rawSettings.waters ?? DEFAULT_SETTINGS.waters,
    filters: rawSettings.filters ?? DEFAULT_SETTINGS.filters,
  };

  // Documents written by this app already use the current shape. Rebuilding
  // their rows would round scores and silently discard optional fields.
  if (source.schemaVersion === DATA_SCHEMA_VERSION) {
    return {
      profiles: loadedProfiles, beans: loadedRawBeans as BeanInfo[], settings: loadedSettings,
      inventory: loadedRawInventory as InventoryItem[], recipes: loadedRawRecipes as RecipeInfo[],
      records: loadedRawRecords as BrewRecord[],
    };
  }

  const loadedBeans = loadedRawBeans.map((item) => ({
    ...item,
    id: String(item.id ?? crypto.randomUUID()),
    createdAt: String(item.createdAt ?? new Date().toISOString()),
  })) as BeanInfo[];
  const beanIdFor = (name: string, roastery: string) => {
    const matches = loadedBeans.filter(bean => bean.name === name && (!roastery || bean.roastery === roastery));
    return matches.length === 1 ? matches[0].id : undefined;
  };

  const loadedInventory = loadedRawInventory.map((item) => {
    return {
      ...item,
      id: String(item.id ?? crypto.randomUUID()),
      beanName: String(item.beanName ?? ""),
      beanId: item.beanId ? String(item.beanId) : beanIdFor(String(item.beanName ?? ""), String(item.roastery ?? "")),
      roastery: String(item.roastery ?? ""),
      purchaseDate: String(item.purchaseDate ?? localDateString()),
      roastDate: String(item.roastDate ?? localDateString()),
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
  const loadedRecipes = loadedRawRecipes.map((item) => {
    const rawPours = Array.isArray(item.pours) ? (item.pours as Array<Record<string, unknown>>) : [];
    const normalizedPours: RecipePour[] = rawPours
      .map((fromRaw, index): RecipePour => {
        const switchState: PourSwitchState = fromRaw.switchState === "열림" ? "열림" : "닫힘";
        return {
          ...fromRaw,
          order: safeNum(fromRaw.order, index + 1),
          start: normalizeClock(String(fromRaw.start ?? "00:00")),
          end: normalizeClock(String(fromRaw.end ?? "00:00")),
          waterMl: clamp(safeNum(fromRaw.waterMl, 0), 0, 2000),
          switchState,
        } as RecipePour;
      });

    return {
      ...item,
      id: String(item.id ?? crypto.randomUUID()),
      createdAt: String(item.createdAt ?? new Date().toISOString()),
      name: String(item.name ?? "이름 없는 레시피"),
      drinkType: item.drinkType === "ice" ? "ice" : "hot",
      dose: clamp(safeNum(item.dose, 20), 1, 100),
      method: String(item.method ?? "Brew"),
      useSwitch: Boolean(item.useSwitch),
      pours: normalizedPours,
      dilutionGuide: String(item.dilutionGuide ?? ""),
      memo: String(item.memo ?? ""),
      oxoUpperFilter: String(item.oxoUpperFilter ?? "종이"),
      oxoLowerFilter: String(item.oxoLowerFilter ?? "종이"),
    } as RecipeInfo;
  });
  const recipeSnapshot = (recipe: RecipeInfo): RecipeSnapshot => ({
    name: recipe.name, method: recipe.method, drinkType: recipe.drinkType, dose: recipe.dose,
    useSwitch: recipe.useSwitch, pours: recipe.pours.map(pour => ({ ...pour })),
    dilutionGuide: recipe.dilutionGuide, oxoUpperFilter: recipe.oxoUpperFilter, oxoLowerFilter: recipe.oxoLowerFilter,
  });
  const recipeFor = (id: unknown, name: string) => {
    if (typeof id === "string") return loadedRecipes.find(recipe => recipe.id === id);
    const matches = loadedRecipes.filter(recipe => recipe.name === name);
    return matches.length === 1 ? matches[0] : undefined;
  };
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
    const storedAverage = safeNum(record.scoreAverage, NaN);
    const average = Number.isFinite(storedAverage)
      ? clamp(storedAverage > 10 ? round(storedAverage / 10, 1) : storedAverage, 0, 10)
      : round(Object.values(normalizedScores).reduce((acc, value) => acc + value, 0) / Object.keys(normalizedScores).length, 1);

    const parsedBrewWaterTemp = clamp(safeNum(record.brewWaterTemp, 92), 80, 100);
    const parsedImmersion = record.immersionWaterTemp;
    const normalizedImmersion = typeof parsedImmersion === "number" ? clamp(parsedImmersion, 50, 100) : null;
    const bean = String(record.bean ?? "Unknown bean");
    const inventory = record.inventoryId ? loadedInventory.find(item => item.id === record.inventoryId) : undefined;
    const recipe = recipeFor(record.recipeId, String(record.recipe ?? ""));
    return {
      ...record,
      id: String(record.id ?? crypto.randomUUID()),
      createdAt: String(record.createdAt ?? new Date().toISOString()),
      bean,
      beanId: record.beanId ? String(record.beanId) : inventory?.beanId ?? beanIdFor(bean, ""),
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
      recipe: String(record.recipe ?? ""),
      recipeId: recipe?.id,
      recipeSnapshot: record.recipeSnapshot ?? (recipe ? recipeSnapshot(recipe) : undefined),
      baseClick: safeNum(record.baseClick, 1.5),
      memo: String(record.memo ?? ""),
      inventoryId: record.inventoryId ? String(record.inventoryId) : undefined,
      dose: Number(record.dose ?? 20),
    } as BrewRecord;
  });

  return {
    profiles: loadedProfiles, beans: loadedBeans, settings: loadedSettings,
    inventory: loadedInventory, recipes: loadedRecipes, records: loadedRecords,
  };
};

/**
 * Deeply removes all undefined fields from an object,
 * as Firestore does not allow them.
 */
export const deepClean = <T>(obj: T): T => {
  if (Array.isArray(obj)) return obj.map(deepClean) as T;
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    const res: Record<string, unknown> = {};
    Object.keys(obj as object).forEach(k => {
      const v = (obj as Record<string, unknown>)[k];
      if (v !== undefined) res[k] = deepClean(v);
    });
    return res as T;
  }
  return obj;
};
