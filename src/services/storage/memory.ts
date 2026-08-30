import type { Mistake } from '@/types';
import { StorageService } from '@/services/storage/StorageService';
import { generateId } from '@/utils/reviewUtils';

export async function recordMistake(input: {
  userSaid: string;
  correct: string;
  explanation: string;
  context?: string;
}): Promise<void> {
  const all = await StorageService.getAllMistakes();
  const existing = all.find(
    (m) => m.correct.toLowerCase() === input.correct.toLowerCase() && m.userSaid.toLowerCase() === input.userSaid.toLowerCase(),
  );

  if (existing) {
    await StorageService.saveMistake({
      ...existing,
      count: existing.count + 1,
      lastOccurrence: new Date().toISOString(),
      mastered: false,
    });
    return;
  }

  const mistake: Mistake = {
    id: generateId(),
    type: 'vocabulary',
    userSaid: input.userSaid,
    correct: input.correct,
    explanation: input.explanation,
    context: input.context || 'conversation',
    count: 1,
    lastOccurrence: new Date().toISOString(),
    mastered: false,
    category: 'conversation',
  };
  await StorageService.saveMistake(mistake);
}
