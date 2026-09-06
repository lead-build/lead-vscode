import { spawn } from "child_process";

// Run the file content through `pbfmt --stdin` and return the formatted
// output. Rejects with the process's stderr output on formatting failure.
export function formatText(text: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = spawn("pbfmt", ["--stdin"]);

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (data) => {
            stdout += data;
        });
        child.stderr.on("data", (data) => {
            stderr += data;
        });

        child.on("error", (err: NodeJS.ErrnoException) => {
            if (err.code === "ENOENT") {
                reject(new Error("pbfmt is not installed or not on PATH. Install lead-build's pbfmt to enable formatting."));
            } else {
                reject(err);
            }
        });

        child.on("close", (code) => {
            if (code === 0) {
                resolve(stdout);
            } else {
                reject(new Error(stderr.trim() || `pbfmt exited with code ${code}`));
            }
        });

        child.stdin.write(text);
        child.stdin.end();
    });
}
