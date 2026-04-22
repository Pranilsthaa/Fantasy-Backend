import { Router } from "express";
import { getAllPlayers } from "./players.controller";

const playerRouter = Router();

playerRouter.get("/", getAllPlayers);

export { playerRouter };