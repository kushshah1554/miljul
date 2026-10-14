import type {Request, Response} from 'express';
import { fail } from '../utils/envelope';


export function notFound(req:Request, res:Response) {
    res.status(404).json(fail(`Route ${req.method} ${req.url} not found`));
}