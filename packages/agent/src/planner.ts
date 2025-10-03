/**
 * Intent classifier and planner for determining which connectors to use
 */

export type Intent = 'coding' | 'career' | 'branding' | 'general';

export interface Plan {
  useGithub: boolean;
  useRss: boolean;
  useResume: boolean;
  useTwitter: boolean;
  forceFresh: boolean;
  maxResults: number;
}

/**
 * Classify user intent from message
 */
export function classifyIntent(message: string): Intent {
  const lower = message.toLowerCase();

  // Coding-related keywords
  if (
    lower.includes('code') ||
    lower.includes('repo') ||
    lower.includes('github') ||
    lower.includes('project') ||
    lower.includes('programming') ||
    lower.includes('technical') ||
    lower.includes('library') ||
    lower.includes('framework')
  ) {
    return 'coding';
  }

  // Career-related keywords
  if (
    lower.includes('job') ||
    lower.includes('career') ||
    lower.includes('resume') ||
    lower.includes('cv') ||
    lower.includes('experience') ||
    lower.includes('work') ||
    lower.includes('role') ||
    lower.includes('position') ||
    lower.includes('hire') ||
    lower.includes('interview')
  ) {
    return 'career';
  }

  // Branding/social keywords
  if (
    lower.includes('tweet') ||
    lower.includes('twitter') ||
    lower.includes('social') ||
    lower.includes('blog') ||
    lower.includes('article') ||
    lower.includes('post') ||
    lower.includes('brand') ||
    lower.includes('online presence')
  ) {
    return 'branding';
  }

  return 'general';
}

/**
 * Check if message requests fresh data
 */
export function needsFreshData(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('latest') ||
    lower.includes('recent') ||
    lower.includes('today') ||
    lower.includes('this week') ||
    lower.includes('refresh') ||
    lower.includes('update')
  );
}

/**
 * Create execution plan based on intent and message
 */
export function makePlan(message: string): Plan {
  const intent = classifyIntent(message);
  const forceFresh = needsFreshData(message);

  // Default plan
  const plan: Plan = {
    useGithub: false,
    useRss: false,
    useResume: false,
    useTwitter: false,
    forceFresh,
    maxResults: 10,
  };

  switch (intent) {
    case 'coding':
      plan.useGithub = true;
      plan.useResume = true;
      plan.maxResults = 15;
      break;

    case 'career':
      plan.useResume = true;
      plan.useGithub = true;
      plan.maxResults = 10;
      break;

    case 'branding':
      plan.useTwitter = true;
      plan.useRss = true;
      plan.maxResults = 20;
      break;

    case 'general':
      // Use all sources
      plan.useGithub = true;
      plan.useRss = true;
      plan.useResume = true;
      plan.useTwitter = true;
      plan.maxResults = 10;
      break;
  }

  return plan;
}

