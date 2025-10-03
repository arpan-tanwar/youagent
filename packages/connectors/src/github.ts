import { safeFetch } from '@youagent/utils/http';
import { sha256 } from '@youagent/utils/hash';
import { now } from '@youagent/utils/date';
import { ConnectorError } from '@youagent/utils/errors';
import { z } from 'zod';
import type { SourceItem } from './types.js';

const githubProfileSchema = z.object({
  login: z.string(),
  name: z.string().nullable(),
  bio: z.string().nullable(),
  public_repos: z.number(),
  followers: z.number(),
  following: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

const githubRepoSchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  description: z.string().nullable(),
  html_url: z.string(),
  language: z.string().nullable(),
  stargazers_count: z.number(),
  forks_count: z.number(),
  updated_at: z.string(),
  pushed_at: z.string(),
  topics: z.array(z.string()).optional(),
});

export interface GitHubConnectorOptions {
  token: string;
  username: string;
}

/**
 * GitHub connector - fetches profile, repos, and READMEs
 */
export class GitHubConnector {
  constructor(private options: GitHubConnectorOptions) {}

  async fetch(): Promise<SourceItem[]> {
    const items: SourceItem[] = [];
    const fetchedAt = now();

    try {
      // Fetch profile
      const profile = await this.getProfile();
      items.push({
        id: `github-profile-${this.options.username}`,
        source: 'github',
        sourceId: this.options.username,
        contentType: 'profile',
        title: `${profile.name ?? profile.login}'s GitHub Profile`,
        content: profile.bio ?? 'No bio available',
        url: `https://github.com/${this.options.username}`,
        publishedAt: profile.created_at,
        contentHash: sha256(JSON.stringify(profile)),
        metadata: {
          public_repos: profile.public_repos,
          followers: profile.followers,
          following: profile.following,
        },
        fetchedAt,
      });

      // Fetch repos (top 20 by update date)
      const repos = await this.listRepos({ sort: 'updated', perPage: 20 });

      for (const repo of repos) {
        const content = [
          repo.description ?? '',
          `Language: ${repo.language ?? 'Unknown'}`,
          `Stars: ${repo.stargazers_count}`,
          `Forks: ${repo.forks_count}`,
          repo.topics && repo.topics.length > 0 ? `Topics: ${repo.topics.join(', ')}` : '',
        ]
          .filter(Boolean)
          .join('\n');

        items.push({
          id: `github-repo-${repo.id}`,
          source: 'github',
          sourceId: repo.id.toString(),
          contentType: 'repo',
          title: repo.full_name,
          content,
          url: repo.html_url,
          publishedAt: repo.pushed_at,
          contentHash: sha256(content),
          metadata: {
            language: repo.language,
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            topics: repo.topics,
          },
          fetchedAt,
        });

        // Optionally fetch README for top repos
        if (repo.stargazers_count > 5 || repos.indexOf(repo) < 5) {
          try {
            const readme = await this.getReadme(repo.full_name);
            if (readme) {
              items.push({
                id: `github-readme-${repo.id}`,
                source: 'github',
                sourceId: `readme-${repo.id}`,
                contentType: 'repo',
                title: `${repo.full_name} README`,
                content: readme,
                url: `${repo.html_url}#readme`,
                publishedAt: repo.pushed_at,
                contentHash: sha256(readme),
                metadata: { repo: repo.full_name },
                fetchedAt,
              });
            }
          } catch (error) {
            // README fetch optional - continue on error
            console.warn(`Failed to fetch README for ${repo.full_name}`);
          }
        }
      }

      return items;
    } catch (error) {
      throw new ConnectorError('GitHub fetch failed', { cause: error });
    }
  }

  private async getProfile(): Promise<z.infer<typeof githubProfileSchema>> {
    const response = await safeFetch(`https://api.github.com/users/${this.options.username}`, {
      headers: {
        Authorization: `Bearer ${this.options.token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    return githubProfileSchema.parse(JSON.parse(response.body));
  }

  private async listRepos(options: {
    sort?: 'updated' | 'pushed' | 'created';
    perPage?: number;
  }): Promise<z.infer<typeof githubRepoSchema>[]> {
    const { sort = 'updated', perPage = 20 } = options;

    const response = await safeFetch(
      `https://api.github.com/users/${this.options.username}/repos?sort=${sort}&per_page=${perPage}`,
      {
        headers: {
          Authorization: `Bearer ${this.options.token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    const repos = z.array(githubRepoSchema).parse(JSON.parse(response.body));
    return repos;
  }

  private async getReadme(fullName: string): Promise<string | null> {
    try {
      const response = await safeFetch(`https://api.github.com/repos/${fullName}/readme`, {
        headers: {
          Authorization: `Bearer ${this.options.token}`,
          Accept: 'application/vnd.github.v3.raw',
        },
      });

      // Limit README size
      const content = response.body.substring(0, 10000);
      return content;
    } catch {
      return null;
    }
  }
}

