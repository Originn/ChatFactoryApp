// Embedding model configuration and dimension mapping
// This file centralizes all embedding model configurations to ensure consistency

export interface EmbeddingModelConfig {
  dimensions: number;
  provider: string;
  supportsMultimodal: boolean;
  description: string;
}

export const EMBEDDING_MODEL_CONFIGS: Record<string, EmbeddingModelConfig> = {
  // OpenAI Models
  'text-embedding-3-small': {
    dimensions: 1536,
    provider: 'openai',
    supportsMultimodal: false,
    description: 'OpenAI text-embedding-3-small (1536 dimensions)'
  },
  'text-embedding-3-large': {
    dimensions: 3072,
    provider: 'openai',
    supportsMultimodal: false,
    description: 'OpenAI text-embedding-3-large (3072 dimensions)'
  },
  'text-embedding-ada-002': {
    dimensions: 1536,
    provider: 'openai',
    supportsMultimodal: false,
    description: 'OpenAI text-embedding-ada-002 (Legacy, 1536 dimensions)'
  },

  // Azure OpenAI Models
  'azure-text-embedding-3-small': {
    dimensions: 1536,
    provider: 'azure',
    supportsMultimodal: false,
    description: 'Azure text-embedding-3-small (1536 dimensions)'
  },
  'azure-text-embedding-3-large': {
    dimensions: 3072,
    provider: 'azure',
    supportsMultimodal: false,
    description: 'Azure text-embedding-3-large (3072 dimensions)'
  },

  // Cohere Models
  'cohere-embed-english-v3.0': {
    dimensions: 1024,
    provider: 'cohere',
    supportsMultimodal: false,
    description: 'Cohere embed-english-v3.0 (1024 dimensions)'
  },
  'cohere-embed-multilingual-v3.0': {
    dimensions: 1024,
    provider: 'cohere',
    supportsMultimodal: false,
    description: 'Cohere embed-multilingual-v3.0 (1024 dimensions)'
  },

  // Hugging Face Models
  'hf-all-MiniLM-L6-v2': {
    dimensions: 384,
    provider: 'huggingface',
    supportsMultimodal: false,
    description: 'HuggingFace all-MiniLM-L6-v2 (384 dimensions)'
  },
  'hf-all-mpnet-base-v2': {
    dimensions: 768,
    provider: 'huggingface',
    supportsMultimodal: false,
    description: 'HuggingFace all-mpnet-base-v2 (768 dimensions)'
  },
  'hf-bge-large-en-v1.5': {
    dimensions: 1024,
    provider: 'huggingface',
    supportsMultimodal: false,
    description: 'HuggingFace bge-large-en-v1.5 (1024 dimensions)'
  },

  // Jina AI Models
  'jina-embeddings-v4': {
    dimensions: 2048,
    provider: 'jina',
    supportsMultimodal: true,
    description: 'Jina AI embeddings-v4 (2048 dimensions, multimodal)'
  },
  'jina-embeddings-v3': {
    dimensions: 1024,
    provider: 'jina',
    supportsMultimodal: false,
    description: 'Jina AI embeddings-v3 (1024 dimensions, text-only)'
  },
  'jina-clip-v2': {
    dimensions: 1024,
    provider: 'jina',
    supportsMultimodal: true,
    description: 'Jina AI clip-v2 (1024 dimensions, multimodal)'
  },

  // Voyage Models
  'voyage-large-2': {
    dimensions: 1536,
    provider: 'voyage',
    supportsMultimodal: false,
    description: 'Voyage large-2 (1536 dimensions)'
  },
  'voyage-code-2': {
    dimensions: 1536,
    provider: 'voyage',
    supportsMultimodal: false,
    description: 'Voyage code-2 (1536 dimensions)'
  }
};

/**
 * Get dimensions for a specific embedding model
 */
export function getEmbeddingDimensions(embeddingModel: string): number {
  const config = EMBEDDING_MODEL_CONFIGS[embeddingModel];
  if (!config) {
    console.warn(`Unknown embedding model: ${embeddingModel}. Using default 1536 dimensions.`);
    return 1536; // Default fallback
  }
  return config.dimensions;
}

/**
 * Get full configuration for a specific embedding model
 */
export function getEmbeddingModelConfig(embeddingModel: string): EmbeddingModelConfig | null {
  return EMBEDDING_MODEL_CONFIGS[embeddingModel] || null;
}

/**
 * Check if an embedding model supports multimodal content
 */
export function isMultimodalModel(embeddingModel: string): boolean {
  const config = EMBEDDING_MODEL_CONFIGS[embeddingModel];
  return config ? config.supportsMultimodal : false;
}

/**
 * Get provider for a specific embedding model
 */
export function getEmbeddingProvider(embeddingModel: string): string {
  const config = EMBEDDING_MODEL_CONFIGS[embeddingModel];
  if (!config) {
    // Try to infer provider from model name
    if (embeddingModel.startsWith('azure-')) return 'azure';
    if (embeddingModel.startsWith('cohere-')) return 'cohere';
    if (embeddingModel.startsWith('hf-')) return 'huggingface';
    if (embeddingModel.startsWith('jina-')) return 'jina';
    if (embeddingModel.startsWith('voyage-')) return 'voyage';
    return 'openai'; // Default fallback
  }
  return config.provider;
}

/**
 * List all available embedding models
 */
export function getAllEmbeddingModels(): string[] {
  return Object.keys(EMBEDDING_MODEL_CONFIGS);
}

/**
 * Get models by provider
 */
export function getModelsByProvider(provider: string): string[] {
  return Object.entries(EMBEDDING_MODEL_CONFIGS)
    .filter(([_, config]) => config.provider === provider)
    .map(([model, _]) => model);
}
