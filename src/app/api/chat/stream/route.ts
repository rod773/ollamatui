import { spawn } from "child_process";
import path from "path";

const SCRIPT = path.join(process.cwd(), "scripts", "ollama_api.py");

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json();

  return new Response(
    new ReadableStream({
      start(controller) {
        const proc = spawn("python", [SCRIPT], { stdio: ["pipe", "pipe", "pipe"] });
        let buffer = "";

        proc.stdout.on("data", (chunk: Buffer) => {
          buffer += chunk.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);
              if (parsed.type === "chunk") {
                controller.enqueue(new TextEncoder().encode(parsed.data));
              } else if (parsed.type === "done") {
                controller.close();
                proc.stdin.end();
              } else if (parsed.type === "error") {
                controller.enqueue(new TextEncoder().encode(`\n[Error: ${parsed.data}]\n`));
                controller.close();
                proc.stdin.end();
              }
            } catch {
              // skip malformed lines
            }
          }
        });

        proc.stderr.on("data", () => {});

        proc.on("close", () => {
          try { controller.close(); } catch {}
        });

        proc.on("error", (err) => {
          controller.enqueue(new TextEncoder().encode(`\n[Error: ${err.message}]\n`));
          controller.close();
        });

        proc.stdin.write(JSON.stringify({
          type: "stream_chat",
          model: body.model,
          prompt: body.prompt,
          temperature: body.temperature ?? 0.7,
          num_predict: body.num_predict ?? 512,
        }) + "\n");
      },
    }),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    }
  );
}
