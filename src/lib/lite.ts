export interface LiteSignals {
  saveData?: boolean;
  effectiveType?: string;
  deviceMemory?: number;
  forced?: boolean;
}

export function shouldUseLite(signals: LiteSignals): boolean {
  if (signals.forced) return true;
  if (signals.saveData) return true;
  if (signals.effectiveType === '2g' || signals.effectiveType === 'slow-2g' || signals.effectiveType === '3g') return true;
  if (signals.deviceMemory !== undefined && signals.deviceMemory <= 2) return true;
  return false;
}

export function readLiteSignals(): LiteSignals {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string }; deviceMemory?: number };
  return {
    ...(nav.connection?.saveData ? { saveData: true } : {}),
    ...(nav.connection?.effectiveType ? { effectiveType: nav.connection.effectiveType } : {}),
    ...(typeof nav.deviceMemory === 'number' ? { deviceMemory: nav.deviceMemory } : {}),
  };
}
