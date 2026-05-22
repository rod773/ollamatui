import { spawn } from "child_process";
import path from "path";
import { NextRequest } from "next/server";

const SCRIPT = path.join(process.cwd(), "scripts", "ollama_api.py");

function runPython(input: object): Promise<object> {
  return new Promise((resolve, reject) => {
    const proc = spawn("python", [SCRIPT], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    proc.on("close", (code) => {
      if (code !== 0) reject(new Error(stderr || `Exit code ${code}`));
      else {
        try {
          resolve(JSON.parse(stdout.trim()));
        } catch { reject(new Error(`Invalid JSON: ${stdout}`)); }
      }
    });
    proc.on("error", reject);
    proc.stdin.write(JSON.stringify(input) + "\n");
    proc.stdin.end();
  });
}

export async function GET(request: NextRequest) {
  const family = request.nextUrl.searchParams.get("family") || undefined;
  const result = await runPython({ type: "list_models", family });
  return Response.json(result);
}
