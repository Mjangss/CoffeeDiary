import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, googleProvider, isFirebaseConfigured } from "./lib/firebase";

type BrewMethod = "Brew" | "Espresso";
type Grinder = "Millab M01" | "HammerHead" | "K-Ultra" | "EK-43";
type RoastLevel = "약약배전" | "약배전" | "중약배전" | "중배전" | "중강배전" | "강배전";
type Dripper = "V60" | "V60 세라믹" | "알파" | "노암니" | "B75" | "벡터";
type BrewWater = "평창수" | "백산수" | "아이시스" | "평딥수" | "백딥수" | "아딥수";
type RecipeDrinkType = "hot" | "ice";
type PourSwitchState = "닫힘" | "열림";

type MethodConfig = {
  baselineClick: number;
  ratioText: string;
};

type CupScores = {
  acidity: number;
  sweetness: number;
  body: number;
  cleanCup: number;
  balance: number;
  flavorIntensity: number;
  aftertaste: number;
};

type BeanInfo = {
  name: string;
  roastery: string;
  roastingDate: string;
  region: string;
  variety: string;
  altitude: string;
  process: string;
  roastLevel: RoastLevel;
  roasterNote: string;
  createdAt: string;
};

type GrinderProfile = {
  bean: string;
  method: BrewMethod;
  grinder: Grinder;
  dripper: Dripper;
  switchApplied: boolean;
  baseClick: number;
  sampleCount: number;
  updatedAt: string;
};

type BrewRecord = {
  id: string;
  createdAt: string;
  bean: string;
  method: BrewMethod;
  grinder: Grinder;
  brewWater: BrewWater;
  brewWaterTemp: number;
  immersionWaterTemp: number | null;
  dripper: Dripper;
  switchApplied: boolean;
  roastLevel: RoastLevel;
  scoreAverage: number;
  cupScores: CupScores;
  restDays: number;
  brewSec: number;
  recipe: string;
  baseClick: number;
  memo: string;
};

type RecipePour = {
  order: number;
  start: string;
  end: string;
  waterMl: number;
  switchState: PourSwitchState;
};

type RecipeInfo = {
  id: string;
  createdAt: string;
  name: string;
  drinkType: RecipeDrinkType;
  dose: number;
  useSwitch: boolean;
  pours: RecipePour[];
  dilutionGuide: string;
};

type PersistedPayload = {
  profiles: Record<string, GrinderProfile>;
  records: BrewRecord[];
  beans: BeanInfo[];
  recipes: RecipeInfo[];
};

const METHODS: BrewMethod[] = ["Brew", "Espresso"];
const GRINDERS: Grinder[] = ["Millab M01", "HammerHead", "K-Ultra", "EK-43"];
const ROAST_LEVELS: RoastLevel[] = ["약약배전", "약배전", "중약배전", "중배전", "중강배전", "강배전"];
const DRIPPERS: Dripper[] = ["V60", "V60 세라믹", "알파", "노암니", "B75", "벡터"];
const BREW_WATERS: BrewWater[] = ["평창수", "백산수", "아이시스", "평딥수", "백딥수", "아딥수"];
const SCORE_FIELDS: Array<{ key: keyof CupScores; label: string }> = [
  { key: "acidity", label: "산미" },
  { key: "sweetness", label: "단맛" },
  { key: "body", label: "바디" },
  { key: "cleanCup", label: "클린컵" },
  { key: "balance", label: "밸런스" },
  { key: "flavorIntensity", label: "향미강도" },
  { key: "aftertaste", label: "후미" },
];

const METHOD_CONFIG: Record<BrewMethod, MethodConfig> = {
  Espresso: { baselineClick: 2.4, ratioText: "1:2.0" },
  Brew: { baselineClick: 18.5, ratioText: "1:15" },
};

const STORAGE_KEY = "notion-grind-engine-v3";
const CLOUD_DOC_KEY = "diary";

const DEFAULT_CUP_SCORES: CupScores = {
  acidity: 86,
  sweetness: 86,
  body: 86,
  cleanCup: 86,
  balance: 86,
  flavorIntensity: 86,
  aftertaste: 86,
};

const EMPTY_BEAN_FORM: Omit<BeanInfo, "createdAt"> = {
  name: "",
  roastery: "",
  roastingDate: "",
  region: "",
  variety: "",
  altitude: "",
  process: "",
  roastLevel: "중배전",
  roasterNote: "",
};

const EMPTY_RECIPE_POURS = (): RecipePour[] =>
  Array.from({ length: 6 }, (_, idx) => ({
    order: idx + 1,
    start: "00:00",
    end: "00:00",
    waterMl: 0,
    switchState: "닫힘",
  }));

const MINUTE_OPTIONS = Array.from({ length: 11 }, (_, idx) => idx);
const SECOND_OPTIONS = Array.from({ length: 60 }, (_, idx) => idx);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number, decimals = 1) => {
  const m = 10 ** decimals;
  return Math.round(value * m) / m;
};
const keyOf = (bean: string, method: BrewMethod, grinder: Grinder, dripper: Dripper, switchApplied: boolean) => {
  const brewContext = method === "Brew" ? `${dripper}::${switchApplied ? "switch" : "plain"}` : "espresso";
  return `${bean.trim().toLowerCase()}::${method}::${grinder}::${brewContext}`;
};
const safeNum = (value: unknown, fallback: number) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);
const normalizeClock = (value: string) => {
  const cleaned = value.replace(/[^0-9]/g, "").slice(0, 4);
  const mm = cleaned.slice(0, 2).padEnd(2, "0");
  const ss = cleaned.slice(2, 4).padEnd(2, "0");
  return `${mm}:${clamp(Number(ss), 0, 59).toString().padStart(2, "0")}`;
};
const parseClockParts = (clock: string) => {
  const [mmRaw = "00", ssRaw = "00"] = normalizeClock(clock).split(":");
  return {
    mm: clamp(Number(mmRaw) || 0, 0, 10),
    ss: clamp(Number(ssRaw) || 0, 0, 59),
  };
};
const toClock = (mm: number, ss: number) => `${clamp(mm, 0, 10).toString().padStart(2, "0")}:${clamp(ss, 0, 59).toString().padStart(2, "0")}`;
const isPourFilled = (pour: RecipePour) => pour.waterMl > 0 || pour.start !== "00:00" || pour.end !== "00:00";
const enforceLinkedPourStarts = (pours: RecipePour[]) => {
  let previousEnd = "00:00";
  return pours.map((pour, idx) => {
    const normalizedStart = normalizeClock(pour.start);
    const normalizedEnd = normalizeClock(pour.end);
    if (idx === 0) {
      previousEnd = normalizedEnd;
      return { ...pour, start: normalizedStart, end: normalizedEnd };
    }
    const linked = { ...pour, start: previousEnd, end: normalizedEnd };
    previousEnd = normalizedEnd;
    return linked;
  });
};
const formatClockToKorean = (clock: string) => {
  const [mmRaw = "00", ssRaw = "00"] = clock.split(":");
  const mm = mmRaw.padStart(2, "0");
  const ss = ssRaw.padStart(2, "0");
  return `${mm}분${ss}초`;
};
const buildRecipeSummary = (recipeInfo: RecipeInfo) => {
  const totalPourWater = recipeInfo.pours.reduce((sum, pour) => sum + pour.waterMl, 0);
  const ratioText = recipeInfo.dose > 0 ? `1:${round(totalPourWater / recipeInfo.dose, 1).toFixed(1)}` : "-";
  const activePours = recipeInfo.pours.filter((_, idx) => idx === 0 || isPourFilled(recipeInfo.pours[idx - 1]));
  const timeline = activePours
    .map((pour) => {
      const range = `${formatClockToKorean(pour.start)}~${formatClockToKorean(pour.end)}`;
      const switchLabel = recipeInfo.useSwitch ? ` (${pour.switchState})` : "";
      return `${pour.order}차 ${range} ${pour.waterMl}ml${switchLabel}`;
    })
    .join(", ");
  const dilutionLabel = recipeInfo.dilutionGuide ? ` / 가수 ${recipeInfo.dilutionGuide}` : "";
  return `${recipeInfo.name} / ${recipeInfo.drinkType.toUpperCase()} / ${recipeInfo.dose}g / 총투입 ${round(totalPourWater, 1)}ml / 비율 ${ratioText}${dilutionLabel} / ${timeline}`;
};

const calcRestDays = (dateText: string) => {
  const parsed = new Date(dateText);
  if (Number.isNaN(parsed.getTime())) return 0;
  const diff = Date.now() - parsed.getTime();
  return clamp(Math.floor(diff / (1000 * 60 * 60 * 24)), 0, 365);
};

function App() {
  const [profiles, setProfiles] = useState<Record<string, GrinderProfile>>({});
  const [records, setRecords] = useState<BrewRecord[]>([]);
  const [beans, setBeans] = useState<BeanInfo[]>([]);
  const [recipes, setRecipes] = useState<RecipeInfo[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudStatus, setCloudStatus] = useState("로컬 모드");

  const [selectedBeanName, setSelectedBeanName] = useState("");
  const [beanForm, setBeanForm] = useState<Omit<BeanInfo, "createdAt">>(EMPTY_BEAN_FORM);
  const [recipeName, setRecipeName] = useState("");
  const [recipeDrinkType, setRecipeDrinkType] = useState<RecipeDrinkType>("hot");
  const [recipeDose, setRecipeDose] = useState(20);
  const [recipeUseSwitch, setRecipeUseSwitch] = useState(false);
  const [recipeDilutionGuide, setRecipeDilutionGuide] = useState("");
  const [recipePours, setRecipePours] = useState<RecipePour[]>(EMPTY_RECIPE_POURS);
  const [selectedRecipeId, setSelectedRecipeId] = useState("");

  const [bean, setBean] = useState("");
  const [method, setMethod] = useState<BrewMethod>("Brew");
  const [grinder, setGrinder] = useState<Grinder>("Millab M01");
  const [brewWater, setBrewWater] = useState<BrewWater>("평창수");
  const [brewWaterTemp, setBrewWaterTemp] = useState(92);
  const [immersionWaterTemp, setImmersionWaterTemp] = useState(90);
  const [dripper, setDripper] = useState<Dripper>("V60");
  const [switchApplied, setSwitchApplied] = useState(false);
  const [roastLevel, setRoastLevel] = useState<RoastLevel>("중배전");
  const [cupScores, setCupScores] = useState<CupScores>(DEFAULT_CUP_SCORES);
  const [restDays, setRestDays] = useState(0);
  const [brewSec, setBrewSec] = useState(31);
  const [recipe, setRecipe] = useState("");
  const [baseClick, setBaseClick] = useState(METHOD_CONFIG.Brew.baselineClick);
  const [memo, setMemo] = useState("");
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<"All" | BrewMethod>("All");
  const [menuOpen, setMenuOpen] = useState(false);

  const hydratePersistedData = (source: Record<string, unknown>) => {
    const loadedProfiles = (source.profiles as Record<string, GrinderProfile>) ?? {};
    const loadedBeans = Array.isArray(source.beans) ? (source.beans as BeanInfo[]) : [];
    const loadedRawRecords = Array.isArray(source.records) ? (source.records as Array<Record<string, unknown>>) : [];
    const loadedRawRecipes = Array.isArray(source.recipes) ? (source.recipes as Array<Record<string, unknown>>) : [];

    setProfiles(loadedProfiles);
    setBeans(loadedBeans);

    const loadedRecipes = loadedRawRecipes.map((item) => {
      const rawPours = Array.isArray(item.pours) ? (item.pours as Array<Record<string, unknown>>) : [];
      const normalizedPours: RecipePour[] = EMPTY_RECIPE_POURS().map((basePour) => {
        const fromRaw = rawPours.find((pour) => safeNum(pour.order, -1) === basePour.order);
        if (!fromRaw) return basePour;
        const switchState: PourSwitchState = fromRaw.switchState === "열림" ? "열림" : "닫힘";
        return {
          order: basePour.order,
          start: normalizeClock(String(fromRaw.start ?? basePour.start)),
          end: normalizeClock(String(fromRaw.end ?? basePour.end)),
          waterMl: clamp(safeNum(fromRaw.waterMl, basePour.waterMl), 0, 2000),
          switchState,
        };
      });
      const linkedPours = enforceLinkedPourStarts(normalizedPours);

      return {
        id: String(item.id ?? crypto.randomUUID()),
        createdAt: String(item.createdAt ?? new Date().toISOString()),
        name: String(item.name ?? "이름 없는 레시피"),
        drinkType: item.drinkType === "ice" ? "ice" : "hot",
        dose: clamp(safeNum(item.dose, 20), 1, 100),
        useSwitch: Boolean(item.useSwitch),
        pours: linkedPours,
        dilutionGuide: String(item.dilutionGuide ?? "").trim(),
      } as RecipeInfo;
    });
    setRecipes(loadedRecipes);

    const loadedRecords = loadedRawRecords.map((record) => {
      const oldScore = safeNum(record.score, 86);
      const loadedScores = (record.cupScores as Partial<CupScores>) ?? {};
      const normalizedScores: CupScores = {
        acidity: safeNum(loadedScores.acidity, oldScore),
        sweetness: safeNum(loadedScores.sweetness, oldScore),
        body: safeNum(loadedScores.body, oldScore),
        cleanCup: safeNum(loadedScores.cleanCup, oldScore),
        balance: safeNum(loadedScores.balance, oldScore),
        flavorIntensity: safeNum(loadedScores.flavorIntensity, oldScore),
        aftertaste: safeNum(loadedScores.aftertaste, oldScore),
      };
      const average =
        typeof record.scoreAverage === "number"
          ? record.scoreAverage
          : round(Object.values(normalizedScores).reduce((acc, value) => acc + value, 0) / 7, 1);

      const parsedBrewWaterTemp = clamp(safeNum(record.brewWaterTemp, 92), 80, 100);
      const parsedImmersion = record.immersionWaterTemp;
      const normalizedImmersion = typeof parsedImmersion === "number" ? clamp(parsedImmersion, 80, 100) : null;

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
        switchApplied: Boolean(record.switchApplied),
        roastLevel: (record.roastLevel as RoastLevel) ?? "중배전",
        scoreAverage: average,
        cupScores: normalizedScores,
        restDays: safeNum(record.restDays, 0),
        brewSec: safeNum(record.brewSec, 0),
        recipe: String(record.recipe ?? ""),
        baseClick: safeNum(record.baseClick, METHOD_CONFIG.Espresso.baselineClick),
        memo: String(record.memo ?? ""),
      } as BrewRecord;
    });

    setRecords(loadedRecords);
  };

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      hydratePersistedData(JSON.parse(raw) as Record<string, unknown>);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setAuthReady(true);
      return;
    }
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ profiles, records, beans, recipes }));
  }, [profiles, records, beans, recipes]);

  const persistedPayload: PersistedPayload = useMemo(
    () => ({ profiles, records, beans, recipes }),
    [profiles, records, beans, recipes],
  );

  const loadFromCloud = async () => {
    if (!user || !db) return;
    setCloudStatus("클라우드 불러오는 중...");
    try {
      const ref = doc(db, "users", user.uid, "coffeeDiary", CLOUD_DOC_KEY);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        setCloudStatus("클라우드 데이터 없음");
        return;
      }
      hydratePersistedData(snap.data() as Record<string, unknown>);
      setCloudStatus("클라우드 불러오기 완료");
    } catch {
      setCloudStatus("클라우드 불러오기 실패");
    }
  };

  const saveToCloud = async (payload: PersistedPayload) => {
    if (!user || !db) return;
    try {
      const ref = doc(db, "users", user.uid, "coffeeDiary", CLOUD_DOC_KEY);
      await setDoc(ref, { ...payload, updatedAt: serverTimestamp() }, { merge: true });
      setCloudStatus("클라우드 저장 완료");
    } catch {
      setCloudStatus("클라우드 저장 실패");
    }
  };

  useEffect(() => {
    if (!user || !db) {
      setCloudReady(false);
      return;
    }

    const firestore = db;
    let alive = true;
    const bootstrap = async () => {
      setCloudStatus("클라우드 동기화 준비 중...");
      try {
        const ref = doc(firestore, "users", user.uid, "coffeeDiary", CLOUD_DOC_KEY);
        const snap = await getDoc(ref);
        if (!alive) return;
        if (snap.exists()) {
          hydratePersistedData(snap.data() as Record<string, unknown>);
          setCloudStatus("클라우드 데이터 로드됨");
        } else {
          await setDoc(ref, { ...persistedPayload, updatedAt: serverTimestamp() }, { merge: true });
          if (!alive) return;
          setCloudStatus("클라우드 초기 저장 완료");
        }
      } catch {
        if (!alive) return;
        setCloudStatus("클라우드 연결 실패");
      } finally {
        if (alive) setCloudReady(true);
      }
    };

    void bootstrap();
    return () => {
      alive = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user || !cloudReady || !db) return;
    const timer = setTimeout(() => {
      void saveToCloud(persistedPayload);
    }, 800);
    return () => clearTimeout(timer);
  }, [persistedPayload, user, cloudReady]);

  useEffect(() => {
    const config = METHOD_CONFIG[method];
    const profile = profiles[keyOf(bean, method, grinder, dripper, switchApplied)];
    setBaseClick(profile?.baseClick ?? config.baselineClick);
  }, [bean, method, grinder, dripper, switchApplied, profiles]);

  useEffect(() => {
    if (method === "Espresso") {
      setSwitchApplied(false);
    }
  }, [method]);

  const averageCupScore = useMemo(
    () => round(Object.values(cupScores).reduce((acc, value) => acc + value, 0) / Object.keys(cupScores).length, 1),
    [cupScores],
  );

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((record) => {
      const byMethod = methodFilter === "All" || record.method === methodFilter;
      const bySearch = q.length === 0 || record.bean.toLowerCase().includes(q) || record.memo.toLowerCase().includes(q);
      return byMethod && bySearch;
    });
  }, [records, search, methodFilter]);

  const sortedBeans = useMemo(() => [...beans].sort((a, b) => a.name.localeCompare(b.name)), [beans]);
  const sortedRecipes = useMemo(() => [...recipes].sort((a, b) => a.name.localeCompare(b.name)), [recipes]);
  const totalRecipePourWater = useMemo(() => round(recipePours.reduce((sum, pour) => sum + pour.waterMl, 0), 1), [recipePours]);
  const recipeRatioText = useMemo(() => (recipeDose > 0 ? `1:${round(totalRecipePourWater / recipeDose, 1).toFixed(1)}` : "-"), [recipeDose, totalRecipePourWater]);
  const selectedBeanInfo = useMemo(() => beans.find((item) => item.name === selectedBeanName) ?? null, [beans, selectedBeanName]);
  const canSaveRecord = selectedBeanName.trim().length > 0 && bean.trim().length > 0;

  useEffect(() => {
    if (!selectedRecipeId) return;
    if (recipes.some((item) => item.id === selectedRecipeId)) return;
    setSelectedRecipeId("");
    setRecipe("");
  }, [recipes, selectedRecipeId]);

  const updateBeanForm = <K extends keyof Omit<BeanInfo, "createdAt">>(key: K, value: Omit<BeanInfo, "createdAt">[K]) => {
    setBeanForm((prev) => ({ ...prev, [key]: value }));
  };

  const saveBeanInfo = () => {
    const trimmedName = beanForm.name.trim();
    if (!trimmedName) return;

    const nextBean: BeanInfo = {
      ...beanForm,
      name: trimmedName,
      roastery: beanForm.roastery.trim(),
      region: beanForm.region.trim(),
      variety: beanForm.variety.trim(),
      altitude: beanForm.altitude.trim(),
      process: beanForm.process.trim(),
      roasterNote: beanForm.roasterNote.trim(),
      createdAt: new Date().toISOString(),
    };

    setBeans((prev) => {
      const idx = prev.findIndex((item) => item.name.toLowerCase() === trimmedName.toLowerCase());
      if (idx === -1) return [nextBean, ...prev];
      const clone = [...prev];
      clone[idx] = { ...clone[idx], ...nextBean, createdAt: clone[idx].createdAt };
      return clone;
    });

    setSelectedBeanName(nextBean.name);
    setBean(nextBean.name);
    setRoastLevel(nextBean.roastLevel);
    if (nextBean.roastingDate) setRestDays(calcRestDays(nextBean.roastingDate));
    setBeanForm(EMPTY_BEAN_FORM);
  };

  const loadBeanToParams = (beanName: string) => {
    setSelectedBeanName(beanName);
    if (!beanName) {
      setMethod("Brew");
      setBean("");
      setRoastLevel("중배전");
      setRestDays(0);
      return;
    }
    const found = beans.find((item) => item.name === beanName);
    if (!found) return;
    setBean(found.name);
    setRoastLevel(found.roastLevel);
    if (found.roastingDate) setRestDays(calcRestDays(found.roastingDate));
  };

  const removeBeanInfo = (beanName: string) => {
    setBeans((prev) => prev.filter((item) => item.name !== beanName));
    if (selectedBeanName === beanName) {
      setSelectedBeanName("");
      setMethod("Brew");
      setBean("");
      setRoastLevel("중배전");
      setRestDays(0);
    }
  };

  const updateCupScore = (key: keyof CupScores, value: number) => {
    setCupScores((prev) => ({
      ...prev,
      [key]: clamp(Number.isFinite(value) ? value : 0, 0, 100),
    }));
  };

  const updateRecipePour = (index: number, key: "start" | "end" | "waterMl" | "switchState", value: string | number) => {
    setRecipePours((prev) => {
      const updated: RecipePour[] = prev.map((pour, pourIdx) => {
        if (pourIdx !== index) return pour;
        if (key === "start" && index > 0) {
          return pour;
        }
        if (key === "switchState") {
          return { ...pour, switchState: value === "열림" ? "열림" : "닫힘" };
        }
        if (key === "waterMl") {
          const nextValue = typeof value === "number" ? value : Number(value);
          return { ...pour, waterMl: clamp(Number.isFinite(nextValue) ? nextValue : 0, 0, 2000) };
        }
        if (key === "start") {
          return { ...pour, start: normalizeClock(String(value)) };
        }
        return { ...pour, end: normalizeClock(String(value)) };
      });
      return enforceLinkedPourStarts(updated);
    });
  };

  const updateRecipeClockPart = (index: number, key: "start" | "end", part: "mm" | "ss", nextValue: number) => {
    if (key === "start" && index > 0) return;
    const current = recipePours[index];
    if (!current) return;
    const { mm, ss } = parseClockParts(current[key]);
    const nextClock = part === "mm" ? toClock(nextValue, ss) : toClock(mm, nextValue);
    updateRecipePour(index, key, nextClock);
  };

  const selectRecipeForInput = (recipeId: string) => {
    setSelectedRecipeId(recipeId);
    if (!recipeId) {
      setRecipe("");
      return;
    }
    const found = recipes.find((item) => item.id === recipeId);
    if (!found) return;
    setRecipe(buildRecipeSummary(found));
  };

  const saveRecipeInfo = () => {
    const trimmedName = recipeName.trim();
    if (!trimmedName) return;

    const existing = recipes.find((item) => item.name.toLowerCase() === trimmedName.toLowerCase());

    const nextRecipe: RecipeInfo = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      name: trimmedName,
      drinkType: recipeDrinkType,
      dose: clamp(recipeDose, 1, 100),
      useSwitch: recipeUseSwitch,
      pours: enforceLinkedPourStarts(recipePours).map((pour) => ({
        ...pour,
        start: normalizeClock(pour.start),
        end: normalizeClock(pour.end),
        waterMl: clamp(pour.waterMl, 0, 2000),
        switchState: recipeUseSwitch ? pour.switchState : "닫힘",
      })),
      dilutionGuide: recipeDilutionGuide.trim(),
    };

    const persistedRecipe: RecipeInfo = {
      ...nextRecipe,
      id: existing?.id ?? nextRecipe.id,
      createdAt: existing?.createdAt ?? nextRecipe.createdAt,
    };

    setRecipes((prev) => {
      const idx = prev.findIndex((item) => item.name.toLowerCase() === trimmedName.toLowerCase());
      if (idx === -1) return [nextRecipe, ...prev];
      const clone = [...prev];
      clone[idx] = { ...nextRecipe, id: clone[idx].id, createdAt: clone[idx].createdAt };
      return clone;
    });

    setSelectedRecipeId(persistedRecipe.id);
    setRecipe(buildRecipeSummary(persistedRecipe));

    setRecipeName("");
    setRecipeDrinkType("hot");
    setRecipeDose(20);
    setRecipeUseSwitch(false);
    setRecipeDilutionGuide("");
    setRecipePours(EMPTY_RECIPE_POURS());
  };

  const loadSavedRecipe = (target: RecipeInfo) => {
    setRecipeName(target.name);
    setRecipeDrinkType(target.drinkType);
    setRecipeDose(target.dose);
    setRecipeUseSwitch(target.useSwitch);
    setRecipePours(enforceLinkedPourStarts(target.pours.map((pour) => ({ ...pour }))));
    setRecipeDilutionGuide(target.dilutionGuide ?? "");
    setSelectedRecipeId(target.id);
    setRecipe(buildRecipeSummary(target));
  };

  const removeRecipeInfo = (recipeId: string) => {
    setRecipes((prev) => prev.filter((item) => item.id !== recipeId));
    if (selectedRecipeId === recipeId) {
      setSelectedRecipeId("");
      setRecipe("");
    }
  };

  const saveRecord = () => {
    if (!canSaveRecord) return;
    const next: BrewRecord = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      bean: bean.trim(),
      method,
      grinder,
      brewWater,
      brewWaterTemp,
      immersionWaterTemp: method === "Brew" && switchApplied ? immersionWaterTemp : null,
      dripper,
      switchApplied,
      roastLevel,
      scoreAverage: averageCupScore,
      cupScores,
      restDays,
      brewSec,
      recipe: recipe.trim(),
      baseClick,
      memo: memo.trim(),
    };

    setRecords((prev) => [next, ...prev]);
    setMemo("");

    const k = keyOf(next.bean, next.method, next.grinder, next.dripper, next.switchApplied);
    setProfiles((prev) => {
      const old = prev[k];
      const origin = old?.baseClick ?? METHOD_CONFIG[next.method].baselineClick;
      const sampleCount = old?.sampleCount ?? 0;
      const updatedBase = round((origin * sampleCount + next.baseClick) / (sampleCount + 1));
      return {
        ...prev,
        [k]: {
          bean: next.bean,
          method: next.method,
          grinder: next.grinder,
          dripper: next.dripper,
          switchApplied: next.switchApplied,
          baseClick: updatedBase,
          sampleCount: sampleCount + 1,
          updatedAt: next.createdAt,
        },
      };
    });
  };

  const resetAll = () => {
    setProfiles({});
    setRecords([]);
    setBeans([]);
    setRecipes([]);
    setSelectedRecipeId("");
    setRecipe("");
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleGoogleLogin = async () => {
    if (!isFirebaseConfigured || !auth) {
      setCloudStatus("Firebase 설정이 필요합니다");
      return;
    }
    try {
      setCloudStatus("Google 로그인 진행 중...");
      await signInWithPopup(auth, googleProvider);
    } catch {
      setCloudStatus("Google 로그인 실패");
    }
  };

  const handleGoogleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      setCloudStatus("로그아웃됨");
    } catch {
      setCloudStatus("로그아웃 실패");
    }
  };

  const scrollToSection = (sectionId: string) => {
    const target = document.getElementById(sectionId);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    setMenuOpen(false);
  };

  return (
    <main className="relative flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <section className="relative overflow-hidden border-b border-zinc-800 px-6 py-16 md:px-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(245,158,11,0.2),transparent_46%),radial-gradient(circle_at_85%_20%,rgba(59,130,246,0.14),transparent_48%),radial-gradient(circle_at_50%_90%,rgba(234,88,12,0.15),transparent_45%)]" />
        <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }} className="relative mx-auto max-w-6xl">
          <p className="text-sm tracking-[0.22em] text-amber-300">Coffee Diary</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-6xl">커피 일기</h1>
          <p className="mt-4 max-w-3xl text-zinc-300">by 므장</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {!isFirebaseConfigured && <p className="text-xs text-amber-300">Firebase 환경변수를 설정하면 Google 로그인을 사용할 수 있습니다.</p>}
            {isFirebaseConfigured && !authReady && <p className="text-xs text-zinc-400">로그인 상태 확인 중...</p>}
            {isFirebaseConfigured && authReady && user && (
              <>
                <p className="text-sm text-zinc-300">{user.displayName || user.email || "Google 사용자"}</p>
                <button
                  onClick={() => {
                    void loadFromCloud();
                  }}
                  className="cursor-pointer border border-zinc-700 px-3 py-2 text-sm text-zinc-200 transition hover:border-amber-400"
                >
                  클라우드 불러오기
                </button>
                <button
                  onClick={() => {
                    void saveToCloud(persistedPayload);
                  }}
                  className="cursor-pointer border border-zinc-700 px-3 py-2 text-sm text-zinc-200 transition hover:border-amber-400"
                >
                  클라우드 저장
                </button>
              </>
            )}
            <p className="text-xs text-zinc-500">상태: {cloudStatus}</p>
          </div>
        </motion.div>

        <div className="fixed right-4 top-4 z-30 md:right-6 md:top-6">
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="cursor-pointer border border-zinc-700 bg-zinc-900/95 px-3 py-2 text-sm text-zinc-200 backdrop-blur transition hover:border-amber-400"
          >
            메뉴
          </button>
          {menuOpen && (
            <div className="mt-2 w-48 border border-zinc-700 bg-zinc-900/95 p-2 backdrop-blur">
              <button onClick={() => scrollToSection("coffee-diary")} className="block w-full cursor-pointer px-2 py-1.5 text-left text-sm text-zinc-200 hover:bg-zinc-800">
                커피 일기
              </button>
              <button onClick={() => scrollToSection("coffee-diary-records")} className="block w-full cursor-pointer px-2 py-1.5 text-left text-sm text-zinc-200 hover:bg-zinc-800">
                커피 일기 기록
              </button>
              <button onClick={() => scrollToSection("bean-storage")} className="block w-full cursor-pointer px-2 py-1.5 text-left text-sm text-zinc-200 hover:bg-zinc-800">
                원두 정보 저장
              </button>
              <button onClick={() => scrollToSection("recipe-storage")} className="block w-full cursor-pointer px-2 py-1.5 text-left text-sm text-zinc-200 hover:bg-zinc-800">
                레시피 정보 저장
              </button>
              <div className="mt-2 border-t border-zinc-700 pt-2">
                {!isFirebaseConfigured && <p className="px-2 py-1 text-xs text-amber-300">Firebase 설정 필요</p>}
                {isFirebaseConfigured && authReady && !user && (
                  <button
                    onClick={() => {
                      void handleGoogleLogin();
                    }}
                    className="block w-full cursor-pointer px-2 py-1.5 text-left text-sm text-amber-300 hover:bg-zinc-800"
                  >
                    Google 로그인
                  </button>
                )}
                {isFirebaseConfigured && authReady && user && (
                  <button
                    onClick={() => {
                      void handleGoogleLogout();
                    }}
                    className="block w-full cursor-pointer px-2 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-800"
                  >
                    로그아웃
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <section id="bean-storage" className="order-3 mx-auto w-full max-w-6xl px-6 py-10 md:px-10">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="space-y-5 border border-zinc-800 p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-xl font-medium">원두 정보 저장</h2>
            <p className="text-xs text-zinc-500">동일한 원두명으로 저장하면 기존 데이터를 업데이트합니다.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="text-zinc-400">원두명</span>
              <input value={beanForm.name} onChange={(e) => updateBeanForm("name", e.target.value)} className="w-full border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-amber-400" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-zinc-400">로스터리</span>
              <input value={beanForm.roastery} onChange={(e) => updateBeanForm("roastery", e.target.value)} className="w-full border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-amber-400" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-zinc-400">로스팅일</span>
              <input type="date" value={beanForm.roastingDate} onChange={(e) => updateBeanForm("roastingDate", e.target.value)} className="w-full border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-amber-400" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-zinc-400">지역</span>
              <input value={beanForm.region} onChange={(e) => updateBeanForm("region", e.target.value)} className="w-full border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-amber-400" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-zinc-400">품종</span>
              <input value={beanForm.variety} onChange={(e) => updateBeanForm("variety", e.target.value)} className="w-full border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-amber-400" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-zinc-400">고도</span>
              <input value={beanForm.altitude} onChange={(e) => updateBeanForm("altitude", e.target.value)} placeholder="예: 1800m" className="w-full border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-amber-400" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-zinc-400">가공법</span>
              <input value={beanForm.process} onChange={(e) => updateBeanForm("process", e.target.value)} className="w-full border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-amber-400" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-zinc-400">배전도</span>
              <select value={beanForm.roastLevel} onChange={(e) => updateBeanForm("roastLevel", e.target.value as RoastLevel)} className="w-full border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-amber-400">
                {ROAST_LEVELS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block space-y-1 text-sm">
            <span className="text-zinc-400">로스터 노트</span>
            <textarea rows={2} value={beanForm.roasterNote} onChange={(e) => updateBeanForm("roasterNote", e.target.value)} className="w-full resize-none border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-amber-400" />
          </label>
          <div className="flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-4">
            <button onClick={saveBeanInfo} className="cursor-pointer border border-amber-400 bg-amber-400 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-transparent hover:text-amber-300">
              원두 정보 저장
            </button>
            <p className="text-xs text-zinc-500">저장된 원두: {beans.length}개</p>
          </div>

          <div className="overflow-x-auto border border-zinc-800">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-zinc-900 text-zinc-300">
                <tr>
                  <th className="px-3 py-2 font-medium">원두명</th>
                  <th className="px-3 py-2 font-medium">로스터리</th>
                  <th className="px-3 py-2 font-medium">로스팅일/숙성</th>
                  <th className="px-3 py-2 font-medium">배전/가공</th>
                  <th className="px-3 py-2 font-medium">동작</th>
                </tr>
              </thead>
              <tbody>
                {sortedBeans.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-zinc-500">
                      저장된 원두 정보가 없습니다.
                    </td>
                  </tr>
                )}
                {sortedBeans.map((item) => (
                  <tr key={item.name} className="border-t border-zinc-800 odd:bg-zinc-900/30">
                    <td className="px-3 py-2">{item.name}</td>
                    <td className="px-3 py-2 text-zinc-400">{item.roastery || "-"}</td>
                    <td className="px-3 py-2 text-zinc-400">{item.roastingDate ? `${item.roastingDate} / ${calcRestDays(item.roastingDate)}d` : "-"}</td>
                    <td className="px-3 py-2 text-zinc-400">{item.roastLevel} / {item.process || "-"}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button onClick={() => loadBeanToParams(item.name)} className="cursor-pointer border border-zinc-600 px-2 py-1 text-xs text-zinc-200 hover:border-amber-400">
                          불러오기
                        </button>
                        <button onClick={() => removeBeanInfo(item.name)} className="cursor-pointer border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:border-zinc-500">
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </section>

      <section id="coffee-diary" className="order-1 mx-auto w-full max-w-6xl px-6 pb-10 md:px-10">
        <motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="space-y-5">
          <h2 className="text-xl font-medium">커피 일기</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="text-zinc-400">저장 원두 불러오기(이름 선택)</span>
              <select value={selectedBeanName} onChange={(e) => loadBeanToParams(e.target.value)} className="w-full border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-amber-400">
                <option value="">원두를 선택하세요</option>
                {sortedBeans.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-zinc-400">원두명</span>
              <input
                value={bean}
                readOnly
                disabled
                className="w-full border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-400 outline-none"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-zinc-400">추출 방식</span>
              <select value={method} onChange={(e) => setMethod(e.target.value as BrewMethod)} className="w-full border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-amber-400">
                {METHODS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-zinc-400">그라인더</span>
              <select value={grinder} onChange={(e) => setGrinder(e.target.value as Grinder)} className="w-full border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-amber-400">
                {GRINDERS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-zinc-400">추출수</span>
              <select value={brewWater} onChange={(e) => setBrewWater(e.target.value as BrewWater)} className="w-full border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-amber-400">
                {BREW_WATERS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm sm:col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">추출수 온도</span>
                <span className="text-amber-300">{brewWaterTemp.toFixed(1)}도</span>
              </div>
              <input
                type="range"
                min={80}
                max={100}
                step={0.5}
                value={brewWaterTemp}
                onChange={(e) => setBrewWaterTemp(clamp(Number(e.target.value) || 80, 80, 100))}
                className="w-full accent-amber-400"
              />
            </label>
            {method === "Brew" && (
              <>
                <label className="space-y-1 text-sm">
                  <span className="text-zinc-400">드리퍼</span>
                  <select
                    value={dripper}
                    onChange={(e) => setDripper(e.target.value as Dripper)}
                    className="w-full border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-amber-400"
                  >
                    {DRIPPERS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 border border-zinc-800 px-3 py-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={switchApplied}
                    onChange={(e) => setSwitchApplied(e.target.checked)}
                    className="size-4 accent-amber-400"
                  />
                  <span className="text-zinc-300">스위치 적용</span>
                  <span className="ml-auto text-xs text-zinc-500">드리퍼 옵션</span>
                </label>
                <label className="space-y-2 text-sm sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">침출수 온도</span>
                    <span className={switchApplied ? "text-amber-300" : "text-zinc-500"}>{immersionWaterTemp.toFixed(1)}도</span>
                  </div>
                  <input
                    type="range"
                    min={80}
                    max={100}
                    step={0.5}
                    value={immersionWaterTemp}
                    disabled={!switchApplied}
                    onChange={(e) => setImmersionWaterTemp(clamp(Number(e.target.value) || 80, 80, 100))}
                    className="w-full accent-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
                  />
                  <p className="text-xs text-zinc-500">스위치를 체크하면 침출수 온도를 별도로 설정할 수 있습니다.</p>
                </label>
              </>
            )}
            <label className="space-y-1 text-sm">
              <span className="text-zinc-400">배전도</span>
              <input value={roastLevel} readOnly disabled className="w-full border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-400 outline-none" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-zinc-400">숙성일</span>
              <input type="number" min={0} max={365} value={restDays} readOnly disabled className="w-full border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-400 outline-none" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-zinc-400">현재 기준 클릭값</span>
              <input type="number" step={0.1} min={0} max={40} value={baseClick} onChange={(e) => setBaseClick(clamp(Number(e.target.value) || 0, 0, 40))} className="w-full border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-amber-400" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-zinc-400">실측 추출시간(초)</span>
              <input type="number" min={20} max={900} value={brewSec} onChange={(e) => setBrewSec(clamp(Number(e.target.value) || 20, 20, 900))} className="w-full border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-amber-400" />
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="text-zinc-400">레시피</span>
              <select
                value={selectedRecipeId}
                onChange={(e) => selectRecipeForInput(e.target.value)}
                className="w-full border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-amber-400"
              >
                <option value="">저장된 레시피를 선택하세요</option>
                {sortedRecipes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.drinkType} / {item.dose}g)
                  </option>
                ))}
              </select>
              {recipe && <p className="text-xs text-zinc-500">선택 요약: {recipe}</p>}
            </label>
          </div>

          {selectedBeanInfo && (
            <p className="text-xs text-zinc-400">
              선택된 원두: {selectedBeanInfo.name} | {selectedBeanInfo.roastery || "로스터리 미입력"} | {selectedBeanInfo.region || "지역 미입력"} | {selectedBeanInfo.variety || "품종 미입력"}
            </p>
          )}

          <div className="space-y-3 border-t border-zinc-800 pt-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h3 className="text-base font-medium">컵 점수 세분화(100점 만점)</h3>
              <p className="text-sm text-amber-300">평균 점수: {averageCupScore.toFixed(1)}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {SCORE_FIELDS.map((field) => (
                <label key={field.key} className="space-y-1 text-sm">
                  <span className="text-zinc-400">{field.label}</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={cupScores[field.key]}
                    onChange={(e) => updateCupScore(field.key, Number(e.target.value))}
                    className="w-full border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-amber-400"
                  />
                </label>
              ))}
            </div>
          </div>

          <label className="block space-y-1 text-sm">
            <span className="text-zinc-400">메모</span>
            <textarea rows={3} value={memo} onChange={(e) => setMemo(e.target.value)} className="w-full resize-none border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-amber-400" />
          </label>

          <div className="flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-4">
            <button
              onClick={saveRecord}
              disabled={!canSaveRecord}
              className="cursor-pointer border border-amber-400 bg-amber-400 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-transparent hover:text-amber-300 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:hover:bg-zinc-800 disabled:hover:text-zinc-500"
            >
              기록 저장 + 기준값 업데이트
            </button>
            <button onClick={resetAll} className="cursor-pointer border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500">
              전체 초기화
            </button>
            <p className="text-xs text-zinc-500">권장 비율: {METHOD_CONFIG[method].ratioText}</p>
            {!canSaveRecord && <p className="text-xs text-amber-300">저장된 원두를 먼저 선택해야 기록을 저장할 수 있습니다.</p>}
          </div>
        </motion.div>
      </section>

      <section id="recipe-storage" className="order-4 mx-auto w-full max-w-6xl px-6 pb-10 md:px-10">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-5 border border-zinc-800 p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-xl font-medium">레시피 정보 저장</h2>
            <p className="text-xs text-zinc-500">동일한 레시피 이름으로 저장하면 기존 레시피를 덮어씁니다.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1 text-sm lg:col-span-2">
              <span className="text-zinc-400">레시피 이름</span>
              <input
                value={recipeName}
                onChange={(e) => setRecipeName(e.target.value)}
                placeholder="예: 데일리 V60 3푸어"
                className="w-full border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-amber-400"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-zinc-400">hot/ice 선택</span>
              <select
                value={recipeDrinkType}
                onChange={(e) => setRecipeDrinkType(e.target.value as RecipeDrinkType)}
                className="w-full border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-amber-400"
              >
                <option value="hot">hot</option>
                <option value="ice">ice</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-zinc-400">원두량(g)</span>
              <input
                type="number"
                min={1}
                max={100}
                step={0.1}
                value={recipeDose}
                onChange={(e) => setRecipeDose(clamp(Number(e.target.value) || 1, 1, 100))}
                className="w-full border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-amber-400"
              />
            </label>
            <label className="flex items-center gap-2 border border-zinc-800 px-3 py-2 text-sm sm:col-span-2 lg:col-span-4">
              <input
                type="checkbox"
                checked={recipeUseSwitch}
                onChange={(e) => setRecipeUseSwitch(e.target.checked)}
                className="size-4 accent-amber-400"
              />
              <span>스위치 사용 여부</span>
            </label>
          </div>

          <div className="space-y-3 border-t border-zinc-800 pt-4">
            <h3 className="text-sm text-zinc-300">타임라인</h3>
            <div className="space-y-2">
              {recipePours.map((pour, idx) => (
                (() => {
                  const isEnabled = idx === 0 || isPourFilled(recipePours[idx - 1]);
                  const startParts = parseClockParts(pour.start);
                  const endParts = parseClockParts(pour.end);
                  return (
                    <div key={pour.order} className={`grid gap-2 border border-zinc-800 p-3 text-sm sm:grid-cols-[92px_1.4fr_1.4fr_110px_120px] ${isEnabled ? "" : "opacity-50"}`}>
                      <p className="self-center text-zinc-300">{pour.order}차푸어</p>
                      <label className="space-y-1">
                        <span className="text-xs text-zinc-500">시작 (MM:SS)</span>
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={startParts.mm}
                            disabled={!isEnabled || idx > 0}
                            onChange={(e) => updateRecipeClockPart(idx, "start", "mm", Number(e.target.value))}
                            className="w-full border border-zinc-700 bg-zinc-900 px-2 py-1.5 outline-none focus:border-amber-400 disabled:cursor-not-allowed"
                          >
                            {MINUTE_OPTIONS.map((minute) => (
                              <option key={`start-mm-${pour.order}-${minute}`} value={minute}>
                                {minute.toString().padStart(2, "0")}
                              </option>
                            ))}
                          </select>
                          <select
                            value={startParts.ss}
                            disabled={!isEnabled || idx > 0}
                            onChange={(e) => updateRecipeClockPart(idx, "start", "ss", Number(e.target.value))}
                            className="w-full border border-zinc-700 bg-zinc-900 px-2 py-1.5 outline-none focus:border-amber-400 disabled:cursor-not-allowed"
                          >
                            {SECOND_OPTIONS.map((second) => (
                              <option key={`start-ss-${pour.order}-${second}`} value={second}>
                                {second.toString().padStart(2, "0")}
                              </option>
                            ))}
                          </select>
                        </div>
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs text-zinc-500">종료 (MM:SS)</span>
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={endParts.mm}
                            disabled={!isEnabled}
                            onChange={(e) => updateRecipeClockPart(idx, "end", "mm", Number(e.target.value))}
                            className="w-full border border-zinc-700 bg-zinc-900 px-2 py-1.5 outline-none focus:border-amber-400 disabled:cursor-not-allowed"
                          >
                            {MINUTE_OPTIONS.map((minute) => (
                              <option key={`end-mm-${pour.order}-${minute}`} value={minute}>
                                {minute.toString().padStart(2, "0")}
                              </option>
                            ))}
                          </select>
                          <select
                            value={endParts.ss}
                            disabled={!isEnabled}
                            onChange={(e) => updateRecipeClockPart(idx, "end", "ss", Number(e.target.value))}
                            className="w-full border border-zinc-700 bg-zinc-900 px-2 py-1.5 outline-none focus:border-amber-400 disabled:cursor-not-allowed"
                          >
                            {SECOND_OPTIONS.map((second) => (
                              <option key={`end-ss-${pour.order}-${second}`} value={second}>
                                {second.toString().padStart(2, "0")}
                              </option>
                            ))}
                          </select>
                        </div>
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs text-zinc-500">투입량 (ml)</span>
                        <input
                          type="number"
                          min={0}
                          max={2000}
                          step={1}
                          disabled={!isEnabled}
                          value={pour.waterMl}
                          onChange={(e) => updateRecipePour(idx, "waterMl", Number(e.target.value))}
                          className="w-full border border-zinc-700 bg-zinc-900 px-2 py-1.5 outline-none focus:border-amber-400 disabled:cursor-not-allowed"
                        />
                      </label>
                      {recipeUseSwitch ? (
                        <label className="space-y-1">
                          <span className="text-xs text-zinc-500">스위치 상태</span>
                          <select
                            value={pour.switchState}
                            disabled={!isEnabled}
                            onChange={(e) => updateRecipePour(idx, "switchState", e.target.value)}
                            className="w-full border border-zinc-700 bg-zinc-900 px-2 py-1.5 outline-none focus:border-amber-400 disabled:cursor-not-allowed"
                          >
                            <option value="닫힘">닫힘</option>
                            <option value="열림">열림</option>
                          </select>
                        </label>
                      ) : (
                        <div className="self-center text-xs text-zinc-500">스위치 미사용</div>
                      )}
                    </div>
                  );
                })()
              ))}
            </div>
            <div className="grid gap-3 border border-zinc-800 p-3 text-sm sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs text-zinc-500">가수 추천량 (ml)</span>
                <input
                  value={recipeDilutionGuide}
                  onChange={(e) => setRecipeDilutionGuide(e.target.value)}
                  placeholder="예: 70-100ml"
                  className="w-full border border-zinc-700 bg-zinc-900 px-2 py-1.5 outline-none focus:border-amber-400"
                />
              </label>
              <div className="self-end text-zinc-300">
                총 투입 물량: <span className="text-amber-300">{totalRecipePourWater.toFixed(1)}ml</span>
                <span className="ml-3 text-zinc-400">비율: </span>
                <span className="text-amber-300">{recipeRatioText}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-4">
            <button
              onClick={saveRecipeInfo}
              className="cursor-pointer border border-amber-400 bg-amber-400 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-transparent hover:text-amber-300"
            >
              레시피 저장
            </button>
            <p className="text-xs text-zinc-500">저장된 레시피: {recipes.length}개</p>
          </div>

          <div className="overflow-x-auto border border-zinc-800">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-zinc-900 text-zinc-300">
                <tr>
                  <th className="px-3 py-2 font-medium">레시피 이름</th>
                  <th className="px-3 py-2 font-medium">hot/ice</th>
                  <th className="px-3 py-2 font-medium">원두량</th>
                  <th className="px-3 py-2 font-medium">스위치</th>
                  <th className="px-3 py-2 font-medium">물량</th>
                  <th className="px-3 py-2 font-medium">타임라인</th>
                  <th className="px-3 py-2 font-medium">동작</th>
                </tr>
              </thead>
              <tbody>
                {sortedRecipes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-zinc-500">
                      저장된 레시피가 없습니다.
                    </td>
                  </tr>
                )}
                {sortedRecipes.map((item) => (
                  <tr key={item.id} className="border-t border-zinc-800 odd:bg-zinc-900/30">
                    <td className="px-3 py-2">{item.name}</td>
                    <td className="px-3 py-2 text-zinc-300">{item.drinkType}</td>
                    <td className="px-3 py-2 text-zinc-300">{item.dose}g</td>
                    <td className="px-3 py-2 text-zinc-300">{item.useSwitch ? "사용" : "미사용"}</td>
                    <td className="px-3 py-2 text-xs text-zinc-300">
                      총 {item.pours.reduce((sum, pour) => sum + pour.waterMl, 0)}ml
                      {item.dose > 0 ? ` / 1:${round(item.pours.reduce((sum, pour) => sum + pour.waterMl, 0) / item.dose, 1).toFixed(1)}` : ""}
                      {item.dilutionGuide ? ` / 가수 ${item.dilutionGuide}` : ""}
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-400">
                      {item.pours
                        .map((pour) => {
                          const range = `${formatClockToKorean(pour.start)}~${formatClockToKorean(pour.end)}`;
                          return `${pour.order}차 ${range} ${pour.waterMl}ml${item.useSwitch ? `(${pour.switchState})` : ""}`;
                        })
                        .join(" | ")}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button onClick={() => loadSavedRecipe(item)} className="cursor-pointer border border-zinc-600 px-2 py-1 text-xs text-zinc-200 hover:border-amber-400">
                          불러오기
                        </button>
                        <button onClick={() => removeRecipeInfo(item.id)} className="cursor-pointer border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:border-zinc-500">
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </section>

      <section id="coffee-diary-records" className="order-2 mx-auto w-full max-w-6xl px-6 pb-14 md:px-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-medium">커피 일기 기록</h2>
            <p className="text-sm text-zinc-400">세분화 컵 점수 평균과 함께 추출 로그를 확인합니다.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <input placeholder="원두명 또는 메모 검색" value={search} onChange={(e) => setSearch(e.target.value)} className="border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-amber-400" />
            <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value as BrewMethod | "All")} className="border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-amber-400">
              <option value="All">All methods</option>
              {METHODS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto border border-zinc-800">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-zinc-900 text-zinc-300">
              <tr>
                <th className="px-3 py-3 font-medium">일시</th>
                <th className="px-3 py-3 font-medium">원두</th>
                <th className="px-3 py-3 font-medium">방식</th>
                <th className="px-3 py-3 font-medium">그라인더</th>
                <th className="px-3 py-3 font-medium">추출수/온도</th>
                <th className="px-3 py-3 font-medium">드리퍼/스위치</th>
                <th className="px-3 py-3 font-medium">레시피</th>
                <th className="px-3 py-3 font-medium">컵 평균</th>
                <th className="px-3 py-3 font-medium">조건</th>
                <th className="px-3 py-3 font-medium">클릭값</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {filteredRecords.length === 0 && (
                  <tr>
                      <td colSpan={10} className="px-3 py-8 text-center text-zinc-500">
                      저장된 기록이 없습니다.
                    </td>
                  </tr>
                )}
                {filteredRecords.map((record) => (
                  <motion.tr key={record.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="border-t border-zinc-800 odd:bg-zinc-900/30">
                    <td className="px-3 py-3 text-zinc-400">{new Date(record.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-3">{record.bean}</td>
                    <td className="px-3 py-3">{record.method}</td>
                    <td className="px-3 py-3">{record.grinder}</td>
                    <td className="px-3 py-3 text-zinc-300">
                      {record.brewWater} / {record.brewWaterTemp.toFixed(1)}도
                      {record.method === "Brew" && record.switchApplied && record.immersionWaterTemp !== null ? ` (침출 ${record.immersionWaterTemp.toFixed(1)}도)` : ""}
                    </td>
                    <td className="px-3 py-3 text-zinc-300">{record.method === "Brew" ? `${record.dripper} / ${record.switchApplied ? "적용" : "미적용"}` : "-"}</td>
                    <td className="px-3 py-3 text-zinc-300">{record.recipe || "-"}</td>
                    <td className="px-3 py-3 text-zinc-300">{record.scoreAverage.toFixed(1)}</td>
                    <td className="px-3 py-3 text-zinc-400">
                      {record.roastLevel}, {record.restDays}d, {record.brewSec}s
                    </td>
                    <td className="px-3 py-3 text-zinc-300">
                      <span className="text-amber-300">{record.baseClick.toFixed(1)}</span>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export default App;
