import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface AgentRule {
  id: string;
  pattern: string;
  severity: 'blocker' | 'major' | 'minor';
}

export interface DocPairConfig {
  code: string;
  doc: string;
  severity: 'blocker' | 'major';
}

export interface AgentConfig {
  name: string;
  enabled: boolean;
  threshold: number;
  zones: string[];
  skills: string[];
  rules: AgentRule[];
  pairedDocs: DocPairConfig[];
  extensionSkill?: string;
}

export interface ReviewConfig {
  base?: string;
  secretAllowlist: string[];
  persona: 'twitch' | 'plain';
  agents: AgentConfig[];
}

export const CONFIG_PATH = '.claude/review.config.json';

const agentDefault = (name: string, threshold: number): AgentConfig => ({
  name,
  enabled: true,
  threshold,
  zones: ['**/*'],
  skills: [],
  rules: [],
  pairedDocs: [],
});

export const DEFAULT_CONFIG: ReviewConfig = {
  secretAllowlist: [],
  persona: 'twitch',
  agents: [
    agentDefault('conventions', 7),
    agentDefault('architecture', 8),
    agentDefault('tests', 7),
    agentDefault('docs', 8),
    agentDefault('security', 9),
  ],
};

const mergeAgent = (base: AgentConfig, override: Partial<AgentConfig>): AgentConfig => ({
  ...base,
  ...override,
});

/**
 * Read `.claude/review.config.json` under `cwd`. Returns DEFAULT_CONFIG when absent; otherwise
 * deep-merges a partial file over the defaults (per-agent override by name, extra agents appended).
 */
export const loadConfig = (cwd: string = process.cwd()): ReviewConfig => {
  const path = join(cwd, CONFIG_PATH);
  if (!existsSync(path)) {
    return DEFAULT_CONFIG;
  }
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<ReviewConfig>;
  const agents = DEFAULT_CONFIG.agents.map((base) => {
    const override = parsed.agents?.find((agent) => agent.name === base.name);
    return override ? mergeAgent(base, override) : base;
  });
  const extra = (parsed.agents ?? []).filter(
    (agent) => !DEFAULT_CONFIG.agents.some((base) => base.name === agent.name),
  ) as AgentConfig[];
  return {
    base: parsed.base ?? DEFAULT_CONFIG.base,
    secretAllowlist: parsed.secretAllowlist ?? DEFAULT_CONFIG.secretAllowlist,
    persona: parsed.persona ?? DEFAULT_CONFIG.persona,
    agents: [...agents, ...extra],
  };
};
