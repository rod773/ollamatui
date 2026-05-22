# OllamaTUI

A terminal-style web UI for chatting with free Ollama models via the [`ollamafreeapi`](https://pypi.org/project/ollamafreeapi/) library.

## Architecture

```
Browser (Next.js Client)
    |  fetch() to /api/chat/stream
    v
Next.js API Route (src/app/api/chat/stream/route.ts)
    |  spawns python scripts/ollama_api.py
    v
Python (scripts/ollama_api.py)
    |  calls OllamaFreeAPI.chat() / .stream_chat()
    v
ollamafreeapi library (site-packages)
    |  looks up model servers in JSON files
    v
Remote Ollama server (public IP:11434)
```

The frontend is a Next.js 16 app. Chat requests are forwarded to a Python script that calls the `ollamafreeapi` library, which maintains a list of public Ollama server IPs mapped to model names in JSON files under `ollama_json/`.

## Commands

| Command | Description |
|---|---|
| `/help` | Show help |
| `/models` | List all available models |
| `/models <number>` | Switch to model by list index |
| `/models <name>` | Switch to model by name |
| `/model <name>` | Switch active model |
| `/info <model>` | Show model metadata |
| `/clear` | Clear terminal |
| `/stop` | Stop streaming response |

**Esc** also stops streaming.

Model selection persists across page reloads via `localStorage`.

## Getting Started

```bash
yarn install
yarn dev
```

Requires Python 3.x with `ollamafreeapi` installed:

```bash
pip install ollamafreeapi
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
  app/
    page.tsx          - Entry point
    terminal.tsx      - Terminal UI, command parsing, chat
    layout.tsx        - Root layout
    globals.css       - Tailwind + dark theme styles
    api/
      chat/
        stream/route.ts  - Streaming chat endpoint
        route.ts         - Non-streaming chat endpoint
      models/route.ts    - List models endpoint
      model-info/route.ts- Model metadata endpoint
scripts/
  ollama_api.py        - Python bridge to ollamafreeapi
  requirements.txt     - Python dependencies (pip install -r)
```

## Notes

- Model data is sourced from scraped public Ollama servers in `ollamafreeapi`. The `qwen.json` file was mis-populated with DeepSeek-R1 entries — no Qwen models are currently available.
- To add a custom model/server, edit the JSON files under the `ollamafreeapi` site-packages `ollama_json/` directory.
