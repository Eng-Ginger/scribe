# Scribe

A tiny website that turns a video into a text transcript. No backend, no login, no accounts. The speech recognition runs **entirely in the visitor's browser**, so uploaded videos never leave the device.

It's a single static page (`index.html`) — it works on any static host.

## How it works

- The page loads a Whisper speech-recognition model in the browser via [Transformers.js](https://huggingface.co/docs/transformers.js).
- The video's audio is decoded and resampled locally with the Web Audio API.
- The model transcribes it and the page shows the text, with copy and download buttons.

The first visit downloads the model (a couple hundred MB), then the browser caches it, so repeat visits are fast. It runs best in **Chrome or Edge** (WebGPU acceleration); other browsers fall back to a slower mode but still work.

## Run it locally

Because the page fetches a model over the network, serve it over http rather than opening the file directly:

```bash
npx serve .
# then open the printed http://localhost:3000
```

(Opening `index.html` straight from disk works too in Chrome/Edge, but serving it is closer to how it'll behave deployed.)

## Deploy it

This is a static site, so any of these work. All the config for the speed-up headers is already included.

**Netlify (easiest):** drag this whole folder onto https://app.netlify.com/drop — done. Or connect a Git repo and it auto-deploys. `netlify.toml` is already set up.

**Vercel:** run `npx vercel` in this folder, or import the Git repo at https://vercel.com. `vercel.json` is already set up.

**Cloudflare Pages:** create a Pages project and point it at this folder / repo. The `_headers` file is already set up.

**GitHub Pages:** push this folder to a repo and enable Pages. It works, but GitHub Pages can't send the cross-origin isolation headers, so it'll use the slightly slower single-thread mode. Fine for short videos.

## About those header files

`_headers`, `netlify.toml`, and `vercel.json` all set two headers (`Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy`). They're optional — the site works without them — but they let the browser run the model with multithreading, which speeds up transcription. Keep whichever file matches your host; the others are harmless.

## Notes

- Best for short-to-medium clips. Very long videos (an hour-plus) are slow in-browser — a local tool like `openai-whisper` on the command line is better for those.
- No data is collected or sent anywhere. There's nothing to configure and no keys to manage.
