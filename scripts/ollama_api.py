import json
import sys
from ollamafreeapi import OllamaFreeAPI

client = OllamaFreeAPI()


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
    except (ValueError, RuntimeError) as e:
        respond({"type": "error", "data": str(e)})


def handle_stream_chat(args):
    model = args.get("model")
    prompt = args.get("prompt")
    kwargs = {k: v for k, v in args.items() if k not in ("type", "model", "prompt")}
    try:
        for chunk in client.stream_chat(prompt, model, **kwargs):
            respond({"type": "chunk", "data": chunk})
        respond({"type": "done", "data": None})
    except (ValueError, RuntimeError) as e:
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
