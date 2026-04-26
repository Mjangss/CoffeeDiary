import { 
  CupScores, 
  BrewMethod, 
  MethodConfig, 
  InventoryItem, 
  BeanInfo, 
  RecipePour, 
  AppSettings,
  BrewFormState,
  RecipeInfo
} from "../types";

export const DEFAULT_CUP_SCORES: CupScores = {
  acidity: 6,
  sweetness: 6,
  body: 6,
  cleanCup: 6,
  balance: 6,
  flavorIntensity: 6,
  aftertaste: 6,
  texture: 6,
};

export const METHOD_CONFIG: Record<BrewMethod, MethodConfig> = {
  Brew: { baselineClick: 18.5, ratioText: "1:15" },
  Espresso: { baselineClick: 1.5, ratioText: "1:2" },
  OXO: { baselineClick: 15.0, ratioText: "1:12" },
};

export const EMPTY_INVENTORY_FORM: Omit<InventoryItem, "id" | "createdAt"> = {
  beanName: "",
  roastery: "",
  purchaseDate: new Date().toISOString().split("T")[0],
  roastDate: new Date().toISOString().split("T")[0],
  initialWeight: 200,
  remainingWeight: 200,
  status: "ACTIVE",
  memo: "",
};

export const EMPTY_BEAN_FORM: Omit<BeanInfo, "createdAt"> = {
  name: "",
  roastery: "",
  roastingDate: new Date().toISOString().split("T")[0],
  region: "",
  variety: "",
  altitude: "",
  process: "",
  roastLevel: "중배전",
  roasterNote: "",
  peakStart: 7,
  peakEnd: 21,
};

export const EMPTY_RECIPE_POURS = (): RecipePour[] => [
  { order: 1, start: "0:00", end: "0:45", waterMl: 40, switchState: "닫힘" },
  { order: 2, start: "0:45", end: "1:30", waterMl: 60, switchState: "닫힘" },
  { order: 3, start: "1:30", end: "2:00", waterMl: 60, switchState: "닫힘" },
  { order: 4, start: "2:00", end: "2:30", waterMl: 60, switchState: "닫힘" },
  { order: 5, start: "2:30", end: "3:00", waterMl: 80, switchState: "닫힘" },
];

export const EMPTY_RECIPE_FORM: Omit<RecipeInfo, "id" | "createdAt"> = {
  name: "",
  method: "Brew",
  drinkType: "hot",
  dose: 20,
  useSwitch: false,
  pours: EMPTY_RECIPE_POURS(),
  dilutionGuide: "",
  memo: "",
  oxoUpperFilter: "종이",
  oxoLowerFilter: "종이",
};

export const STORAGE_KEY = "notion-grind-engine-v3";
export const CLOUD_DOC_KEY = "diary";
export const MAX_CUP_SCORE = 10;
export const CUP_SCORE_STEP = 0.5;

export const GRINDER_RANGE: Record<string, { min: number; max: number; step: number }> = {
  "Millab M01": { min: 0.1, max: 10.0, step: 0.1 },
  HammerHead: { min: 1, max: 50, step: 1 },
  "K-Ultra": { min: 0.1, max: 15.0, step: 0.1 },
  "EK-43": { min: 0.1, max: 16.0, step: 0.1 },
};

export const DEFAULT_SETTINGS: AppSettings = {
  grinders: { ...GRINDER_RANGE },
  drippers: ["V60", "V60 세라믹", "알파", "노암니", "B75", "벡터"],
  waters: ["평창수", "백산수", "아이시스", "평딥수", "백딥수", "아딥수"],
  filters: ["하리오 기본", "하리오 메테오", "시바리스트", "th-3"],
  units: { temp: "C", weight: "g" },
  roastLabels: {
    약약배전: "약약배전",
    약배전: "약배전",
    중약배전: "중약배전",
    중배전: "중배전",
    중강배전: "중강배전",
    강배전: "강배전",
  },
  theme: { isDarkMode: true, pointColor: "#fbbf24", uiScale: 1.0, textScale: 1.0, pageTransition: "scan" },
};

export const INITIAL_BREW_FORM: BrewFormState = {
  bean: "",
  method: "Brew",
  grinder: "Millab M01",
  brewWater: "평창수",
  brewWaterTemp: 92,
  immersionWaterTemp: 90,
  filterPaper: "하리오 기본",
  dripper: "V60",
  switchApplied: false,
  roastLevel: "중배전",
  cupScores: { ...DEFAULT_CUP_SCORES },
  restDays: 0,
  brewSec: 31,
  recipe: "",
  dose: 20,
  baseClick: 18.5,
  baseClickInput: "18.5",
  memo: "",
  selectedInventoryId: "",
  selectedRecipeId: "",
  selectedBeanName: "",
  oxoUpperFilter: "종이",
  oxoLowerFilter: "종이",
};

export const METHODS: BrewMethod[] = ["Brew", "Espresso", "OXO"];
export const ROAST_LEVELS: (keyof AppSettings["roastLabels"])[] = ["약약배전", "약배전", "중약배전", "중배전", "중강배전", "강배전"];

export const SCORE_FIELDS: Array<{ key: keyof CupScores; label: string }> = [
  { key: "acidity", label: "산미" },
  { key: "sweetness", label: "단맛" },
  { key: "body", label: "바디" },
  { key: "cleanCup", label: "클린컵" },
  { key: "balance", label: "밸런스" },
  { key: "flavorIntensity", label: "향미강도" },
  { key: "aftertaste", label: "후미" },
  { key: "texture", label: "질감" },
];
