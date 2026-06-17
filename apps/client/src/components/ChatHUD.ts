import { Network } from '../network/socket';
import { SOCKET_EVENTS, ChatMessagePayload } from '@psalter/shared';

export class ChatHUD {
  private element!: HTMLDivElement;
  private logElement!: HTMLDivElement;
  private inputElement!: HTMLInputElement;
  public isTyping: boolean = false;

  constructor() {
    this.createDomElements();
    this.listenToNetwork();
  }

  private createDomElements() {
    this.element = document.createElement('div');
    this.element.id = 'chat-hud';
    this.element.style.position = 'absolute';
    this.element.style.bottom = '20px';
    this.element.style.left = '20px';
    this.element.style.width = '340px';
    this.element.style.background = 'rgba(11, 12, 16, 0.85)';
    this.element.style.border = '2px solid #1f2833';
    this.element.style.borderRadius = '6px';
    this.element.style.display = 'flex';
    this.element.style.flexDirection = 'column';
    this.element.style.zIndex = '9999';

    this.element.innerHTML = `
      <div id="chat-log" style="height: 140px; overflow-y: auto; padding: 8px; font-family: sans-serif; font-size: 13px; color: #c9d1d9; display: flex; flex-direction: column; gap: 4px;"></div>
      <input id="chat-input" type="text" placeholder="Press Enter to type chat message..." style="background: #0d0e12; border: none; border-top: 2px solid #1f2833; padding: 8px; color: #fff; font-size: 13px; border-bottom-left-radius: 4px; border-bottom-right-radius: 4px; outline: none;"/>
    `;

    document.getElementById('game-container')?.appendChild(this.element);
    this.logElement = document.getElementById('chat-log') as HTMLDivElement;
    this.inputElement = document.getElementById('chat-input') as HTMLInputElement;

    // Monitor input target toggles
    this.inputElement.addEventListener('focus', () => { this.isTyping = true; });
    this.inputElement.addEventListener('blur', () => { this.isTyping = false; });

    this.inputElement.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.sendMessage();
      }
    });
  }

  private sendMessage() {
    const text = this.inputElement.value.trim();
    if (text) {
      Network.socket.emit(SOCKET_EVENTS.CHAT_MESSAGE, { text, channel: 'global' });
      this.inputElement.value = '';
      this.inputElement.blur();
    }
  }

  public pushMessage(sender: string, text: string, color: string = '#ffffff') {
    const msgNode = document.createElement('div');
    msgNode.innerHTML = `<strong style="color: ${color};">${sender}:</strong> ${text}`;
    this.logElement.appendChild(msgNode);
    this.logElement.scrollTop = this.logElement.scrollHeight; // Auto scroll down
  }

  private listenToNetwork() {
    Network.socket.on(SOCKET_EVENTS.CHAT_MESSAGE, (payload: ChatMessagePayload) => {
      let color = '#58a6ff'; // Standard user sync tag
      if (payload.channel === 'system') color = '#00ffcc';
      this.pushMessage(payload.sender, payload.text, color);
    });

    // Listen for global admin announcements
    Network.socket.on(SOCKET_EVENTS.GM_ANNOUNCEMENT, (data: { text: string }) => {
      this.pushMessage("📢 ANNOUNCEMENT", data.text, "#ff3366");
    });
  }
}
