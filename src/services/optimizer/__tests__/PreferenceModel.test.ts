import { PreferenceModel, type MethodResult } from '@/services/optimizer/PreferenceModel';
import { assert } from '../../learning/__tests__/assert';

export async function testPreferenceModel() {
  await PreferenceModel.save({});
  const resultA: Omit<MethodResult, 'timestamp'> = {
    method: 'shadowing',
    contentType: 'pronunciation',
    gain: 30,
    minutes: 10,
    retention1d: 0.9,
    retention3d: null,
    retention7d: null,
    transfer: 0.5,
    spontaneous: 0.3,
    helpUsed: 1,
  };
  await PreferenceModel.record({ ...resultA, timestamp: new Date().toISOString() });
  const best = await PreferenceModel.bestMethod('pronunciation', 0);
  assert(best === 'shadowing', 'método registrado vira o melhor');

  const resultB: Omit<MethodResult, 'timestamp'> = {
    method: 'listen_repeat',
    contentType: 'pronunciation',
    gain: 10,
    minutes: 10,
    retention1d: 0.5,
    retention3d: null,
    retention7d: null,
    transfer: 0.1,
    spontaneous: 0,
    helpUsed: 4,
  };
  await PreferenceModel.record({ ...resultB, timestamp: new Date().toISOString() });
  const best2 = await PreferenceModel.bestMethod('pronunciation', 0);
  assert(best2 === 'shadowing', 'shadowing permanece melhor que listen_repeat');

  const all = await PreferenceModel.all();
  assert(all.length === 2, 'dois métodos registrados');
  assert(all[0].sampleCount === 1, 'sampleCount incrementa');
}
