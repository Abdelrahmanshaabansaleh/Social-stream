import React, { useState } from 'react';
import { 
  Download, 
  Link as LinkIcon, 
  Loader2, 
  AlertCircle, 
  Facebook, 
  Linkedin, 
  Twitter, 
  Play, 
  ExternalLink,
  ShieldCheck,
  Video
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface VideoInfo {
  title: string;
  thumbnail?: string;
  downloadUrl: string;
  source: string;
}

const SUPPORTED_PLATFORMS = [
  { name: 'TikTok', icon: Play, color: 'text-pink-500' },
  { name: 'Facebook', icon: Facebook, color: 'text-blue-600' },
  { name: 'Twitter', icon: Twitter, color: 'text-sky-400' },
  { name: 'LinkedIn', icon: Linkedin, color: 'text-blue-700' },
];

export default function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [fetchMessage, setFetchMessage] = useState('Fetching...');

  const handleFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError(null);
    setVideoInfo(null);

    // Dynamic message for longer fetch times
    const timeoutMsg = setTimeout(() => {
      setFetchMessage('Analyzing page components...');
    }, 2000);

    try {
      const response = await fetch('/api/fetch-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch video');
      }

      setVideoInfo(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      clearTimeout(timeoutMsg);
      setLoading(false);
      setFetchMessage('Fetching...');
    }
  };

  const downloadVideo = (proxy: boolean = false) => {
    if (!videoInfo) return;
    
    if (proxy) {
      window.location.href = `/api/proxy-download?url=${encodeURIComponent(videoInfo.downloadUrl)}&filename=${encodeURIComponent(videoInfo.title.substring(0, 30))}.mp4`;
    } else {
      window.open(videoInfo.downloadUrl, '_blank');
    }
  };

  // Helper to get proxied video URL for playback
  const getStreamUrl = (originalUrl: string) => {
    return `/api/proxy-stream?url=${encodeURIComponent(originalUrl)}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-indigo-100 flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-slate-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-md flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-white rotate-45"></div>
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-800">SOCIALSTREAM</span>
          </div>
          <div className="hidden md:flex gap-8 text-sm font-medium text-slate-500">
            <span className="hover:text-indigo-600 cursor-pointer transition-colors">How it Works</span>
            <span className="hover:text-indigo-600 cursor-pointer transition-colors">Supported Sites</span>
            <span className="text-indigo-600">Mobile App</span>
          </div>
          <button className="px-5 py-2 rounded-full border border-slate-300 text-sm font-semibold hover:bg-slate-50 transition-colors">
            Go Premium
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-6 lg:px-12 py-12 sm:py-20 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:32px_32px]">
        <div className="w-full max-w-4xl flex flex-col items-center gap-10">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl sm:text-6xl font-black text-slate-900 leading-tight tracking-tighter"
            >
              Download Social Media <br/>
              <span className="text-indigo-600">Videos Instantly.</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-lg text-slate-500 max-w-2xl mx-auto"
            >
              High-quality video downloader for TikTok (no watermark), Facebook, LinkedIn, and more. Simple, secure, and always free.
            </motion.p>
          </div>

          {/* Input Form */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="w-full p-4 bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-200 flex flex-col sm:flex-row items-center gap-4"
          >
            <div className="flex-1 w-full flex items-center px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 group focus-within:border-indigo-200 transition-colors">
              <LinkIcon className="w-5 h-5 text-slate-400 mr-3" />
              <input 
                type="text" 
                placeholder="Paste video link here..." 
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="bg-transparent w-full outline-none text-slate-700 placeholder-slate-400 font-medium"
                onKeyDown={(e) => e.key === 'Enter' && handleFetch(e as any)}
              />
            </div>
            <button 
              onClick={handleFetch}
              disabled={loading || !url}
              className="w-full sm:w-auto px-10 py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="uppercase">{fetchMessage}</span>
                </div>
              ) : (
                "DOWNLOAD"
              )}
            </button>
          </motion.div>

          {/* Supported Platforms */}
          <div className="w-full grid grid-cols-2 sm:grid-cols-5 gap-4">
            {SUPPORTED_PLATFORMS.map((platform) => (
              <div key={platform.name} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col items-center gap-2 group cursor-default">
                <div className={`w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center transition-all duration-300 ${platform.color.replace('text-', 'bg-').replace('-500', '-600').replace('-600', '-700')} bg-opacity-0 group-hover:bg-opacity-100 text-slate-400 group-hover:text-white`}>
                  <platform.icon size={20} />
                </div>
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{platform.name}</span>
              </div>
            ))}
          </div>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-8 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-4"
            >
              <div className="p-2 bg-red-100 rounded-full">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-red-900">Wait, something went wrong</h3>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Result Card */}
        <AnimatePresence>
          {videoInfo && (
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-12 w-full bg-white rounded-2xl border border-slate-200 shadow-2xl shadow-slate-200/50 overflow-hidden"
            >
              <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100">
                {/* Preview */}
                <div className="md:w-2/5 relative aspect-video md:aspect-square bg-slate-950 flex items-center justify-center overflow-hidden group">
                  <video 
                    key={videoInfo.downloadUrl}
                    src={getStreamUrl(videoInfo.downloadUrl)} 
                    poster={videoInfo.thumbnail}
                    controls
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-4 left-4 pointer-events-none transition-opacity group-hover:opacity-100 opacity-60">
                    <span className="px-3 py-1 bg-black/60 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest rounded-md border border-white/10">
                      {videoInfo.source}
                    </span>
                  </div>
                </div>

                {/* Info & Actions */}
                <div className="md:w-3/5 p-8 sm:p-10 flex flex-col justify-center">
                  <div className="flex-1">
                    <h2 className="text-2xl font-black text-slate-900 mb-4 line-clamp-3 leading-tight tracking-tighter">
                      {videoInfo.title || "Ready to download"}
                    </h2>
                    <div className="flex items-center gap-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-10">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        HD Quality
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                        MP4 / MP3
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <button 
                      onClick={() => downloadVideo(true)}
                      className="flex items-center justify-center gap-3 bg-indigo-600 text-white px-8 py-5 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
                    >
                      <Download className="w-5 h-5" />
                      SAVE TO DEVICE
                    </button>
                    <button 
                      onClick={() => downloadVideo(false)}
                      className="flex items-center justify-center gap-2 bg-slate-50 text-slate-600 px-8 py-4 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-100 transition-all active:scale-95 border border-slate-100"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Direct Link
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Steps/Info */}
        <div className="mt-20 w-full grid grid-cols-1 sm:grid-cols-3 gap-12 border-t border-slate-200 pt-20">
          {[
            { step: '01', title: 'Copy Link', desc: 'Copy the video link from TikTok, Facebook, or any site.' },
            { step: '02', title: 'Paste Link', desc: 'Paste the link here. We handle the rest automatically.' },
            { step: '03', title: 'Download', desc: 'Get your high-quality video without any watermarks.' }
          ].map((item) => (
            <div key={item.step} className="group">
              <span className="text-5xl font-black text-slate-200 group-hover:text-indigo-600 transition-colors duration-500 block mb-4">{item.step}</span>
              <h4 className="font-black text-slate-800 text-xl mb-2 tracking-tighter uppercase">{item.title}</h4>
              <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 py-12 px-6 lg:px-12 text-slate-400 text-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="flex flex-wrap justify-center md:justify-start gap-12">
            <div>
              <span className="block text-slate-500 font-black text-[10px] uppercase tracking-widest mb-2">No Watermark</span>
              <p className="text-white font-medium">Pure video quality</p>
            </div>
            <div>
              <span className="block text-slate-500 font-black text-[10px] uppercase tracking-widest mb-2">Multi-Format</span>
              <p className="text-white font-medium">MP4, MP3, 4K UHD</p>
            </div>
            <div>
              <span className="block text-slate-500 font-black text-[10px] uppercase tracking-widest mb-2">Platform Support</span>
              <p className="text-white font-medium">50+ Social Channels</p>
            </div>
          </div>
          
          <div className="text-center md:text-right">
            <p className="text-slate-500 font-black text-[10px] uppercase tracking-widest mb-2">System Status</p>
            <div className="flex items-center gap-2 justify-center md:justify-end">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-white font-medium">All nodes operational</span>
            </div>
            <div className="mt-8 pt-8 border-t border-slate-800 text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">
              © 2024 SOCIALSTREAM • SECURE MULTI-DOWNLOADER
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

