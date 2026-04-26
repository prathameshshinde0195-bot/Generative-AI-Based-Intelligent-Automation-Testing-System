const config = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5000,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_in_production_12345',
    expire: process.env.JWT_EXPIRE || '7d',
  },

  // LLM/AI Configuration
  ai: {
    provider: process.env.AI_PROVIDER || 'openai', // 'openai', 'huggingface', 'gemini', 'claude', 'local'
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      endpoint: process.env.LLM_API_ENDPOINT || 'https://api.openai.com/v1',
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 2000,
    },
    huggingface: {
      apiKey: process.env.HUGGINGFACE_API_KEY || '',
      model: process.env.HUGGINGFACE_MODEL || 'mistralai/Mistral-7B-Instruct-v0.1',
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
      endpoint: process.env.GEMINI_API_ENDPOINT || 'https://generativelanguage.googleapis.com/v1beta/models',
    },
  },

  // Rate Limiting
  rateLimit: {
    windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000,
    max: process.env.RATE_LIMIT_MAX || 100,
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
  },

  // Features
  features: {
    emailNotifications: process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true',
    webhooks: process.env.ENABLE_WEBHOOKS === 'true',
    analytics: process.env.ENABLE_ANALYTICS === 'true',
  },
};

export default config;
