import { io, Socket } from 'socket.io-client';

class NetworkManager {
  public socket: Socket;

  constructor() {
    // Dynamically map host depending on environment (cloud iframe vs local testbed)
    const targetUrl = (typeof window !== 'undefined')
      ? (window.location.origin.includes('3002') ? window.location.origin.replace('3002', '3000') : window.location.origin)
      : 'http://localhost:3000';

    this.socket = io(targetUrl, {
      autoConnect: false
    });
  }

  public connect() {
    if (!this.socket.connected) {
      this.socket.connect();
    }
  }
}

export const Network = new NetworkManager();
