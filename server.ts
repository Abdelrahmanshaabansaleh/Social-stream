import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy Gemini model getter
let _model: any = null;
function getGeminiModel() {
  if (!_model) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.VITE_GEMINI_API_KEY;
    
    // Specifically block known placeholders or missing keys
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.includes('YOUR_')) {
      console.warn('Gemini API key missing or invalid in environment.');
      return null;
    }
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        _model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    } catch (e) {
        console.warn('Gemini initialization failed:', e);
        return null;
    }
  }
  return _model;
}

// Fallback search using Gemini for complex pages
async function findVideoWithGemini(html: string, platform: string): Promise<{ downloadUrl: string; title: string } | null> {
    try {
        const model = getGeminiModel();
        if (!model) return null;

        const snippet = html.substring(0, 30000); // reduced size for better stability
        const prompt = `
            Context: Web Scraper for a ${platform} video page.
            Task: Find the DIRECT MP4/M3U8 link in the HTML.
            HTML snippet starts below:
            ${snippet}
            
            Return ONLY a JSON object: {"downloadUrl": "...", "title": "..."}.
            If not found, return {"downloadUrl": null, "title": null}.
        `;
        
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonMatch = text.match(/\{.*\}/s);
        
        if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            if (data.downloadUrl) return data;
        }
    } catch (e: any) {
        // Log locally but don't crash or throw to frontend if it's just an auth issue
        console.error('Gemini fallback failed:', e.message);
    }
    return null;
}

// Helper to get video info from TikTok (No Watermark)
async function getTikTokInfo(url: string) {
  try {
    const response = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`, {
        timeout: 10000
    });
    const data = response.data.data;
    
    if (!data) throw new Error('TikTok video not found. Try another link.');

    return {
      title: data.title || 'TikTok Video',
      thumbnail: data.cover,
      downloadUrl: data.play,
      source: 'TikTok',
      found: true
    };
  } catch (error: any) {
    throw new Error('Failed to fetch TikTok. Link might be private or invalid.');
  }
}

// Special Twitter scraper using vxtwitter API
async function getTwitterInfo(url: string) {
    try {
        const tweetId = url.split('/status/')[1]?.split('?')[0];
        if (!tweetId) throw new Error('Could not parse Tweet ID');

        // Using vxtwitter API which is generally more reliable for bots
        const response = await axios.get(`https://api.vxtwitter.com/i/status/${tweetId}`, {
            timeout: 8000,
            headers: {
                'Accept': 'application/json'
            }
        });
        
        const data = response.data;
        
        // Try media_extended first as it has type info
        if (data && data.media_extended && data.media_extended.length > 0) {
            const video = data.media_extended.find((m: any) => m.type === 'video' || m.type === 'gif');
            if (video) {
                return {
                    title: data.text || 'Twitter Video',
                    thumbnail: data.media_extended.find((m: any) => m.type === 'image')?.url || data.thumbnail_url,
                    downloadUrl: video.url,
                    source: 'Twitter',
                    found: true
                };
            }
        }

        // Fallback to media_urls
        if (data && data.media_urls && data.media_urls.length > 0) {
            const videoUrl = data.media_urls.find((u: string) => u.includes('.mp4') || u.includes('video.twimg.com')) || data.media_urls[0];
            
            return {
                title: data.text || 'Twitter Video',
                thumbnail: data.media_urls.find((u: string) => u.includes('pbs.twimg.com')) || undefined,
                downloadUrl: videoUrl,
                source: 'Twitter',
                found: true
            };
        }
        throw new Error('No media found on this tweet.');
    } catch (error: any) {
        console.error('vxtwitter error:', error.message);
        // Fallback to generic scrape if vxtwitter fails
        return genericScrape(url, 'Twitter');
    }
}

// Special Instagram scraper attempt using fxtagram/ddinstagram pattern or generic
async function getInstagramInfo(url: string) {
    try {
        // Instagram is extremely hard to scrape directly. 
        // We try a specialized service pattern or generic.
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        
        // Look for common Patterns in Instagram's limited SEO data
        let videoUrl = $('meta[property="og:video"]').attr('content') || 
                       $('meta[property="og:video:secure_url"]').attr('content');
        
        if (!videoUrl) {
            // Try to find it in script tags
            const scripts = $('script').toArray();
            for (const s of scripts) {
                const content = $(s).html();
                if (content && content.includes('video_url')) {
                    const match = content.match(/"video_url":\s*"(.*?)"/);
                    if (match) {
                        videoUrl = match[1].replace(/\\u0026/g, '&');
                        break;
                    }
                }
            }
        }

        if (videoUrl) {
            return {
                title: $('meta[property="og:title"]').attr('content') || 'Instagram Video',
                thumbnail: $('meta[property="og:image"]').attr('content'),
                downloadUrl: videoUrl,
                source: 'Instagram',
                found: true
            };
        }

        // Final attempt: fallback to Gemini for Instagram pages
        return genericScrape(url, 'Instagram');
    } catch (e: any) {
        return genericScrape(url, 'Instagram');
    }
}

async function genericScrape(url: string, platform: string) {
    try {
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          timeout: 12000
        });
        
        const html = response.data;
        const $ = cheerio.load(html);
        
        let videoUrl = $('meta[property="og:video:secure_url"]').attr('content') || 
                       $('meta[property="og:video"]').attr('content') ||
                       $('meta[name="twitter:player:stream"]').attr('content') ||
                       $('meta[property="twitter:player:stream"]').attr('content');
        
        if (!videoUrl) {
        // Dig into script tags for anything looking like a video URL
            const scripts = $('script').toArray();
            for (const s of scripts) {
                const content = $(s).html();
                if (content && (content.includes('video') || content.includes('mp4'))) {
                    // Look for JSON or raw URL
                    const mp4Match = content.match(/https?:\/\/[^"'>]+\.mp4[^"'>]*/g);
                    if (mp4Match) {
                        // Filter out common trackers or tiny logos if multiple found
                        videoUrl = mp4Match.find(u => u.includes('video') || !u.includes('tracker')) || mp4Match[0];
                        videoUrl = videoUrl.replace(/\\u0026/g, '&').replace(/\\/g, '');
                        break;
                    }
                }
            }
        }

        if (!videoUrl) {
            videoUrl = $('video source').attr('src') || $('video').attr('src') || $('video source[type="video/mp4"]').attr('src');
        }

        // Ensure absolute URL
        if (videoUrl && videoUrl.startsWith('//')) {
            videoUrl = 'https:' + videoUrl;
        } else if (videoUrl && videoUrl.startsWith('/')) {
            const parsedUrl = new URL(url);
            videoUrl = parsedUrl.origin + videoUrl;
        }

        if (!videoUrl) {
            const geminiResult = await findVideoWithGemini(html, platform);
            if (geminiResult && geminiResult.downloadUrl) {
                return {
                    title: geminiResult.title || `${platform} Video`,
                    thumbnail: $('meta[property="og:image"]').attr('content'),
                    downloadUrl: geminiResult.downloadUrl,
                    source: platform,
                    found: true
                };
            }
            throw new Error(`Could not find video link on ${platform}. The page might be protected or require login.`);
        }

        return {
          title: $('meta[property="og:title"]').attr('content') || $('title').text() || `${platform} Video`,
          thumbnail: $('meta[property="og:image"]').attr('content'),
          downloadUrl: videoUrl,
          source: platform,
          found: true
        };
    } catch (error: any) {
        throw new Error(`Extraction failed: ${error.message}`);
    }
}

app.post('/api/fetch-video', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    let info;
    if (url.includes('tiktok.com')) {
      info = await getTikTokInfo(url);
    } else if (url.includes('instagram.com')) {
      info = await getInstagramInfo(url);
    } else if (url.includes('facebook.com') || url.includes('fb.watch')) {
      info = await genericScrape(url, 'Facebook');
    } else if (url.includes('twitter.com') || url.includes('x.com')) {
      info = await getTwitterInfo(url);
    } else if (url.includes('linkedin.com')) {
      info = await genericScrape(url, 'LinkedIn');
    } else {
      info = await genericScrape(url, 'Generic');
    }

    res.json(info);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Proxy for video streaming to bypass Referer/CORS
app.get('/api/proxy-stream', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send('URL is required');

  try {
    const videoUrl = String(url);
    const response = await axios({
      method: 'get',
      url: videoUrl,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Range': req.headers.range || 'bytes=0-'
      },
      maxRedirects: 5,
      validateStatus: (status) => status < 400 // fail on 4xx/5xx
    });

    res.setHeader('Content-Type', String(response.headers['content-type'] || 'video/mp4'));
    if (response.headers['content-length']) res.setHeader('Content-Length', String(response.headers['content-length']));
    if (response.headers['content-range']) res.setHeader('Content-Range', String(response.headers['content-range']));
    if (response.status === 206) res.status(206);
    
    response.data.pipe(res);
  } catch (error: any) {
    console.error('Stream Proxy Error:', error.message);
    res.status(500).send('Streaming failed');
  }
});

app.get('/api/proxy-download', async (req, res) => {
  const { url, filename } = req.query;
  if (!url) return res.status(400).send('URL is required');

  try {
    const response = await axios({
      method: 'get',
      url: String(url),
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      maxRedirects: 5
    });

    const rawFilename = String(filename || 'video.mp4');
    // Sanitize filename to ASCII only for the basic header
    const safeFilename = rawFilename.replace(/[^\x20-\x7E]/g, '_').replace(/[\"\']/g, ''); 
    const encodedFilename = encodeURIComponent(rawFilename);
    
    // Modern header format with safe fallback
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`);
    res.setHeader('Content-Type', String(response.headers['content-type'] || 'video/mp4'));
    response.data.pipe(res);
  } catch (error: any) {
    console.error('Proxy Error:', error.message);
    res.status(500).send('Failed to serve video stream');
  }
});

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start();
