export class VitalsHUD {
  private element!: HTMLDivElement;

  constructor() {
    this.createDomElements();
  }

  private createDomElements() {
    this.element = document.createElement('div');
    this.element.id = 'vitals-hud';
    this.element.style.position = 'absolute';
    this.element.style.top = '20px';
    this.element.style.left = '20px';
    this.element.style.padding = '12px';
    this.element.style.background = 'rgba(11, 12, 16, 0.85)';
    this.element.style.border = '2px solid #1f2833';
    this.element.style.borderRadius = '6px';
    this.element.style.color = '#fff';
    this.element.style.fontFamily = 'monospace';
    this.element.style.pointerEvents = 'none'; // Keeps clicks registering on canvas

    this.element.innerHTML = `
      <div style="font-weight: bold; color: #45f3ff; margin-bottom: 5px;" id="hud-char-name">Loading...</div>
      <div style="font-size: 11px; margin-bottom: 8px;" id="hud-char-class">CLASS</div>
      <div style="width: 160px; background: #333; height: 12px; border-radius: 3px; overflow: hidden; margin-bottom: 4px;">
        <div id="hp-bar" style="width: 100%; background: #ff3344; height: 100%; transition: width 0.2s;"></div>
      </div>
      <div style="width: 160px; background: #333; height: 12px; border-radius: 3px; overflow: hidden;">
        <div id="mp-bar" style="width: 100%; background: #3388ff; height: 100%; transition: width 0.2s;"></div>
      </div>
    `;

    document.getElementById('game-container')?.appendChild(this.element);
  }

  public updateVitals(name: string, className: string, hp: number, maxHp: number) {
    const nameEl = document.getElementById('hud-char-name');
    const classEl = document.getElementById('hud-char-class');
    const hpBar = document.getElementById('hp-bar');

    if (nameEl) nameEl.innerText = name;
    if (classEl) classEl.innerText = `Lv. 1 ${className}`;
    if (hpBar) {
      const pct = (hp / maxHp) * 100;
      hpBar.style.width = `${pct}%`;
    }
  }
}
