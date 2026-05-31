import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { successResponse, errorResponse } from '../utils/responseFormatter';
import logger from '../utils/logger';
import bcrypt from 'bcrypt';
import { ZkDeviceClient } from '../infrastructure/zk-client';

export class DeviceController {
  public static async getDevices(req: Request, res: Response): Promise<Response> {
    try {
      const devices = await prisma.devices.findMany({
        where: { is_active: true },
        select: {
          id: true,
          device_name: true,
          device_id: true,
          location: true,
          is_active: true,
          created_at: true,
        },
        orderBy: {
          created_at: 'desc',
        },
      });

      return successResponse(res, devices, 'Devices retrieved successfully');
    } catch (error) {
      logger.error('Get devices error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return errorResponse(res, 'Failed to retrieve devices', 500);
    }
  }

  public static async getDeviceById(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      if (!id) return errorResponse(res, 'Device ID is required', 400);

      const device = await prisma.devices.findUnique({
        where: { id: Number(id) },
        select: {
          id: true,
          device_name: true,
          device_id: true,
          ip_address: true,
          location: true,
          is_active: true,
          created_at: true,
        },
      });

      if (!device || !device.is_active) {
        return errorResponse(res, 'Device not found', 404);
      }

      return successResponse(res, device, 'Device retrieved successfully');
    } catch (error) {
      logger.error('Get device error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return errorResponse(res, 'Failed to retrieve device', 500);
    }
  }

  public static async createDevice(req: Request, res: Response): Promise<Response> {
    try {
      const { device_name, device_id, ip_address, location, api_key } = req.body;

      if (!device_name || !device_id) {
        return errorResponse(res, 'Device name and ID are required', 400);
      }

      const existing = await prisma.devices.findUnique({ where: { device_id } });
      if (existing) {
        return errorResponse(res, 'Device ID already exists', 409);
      }

      let api_key_hash = null;
      if (api_key) {
        api_key_hash = await bcrypt.hash(api_key, 10);
      }

      const device = await prisma.devices.create({
        data: {
          device_name,
          device_id,
          ip_address,
          location,
          api_key_hash,
          is_active: true,
        },
      });

      return successResponse(
        res,
        { id: device.id, device_name: device.device_name },
        'Device created successfully',
        201
      );
    } catch (error) {
      logger.error('Create device error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return errorResponse(res, 'Failed to create device', 500);
    }
  }

  public static async updateDevice(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { device_name, ip_address, location, is_active } = req.body;

      if (!id) return errorResponse(res, 'Device ID is required', 400);

      const device = await prisma.devices.findUnique({ where: { id: Number(id) } });
      if (!device) return errorResponse(res, 'Device not found', 404);

      const updated = await prisma.devices.update({
        where: { id: Number(id) },
        data: {
          device_name: device_name !== undefined ? device_name : device.device_name,
          ip_address: ip_address !== undefined ? ip_address : device.ip_address,
          location: location !== undefined ? location : device.location,
          is_active: is_active !== undefined ? is_active : device.is_active,
        },
      });

      return successResponse(
        res,
        { id: updated.id, device_name: updated.device_name },
        'Device updated successfully'
      );
    } catch (error) {
      logger.error('Update device error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return errorResponse(res, 'Failed to update device', 500);
    }
  }

  public static async deleteDevice(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      if (!id) return errorResponse(res, 'Device ID is required', 400);

      const device = await prisma.devices.findUnique({ where: { id: Number(id) } });
      if (!device) return errorResponse(res, 'Device not found', 404);

      await prisma.devices.update({
        where: { id: Number(id) },
        data: { is_active: false },
      });

      return successResponse(res, null, 'Device deleted successfully');
    } catch (error) {
      logger.error('Delete device error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return errorResponse(res, 'Failed to delete device', 500);
    }
  }

  public static async syncDevice(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      if (!id) return errorResponse(res, 'Device ID is required', 400);

      const device = await prisma.devices.findUnique({ where: { id: Number(id) } });
      if (!device || !device.is_active) {
        return errorResponse(res, 'Device not found or inactive', 404);
      }

      const zkClient = ZkDeviceClient.getInstance();
      await zkClient.start();

      return successResponse(
        res,
        { status: zkClient.getStatus() },
        'Device sync triggered successfully'
      );
    } catch (error) {
      logger.error('Sync device error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return errorResponse(res, 'Failed to trigger device sync', 500);
    }
  }
}
export default DeviceController;
