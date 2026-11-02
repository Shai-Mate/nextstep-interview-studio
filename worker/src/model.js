/* One adapter. Workers AI is the default. Another free provider can replace this file's factory. */

export const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct';

export function createWorkersAiAdapter(ai, modelId = DEFAULT_MODEL) {
  if (!ai || typeof ai.run !== 'function') {
    const error = new Error('model-unconfigured');
    error.code = 'model-unconfigured';
    throw error;
  }
  return {
    async complete({ system, user }) {
      const result = await ai.run(modelId, {
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        max_tokens: 1800,
        temperature: 0.2
      });
      if (typeof result === 'string') return result;
      if (result && typeof result.response === 'string') return result.response;
      if (result && typeof result.result === 'string') return result.result;
      return '';
    }
  };
}
