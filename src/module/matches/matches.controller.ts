import type { Request, Response } from "express";
import { db } from "../../db";

const getAllMatches = async (req:Request, res: Response) => {
    try{
        const allMatches = await db.query.matches.findMany({
            columns: {
                id: true,
                matchNumber: true,
                date: true,
                venue: true,
                status: true,
            },
            with: {
                team1: {
                    columns: {
                        name: true,
                        logo: true,
                        code: true,
                    }
                },
                team2: {
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
            message: "Matches fetched successfully",
            data: allMatches,
        })
    }catch(error){
        console.log("Error in getAllMatches:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}

export {getAllMatches}