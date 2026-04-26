import axios from 'axios';
import config from '../config/index.js';
import logger from './logger.js';

class LLMService {
  constructor() {
    this.provider = config.ai.provider;
    // OpenAI client
    this.openaiClient = axios.create({
      baseURL: config.ai.openai.endpoint,
      headers: {
        'Authorization': `Bearer ${config.ai.openai.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    // HuggingFace client
    this.huggingfaceClient = axios.create({
      baseURL: 'https://api-inference.huggingface.co/models',
      headers: {
        'Authorization': `Bearer ${config.ai.huggingface.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    // Gemini client
    this.geminiClient = axios.create({
      baseURL: config.ai.gemini.endpoint,
      headers: {
        'Content-Type': 'application/json',
      },
      params: {
        key: config.ai.gemini.apiKey,
      },
    });
  }

  async generateCompletion(prompt, maxTokens = 2000, options = {}) {
    try {
      const provider = options.provider || this.provider;
      const systemPrompt = options.systemPrompt || 'You are an expert software testing specialist and QA automation engineer.';

      if (provider === 'openai') {
        if (!config.ai.openai.apiKey) {
          logger.warn('OpenAI API key not configured, returning mock response');
          return this.getMockResponse(prompt);
        }
        const response = await this.openaiClient.post('/chat/completions', {
          model: options.model || config.ai.openai.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          temperature: typeof options.temperature === 'number' ? options.temperature : config.ai.openai.temperature,
          max_tokens: maxTokens,
        });
        const content = response.data.choices[0].message.content;
        const tokens = response.data.usage;
        logger.info(`AI completion (OpenAI) generated. Tokens used: ${tokens.total}`);
        return { success: true, content, tokens, provider: 'openai' };
      }

      if (provider === 'huggingface') {
        if (!config.ai.huggingface.apiKey) {
          logger.warn('HuggingFace API key not configured, returning mock response');
          return this.getMockResponse(prompt);
        }
        const model = options.model || config.ai.huggingface.model;
        const response = await this.huggingfaceClient.post(`/${model}`, {
          inputs: prompt,
          parameters: { max_new_tokens: maxTokens },
        });
        const content = Array.isArray(response.data)
          ? response.data[0]?.generated_text || ''
          : response.data.generated_text || JSON.stringify(response.data);
        logger.info(`AI completion (HuggingFace) generated.`);
        return { success: true, content, tokens: {}, provider: 'huggingface' };
      }

      if (provider === 'gemini') {
        if (!config.ai.gemini.apiKey) {
          logger.warn('Gemini API key not configured, returning mock response');
          return this.getMockResponse(prompt);
        }
        const model = options.model || config.ai.gemini.model;
        // Gemini expects POST to /{model}:generateContent
        const response = await this.geminiClient.post(`/${model}:generateContent`, {
          contents: [
            { role: 'user', parts: [{ text: prompt }] },
          ],
          generationConfig: {
            maxOutputTokens: maxTokens,
          },
        });
        const content = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        logger.info(`AI completion (Gemini) generated.`);
        return { success: true, content, tokens: {}, provider: 'gemini' };
      }

      // Default fallback
      logger.warn('Unknown provider or not configured, using mock response');
      return this.getMockResponse(prompt);
    } catch (error) {
      logger.error(`LLM API Error: ${error.message}`);
      if (error.response?.status === 401) {
        logger.warn('Invalid LLM API key, using mock response');
        return this.getMockResponse(prompt);
      }
      throw error;
    }
  }

  getMockResponse(prompt) {
    logger.info('Using mock LLM response (API not configured)');
    
    // Extract requirement text from prompt to create realistic mock test cases
    const requirementMatch = prompt.match(/Requirement:\s*"([^"]+)"/i) || prompt.match(/Requirement:\s*([^.]+)/i);
    const requirement = requirementMatch ? requirementMatch[1] : 'Default functionality';
    
    const mockTestCases = [
      {
        scenario: `Verify basic ${requirement}`,
        preconditions: ['User is logged in', 'System is accessible'],
        steps: ['Navigate to feature', 'Perform action', 'Verify result'],
        expectedResults: 'Feature works as expected',
        priority: 'High',
        category: 'functional'
      },
      {
        scenario: `Verify ${requirement} with valid inputs`,
        preconditions: ['User is logged in', 'Test data available'],
        steps: ['Input valid data', 'Submit request', 'Verify processing'],
        expectedResults: 'Request processed successfully',
        priority: 'High',
        category: 'functional'
      },
      {
        scenario: `Verify ${requirement} with invalid inputs`,
        preconditions: ['User is logged in'],
        steps: ['Input invalid data', 'Submit request', 'Check error handling'],
        expectedResults: 'Error message displayed, data not processed',
        priority: 'High',
        category: 'negative'
      },
      {
        scenario: `Verify edge case for ${requirement}`,
        preconditions: ['User is logged in', 'Boundary data available'],
        steps: ['Input boundary value', 'Submit request', 'Verify behavior'],
        expectedResults: 'System handles boundary case correctly',
        priority: 'Medium',
        category: 'edge'
      },
      {
        scenario: `Verify security for ${requirement}`,
        preconditions: ['User is logged in'],
        steps: ['Attempt unauthorized access', 'Try to bypass security', 'Verify protection'],
        expectedResults: 'Security measures prevent unauthorized access',
        priority: 'High',
        category: 'security'
      },
      {
        scenario: `Verify performance of ${requirement}`,
        preconditions: ['System is under normal load'],
        steps: ['Execute operation', 'Monitor response time', 'Check resource usage'],
        expectedResults: 'Response time within acceptable limits',
        priority: 'Medium',
        category: 'functional'
      },
      {
        scenario: `Verify ${requirement} with empty inputs`,
        preconditions: ['User is logged in'],
        steps: ['Leave fields empty', 'Submit request', 'Check validation'],
        expectedResults: 'Validation error displayed',
        priority: 'Medium',
        category: 'negative'
      }
    ];

    return {
      success: true,
      content: JSON.stringify(mockTestCases),
      tokens: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      provider: 'mock',
    };
  }

  async parseJSON(text) {
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      logger.error(`JSON parsing error: ${error.message}`);
      throw error;
    }
  }
}

export default new LLMService();
