// ==================== DELAY STRING → MILLISECONDS ====================

const DELAY_MAP = {
    "5_min": 5 * 60 * 1000,
    "15_min": 15 * 60 * 1000,
    "30_min": 30 * 60 * 1000,
    "1_hour": 60 * 60 * 1000,
    "2_hours": 2 * 60 * 60 * 1000,
    "6_hours": 6 * 60 * 60 * 1000,
    "12_hours": 12 * 60 * 60 * 1000,
    "24_hours": 24 * 60 * 60 * 1000,
  };
  
  export function parseDelayToMs(delayStr) {
    return DELAY_MAP[delayStr] ?? 30 * 60 * 1000;
  }