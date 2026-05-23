import AttendanceController from './src/controllers/attendance.controller';
import { Request, Response } from 'express';
import prisma from './src/config/prisma';

async function test() {
  const req = {
    query: {
      startDate: '2026-05-22',
      endDate: '2026-05-22'
    }
  } as unknown as Request;

  const res = {
    status: (code: number) => ({
      json: (data: any) => {
        console.log('Data count:', data.data?.length);
      }
    }),
    json: (data: any) => {
      console.log('Data count:', data.data?.length);
    }
  } as unknown as Response;

  await AttendanceController.getAttendanceSummary(req, res);
}

test().catch(console.error).finally(() => prisma.$disconnect());
