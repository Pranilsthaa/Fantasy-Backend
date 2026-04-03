import 'dotenv/config'
import type { NextFunction, Request, Response } from "express"

export const logger = async (req: Request, res: Response, next: NextFunction) => {
    if(process.env.NODE_ENV === "development") {
        console.log(`method: ${req.method}`)
        console.log(`url: ${req.url}`)
        // console.log(`params: ${JSON.stringify(req.params, null,2)}`)
        // console.log(`body: ${JSON.stringify(req.body, null,2)}`)
    }
    next()
}