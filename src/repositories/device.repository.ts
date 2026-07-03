// src/repositories/device.repository.ts
import prisma from '../config/prisma';
import { Prisma } from '@prisma/client';

export class DeviceRepository {
  public async findActiveDevices() {
    return prisma.devices.findMany({
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
  }

  public async findById(id: number) {
    return prisma.devices.findUnique({
      where: { id },
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
  }

  public async findByDeviceId(device_id: string) {
    return prisma.devices.findUnique({
      where: { device_id },
    });
  }

  public async create(data: Prisma.devicesCreateInput) {
    return prisma.devices.create({
      data,
    });
  }

  public async update(id: number, data: Prisma.devicesUpdateInput) {
    return prisma.devices.update({
      where: { id },
      data,
    });
  }

  public async softDelete(id: number) {
    return prisma.devices.update({
      where: { id },
      data: { is_active: false },
    });
  }
}
