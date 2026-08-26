'use strict';

const Anthropic = require('@anthropic-ai/sdk');

class ClaudeClient {
  /** @param {{apiKey: string, model: string}} config */
  constructor(config) {
    this.model = config.model;
    this.client = new Anthropic({ apiKey: config.apiKey });
  }

  /**
   * Sends a message and returns the text of the first text block.
   * @param {{system?: string, prompt: string, maxTokens?: number}} opts
   */
  async complete({ system, prompt, maxTokens = 4096 }) {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    return textBlock ? textBlock.text : '';
  }

  /**
   * Sends a message and parses the response as JSON, tolerating markdown
   * code fences that Claude sometimes wraps JSON in.
   */
  async completeJson(opts) {
    const raw = await this.complete(opts);
    return parseJsonLoose(raw);
  }
}

function parseJsonLoose(raw) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch (err) {
    throw new Error(
      `Failed to parse JSON from Claude response: ${err.message}\n--- raw response ---\n${raw}`
    );
  }
}

module.exports = { ClaudeClient, parseJsonLoose };
