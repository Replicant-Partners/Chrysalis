/**
 * Scenarios Canvas - Zustand Store
 */

import { create } from 'zustand';
import type { ScenariosCanvasState, Scenario, Observation } from './types';

export const useScenariosStore = create<ScenariosCanvasState>((set) => ({
  // Initial state
  viewMode: 'board',
  selectedScenarioIds: [],
  filterByStatus: ['active'],
  sortBy: 'probability',
  comparisonScenarioIds: [],
  totalProbability: 0,
  needsReconciliation: false,
  overdueIndicators: [],
  
  // Actions
  createScenario: (scenarioData) => {
    const scenario: Scenario = {
      ...scenarioData,
      id: `scenario-${Date.now()}`,
      probabilityHistory: [],
    };
    // TODO: Add to YJS document
    console.log('Created scenario:', scenario);
  },
  
  updateProbability: (scenarioId, newProb, reason) => {
    // TODO: Update in YJS document
    console.log('Update probability:', { scenarioId, newProb, reason });
  },
  
  addObservation: (indicatorId, obsData) => {
    const observation: Observation = {
      ...obsData,
      id: `obs-${Date.now()}`,
    };
    // TODO: Add to YJS document
    console.log('Add observation:', { indicatorId, observation });
  },
  
  archiveScenario: (scenarioId, reason) => {
    // TODO: Update in YJS document
    console.log('Archive scenario:', { scenarioId, reason });
  },
  
  scheduleReview: (date) => {
    // TODO: Update in YJS document
    console.log('Schedule review:', new Date(date));
  },
  
  setViewMode: (mode) => {
    set({ viewMode: mode });
  },
  
  setSelectedScenarios: (ids) => {
    set({ selectedScenarioIds: ids });
  },
}));