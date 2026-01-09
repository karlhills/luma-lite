import dgram from 'node:dgram';
import type { Device, GoveeProvider, RGB } from './types.js';

export class GoveeLanProvider implements GoveeProvider {
  private deviceMap = new Map<string, { ip: string; port: number }>();
  private timeoutMs: number;
  private scanAddress: string;
  private scanPort: number;
  private responsePort: number;
  private controlPort: number;

  constructor(options?: { timeoutMs?: number; broadcastAddress?: string; port?: number }) {
    this.timeoutMs = options?.timeoutMs ?? 1500;
    this.scanAddress = options?.broadcastAddress ?? '239.255.255.250';
    this.scanPort = options?.port ?? 4001;
    this.responsePort = 4002;
    this.controlPort = 4003;
  }

  async listDevices(): Promise<Device[]> {
    const devices = new Map<string, Device>();
    this.deviceMap.clear();

    const payload = Buffer.from(
      JSON.stringify({
        msg: { cmd: 'scan', data: { account_topic: 'reserve' } }
      })
    );
    const payloadString = payload.toString();

    const scan = async () => {
      const listener = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      const sender = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          listener.close();
          sender.close();
          resolve();
        }, this.timeoutMs);

        listener.on('message', (message, rinfo) => {
          try {
            const raw = message.toString();
            const parsed = JSON.parse(raw);
            let data = parsed?.msg?.data ?? parsed?.data ?? parsed;
            if (typeof data === 'string') {
              try {
                data = JSON.parse(data);
              } catch {
                data = {};
              }
            }
            const isEmptyScan =
              parsed?.msg?.cmd === 'scan' &&
              data &&
              typeof data === 'object' &&
              Object.keys(data as Record<string, unknown>).length === 0 &&
              raw === payloadString;
            if (isEmptyScan) {
              if (process.env.GOVEE_DEBUG === '1') {
                console.log('[govee] lan response (ignored empty scan echo)', {
                  address: rinfo.address,
                  port: rinfo.port
                });
              }
              return;
            }
            if (process.env.GOVEE_DEBUG === '1') {
              console.log('[govee] lan response', {
                address: rinfo.address,
                port: rinfo.port,
                raw,
                data
              });
            }
            const id = data?.device ?? data?.deviceId ?? data?.id ?? parsed?.device ?? parsed?.id;
            if (!id || typeof id !== 'string') return;
            const ip = data?.ip ?? parsed?.ip ?? rinfo.address;
            const resolvedPort =
              typeof data?.port === 'number' ? data.port : this.controlPort;
            const name = data?.deviceName ?? data?.name ?? data?.sku ?? parsed?.name ?? 'Govee';
            const model = data?.model ?? data?.sku ?? parsed?.model ?? 'unknown';
            const device: Device = {
              id,
              name,
              model,
              sku: data?.sku ?? parsed?.sku,
              lanIp: ip,
              lanPort: resolvedPort,
              source: 'lan',
              supportedCommands: ['power']
            };
            devices.set(id, device);
            this.deviceMap.set(normalizeId(id), { ip, port: resolvedPort });
          } catch {
            return;
          }
        });

        listener.bind(this.responsePort, () => {
          try {
            listener.setMulticastLoopback(false);
            listener.addMembership(this.scanAddress);
          } catch {
            // Ignore multicast join failures and still attempt a scan.
          }
          try {
            sender.setBroadcast(true);
          } catch {
            // Some environments disallow broadcast on an unbound socket.
          }
          sender.bind(() => {
            sender.send(payload, 0, payload.length, this.scanPort, this.scanAddress, (error) => {
              if (error) {
                clearTimeout(timer);
                listener.close();
                sender.close();
                resolve();
                return;
              }
              clearTimeout(timer);
              const inner = setTimeout(() => {
                listener.close();
                sender.close();
                resolve();
              }, this.timeoutMs);
              listener.once('close', () => clearTimeout(inner));
            });
          });
        });
      });
    };

    await scan();

    return Array.from(devices.values());
  }

  async setPower(_deviceId: string, _on: boolean): Promise<void> {
    const target = this.deviceMap.get(normalizeId(_deviceId));
    if (!target) {
      throw new Error('LAN device not found');
    }
    const socket = dgram.createSocket('udp4');
    const payload = Buffer.from(
      JSON.stringify({
        msg: { cmd: 'turn', data: { value: _on ? 1 : 0 } }
      })
    );

    await new Promise<void>((resolve, reject) => {
      socket.send(payload, 0, payload.length, target.port, target.ip, (error) => {
        socket.close();
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  async setBrightness(_deviceId: string, _level: number): Promise<void> {
    const target = this.deviceMap.get(normalizeId(_deviceId));
    if (!target) {
      throw new Error('LAN device not found');
    }
    const value = Math.max(1, Math.min(100, Math.round(_level)));
    const socket = dgram.createSocket('udp4');
    const payload = Buffer.from(
      JSON.stringify({
        msg: { cmd: 'brightness', data: { value } }
      })
    );
    await new Promise<void>((resolve, reject) => {
      socket.send(payload, 0, payload.length, target.port, target.ip, (error) => {
        socket.close();
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  async setColor(_deviceId: string, _color: RGB): Promise<void> {
    const target = this.deviceMap.get(normalizeId(_deviceId));
    if (!target) {
      throw new Error('LAN device not found');
    }
    const socket = dgram.createSocket('udp4');
    const payload = Buffer.from(
      JSON.stringify({
        msg: {
          cmd: 'colorwc',
          data: {
            color: {
              r: Math.max(0, Math.min(255, Math.round(_color.r))),
              g: Math.max(0, Math.min(255, Math.round(_color.g))),
              b: Math.max(0, Math.min(255, Math.round(_color.b)))
            },
            colorTemInKelvin: 0
          }
        }
      })
    );
    await new Promise<void>((resolve, reject) => {
      socket.send(payload, 0, payload.length, target.port, target.ip, (error) => {
        socket.close();
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  async setColorTemperatureK(_deviceId: string, _kelvin: number): Promise<void> {
    const target = this.deviceMap.get(normalizeId(_deviceId));
    if (!target) {
      throw new Error('LAN device not found');
    }
    const value = Math.max(2000, Math.min(9000, Math.round(_kelvin)));
    const socket = dgram.createSocket('udp4');
    const payload = Buffer.from(
      JSON.stringify({
        msg: {
          cmd: 'colorwc',
          data: {
            color: { r: 0, g: 0, b: 0 },
            colorTemInKelvin: value
          }
        }
      })
    );
    await new Promise<void>((resolve, reject) => {
      socket.send(payload, 0, payload.length, target.port, target.ip, (error) => {
        socket.close();
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  async getDeviceState(_deviceId: string): Promise<{
    onOff?: number;
    brightness?: number;
    color?: { r: number; g: number; b: number };
    colorTemInKelvin?: number;
  }> {
    const target = this.deviceMap.get(normalizeId(_deviceId));
    if (!target) {
      throw new Error('LAN device not found');
    }
    const socket = dgram.createSocket('udp4');
    const payload = Buffer.from(
      JSON.stringify({
        msg: { cmd: 'devStatus', data: {} }
      })
    );
    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.close();
        reject(new Error('LAN status timeout'));
      }, 1200);

      socket.on('message', (message) => {
        try {
          const parsed = JSON.parse(message.toString());
          const data = parsed?.msg?.data ?? parsed?.data ?? {};
          clearTimeout(timeout);
          socket.close();
          resolve(data);
        } catch (error) {
          clearTimeout(timeout);
          socket.close();
          reject(error);
        }
      });

      socket.send(payload, 0, payload.length, target.port, target.ip, (error) => {
        if (error) {
          clearTimeout(timeout);
          socket.close();
          reject(error);
        }
      });
    });
  }
}

const normalizeId = (id: string) => id.toLowerCase().replace(/[^a-f0-9]/g, '');
