import { MessengerAdapter, MessengerPlatform } from './messenger-adapter.interface.js';

export class MessengerRegistryService {
  private static instance: MessengerRegistryService | null = null;
  private adapters = new Map<MessengerPlatform, MessengerAdapter>();

  static getInstance(): MessengerRegistryService {
    if (!MessengerRegistryService.instance) {
      MessengerRegistryService.instance = new MessengerRegistryService();
    }
    return MessengerRegistryService.instance;
  }

  register(adapter: MessengerAdapter): void {
    this.adapters.set(adapter.platform, adapter);
  }

  get(platform: MessengerPlatform): MessengerAdapter | undefined {
    return this.adapters.get(platform);
  }

  list() {
    return [...this.adapters.values()].map((a) => a.getStatus());
  }
}
