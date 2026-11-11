/**
 * Utility for handling known seed records and DEMO_DATA_ENABLED filtering.
 * Fixed IDs from initial seeding:
 * - fields: 'field-1', 'field-2', 'field-3', 'field-4' and organizationId === 'org-1'
 * - drone_missions: 'mission-1', 'mission-2', 'mission-3'
 * - recommendations: 'rec-1', 'rec-2'
 * - history/analyses: 'analysis-1', 'analysis-2'
 * - reviews: 'review-1', 'review-2'
 */

export const SEED_FIELD_IDS = new Set(['field-1', 'field-2', 'field-3', 'field-4']);
export const SEED_MISSION_IDS = new Set(['mission-1', 'mission-2', 'mission-3']);
export const SEED_REC_IDS = new Set(['rec-1', 'rec-2', 'rec-3']);
export const SEED_ANALYSIS_IDS = new Set(['analysis-1', 'analysis-2']);
export const SEED_NOTIF_IDS = new Set(['notif-1', 'notif-2', 'notif-3', 'notif-4']);

export const isSeedField = (field?: { id?: string; organizationId?: string } | null): boolean => {
  if (!field) return false;
  if (field.id && SEED_FIELD_IDS.has(field.id)) return true;
  if (field.organizationId === 'org-1') return true;
  return false;
};

export const isSeedMission = (mission?: { id?: string; fieldId?: string } | null): boolean => {
  if (!mission) return false;
  if (mission.id && SEED_MISSION_IDS.has(mission.id)) return true;
  if (mission.fieldId && SEED_FIELD_IDS.has(mission.fieldId)) return true;
  return false;
};

export const isSeedRecommendation = (rec?: { id?: string; fieldId?: string } | null): boolean => {
  if (!rec) return false;
  if (rec.id && SEED_REC_IDS.has(rec.id)) return true;
  if (rec.fieldId && SEED_FIELD_IDS.has(rec.fieldId)) return true;
  return false;
};

export const isSeedAnalysis = (analysis?: { id?: string; fieldId?: string } | null): boolean => {
  if (!analysis) return false;
  if (analysis.id && SEED_ANALYSIS_IDS.has(analysis.id)) return true;
  if (analysis.fieldId && SEED_FIELD_IDS.has(analysis.fieldId)) return true;
  return false;
};

export const isSeedNotification = (notif?: { id?: string; relatedId?: string } | null): boolean => {
  if (!notif) return false;
  if (notif.id && SEED_NOTIF_IDS.has(notif.id)) return true;
  if (notif.relatedId && (SEED_FIELD_IDS.has(notif.relatedId) || SEED_MISSION_IDS.has(notif.relatedId) || SEED_REC_IDS.has(notif.relatedId))) return true;
  return false;
};

export const getDemoDataEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem('plant_health_demo_data_enabled');
  if (stored !== null) {
    return stored === 'true';
  }
  return import.meta.env.VITE_DEMO_DATA_ENABLED === 'true';
};

export const setDemoDataEnabled = (enabled: boolean): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('plant_health_demo_data_enabled', enabled ? 'true' : 'false');
};
