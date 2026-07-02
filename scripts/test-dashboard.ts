import DashboardController from './src/controllers/dashboard.controller';
import { Request, Response } from 'express';

async function test() {
    const req = { query: {} } as Request;
    const res = {
        status: (s: number) => ({ json: (j: any) => console.log(JSON.stringify(j, null, 2)) }),
        json: (j: any) => console.dir(j, { depth: null })
    } as unknown as Response;

    await DashboardController.getSummary(req, res);
}

test();
