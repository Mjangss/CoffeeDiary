import { DATA_SCHEMA_VERSION, DEFAULT_SETTINGS, STORAGE_KEY } from "../constants";
import type { PersistedPayload } from "../types";
import { hydratePersistedData } from "../utils/hydration";

export const localDiaryKey = (uid: string | null) => `${STORAGE_KEY}:${uid ? `user:${uid}` : "guest"}`;
export const legacyImportedKey = (uid: string | null) => `${STORAGE_KEY}:legacy-imported:${uid ?? "guest"}`;

export const emptyDiary = (): PersistedPayload => ({
  profiles: {}, records: [], beans: [], inventory: [], recipes: [], settings: DEFAULT_SETTINGS,
  beanSortMode: "newest", beanSortOrder: "desc",
  inventorySortMode: "newest", inventorySortOrder: "desc",
  recipeSortMode: "newest", recipeSortOrder: "desc",
});

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const parseAndMigratePayload = (value: unknown): PersistedPayload => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid diary data");
  const data = value as Record<string, unknown>;
  const settings = data.settings ?? {};
  const theme = object(settings) ? settings.theme : undefined;
  const units = object(settings) ? settings.units : undefined;
  const grinders = object(settings) ? settings.grinders : undefined;
  const grinderCalibrations = object(settings) ? settings.grinderCalibrations : undefined;
  if ((data.schemaVersion !== undefined && (!Number.isSafeInteger(data.schemaVersion) ||
        (data.schemaVersion as number) > DATA_SCHEMA_VERSION || (data.schemaVersion as number) < 1)) ||
      (data.profiles !== undefined && (!object(data.profiles) || !Object.values(data.profiles).every(object))) ||
      ["records", "beans", "recipes", "inventory"].some(key => data[key] !== undefined &&
        (!Array.isArray(data[key]) || !(data[key] as unknown[]).every(object))) ||
      !object(settings) ||
      ["units", "theme", "roastLabels", "grinders", "grinderCalibrations"].some(key => settings[key] !== undefined && !object(settings[key])) ||
      (object(theme) && Object.entries(theme).some(([key, entry]) =>
        key === "isDarkMode" ? typeof entry !== "boolean" :
        key === "pointColor" || key === "pageTransition" ? typeof entry !== "string" :
        key === "uiScale" || key === "textScale" ? typeof entry !== "number" || !Number.isFinite(entry) || entry <= 0 : false)) ||
      (object(units) && Object.entries(units).some(([, entry]) => typeof entry !== "string")) ||
      (object(grinders) && !Object.values(grinders).every(range => object(range) &&
        ["min", "max", "step"].every(key => typeof range[key] === "number" && Number.isFinite(range[key])))) ||
      (object(grinderCalibrations) && !Object.values(grinderCalibrations).every(points => object(points) &&
        Object.values(points).every(value => typeof value === "number" && Number.isFinite(value) && value > 0))) ||
      ["drippers", "waters", "filters"].some(key => settings[key] !== undefined &&
        (!Array.isArray(settings[key]) || !(settings[key] as unknown[]).every(item => typeof item === "string"))) ||
      (Array.isArray(data.recipes) && data.recipes.some((recipe: Record<string, unknown>) =>
        recipe.pours !== undefined && (!Array.isArray(recipe.pours) || !recipe.pours.every(object)))) ||
      (Array.isArray(data.records) && data.records.some((record: Record<string, unknown>) =>
        record.cupScores !== undefined && !object(record.cupScores))) ||
      (Array.isArray(data.inventory) && data.inventory.some((item: Record<string, unknown>) =>
        item.manualLogs !== undefined && (!Array.isArray(item.manualLogs) || !item.manualLogs.every(object))))) {
    throw new Error("Invalid diary data");
  }
  return {
    ...emptyDiary(),
    ...hydratePersistedData(data),
    beanSortMode: typeof data.beanSortMode === "string" ? data.beanSortMode : "newest",
    beanSortOrder: data.beanSortOrder === "asc" ? "asc" : "desc",
    inventorySortMode: typeof data.inventorySortMode === "string" ? data.inventorySortMode : "newest",
    inventorySortOrder: data.inventorySortOrder === "asc" ? "asc" : "desc",
    recipeSortMode: typeof data.recipeSortMode === "string" ? data.recipeSortMode : "newest",
    recipeSortOrder: data.recipeSortOrder === "asc" ? "asc" : "desc",
  };
};

export const parseDiary = (raw: string): PersistedPayload => parseAndMigratePayload(JSON.parse(raw));
export const serializeDiary = (data: PersistedPayload) => JSON.stringify({ ...data, schemaVersion: DATA_SCHEMA_VERSION });

export const hasDiaryData = (data: PersistedPayload) =>
  Object.keys(data.profiles).length > 0 || data.records.length > 0 || data.beans.length > 0 ||
  (data.inventory?.length ?? 0) > 0 || data.recipes.length > 0 ||
  JSON.stringify(data.settings ?? DEFAULT_SETTINGS) !== JSON.stringify(DEFAULT_SETTINGS) ||
  data.beanSortMode !== "newest" || data.beanSortOrder !== "desc" ||
  data.inventorySortMode !== "newest" || data.inventorySortOrder !== "desc" ||
  data.recipeSortMode !== "newest" || data.recipeSortOrder !== "desc";
