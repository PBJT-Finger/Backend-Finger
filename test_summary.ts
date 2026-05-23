import AttendanceController from './src/controllers/attendance.controller';
import { Request, Response } from 'express';
import prisma from './src/config/prisma';

async function test() {
  const req = {
    query: {
      startDate: '2026-04-30',
      endDate: '2026-05-30'
    }
  } as unknown as Request;

  const res = {
    status: (code: number) => ({
      json: (data: any) => {
        console.log('Status:', code);
        console.log('Data count:', data.data?.length);
        if (data.data?.length > 0) {
          console.log('Sample item:', data.data[0]);
        } else {
          console.log('Data payload:', data);
        }
      }
    }),
    json: (data: any) => {
      console.log('Data count:', data.data?.length);
      if (data.data?.length > 0) {
        console.log('Sample item:', data.data[0]);
      } else {
          console.log('Data payload:', data);
      }
    }
  } as unknown as Response;

  await AttendanceController.getAttendanceSummary(req, res);
}

test().catch(console.error).finally(() => prisma.$disconnect());
