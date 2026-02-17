import { useState, useMemo, useRef, useEffect } from 'react';
import { Channel } from '../types/channel';
import { Search, Tv, X, ChevronDown, Filter } from 'lucide-react';

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
  const [showFilters, setShowFilters] = useState(false);
  const selectedRef = useRef<HTMLButtonElement>(null);

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

  const activeFilterCount = (selectedGroup !== 'all' ? 1 : 0) + (selectedLanguage !== 'all' ? 1 : 0);

  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedChannel]);

  const clearFilters = () => {
    setSelectedGroup('all');
    setSelectedLanguage('all');
    setSearchQuery('');
  };

  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-200">
      {/* Header */}
      <div className="flex-shrink-0 p-4 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Channels
          </h2>
          <span className="text-xs text-gray-400 tabular-nums">
            {filteredChannels.length} of {channels.length}
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search channels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-10 pr-9 py-2.5 text-sm rounded-lg"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`mt-2.5 w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200
            ${showFilters || activeFilterCount > 0
              ? 'bg-brand-50 text-brand-700 border border-brand-200'
              : 'bg-gray-50 text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
        >
          <span className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="px-1.5 py-0.5 bg-brand-100 text-brand-700 rounded text-[10px] font-semibold">
                {activeFilterCount}
              </span>
            )}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} />
        </button>

        {/* Filter Dropdowns */}
        {showFilters && (
          <div className="mt-2.5 space-y-2 animate-fade-in">
            <div className="relative">
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="input-field pl-3 pr-8 py-2 text-xs appearance-none cursor-pointer"
              >
                <option value="all">All Languages</option>
                {languages.slice(1).map(language => (
                  <option key={language} value={language}>
                    {language}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>

            {groups.length > 1 && (
              <div className="relative">
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="input-field pl-3 pr-8 py-2 text-xs appearance-none cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  {groups.slice(1).map(group => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
            )}

            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="w-full text-xs text-gray-400 hover:text-gray-600 py-1.5 transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Channel List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {filteredChannels.map((channel, index) => {
          const isSelected = selectedChannel?.id === channel.id;
          return (
            <button
              key={channel.id}
              ref={isSelected ? selectedRef : null}
              onClick={() => onSelectChannel(channel)}
              className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-all duration-150 border-l-[3px] group
                ${isSelected
                  ? 'bg-brand-50 border-l-brand-600'
                  : 'border-l-transparent hover:bg-gray-50'
                }
              `}
              style={{ animationDelay: `${Math.min(index * 15, 300)}ms` }}
            >
              {/* Channel Logo */}
              <div className={`w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center transition-all duration-200
                ${isSelected ? 'bg-brand-100 ring-1 ring-brand-200' : 'bg-gray-100 group-hover:bg-gray-200/70'}
              `}>
                {channel.logo ? (
                  <img
                    src={channel.logo}
                    alt={channel.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        const fallback = document.createElement('div');
                        fallback.className = 'w-full h-full flex items-center justify-center';
                        fallback.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400"><rect width="20" height="15" x="2" y="7" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>`;
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                ) : (
                  <Tv className="w-[18px] h-[18px] text-gray-400" />
                )}
              </div>

              {/* Channel Info */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${isSelected ? 'text-brand-800' : 'text-gray-700 group-hover:text-gray-900'}`}>
                  {channel.name}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {channel.group && (
                    <span className="text-[11px] text-gray-400 truncate max-w-[120px]">
                      {channel.group}
                    </span>
                  )}
                  {channel.language && channel.group && (
                    <span className="text-gray-300">&middot;</span>
                  )}
                  {channel.language && (
                    <span className={`text-[11px] truncate max-w-[80px] ${isSelected ? 'text-accent-600' : 'text-gray-400'}`}>
                      {channel.language}
                    </span>
                  )}
                </div>
              </div>

              {/* Active Indicator */}
              {isSelected && (
                <div className="flex-shrink-0 w-2 h-2 rounded-full bg-brand-500 animate-pulse-soft" />
              )}
            </button>
          );
        })}

        {filteredChannels.length === 0 && (
          <div className="p-8 text-center animate-fade-in">
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gray-100 flex items-center justify-center">
              <Search className="w-5 h-5 text-gray-300" />
            </div>
            <p className="text-gray-500 text-sm mb-1">No channels found</p>
            <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
            {(searchQuery || activeFilterCount > 0) && (
              <button
                onClick={clearFilters}
                className="mt-3 text-xs text-brand-600 hover:text-brand-700 transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
