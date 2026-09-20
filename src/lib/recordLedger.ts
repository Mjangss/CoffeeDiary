import type { BrewRecord, InventoryItem, PersistedPayload } from "../types";
import { keyOf, round } from "../utils";
import { validMeasure, validStockOutflow } from "../utils/validation";

const refreshProfiles = (payload: PersistedPayload, records: BrewRecord[], keys: string[]) => {
  const profiles = { ...payload.profiles };
  for (const key of new Set(keys)) {
    const matches = records.filter(record => keyOf(record.beanId ?? record.bean, record.method, record.grinder, record.dripper, record.switchApplied) === key);
    if (!matches.length) {
      delete profiles[key];
      continue;
    }
    const latest = matches.reduce((a, b) => a.createdAt >= b.createdAt ? a : b);
    profiles[key] = {
      bean: latest.bean, beanId: latest.beanId, method: latest.method, grinder: latest.grinder,
      dripper: latest.dripper, switchApplied: latest.switchApplied,
      baseClick: round(matches.reduce((sum, record) => sum + record.baseClick, 0) / matches.length),
      sampleCount: matches.length, updatedAt: latest.createdAt,
    };
  }
  return profiles;
};

export const saveBrewRecord = (payload: PersistedPayload, next: BrewRecord): PersistedPayload => {
  if (!validMeasure(next.dose, 1, 100, 0.1)) throw new Error("사용량은 1~100g, 0.1g 단위여야 합니다.");
  const old = payload.records.find(record => record.id === next.id);
  const inventory = [...(payload.inventory ?? [])];
  const oldStock = old?.inventoryId ? inventory.find(item => item.id === old.inventoryId) : undefined;
  const newStock = next.inventoryId ? inventory.find(item => item.id === next.inventoryId) : undefined;
  const stockChanged = old?.inventoryId !== next.inventoryId || Boolean(old && old.dose !== next.dose);
  if (old?.inventoryId && stockChanged && (!oldStock || !Number.isFinite(old.dose) || old.dose < 0)) {
    throw new Error("기존 재고를 찾거나 이전 사용량을 확인할 수 없어 정정할 수 없습니다.");
  }
  if (next.inventoryId && !newStock) throw new Error("선택한 재고를 찾을 수 없습니다.");
  const available = newStock ? newStock.remainingWeight + (oldStock?.id === newStock.id ? old!.dose : 0) : 0;
  if (newStock && stockChanged && !validStockOutflow(next.dose, available)) {
    throw new Error("사용량이 재고 잔량을 초과합니다.");
  }

  const move = (stockId: string, delta: number) => {
    if (!delta) return;
    const index = inventory.findIndex(item => item.id === stockId);
    const item = inventory[index];
    const remainingWeight = round(item.remainingWeight + delta, 10);
    inventory[index] = {
      ...item,
      remainingWeight,
      status: remainingWeight === 0 ? "DEPLETED" : item.status === "DEPLETED" ? "ACTIVE" : item.status,
      manualLogs: [...(item.manualLogs ?? []), {
        id: crypto.randomUUID(), recordId: next.id, date: new Date().toISOString(),
        amount: Math.abs(delta), type: delta > 0 ? "INC" as const : "DEC" as const,
        reason: old ? "기록 정정" : "추출에 의한 자동 차감",
      }],
    };
  };
  if (stockChanged) {
    if (oldStock?.id === newStock?.id && oldStock) move(oldStock.id, old!.dose - next.dose);
    else {
      if (oldStock) move(oldStock.id, old!.dose);
      if (newStock) move(newStock.id, -next.dose);
    }
  }
  const records = old ? payload.records.map(record => record.id === next.id ? next : record) : [next, ...payload.records];
  const keys = [keyOf(next.beanId ?? next.bean, next.method, next.grinder, next.dripper, next.switchApplied)];
  if (old) keys.push(keyOf(old.beanId ?? old.bean, old.method, old.grinder, old.dripper, old.switchApplied));
  return { ...payload, records, inventory, profiles: refreshProfiles(payload, records, keys) };
};

export const deleteBrewDiary = (payload: PersistedPayload, recordId: string): PersistedPayload => {
  const old = payload.records.find(record => record.id === recordId);
  if (!old) return payload;
  const records = payload.records.filter(record => record.id !== recordId);
  const key = keyOf(old.beanId ?? old.bean, old.method, old.grinder, old.dripper, old.switchApplied);
  return { ...payload, records, profiles: refreshProfiles(payload, records, [key]) };
};

export const cancelBrewRecord = (payload: PersistedPayload, recordId: string): PersistedPayload => {
  const record = payload.records.find(item => item.id === recordId);
  if (!record) throw new Error("취소할 기록을 찾을 수 없습니다.");
  if (!record.inventoryId) return deleteBrewDiary(payload, recordId);
  const inventory = payload.inventory ?? [];
  const stock = inventory.find(item => item.id === record.inventoryId);
  if (!stock) throw new Error("연결된 재고를 찾을 수 없어 추출을 취소할 수 없습니다.");
  if (!Number.isFinite(stock.remainingWeight) || stock.remainingWeight < 0) throw new Error("재고 잔량을 확인할 수 없습니다.");
  const recordNetDebit = (stock.manualLogs ?? [])
    .filter(log => log.recordId === recordId)
    .reduce((total, log) => total + (log.type === "DEC" ? log.amount : -log.amount), 0);
  if (!Number.isFinite(record.dose) || record.dose <= 0 || round(recordNetDebit, 10) !== round(record.dose, 10)) {
    throw new Error("이 기록의 자동 차감 이력을 확인할 수 없습니다. 재고를 수동으로 정정해 주세요.");
  }
  const remainingWeight = round(stock.remainingWeight + record.dose, 10);
  const restored: InventoryItem = {
    ...stock,
    remainingWeight,
    status: stock.status === "DEPLETED" ? "ACTIVE" : stock.status,
    manualLogs: [...(stock.manualLogs ?? []), {
      id: crypto.randomUUID(), recordId, date: new Date().toISOString(),
      amount: record.dose, type: "INC", reason: "추출 취소",
    }],
  };
  return deleteBrewDiary({ ...payload, inventory: inventory.map(item => item.id === stock.id ? restored : item) }, recordId);
};

export const reviseInitialWeight = (item: InventoryItem, initialWeight: number): InventoryItem => ({
  ...item,
  initialWeight,
  remainingWeight: round(item.remainingWeight + initialWeight - item.initialWeight, 10),
});
