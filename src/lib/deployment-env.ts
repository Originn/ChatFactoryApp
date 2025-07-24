import { ChatbotConfig } from '@/types/chatbot';
import { generateFaviconEnvVars } from './utils/faviconUpload';

export function generateDeploymentEnvVars(chatbot: ChatbotConfig): Record<string, string> {
  const envVars: Record<string, string> = {
    // Basic chatbot configuration
    NEXT_PUBLIC_CHATBOT_NAME: chatbot.name,
    NEXT_PUBLIC_COMPANY_NAME: chatbot.name,
    NEXT_PUBLIC_COMPANY_DESCRIPTION: chatbot.description,
    NEXT_PUBLIC_PRODUCT_NAME: chatbot.name,
    
    // AI Configuration
    NEXT_PUBLIC_EMBEDDING_MODEL: chatbot.aiConfig.embeddingModel,
    NEXT_PUBLIC_LLM_MODEL: chatbot.aiConfig.llmModel,
    NEXT_PUBLIC_TEMPERATURE: chatbot.aiConfig.temperature.toString(),
    NEXT_PUBLIC_CONTEXT_WINDOW: chatbot.aiConfig.contextWindow.toString(),
    
    // Appearance Configuration
    NEXT_PUBLIC_PRIMARY_COLOR: chatbot.appearance.primaryColor,
    NEXT_PUBLIC_BUBBLE_STYLE: chatbot.appearance.bubbleStyle,
    
    // Behavior Configuration
    NEXT_PUBLIC_PERSONA: chatbot.behavior.persona,
    NEXT_PUBLIC_RESPONSE_LENGTH: chatbot.behavior.responseLength,
    NEXT_PUBLIC_SYSTEM_PROMPT: chatbot.behavior.systemPrompt,
    
    // Logo Configuration
    NEXT_PUBLIC_CHATBOT_LOGO_URL: chatbot.logoUrl || '',
    
    // Authentication Configuration
    NEXT_PUBLIC_REQUIRE_AUTH: chatbot.requireAuth.toString(),
  };

  // Add favicon environment variables if enabled
  if (chatbot.appearance.favicon.enabled) {
    const faviconEnvVars = generateFaviconEnvVars(chatbot.appearance.favicon, chatbot.name);
    Object.assign(envVars, faviconEnvVars);
  }

  // Add vectorstore configuration if available
  if (chatbot.vectorstore) {
    envVars.NEXT_PUBLIC_VECTORSTORE_PROVIDER = chatbot.vectorstore.provider;
    envVars.NEXT_PUBLIC_VECTORSTORE_INDEX = chatbot.vectorstore.indexName;
    envVars.NEXT_PUBLIC_VECTORSTORE_REGION = chatbot.vectorstore.region;
  }

  // Add Firebase configuration if available
  if (chatbot.authConfig?.firebaseProjectId) {
    envVars.NEXT_PUBLIC_FIREBASE_PROJECT_ID = chatbot.authConfig.firebaseProjectId;
  }

  return envVars;
}

export function validateRequiredEnvVars(envVars: Record<string, string>): string[] {
  const required = [
    'NEXT_PUBLIC_CHATBOT_NAME',
    'NEXT_PUBLIC_EMBEDDING_MODEL',
    'NEXT_PUBLIC_LLM_MODEL'
  ];

  const missing: string[] = [];
  
  for (const key of required) {
    if (!envVars[key] || envVars[key].trim() === '') {
      missing.push(key);
    }
  }

  return missing;
}