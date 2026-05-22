import json
import random
import sys
from ollama import Client as OllamaClient
from ollamafreeapi import OllamaFreeAPI

client = OllamaFreeAPI()


def _all_servers():
    seen = set()
    for models in client._models_data.values():
        for m in models:
            url = m.get("ip_port") if isinstance(m, dict) else None
            if url:
                seen.add(url)
    return list(seen)


def _fallback_chat(prompt, model, **kwargs):
    servers = _all_servers()
    random.shuffle(servers)
    request = client.generate_api_request(model, prompt, **kwargs)
    last_error = None
    for url in servers:
        try:
            oc = OllamaClient(host=url)
            return oc.generate(**request)["response"]
        except Exception as e:
            last_error = e
    raise RuntimeError(
        f"All {len(servers)} servers failed for model '{model}'. Last error: {last_error}"
    )


def _fallback_stream_chat(prompt, model, **kwargs):
    servers = _all_servers()
    random.shuffle(servers)
    request = client.generate_api_request(model, prompt, **kwargs)
    request["stream"] = True
    last_error = None
    for url in servers:
        try:
            oc = OllamaClient(host=url)
            for chunk in oc.generate(**request):
                yield chunk["response"]
            return
        except Exception as e:
            last_error = e
    raise RuntimeError(
        f"All {len(servers)} servers failed for model '{model}'. Last error: {last_error}"
    )


def respond(data):
    print(json.dumps(data), flush=True)


def handle_list_families(args):
    families = client.list_families()
    respond({"type": "families", "data": families})


def handle_list_models(args):
    family = args.get("family")
    models = client.list_models(family)
    respond({"type": "models", "data": models})


def handle_model_info(args):
    model = args.get("model")
    try:
        info = client.get_model_info(model)
        respond({"type": "model_info", "data": info})
    except ValueError as e:
        respond({"type": "error", "data": str(e)})


def handle_chat(args):
    model = args.get("model")
    prompt = args.get("prompt")
    kwargs = {k: v for k, v in args.items() if k not in ("type", "model", "prompt")}
    try:
        response = client.chat(prompt, model, **kwargs)
        respond({"type": "response", "data": response})
    except RuntimeError as e:
        if "No servers available" in str(e):
            try:
                response = _fallback_chat(prompt, model, **kwargs)
                respond({"type": "response", "data": response})
                return
            except RuntimeError as e2:
                respond({"type": "error", "data": str(e2)})
                return
        respond({"type": "error", "data": str(e)})
    except ValueError as e:
        respond({"type": "error", "data": str(e)})


def handle_stream_chat(args):
    model = args.get("model")
    prompt = args.get("prompt")
    kwargs = {k: v for k, v in args.items() if k not in ("type", "model", "prompt")}
    try:
        for chunk in client.stream_chat(prompt, model, **kwargs):
            respond({"type": "chunk", "data": chunk})
        respond({"type": "done", "data": None})
    except RuntimeError as e:
        if "No servers available" in str(e):
            try:
                for chunk in _fallback_stream_chat(prompt, model, **kwargs):
                    respond({"type": "chunk", "data": chunk})
                respond({"type": "done", "data": None})
                return
            except RuntimeError as e2:
                respond({"type": "error", "data": str(e2)})
                return
        respond({"type": "error", "data": str(e)})
    except ValueError as e:
        respond({"type": "error", "data": str(e)})


handlers = {
    "list_families": handle_list_families,
    "list_models": handle_list_models,
    "model_info": handle_model_info,
    "chat": handle_chat,
    "stream_chat": handle_stream_chat,
}

for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        args = json.loads(line)
        cmd = args.get("type")
        handler = handlers.get(cmd)
        if handler:
            handler(args)
        else:
            respond({"type": "error", "data": f"Unknown command: {cmd}"})
    except json.JSONDecodeError:
        respond({"type": "error", "data": "Invalid JSON"})
    except Exception as e:
        respond({"type": "error", "data": str(e)})
