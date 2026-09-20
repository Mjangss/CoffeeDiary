export const validMeasure = (value: number, min: number, max: number, step: number) =>
  Number.isFinite(value) && Number.isFinite(step) && step > 0 && value >= min && value <= max &&
  Math.abs((value - min) / step - Math.round((value - min) / step)) < 1e-7;

export const validGrinderRange = (min: number, max: number, step: number) =>
  Number.isFinite(min) && Number.isFinite(max) && Number.isFinite(step) &&
  min >= 0 && max > min && step > 0 && step <= max - min;

export const validStockOutflow = (amount: number, remaining: number) =>
  Number.isFinite(remaining) && remaining >= 0 && validMeasure(amount, 0.1, remaining + 1e-8, 0.1);

const clockSeconds = (clock: string) => {
  const parts = clock.match(/^(\d{1,2}):(\d{2})$/);
  if (!parts) return NaN;
  const minute = Number(parts[1]);
  const second = Number(parts[2]);
  return minute <= 10 && second < 60 ? minute * 60 + second : NaN;
};

export const validPourTime = (start: string, end: string) => clockSeconds(start) < clockSeconds(end);

export const activeRecipePours = <T extends { start: string; end: string; waterMl: number }>(pours: T[]) =>
  pours.filter(pour => !(pour.end === "00:00" && pour.waterMl === 0));

export const validRecipeTimeline = (pours: Array<{ start: string; end: string; waterMl: number }>) => {
  const active = activeRecipePours(pours);
  if (!active.length) return "최소 한 단계 이상의 타임라인이 필요합니다.";
  for (const pour of active) {
    if (!validPourTime(pour.start, pour.end)) return "각 단계의 시작 시간은 종료 시간보다 빨라야 합니다.";
    if (!validMeasure(pour.waterMl, 0, 2000, 1)) return "물량은 0~2000ml의 정수여야 합니다.";
  }
  for (let i = 1; i < active.length; i += 1) {
    if (clockSeconds(active[i].start) < clockSeconds(active[i - 1].end)) return "타임라인 단계가 서로 겹칩니다.";
  }
  return "";
};
