const WebSocket = require("ws");
const Docker = require("dockerode");
const pty = require("node-pty");
const { PassThrough } = require("stream");

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

        const exec = await container.exec({
            Cmd: ["/bin/bash"],
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            Tty: true,
        });

        const stream = await exec.start({ hijack: true, stdin: true });

        const stdout = new PassThrough();
        const stderr = new PassThrough();
        container.modem.demuxStream(stream, stdout, stderr);

        stdout.on("data", (data) => {
            ws.send(data.toString("utf-8"));
        });

        stderr.on("data", (data) => {
            ws.send(data.toString("utf-8"));
        });

        ws.on("message", (msg) => {
            stream.write(msg);
        });

        ws.on("close", async () => {
            await container.stop();
            await container.remove();
        });
    } catch (error) {
        console.error("Error:", error);
        ws.close();
    }
});
