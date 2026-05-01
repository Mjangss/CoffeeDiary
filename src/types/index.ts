export type BrewMethod = "Brew" | "Espresso" | "OXO";
export type OXOFilterType = "종이" | "메탈" | "없음";
export type Grinder = "Millab M01" | "HammerHead" | "K-Ultra" | "EK-43";
export type RoastLevel = "약약배전" | "약배전" | "중약배전" | "중배전" | "중강배전" | "강배전";
export type Dripper = "V60" | "V60 세라믹" | "알파" | "노암니" | "B75" | "벡터";
export type BrewWater = "평창수" | "백산수" | "아이시스" | "평딥수" | "백딥수" | "아딥수";
export type RecipeDrinkType = "hot" | "ice";
export type PourSwitchState = "닫힘" | "열림";

export type MethodConfig = {
  baselineClick: number;
  ratioText: string;
};

export type CupScores = {
  acidity: number;
  sweetness: number;
  body: number;
  cleanCup: number;
  balance: number;
  flavorIntensity: number;
  aftertaste: number;
  texture: number;
};

export type BeanInfo = {
  name: string;
  roastery: string;
  roastingDate: string;
  region: string;
  variety: string;
  altitude: string;
  process: string;
  roastLevel: RoastLevel;
  roasterNote: string;
  peakStart?: number;
  peakEnd?: number;
  createdAt: string;
};

export type InventoryStatus = "RESTING" | "ACTIVE" | "FROZEN" | "DEPLETED";

export type InventoryItem = {
  id: string;
  beanName: string;
  roastery: string;
  purchaseDate: string;
  roastDate: string;
  initialWeight: number;
  remainingWeight: number;
  status: InventoryStatus;
  memo: string;
  createdAt: string;
  frozenRestDays?: number;
  frozenDurationMs?: number;
  lastFrozenAt?: string;
  manualLogs?: Array<{ date: string; amount: number; type: "INC" | "DEC"; reason?: string }>;
};

export type GrinderProfile = {
  bean: string;
  method: BrewMethod;
  grinder: Grinder;
  dripper: Dripper;
  switchApplied: boolean;
  baseClick: number;
  sampleCount: number;
  updatedAt: string;
};

export type BrewRecord = {
  id: string;
  createdAt: string;
  bean: string;
  method: BrewMethod;
  grinder: Grinder;
  brewWater: BrewWater;
  brewWaterTemp: number;
  immersionWaterTemp: number | null;
  dripper: Dripper;
  filterPaper: string;
  switchApplied: boolean;
  roastLevel: RoastLevel;
  scoreAverage: number;
  cupScores: CupScores;
  restDays: number;
  brewSec: number;
  recipe: string;
  baseClick: number;
  memo: string;
  inventoryId?: string;
  dose: number;
  oxoUpperFilter?: OXOFilterType;
  oxoLowerFilter?: OXOFilterType;
};

export type RecipePour = {
  order: number;
  start: string;
  end: string;
  waterMl: number;
  switchState: PourSwitchState;
};

export type RecipeInfo = {
  id: string;
  createdAt: string;
  name: string;
  method: BrewMethod;
  drinkType: RecipeDrinkType;
  dose: number;
  useSwitch: boolean;
  pours: RecipePour[];
  dilutionGuide: string;
  memo: string;
  oxoUpperFilter?: OXOFilterType;
  oxoLowerFilter?: OXOFilterType;
};

export type AppSettings = {
  grinders: Record<string, { min: number; max: number; step: number }>;
  drippers: string[];
  waters: string[];
  filters: string[];
  units: { temp: "C" | "F"; weight: "g" | "oz" };
  roastLabels: Record<RoastLevel, string>;
  theme: { isDarkMode: boolean; pointColor: string; uiScale: number; textScale: number; pageTransition: "scan" | "glitch" | "vanguard" | "shutter" | "cascade" | "decrypt" };
};

export type PersistedPayload = {
  profiles: Record<string, GrinderProfile>;
  records: BrewRecord[];
  beans: BeanInfo[];
  inventory?: InventoryItem[];
  recipes: RecipeInfo[];
  settings?: AppSettings;
  beanSortMode?: string;
  beanSortOrder?: "asc" | "desc";
  inventorySortMode?: string;
  inventorySortOrder?: "asc" | "desc";
  recipeSortMode?: string;
  recipeSortOrder?: "asc" | "desc";
};

export type BrewFormState = {
  bean: string;
  method: BrewMethod;
  grinder: Grinder;
  brewWater: BrewWater;
  brewWaterTemp: number;
  immersionWaterTemp: number;
  filterPaper: string;
  dripper: Dripper;
  switchApplied: boolean;
  roastLevel: RoastLevel;
  cupScores: CupScores;
  restDays: number;
  brewSec: number;
  recipe: string;
  dose: number;
  baseClick: number;
  baseClickInput: string;
  memo: string;
  selectedInventoryId: string;
  selectedRecipeId: string;
  selectedBeanName: string;
  oxoUpperFilter: OXOFilterType;
  oxoLowerFilter: OXOFilterType;
};

export type BrewAction = 
  | { type: "UPDATE_FIELD"; field: keyof BrewFormState; value: any }
  | { type: "UPDATE_CUP_SCORES"; scores: Partial<CupScores> }
  | { type: "RESET_FORM" }
  | { type: "LOAD_RECORD"; record: BrewRecord; recipes: RecipeInfo[] }
  | { type: "APPLY_RECIPE"; recipe: RecipeInfo }
  | { type: "SET_METHOD"; method: BrewMethod }
  | { type: "SET_BASE_CLICK"; value: number };

export type CloudStatusVisual = "idle" | "loading" | "success" | "error";
export type PageKey = "coffee-diary" | "coffee-diary-records" | "bean-storage" | "recipe-storage" | "inventory" | "settings" | "brewing-timer";
