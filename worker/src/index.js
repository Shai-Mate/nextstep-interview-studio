import { handle } from './handlers.js';
import { createWorkersAiAdapter, DEFAULT_MODEL } from './model.js';
import { resolveHostDefault } from './fetch-job.js';

export default {
  async fetch(request, env) {
    let adapter;
    try {
      adapter = createWorkersAiAdapter(env.AI, env.MODEL_ID || DEFAULT_MODEL);
    } catch {
      adapter = {
        async complete() {
          const error = new Error('model-unavailable');
          error.code = 'model-unavailable';
          throw error;
        }
      };
    }
    return handle(request, {
      adapter,
      env,
      fetchImpl: globalThis.fetch.bind(globalThis),
      resolveHost: host => resolveHostDefault(host, globalThis.fetch.bind(globalThis))
    });
  }
};
