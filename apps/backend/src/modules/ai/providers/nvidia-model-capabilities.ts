/**
 * NVIDIA NIM model capability registry.
 *
 * Add vision-capable model IDs to NVIDIA_VISION_MODELS when enabling image
 * analysis for a specific model. Keep TEXT_ONLY entries explicit so known
 * chat-only models never silently accept imageParts.
 */

const NORMALIZE = (model: string): string => model.trim().toLowerCase();

/** Explicitly text-only (no image / vision input). */
const NVIDIA_TEXT_ONLY_MODELS = new Set<string>([
  'openai/gpt-oss-120b',
]);

/**
 * Vision-capable NVIDIA models (OpenAI-compatible multimodal image_url).
 * Empty for now — add model IDs here when a vision model is configured.
 */
const NVIDIA_VISION_MODELS = new Set<string>([
  // e.g. 'meta/llama-3.2-90b-vision-instruct',
]);

/**
 * Whether the given NVIDIA model ID supports image / vision input.
 * Unknown models default to text-only (fail closed) until allowlisted.
 */
export function nvidiaModelSupportsImageInput(model: string): boolean {
  const id = NORMALIZE(model);
  if (!id) {
    return false;
  }
  if (NVIDIA_VISION_MODELS.has(id)) {
    return true;
  }
  if (NVIDIA_TEXT_ONLY_MODELS.has(id)) {
    return false;
  }
  return false;
}
