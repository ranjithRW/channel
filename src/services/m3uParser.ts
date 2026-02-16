import { Channel } from '../types/channel';

export async function fetchM3UPlaylist(url: string): Promise<Channel[]> {
  try {
    const response = await fetch(url);
    const text = await response.text();
    return parseM3U(text);
  } catch (error) {
    console.error('Error fetching M3U playlist:', error);
    throw new Error('Failed to fetch playlist');
  }
}

export async function fetchLanguageMap(url: string): Promise<Map<string, string>> {
  try {
    const response = await fetch(url);
    const text = await response.text();
    return buildLanguageMap(text);
  } catch (error) {
    console.error('Error fetching language M3U:', error);
    return new Map();
  }
}

function buildLanguageMap(content: string): Map<string, string> {
  const lines = content.split('\n').map(line => line.trim());
  const langMap = new Map<string, string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('#EXTINF:')) {
      const nextLine = lines[i + 1];
      if (!nextLine || nextLine.startsWith('#')) continue;

      const language = extractAttribute(line, 'group-title');
      const streamUrl = nextLine.trim();

      if (language && streamUrl) {
        const existing = langMap.get(streamUrl);
        if (existing) {
          if (!existing.split(';').includes(language)) {
            langMap.set(streamUrl, existing + ';' + language);
          }
        } else {
          langMap.set(streamUrl, language);
        }
      }
    }
  }

  return langMap;
}

export function mergeLanguageData(channels: Channel[], langMap: Map<string, string>): Channel[] {
  return channels.map(channel => ({
    ...channel,
    language: langMap.get(channel.url) || undefined,
  }));
}

export function parseM3U(content: string): Channel[] {
  const lines = content.split('\n').map(line => line.trim());
  const channels: Channel[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('#EXTINF:')) {
      const nextLine = lines[i + 1];
      if (!nextLine || nextLine.startsWith('#')) continue;

      const name = extractChannelName(line);
      const logo = extractAttribute(line, 'tvg-logo');
      const group = extractAttribute(line, 'group-title');
      const language = extractAttribute(line, 'tvg-language');

      channels.push({
        id: `channel-${channels.length}`,
        name: name || `Channel ${channels.length + 1}`,
        url: nextLine.trim(),
        logo,
        group,
        language,
      });
    }
  }

  return channels;
}

function extractChannelName(line: string): string {
  const match = line.match(/,(.+)$/);
  return match ? match[1].trim() : '';
}

function extractAttribute(line: string, attribute: string): string | undefined {
  const regex = new RegExp(`${attribute}="([^"]*)"`, 'i');
  const match = line.match(regex);
  return match ? match[1] : undefined;
}
