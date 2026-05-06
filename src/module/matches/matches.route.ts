import { Router } from "express";
import { getAllMatches } from "./matches.controller";
const matchesRouter = Router();

matchesRouter.get("/", getAllMatches);

export { matchesRouter };