import { toPng } from "html-to-image";
import { Variants } from "framer-motion";
import { 
  BrewMethod, 
  Grinder, 
  Dripper, 
  RecipePour, 
  RecipeInfo, 
  BeanInfo 
} from "../types";
import { 
  DEFAULT_CUP_SCORES, 
  MAX_CUP_SCORE, 
  CUP_SCORE_STEP 
} from "../constants";

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const round = (value: number, decimals = 1) => {
  const m = 10 ** decimals;
  return Math.round(value * m) / m;
};

export const toStep = (value: number, step: number) => {
  const decimals = (step.toString().split(".")[1] || "").length;
  const snapped = Math.round((value + Number.EPSILON) / step) * step;
  return Number(snapped.toFixed(decimals));
};

export const parseTypedNumber = (raw: string) => {
  if (raw.trim() === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

export const safeNum = (value: unknown, fallback: number) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);

/**
 * 저장된 값이 구버전 100점 만점 형식(>10)이면 10점 만점으로 변환하고,
 * step과 범위(0~MAX_CUP_SCORE)에 맞게 정규화한다.
 *
 * @param value - 원시 점수 값 (unknown 타입 허용)
 * @param fallback - 파싱 실패 시 기본값
 */
export const normalizeCupScoreValue = (value: unknown, fallback = DEFAULT_CUP_SCORES.acidity) => {
  const parsed = safeNum(value, fallback);
  const scaled = parsed > MAX_CUP_SCORE ? parsed / 10 : parsed;
  return clamp(toStep(scaled, CUP_SCORE_STEP), 0, MAX_CUP_SCORE);
};

/**
 * 원두·추출방식·그라인더·드리퍼·스위치 여부 조합으로 그라인더 프로파일 키를 생성한다.
 * 이 키는 profiles 레코드의 인덱스로 사용된다.
 */
export const keyOf = (bean: string, method: BrewMethod, grinder: Grinder, dripper: Dripper, switchApplied: boolean) => {
  const brewContext = method === "Brew" ? `${dripper}::${switchApplied ? "switch" : "plain"}` : "espresso";
  return `${bean.trim().toLowerCase()}::${method}::${grinder}::${brewContext}`;
};

export const normalizeClock = (value: string) => {
  const cleaned = value.replace(/[^0-9]/g, "").slice(0, 4);
  const mm = cleaned.slice(0, 2).padEnd(2, "0");
  const ss = cleaned.slice(2, 4).padEnd(2, "0");
  return `${mm}:${clamp(Number(ss), 0, 59).toString().padStart(2, "0")}`;
};

export const parseClockParts = (clock: string) => {
  const [mmRaw = "00", ssRaw = "00"] = normalizeClock(clock).split(":");
  return {
    mm: clamp(Number(mmRaw) || 0, 0, 10),
    ss: clamp(Number(ssRaw) || 0, 0, 59),
  };
};

export const toClock = (mm: number, ss: number) => `${clamp(mm, 0, 10).toString().padStart(2, "0")}:${clamp(ss, 0, 59).toString().padStart(2, "0")}`;

export const isPourFilled = (pour: RecipePour) => pour.waterMl > 0;

export const enforceLinkedPourStarts = (pours: RecipePour[]) => {
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

export const formatClockToKorean = (clock: string) => {
  const [mmRaw = "00", ssRaw = "00"] = clock.split(":");
  const mm = mmRaw.padStart(2, "0");
  const ss = ssRaw.padStart(2, "0");
  return `${mm}분${ss}초`;
};

export const parseDilutionAmount = (guide: string): number[] => {
  const matches = guide.match(/\d+/g);
  if (!matches) return [];
  return matches.map(Number);
};

export const calculateRatioText = (dose: number, totalPour: number, dilutionValues: number[]): string => {
  if (dose <= 0) return "N/A";
  if (dilutionValues.length === 0) {
    return `1:${round(totalPour / dose, 1).toFixed(1)}`;
  }
  if (dilutionValues.length === 1) {
    return `1:${round((totalPour + dilutionValues[0]) / dose, 1).toFixed(1)}`;
  }
  const minD = Math.min(...dilutionValues);
  const maxD = Math.max(...dilutionValues);
  return `1:${round((totalPour + minD) / dose, 1).toFixed(1)} ~ 1:${round((totalPour + maxD) / dose, 1).toFixed(1)}`;
};

export const buildRecipeSummary = (recipeInfo: RecipeInfo) => {
  const totalPourWater = recipeInfo.pours.reduce((sum, pour) => sum + pour.waterMl, 0);
  const dilutionVals = parseDilutionAmount(recipeInfo.dilutionGuide);
  const ratioText = calculateRatioText(recipeInfo.dose, totalPourWater, dilutionVals);
  const activePours = recipeInfo.pours.filter(isPourFilled);
  const timeline = activePours
    .map((pour) => {
      const range = `${formatClockToKorean(pour.start)}~${formatClockToKorean(pour.end)}`;
      const switchLabel = recipeInfo.useSwitch ? ` (${pour.switchState})` : "";
      return `${pour.order}차 ${range} ${pour.waterMl}ml${switchLabel}`;
    })
    .join(", ");
  const dilutionLabel = recipeInfo.dilutionGuide ? ` / 가수 ${recipeInfo.dilutionGuide}` : "";
  const filterLabel = recipeInfo.method === "OXO" ? ` / 필터 [상:${recipeInfo.oxoUpperFilter} / 하:${recipeInfo.oxoLowerFilter}]` : "";
  
  return `${recipeInfo.name} / ${recipeInfo.method.toUpperCase()} / ${recipeInfo.drinkType.toUpperCase()} / ${recipeInfo.dose}g / 총투입 ${round(totalPourWater, 1)}ml / 비율 ${ratioText}${dilutionLabel}${filterLabel} / ${timeline}`;
};

export const parseTimeToSeconds = (timeStr: string) => {
  const [m, s] = timeStr.split(":").map(Number);
  return (isNaN(m) ? 0 : m) * 60 + (isNaN(s) ? 0 : s);
};

/**
 * 로스팅 날짜 기준으로 실제 숙성 일수를 계산한다.
 * 냉동 보관 기간(frozenDurationMs)은 숙성 시간에서 제외되며,
 * 현재 냉동 중(isFrozen)이면 냉동 시작 시점(lastFrozenAt)을 기준으로 계산한다.
 *
 * @param roastDate - 로스팅 날짜 (ISO 문자열)
 * @param frozenDurationMs - 누적 냉동 시간 (ms)
 * @param lastFrozenAt - 마지막으로 냉동을 시작한 시점 (ISO 문자열, optional)
 * @param isFrozen - 현재 냉동 상태 여부
 * @returns 실효 숙성 일수 (0~365 범위로 클램핑)
 */
export const calcRestDays = (roastDate: string, frozenDurationMs: number = 0, lastFrozenAt?: string, isFrozen: boolean = false) => {
  const roastTime = new Date(roastDate).getTime();
  if (Number.isNaN(roastTime)) return 0;
  
  const effectiveNow = (isFrozen && lastFrozenAt) ? new Date(lastFrozenAt).getTime() : Date.now();
  const netDuration = effectiveNow - roastTime - frozenDurationMs;
  
  return clamp(Math.floor(Math.max(0, netDuration) / (1000 * 60 * 60 * 24)), 0, 365);
};

export const getAgingStatus = (bean: BeanInfo, overrideRestDays?: number) => {
  if (bean.peakStart === undefined || bean.peakEnd === undefined) return "NOT_SET";
  const restDays = overrideRestDays !== undefined ? overrideRestDays : calcRestDays(bean.roastingDate);
  if (restDays < bean.peakStart) return "DEGASSING";
  if (restDays <= bean.peakEnd) return "PEAK";
  return "PAST_PEAK";
};

export const getAgingStatusDetail = (bean: BeanInfo, overrideRestDays?: number) => {
  if (bean.peakStart === undefined || bean.peakEnd === undefined) return "숙성 목표 미설정";
  const restDays = overrideRestDays !== undefined ? overrideRestDays : calcRestDays(bean.roastingDate);
  if (restDays < bean.peakStart) return `피크 시작 ${bean.peakStart - restDays}일 전`;
  if (restDays <= bean.peakEnd) return `최적의 풍미 유지 중 (종료 ${bean.peakEnd - restDays}일 전)`;
  return `피크 종료 ${restDays - bean.peakEnd}일 지남`;
};

/**
 * 배경색에 대비되는 전경색을 반환한다.
 * HEX(#rrggbb)와 hsl() 형식을 지원하며, 상대 밝기(luminance) 기준으로
 * 밝은 색상이면 어두운 CSS 변수, 어두운 색상이면 밝은 CSS 변수를 반환한다.
 *
 * @param color - HEX 또는 hsl() 형식의 색상 문자열
 * @returns CSS 변수 문자열 ('var(--bg-deep)' | 'var(--text-strong)')
 */
export const getContrastColor = (color: string) => {
  let r = 255, g = 255, b = 255;
  if (color.startsWith("#")) {
    const cleanHex = color.replace("#", "");
    r = parseInt(cleanHex.substring(0, 2), 16);
    g = parseInt(cleanHex.substring(2, 4), 16);
    b = parseInt(cleanHex.substring(4, 6), 16);
  } else if (color.startsWith("hsl")) {
    const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (match) {
      const h = parseInt(match[1]) / 360;
      const s = parseInt(match[2]) / 100;
      const l = parseInt(match[3]) / 100;
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
      g = Math.round(hue2rgb(p, q, h) * 255);
      b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);
    }
  }
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "var(--bg-deep)" : "var(--text-strong)";
};

export const describeAuthError = (error: unknown) => {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "unknown";

  if (code === "auth/popup-blocked") {
    return "팝업이 차단되어 리다이렉트 로그인으로 전환합니다.";
  }
  if (code === "auth/popup-closed-by-user") {
    return "로그인 팝업이 닫혀서 취소되었습니다.";
  }
  if (code === "auth/cancelled-popup-request") {
    return "로그인 요청이 취소되었습니다. 다시 시도해 주세요.";
  }
  if (code === "auth/operation-not-allowed") {
    return "Firebase Authentication에서 Google 로그인 활성화가 필요합니다.";
  }
  if (code === "auth/unauthorized-domain") {
    return "현재 도메인이 허용되지 않았습니다. Firebase Authentication > 승인된 도메인에 배포 도메인을 추가해 주세요.";
  }
  if (code === "auth/invalid-api-key") {
    return "Firebase API Key가 올바르지 않습니다. 환경변수를 확인해 주세요.";
  }

  return `Google 로그인 실패 (${code})`;
};

export const describeCloudError = (error: unknown) => {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "unknown";

  if (code.includes("permission-denied")) {
    return "클라우드 권한 오류: Firestore 규칙에서 로그인 사용자 읽기/쓰기 허용이 필요합니다. (permission-denied)";
  }
  if (code.includes("failed-precondition")) {
    return "클라우드 설정 필요: Firestore Database 생성 여부를 확인해 주세요. (failed-precondition)";
  }
  if (code.includes("unavailable")) {
    return "클라우드 연결 실패: 네트워크 또는 Firestore 서비스 상태를 확인해 주세요. (unavailable)";
  }
  if (code.includes("unauthenticated")) {
    return "클라우드 인증 오류: 다시 로그인 후 시도해 주세요. (unauthenticated)";
  }

  return `클라우드 동기화 실패 (${code})`;
};

export const getTransitionVariants = (type: "scan" | "blur" | "glitch" = "scan", height?: number): Variants => {
  const velocity = 2500; // px per second
  const baseDuration = height ? height / velocity : 0.6;
  const d = Math.min(Math.max(baseDuration, 0.6), 1.5);

  if (type === "blur") {
    return {
      initial: { opacity: 0, filter: "blur(20px) saturate(0)", scale: 1.05 },
      animate: { 
        opacity: 1, 
        filter: ["blur(20px) saturate(0)", "blur(8px) saturate(0.5)", "blur(0px) saturate(1)"], 
        scale: [1.05, 1.02, 1],
        transition: { 
          duration: d, 
          times: [0, 0.4, 1],
          ease: "easeOut" 
        } 
      },
      exit: { opacity: 0, filter: "blur(10px) saturate(0.5)", transition: { duration: 0.3 } },
    };
  }
  if (type === "glitch") {
    return {
      initial: { opacity: 0, x: -15, skewX: 10, textShadow: "0px 0 transparent" },
      animate: { 
        opacity: [0, 1, 0.4, 0.9, 1],
        x: [10, -5, 2, -1, 0],
        skewX: [15, -10, 5, 0],
        textShadow: [
          "1.5px 0.5px rgba(255,0,0,0.7), -1.5px -0.5px rgba(0,255,255,0.7)",
          "-1.5px -0.5px rgba(255,0,0,0.7), 1.5px 0.5px rgba(0,255,255,0.7)",
          "0px 0px transparent"
        ],
        filter: ["brightness(1.8)", "brightness(1.3)", "brightness(1)"],
        transition: { 
          duration: d, 
          times: [0, 0.1, 0.2, 0.4, 1],
          ease: "easeInOut"
        } 
      },
      exit: { 
        opacity: [1, 0.6, 0],
        x: [0, 5, 15],
        skewX: [0, 5, -10],
        textShadow: "1px 0 rgba(255,0,0,0.5), -1px 0 rgba(0,255,255,0.5)",
        transition: { duration: 0.2 } 
      },
    };
  }
  return {
    initial: { 
      opacity: 0, 
      clipPath: "inset(0 0 100% 0)",
      backgroundImage: "linear-gradient(to bottom, transparent, var(--point-color) 50%, transparent)",
      backgroundSize: "100% 4px",
      backgroundRepeat: "no-repeat",
      backgroundPosition: "0% 0%"
    },
    animate: { 
      opacity: 1, 
      clipPath: "inset(0 0 0% 0)",
      backgroundPosition: "0% 100%",
      transition: { 
        duration: d, 
        ease: [0.22, 1, 0.36, 1],
        clipPath: { duration: d },
        backgroundPosition: { duration: d }
      } 
    },
    exit: { 
      opacity: 0, 
      clipPath: "inset(100% 0 0 0)", 
      transition: { duration: 0.3 } 
    },
  };
};


export const BACKDROP_VARIANTS: Variants = {
  initial: { opacity: 0, backdropFilter: "blur(0px)", backgroundColor: "rgba(0, 0, 0, 0)" },
  animate: { opacity: 1, backdropFilter: "blur(12px)", backgroundColor: "rgba(0, 0, 0, 0.85)", transition: { duration: 0.3 } },
  exit: { opacity: 0, backdropFilter: "blur(0px)", backgroundColor: "rgba(0, 0, 0, 0)", transition: { duration: 0.2 } },
};

export const MODAL_VARIANTS: Variants = {
  initial: { opacity: 0, y: 20, scale: 0.95, skewX: 2 },
  animate: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    skewX: [2, -1, 0],
    textShadow: [
      "1px 0 rgba(255,0,0,0.5), -1px 0 rgba(0,255,255,0.5)",
      "0px 0 transparent"
    ],
    transition: { 
      type: "spring",
      stiffness: 400,
      damping: 30,
      skewX: { duration: 0.2, times: [0, 0.5, 1] },
      textShadow: { duration: 0.15, delay: 0.05 }
    } 
  },
  exit: { 
    opacity: 0, 
    y: 10, 
    scale: 0.98,
    transition: { duration: 0.15 } 
  },
};

export const handleDownloadScreenshot = async (ref: React.RefObject<HTMLDivElement | null>, filename: string) => {
  if (!ref.current) {
    alert("⚠️ Capture target not found.");
    return;
  }
  
  try {
    const bgColor = getComputedStyle(document.documentElement).getPropertyValue("--bg-base").trim() || "#09090b";
    
    // Calculate actual dimensions to prevent cutting
    const width = ref.current.offsetWidth;
    const height = ref.current.scrollHeight;

    const dataUrl = await toPng(ref.current, {
      backgroundColor: bgColor,
      pixelRatio: 3, // Increased for better clarity
      cacheBust: true,
      width: width,
      height: height,
      style: {
        transform: 'none',
        margin: '0',
        padding: getComputedStyle(ref.current).padding,
        height: `${height}px`,
        width: `${width}px`,
      }
    });
    
    const link = document.createElement("a");
    link.download = `${filename}_${new Date().toISOString().split("T")[0]}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    alert("✅ 스크린샷이 다운로드 폴더에 저장되었습니다.");
  } catch (err) {
    console.error("Screenshot capture failed:", err);
    alert("❌ 스크린샷 저장 중 오류가 발생했습니다: " + (err instanceof Error ? err.message : String(err)));
  }
};
export * from "./haptics";
