import { useEffect, useState } from 'react';
import { Channel } from './types/channel';
import { fetchM3UPlaylist, fetchLanguageMap, mergeLanguageData } from './services/m3uParser';
import VideoPlayer from './components/VideoPlayer';
import ChannelList from './components/ChannelList';
import { Loader2, AlertCircle, Menu, X, Radio } from 'lucide-react';
import { Analytics } from "@vercel/analytics/react"

const PLAYLIST_URL = import.meta.env.VITE_PLAYLIST_URL;
const LANGUAGE_PLAYLIST_URL = import.meta.env.VITE_LANGUAGE_PLAYLIST_URL;

function App() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    loadChannels();
  }, []);

  const loadChannels = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [channelList, langMap] = await Promise.all([
        fetchM3UPlaylist(PLAYLIST_URL),
        fetchLanguageMap(LANGUAGE_PLAYLIST_URL),
      ]);
      const enrichedChannels = mergeLanguageData(channelList, langMap);
      setChannels(enrichedChannels);

      if (channelList.length > 0) {
        setSelectedChannel(channelList[0]);
      }
    } catch (err) {
      setError('Failed to load channels. Please try again later.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectChannel = (channel: Channel) => {
    setSelectedChannel(channel);
    setIsSidebarOpen(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="relative mx-auto mb-6 w-20 h-20">
            <div className="absolute inset-0 rounded-full bg-brand-100 animate-ping" />
            <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-white shadow-lg border border-gray-100">
              <Loader2 className="w-10 h-10 text-brand-600 animate-spin" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Loading Channels</h2>
          <p className="text-gray-400 text-sm">Preparing your streaming experience...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="card-elevated p-8 max-w-md text-center animate-fade-in">
          <div className="mx-auto mb-5 w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-brand-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Connection Error</h2>
          <p className="text-gray-500 mb-6 text-sm leading-relaxed">{error}</p>
          <button onClick={loadChannels} className="btn-primary">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <Analytics />
      {/* Header */}
      <header className="relative z-40 flex-shrink-0 h-14 sm:h-16 flex items-center justify-between px-4 sm:px-6 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="lg:hidden btn-ghost"
            aria-label="Toggle menu"
          >
            {isSidebarOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shadow-sm shadow-brand-600/25">
              <Radio className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-800 tracking-tight">
              Obito <span className="text-brand-600">Media</span>
            </h1>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-soft" />
          <span>{channels.length} channels live</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar Overlay (mobile) */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 lg:hidden animate-fade-in"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed lg:relative inset-y-0 left-0 z-40
            w-[85vw] max-w-[340px] sm:w-80 lg:w-80 xl:w-96
            transform transition-transform duration-300 ease-out
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            top-14 sm:top-16 lg:top-0
            flex-shrink-0
          `}
        >
          <ChannelList
            channels={channels}
            selectedChannel={selectedChannel}
            onSelectChannel={handleSelectChannel}
          />
        </aside>

        {/* Main Area */}
        <main className="flex-1 min-w-0 overflow-y-auto scrollbar-thin">
          <div className="p-3 sm:p-4 lg:p-6 max-w-5xl">
            {selectedChannel ? (
              <div className="animate-fade-in">
                <VideoPlayer
                  src={selectedChannel.url}
                  channelName={selectedChannel.name}
                />
              </div>
            ) : (
              <div className="h-[60vh] flex items-center justify-center">
                <div className="text-center animate-fade-in">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-center">
                    <Radio className="w-8 h-8 text-gray-300" />
                  </div>
                  <p className="text-gray-400 text-sm">Select a channel to start watching</p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
