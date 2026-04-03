import express, { type Request, type Response } from "express";
import os from 'os'
import { logger } from "./utils/logger";
import { db, players, teams } from "./db";

const app = express();
const port = 3001;

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name in interfaces) {
    const networkInterface = interfaces[name];
    if (networkInterface) {
      for (const iface of networkInterface) {
        if (iface.family === "IPv4" && !iface.internal) {
          return iface.address;
        }
      }
    }
  }
  return "127.0.0.1";
}

app.use(logger)

app.get("/", (req: Request, res: Response) => {
    res.send("Fantasy API is running");
});

app.listen(port, () => {
    console.log(`Server is running on ${getLocalIP()}:${port}`)
})
