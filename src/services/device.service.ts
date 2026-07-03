// src/services/device.service.ts
import bcrypt from 'bcrypt';
import { DeviceRepository } from '../repositories/device.repository';

export class DeviceService {
  private deviceRepository: DeviceRepository;

  constructor() {
    this.deviceRepository = new DeviceRepository();
  }

  public async getActiveDevices() {
    return await this.deviceRepository.findActiveDevices();
  }

  public async getDeviceById(id: number) {
    const device = await this.deviceRepository.findById(id);
    if (!device || !device.is_active) {
      throw new Error('NOT_FOUND: Perangkat tidak ditemukan');
    }
    return device;
  }

  public async createDevice(data: {
    device_name: string;
    device_id: string;
    ip_address?: string;
    location?: string;
    api_key?: string;
  }) {
    if (!data.device_name || !data.device_id) {
      throw new Error('BAD_REQUEST: Nama Perangkat dan ID Perangkat wajib diisi');
    }

    const existing = await this.deviceRepository.findByDeviceId(data.device_id);
    if (existing) {
      throw new Error('CONFLICT: ID Perangkat sudah digunakan oleh mesin lain');
    }

    let api_key_hash = null;
    if (data.api_key) {
      api_key_hash = await bcrypt.hash(data.api_key, 10);
    }

    const device = await this.deviceRepository.create({
      device_name: data.device_name,
      device_id: data.device_id,
      ip_address: data.ip_address || null,
      location: data.location || null,
      api_key_hash,
      is_active: true,
    });

    return { id: device.id, device_name: device.device_name };
  }

  public async updateDevice(
    id: number,
    data: {
      device_name?: string;
      ip_address?: string;
      location?: string;
      is_active?: boolean;
    }
  ) {
    // Memastikan perangkat ada sebelum update
    await this.getDeviceById(id); // Will throw NOT_FOUND if it doesn't exist

    const updated = await this.deviceRepository.update(id, data);
    return { id: updated.id, device_name: updated.device_name };
  }

  public async deleteDevice(id: number) {
    // Memastikan perangkat ada sebelum delete
    await this.getDeviceById(id);

    await this.deviceRepository.softDelete(id);
  }
}
