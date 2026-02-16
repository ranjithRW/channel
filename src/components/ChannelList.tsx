import { useState, useMemo } from 'react';
import { Channel } from '../types/channel';
import { Search, Tv } from 'lucide-react';

interface ChannelListProps {
  channels: Channel[];
  selectedChannel: Channel | null;
  onSelectChannel: (channel: Channel) => void;
}

export default function ChannelList({
  channels,
  selectedChannel,
  onSelectChannel,
}: ChannelListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');

  const groups = useMemo(() => {
    const groupSet = new Set<string>();
    channels.forEach(channel => {
      if (channel.group) groupSet.add(channel.group);
    });
    return ['all', ...Array.from(groupSet).sort()];
  }, [channels]);

  const languages = useMemo(() => {
    const langSet = new Set<string>();
    channels.forEach(channel => {
      if (channel.language) {
        channel.language.split(';').forEach(lang => {
          const trimmed = lang.trim();
          if (trimmed) langSet.add(trimmed);
        });
      }
    });
    return ['all', ...Array.from(langSet).sort()];
  }, [channels]);

  const filteredChannels = useMemo(() => {
    return channels.filter(channel => {
      const matchesSearch = channel.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesGroup =
        selectedGroup === 'all' || channel.group === selectedGroup;
      const matchesLanguage =
        selectedLanguage === 'all' ||
        (channel.language &&
          channel.language
            .split(';')
            .map(l => l.trim())
            .includes(selectedLanguage));
      return matchesSearch && matchesGroup && matchesLanguage;
    });
  }, [channels, searchQuery, selectedGroup, selectedLanguage]);

  return (
    <div className="h-full flex flex-col bg-white shadow-lg">
      <div className="p-4 border-b">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Tv className="w-6 h-6" />
          Channels ({filteredChannels.length})
        </h2>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search channels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-col gap-2">
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="all">All Languages</option>
            {languages.slice(1).map(language => (
              <option key={language} value={language}>
                {language}
              </option>
            ))}
          </select>

          {groups.length > 1 && (
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="all">All Categories</option>
              {groups.slice(1).map(group => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredChannels.map((channel) => (
          <button
            key={channel.id}
            onClick={() => onSelectChannel(channel)}
            className={`w-full p-4 flex items-center gap-3 hover:bg-gray-50 border-b transition ${
              selectedChannel?.id === channel.id
                ? 'bg-blue-50 border-l-4 border-l-blue-500'
                : ''
            }`}
          >
            <div className="w-12 h-12 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden">
              {channel.logo ? (
                <img
                  src={channel.logo}
                  alt={channel.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <Tv className="w-6 h-6" />
                </div>
              )}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="font-medium text-gray-800 line-clamp-1">
                {channel.name}
              </p>
              <div className="flex items-center gap-2">
                {channel.group && (
                  <p className="text-xs text-gray-500 line-clamp-1">
                    {channel.group}
                  </p>
                )}
                {channel.language && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded flex-shrink-0">
                    {channel.language}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}

        {filteredChannels.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No channels found
          </div>
        )}
      </div>
    </div>
  );
}
