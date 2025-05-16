import { 
  MessageParam
} from '@anthropic-ai/sdk';
import Anthropic from '@anthropic-ai/sdk';

// Types and interfaces
export interface AIConfig {
  apiKey: string;
  model?: string;
  maxRetries?: number;
  temperature?: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  name?: string;
}

export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface AIServiceResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  functionCall?: {
    name: string;
    arguments: string;
  };
}

export class AIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'AIError';
  }
}

export class AIService {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxRetries: number;
  private readonly temperature: number;
  private client: Anthropic;

  constructor(config: AIConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'claude-3-opus-20240229';
    this.maxRetries = config.maxRetries || 3;
    this.temperature = config.temperature || 0.7;
    
    // Initialize Anthropic client
    this.initializeClient();
  }

  private initializeClient(): void {
    try {
      this.client = new Anthropic({
        apiKey: this.apiKey
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new AIError(error.message, 500);
      }
      throw new AIError('Failed to initialize Anthropic client', 500);
    }
  }

  /**
   * Sends a single message to Claude and gets a response
   */
  public async sendMessage(
    message: string,
    systemPrompt?: string
  ): Promise<AIServiceResponse> {
    const messages: MessageParam[] = [];
    
    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt
      });
    }

    messages.push({
      role: 'user',
      content: message
    });

    return this.createChatCompletion(messages);
  }

  /**
   * Handles a conversation with multiple messages
   */
  public async chat(
    messages: ChatMessage[],
    systemPrompt?: string
  ): Promise<AIServiceResponse> {
    const formattedMessages: MessageParam[] = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      ...(msg.name && { name: msg.name })
    }));

    if (systemPrompt) {
      formattedMessages.unshift({
        role: 'system',
        content: systemPrompt
      });
    }

    return this.createChatCompletion(formattedMessages);
  }

  /**
   * Creates a chat completion with function calling capabilities
   */
  public async createChatCompletionWithFunctions(
    messages: ChatMessage[],
    functions: FunctionDefinition[],
    systemPrompt?: string
  ): Promise<AIServiceResponse> {
    const formattedMessages: MessageParam[] = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      ...(msg.name && { name: msg.name })
    }));

    if (systemPrompt) {
      formattedMessages.unshift({
        role: 'system',
        content: systemPrompt
      });
    }

    return this.createChatCompletion(formattedMessages, functions);
  }

  /**
   * Core method to create chat completions
   */
  private async createChatCompletion(
    messages: MessageParam[],
    functions?: FunctionDefinition[]
  ): Promise<AIServiceResponse> {
    let attempts = 0;
    
    while (attempts < this.maxRetries) {
      try {
        const response = await this.client.messages.create({
          model: this.model,
          messages: messages,
          temperature: this.temperature,
          ...(functions && { tools: functions })
        });

        return {
          content: response.content[0].text,
          usage: {
            promptTokens: response.usage?.input_tokens || 0,
            completionTokens: response.usage?.output_tokens || 0,
            totalTokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
          },
          ...(response.tool_calls && {
            functionCall: {
              name: response.tool_calls[0].function.name,
              arguments: response.tool_calls[0].function.arguments
            }
          })
        };
      } catch (error: unknown) {
        attempts++;
        
        if (attempts === this.maxRetries) {
          if (error instanceof Error) {
            throw new AIError(
              error.message,
              'status' in error ? (error as { status: number }).status : 500,
              'code' in error ? (error as { code: string }).code : undefined
            );
          }
          throw new AIError('Failed to create chat completion', 500);
        }
        
        // Exponential backoff
        await new Promise(resolve => 
          setTimeout(resolve, Math.pow(2, attempts) * 1000)
        );
      }
    }

    throw new AIError('Max retries exceeded', 500);
  }

  /**
   * Stream chat completions
   */
  public async streamChatCompletion(
    messages: ChatMessage[],
    systemPrompt?: string,
    onToken?: (token: string) => void
  ): Promise<AIServiceResponse> {
    const formattedMessages: MessageParam[] = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      ...(msg.name && { name: msg.name })
    }));

    if (systemPrompt) {
      formattedMessages.unshift({
        role: 'system',
        content: systemPrompt
      });
    }

    try {
      const stream = await this.client.messages.create({
        model: this.model,
        messages: formattedMessages,
        temperature: this.temperature,
        stream: true
      });

      let fullContent = '';

      for await (const chunk of stream) {
        const token = chunk.content[0]?.text || '';
        fullContent += token;
        
        if (onToken) {
          onToken(token);
        }
      }

      return {
        content: fullContent
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new AIError(
          error.message,
          'status' in error ? (error as { status: number }).status : 500,
          'code' in error ? (error as { code: string }).code : undefined
        );
      }
      throw new AIError('Failed to stream chat completion', 500);
    }
  }

  /**
   * Utility method to count tokens in a message
   */
  public async countTokens(text: string): Promise<number> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        messages: [{ role: 'user', content: text }],
        max_tokens: 1
      });
      
      return response.usage?.input_tokens || 0;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new AIError(
          error.message,
          'status' in error ? (error as { status: number }).status : 500,
          'code' in error ? (error as { code: string }).code : undefined
        );
      }
      throw new AIError('Failed to count tokens', 500);
    }
  }
}
