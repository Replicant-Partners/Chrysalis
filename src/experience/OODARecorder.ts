import { Episode, OODAField, OODAInterrogatives, OODAStage, OODAStep } from '../core/UniversalAgentV2';

function emptyStep(): OODAStep {
  return { who: [], what: [], when: [], where: [], why: [], how: [], huh: [] };
}

function mergeValues(existing: string[], incoming?: string[]): string[] {
  if (!incoming) return existing;
  const next = existing.concat(incoming);
  return Array.from(new Set(next.filter(Boolean)));
}

function ensureOODA(episode: Episode): OODAInterrogatives {
  if (!episode.ooda) {
    episode.ooda = {
      observe: emptyStep(),
      orient: emptyStep(),
      decide: emptyStep(),
      act: emptyStep()
    };
  }
  return episode.ooda;
}

export function recordOODA(
  episode: Episode,
  stage: OODAStage,
  updates: Partial<Record<OODAField, string[]>>
): OODAInterrogatives {
  const ooda = ensureOODA(episode);
  const step = ooda[stage];
  (['who', 'what', 'when', 'where', 'why', 'how', 'huh'] as OODAField[]).forEach(key => {
    step[key] = mergeValues(step[key], updates[key]);
  });
  ooda[stage] = step;
  episode.ooda = ooda;
  return ooda;
}
