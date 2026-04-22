import type { Request, Response } from "express";
import { db } from "../../db";

const getAllPlayers = async (req:Request, res: Response) => {
    try{
        const allPlayers = await db.query.players.findMany({
            columns: {
                id: true,
                name: true,
                age: true,
                price: true,
                role: true,
                isActive: true,
            },
            with: {
                team: {
                    columns: {
                        name: true,
                        logo: true,
                        code: true,
                    }
                }
            }
        });

        res.status(200).json({
            success: true,
            message: "Players fetched successfully",
            data: allPlayers,
        })
    }catch(error){
        console.log("Error in getAllPlayers:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export {
    getAllPlayers,
}