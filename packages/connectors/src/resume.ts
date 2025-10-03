import { readFile } from 'fs/promises';
import pdfParse from 'pdf-parse';
import { sha256 } from '@youagent/utils/hash';
import { now } from '@youagent/utils/date';
import { ConnectorError } from '@youagent/utils/errors';
import type { SourceItem } from './types.js';

export interface ResumeConnectorOptions {
  pdfPath: string;
}

/**
 * Resume connector - parses PDF resume
 *
 * Note: This is a simple text extraction. For better structured data,
 * consider using a dedicated resume parsing service.
 */
export class ResumeConnector {
  constructor(private options: ResumeConnectorOptions) {}

  async fetch(): Promise<SourceItem[]> {
    const items: SourceItem[] = [];
    const fetchedAt = now();

    try {
      const buffer = await readFile(this.options.pdfPath);
      const data = await pdfParse(buffer);
      const text = data.text;

      // Extract full resume text
      items.push({
        id: 'resume-full',
        source: 'resume',
        sourceId: 'full',
        contentType: 'fact',
        title: 'Full Resume',
        content: text,
        contentHash: sha256(text),
        metadata: {
          pages: data.numpages,
        },
        fetchedAt,
      });

      // Try to extract sections (very basic heuristic)
      const sections = this.extractSections(text);

      for (const [sectionName, sectionContent] of Object.entries(sections)) {
        items.push({
          id: `resume-section-${sectionName.toLowerCase().replace(/\s+/g, '-')}`,
          source: 'resume',
          sourceId: sectionName,
          contentType: 'fact',
          title: `Resume: ${sectionName}`,
          content: sectionContent,
          contentHash: sha256(sectionContent),
          fetchedAt,
        });
      }

      return items;
    } catch (error) {
      throw new ConnectorError('Resume parsing failed', { cause: error });
    }
  }

  private extractSections(text: string): Record<string, string> {
    const sections: Record<string, string> = {};

    // Common section headers (case insensitive)
    const sectionHeaders = [
      'experience',
      'work experience',
      'education',
      'skills',
      'projects',
      'certifications',
      'summary',
      'objective',
    ];

    const lines = text.split('\n');
    let currentSection: string | null = null;
    let currentContent: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      const lower = trimmed.toLowerCase();

      // Check if line is a section header
      const matchedHeader = sectionHeaders.find(
        (header) => lower === header || lower.startsWith(header)
      );

      if (matchedHeader) {
        // Save previous section
        if (currentSection && currentContent.length > 0) {
          sections[currentSection] = currentContent.join('\n').trim();
        }

        // Start new section
        currentSection = trimmed;
        currentContent = [];
      } else if (currentSection) {
        currentContent.push(line);
      }
    }

    // Save last section
    if (currentSection && currentContent.length > 0) {
      sections[currentSection] = currentContent.join('\n').trim();
    }

    return sections;
  }
}

