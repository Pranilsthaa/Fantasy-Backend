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

const iplTeams = [
    {
        code: "MI",
        name: "Mumbai Indians",
        logo: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSQTgNMYj3dia5BSOLrdqDdxgThHuwuP0L8f5JhSAEOp5BGZVTJSU1GA9nsGlbPfCwOC1xwOg&s"
    },
    {
        code: "CSK",
        name: "Chennai Super Kings",
        logo: "ss"
    },
    {
        code: "RCB",
        name: "Royal Challengers Bangalore",
        logo: "ss"
    }
]

const players_dummy = [
    {
        name: "Rohit Sharma",
        age: "36",
        price: 100,
        role: "Batter",
        team_id: "6df69121-5768-422b-9626-9975390b99cc",
        isActive: true
    },
    {
        name: 'Virat Kohli',
        age: "35",
        price: 99,
        role: "Batter",
        team_id: "06a66678-9b5c-41d4-a3c6-7df90b705bba",
        isActive: true
    },
    {
        name: 'Rahul Chahar',
        age: "24",
        price: 20,
        role: "Bowler" as any,
        team_id: "50d4959c-6378-4ce8-997d-f828b418fce3",
        isActive: true
    }
]

const store_teams_test = async (req: Request, res: Response) => {
    try{
        await db.insert(teams).values(iplTeams)
        res.send("Teams inserted successfully")
    }catch(e){
        console.log(e)
        res.send("Error inserting teams")
    }
}
const store_Players_test = async (req: Request, res: Response) => {
    try{
        await db.insert(players).values(players_dummy)
        res.send("Players inserted successfully")
    }catch(e){
        console.log(e)
        res.send("Error inserting teams")
    }
}

app.get("/store-teams", store_teams_test)
app.get("/store-players", store_Players_test)

app.listen(port, () => {
    console.log(`Server is running on  ${getLocalIP()}:${port}`)
})
