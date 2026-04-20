# Little Rocky

A pixel-art AI companion that lives on your macOS Dock. Rocky paces back and forth at the base of your screen and responds to questions via a local LLM. When you open a distracting website, Rocky yells at you until you leave.

## Prerequisites

- macOS (required)
- Node.js 18 or later
- [Ollama](https://ollama.com/download/mac) for local LLM inference

## Setup

**1. Clone and install dependencies**

```bash
git clone https://github.com/akarvir/little-rocky.git
cd little-rocky
npm install
```

**2. Install and start Ollama**

Download Ollama from [ollama.com/download/mac](https://ollama.com/download/mac) and run it. Then pull a model:

```bash
ollama pull qwen2.5:7b
```

Any model listed by `ollama list` will work. `qwen2.5:7b` is a good balance of speed and quality on Apple Silicon.

**3. Configure environment**

```bash
cp .env.example .env
```

The defaults use Ollama with `llama3`. Update `VITE_LLM_MODEL` to match whichever model you pulled:

```
VITE_LLM_PROVIDER=ollama
VITE_LLM_MODEL=qwen2.5:7b
```

To use Claude instead, set `VITE_LLM_PROVIDER=claude` and add your `VITE_ANTHROPIC_API_KEY`.

**4. Run**

```bash
npm run dev
```

Rocky will appear just above the Dock and begin pacing.

## Usage

| Action | Result |
|---|---|
| `Cmd+Shift+Space` | Activate Rocky, show prompt |
| Type and press `Enter` | Submit question |
| `Escape` | Dismiss and return to idle |
| Click alert | Dismiss yell immediately |

## Browser Extension (distraction detection)

Rocky yells when you visit Twitter, YouTube, Instagram, TikTok, or X. To enable this:

1. Open Chrome and go to `chrome://extensions`
2. Enable Developer mode (toggle in the top right)
3. Click "Load unpacked" and select the `extension/` folder in this repo

The extension connects to Rocky automatically when the app is running and reconnects if Rocky restarts.

## Switching LLM providers

Edit `.env` at any time and restart `npm run dev`:

```
# Local (default)
VITE_LLM_PROVIDER=ollama
VITE_LLM_MODEL=qwen2.5:7b

# Claude API
VITE_LLM_PROVIDER=claude
VITE_LLM_MODEL=claude-haiku-4-5-20251001
VITE_ANTHROPIC_API_KEY=sk-ant-...
```
