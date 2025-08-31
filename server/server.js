const WebSocket = require("ws");
const Docker = require("dockerode");
const pty = require("node-pty");

const wss = new WebSocket.Server({ port: 3000 });
const docker = new Docker();

wss.on("connection", async (ws) => {
    try {
        const container = await docker.createContainer({
            Image: "ubuntu:latest",
            Cmd: ["/bin/bash"],
            Tty: true,
            OpenStdin: true,
            StdinOnce: false,
        });
        await container.start();

        const exexc = await container.exec({
            Cmd: ["/bin/bash"],
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            Tty: true,
        });

        const stream = await exexc.start({ hijack: true, stdin: true });

        const term = pty.spawn("/bin/cat", [], {
            name: "xterm-color",
            cols: 80,
            rows: 30,
            cwd: process.env.HOME,
            env: process.env,
        })

        stream.on("data", (data) => {
            ws.send(data.toString("utf-8"));
        });

        ws.on("message", (msg) => {
            stream.write(msg);
        });

        ws.on("close", async () => {
            stream.end();
            await container.stop();
            await container.remove();
        });
    } catch (error) {
        console.error("Error:", error);
        ws.close();
    }
});
