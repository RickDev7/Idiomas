/* TeacherPersonaProfile — estável entre sessões. Não reinicia. */

import { loadPersonalLearningProfile } from '@/services/learning/PersonalLearningProfile';

export interface TeacherPersonaProfile {
  version: 1;
  name: string;
  tone: 'warm_professional';
  encouragement: 'moderate';
  formality: 'informal_du';
  humor: 'light';
  correctionDefault: 'short' | 'brief_explanation';
  pace: 'fast' | 'steady' | 'careful';
}

const KEY = 'deutsch-turbo:teacher-persona:v1';

export function defaultPersona(): TeacherPersonaProfile {
  const adapt = loadPersonalLearningProfile();
  return {
    version: 1,
    name: 'Deutsch Coach',
    tone: 'warm_professional',
    encouragement: 'moderate',
    formality: 'informal_du',
    humor: 'light',
    correctionDefault: adapt.teachingStrategy.correctionStyle === 'brief_explanation' ? 'brief_explanation' : 'short',
    pace: adapt.teachingStrategy.pace,
  };
}

export function loadTeacherPersona(): TeacherPersonaProfile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const d = defaultPersona();
      localStorage.setItem(KEY, JSON.stringify(d));
      return d;
    }
    const p = JSON.parse(raw) as TeacherPersonaProfile;
    if (p?.version !== 1 || p.tone !== 'warm_professional') return defaultPersona();
    return { ...defaultPersona(), ...p, tone: 'warm_professional', encouragement: 'moderate', formality: 'informal_du', humor: 'light' };
  } catch {
    return defaultPersona();
  }
}

/** Só atualiza ritmo/correção a partir da adaptação — nunca o tom. */
export function syncPersonaFromAdaptation(): TeacherPersonaProfile {
  const current = loadTeacherPersona();
  const adapt = loadPersonalLearningProfile();
  const next: TeacherPersonaProfile = {
    ...current,
    correctionDefault: adapt.teachingStrategy.correctionStyle === 'brief_explanation' ? 'brief_explanation' : current.correctionDefault,
    pace: adapt.teachingStrategy.pace || current.pace,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch { /* */ }
  return next;
}

export function personaInstruction(p = loadTeacherPersona()): string {
  return [
    `PERSONA ESTÁVEL: ${p.name}. Tom ${p.tone.replace('_', '/')}, incentivo ${p.encouragement}, du informal, humor leve.`,
    'Pareça humano, sem exagero emocional. Não reinicie a personalidade.',
    `Correção padrão: ${p.correctionDefault === 'short' ? 'curta' : 'explicação breve'}. Ritmo: ${p.pace}.`,
  ].join(' ');
}
