import { useEffect, useState } from 'react';
import { Channel } from './types/channel';
import { fetchM3UPlaylist, fetchLanguageMap, mergeLanguageData } from './services/m3uParser';
import VideoPlayer from './components/VideoPlayer';
import ChannelList from './components/ChannelList';
import { Loader2, AlertCircle, Menu, X } from 'lucide-react';

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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Loading channels...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={loadChannels}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-blue-50 to-gray-100">
      <header className="bg-white shadow-md px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition"
          >
            {isSidebarOpen ? (
              <X className="w-6 h-6 text-gray-700" />
            ) : (
              <Menu className="w-6 h-6 text-gray-700" />
            )}
          </button>
          <h1 className="text-2xl font-bold text-gray-800">IPTV Player</h1>
        </div>
        <div className="text-sm text-gray-600">
          {channels.length} channels available
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside
          className={`
            w-80 lg:block fixed lg:relative inset-y-0 left-0 z-30 transform transition-transform duration-300
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            mt-16 lg:mt-0
          `}
        >
          <ChannelList
            channels={channels}
            selectedChannel={selectedChannel}
            onSelectChannel={handleSelectChannel}
          />
        </aside>

        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {selectedChannel ? (
            <VideoPlayer
              src={selectedChannel.url}
              channelName={selectedChannel.name}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <p>Select a channel to start watching</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
