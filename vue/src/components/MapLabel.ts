/**
 * @license
 * Copyright 2011 Google Inc.
 * Licensed under a source-available license
 */

interface MapLabelOptions {
  fontFamily?: string;
  fontSize?: number;
  fontColor?: string;
  strokeWeight?: number;
  strokeColor?: string;
  align?: 'left' | 'center' | 'right';
  zIndex?: number;
  position?: google.maps.LatLng;
  text?: string;
  minZoom?: number;
  maxZoom?: number;
}

export class MapLabel extends google.maps.OverlayView {
  private canvas_: HTMLCanvasElement | null = null;

  constructor(opt_options: MapLabelOptions = {}) {
    super();
    this.set('fontFamily', 'sans-serif');
    this.set('fontSize', 14);
    this.set('fontColor', '#000000');
    this.set('strokeWeight', 4);
    this.set('strokeColor', '#ffffff');
    this.set('align', 'center');
    this.set('zIndex', 1e3);

    this.setValues(opt_options);
  }

  changed(prop: string): void {
    switch (prop) {
      case 'fontFamily':
      case 'fontSize':
      case 'fontColor':
      case 'strokeWeight':
      case 'strokeColor':
      case 'align':
      case 'text':
        this.drawCanvas_();
        break;
      case 'maxZoom':
      case 'minZoom':
      case 'position':
        this.draw();
        break;
    }
  }

  private drawCanvas_(): void {
    if (!this.canvas_) return;

    const style = this.canvas_.style;
    style.zIndex = String(this.get('zIndex'));

    const ctx = this.canvas_.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, this.canvas_.width, this.canvas_.height);
    ctx.strokeStyle = this.get('strokeColor');
    ctx.fillStyle = this.get('fontColor');
    ctx.font = `${this.get('fontSize')}px ${this.get('fontFamily')}`;

    const strokeWeight = Number(this.get('strokeWeight'));
    const text = this.get('text');

    if (text) {
      if (strokeWeight) {
        ctx.lineWidth = strokeWeight;
        ctx.strokeText(text, strokeWeight, strokeWeight);
      }

      ctx.fillText(text, strokeWeight, strokeWeight);

      const textMeasure = ctx.measureText(text);
      const textWidth = textMeasure.width + strokeWeight;
      style.marginLeft = `${this.getMarginLeft_(textWidth)}px`;
      style.marginTop = '-0.4em';
    }
  }

  onAdd(): void {
    this.canvas_ = document.createElement('canvas');
    const style = this.canvas_.style;
    style.position = 'absolute';

    const ctx = this.canvas_.getContext('2d');
    if (ctx) {
      ctx.lineJoin = 'round';
      ctx.textBaseline = 'top';
    }

    this.drawCanvas_();

    const panes = this.getPanes();
    if (panes) {
      panes.mapPane.appendChild(this.canvas_);
    }
  }

  private getMarginLeft_(textWidth: number): number {
    switch (this.get('align')) {
      case 'left':
        return 0;
      case 'right':
        return -textWidth;
      default:
        return textWidth / -2;
    }
  }

  draw(): void {
    const projection = this.getProjection();

    if (!projection || !this.canvas_) {
      return;
    }

    const latLng = this.get('position') as google.maps.LatLng;
    if (!latLng) {
      return;
    }

    const pos = projection.fromLatLngToDivPixel(latLng);
    if (!pos) {
      return;
    }

    const style = this.canvas_.style;
    style.top = `${pos.y}px`;
    style.left = `${pos.x}px`;
    style.visibility = this.getVisible_();
  }

  private getVisible_(): string {
    const minZoom = this.get('minZoom') as number | undefined;
    const maxZoom = this.get('maxZoom') as number | undefined;

    if (minZoom === undefined && maxZoom === undefined) {
      return '';
    }

    const map = this.getMap();
    if (!map) {
      return '';
    }

    const mapZoom = map.getZoom();
    if (typeof mapZoom !== 'number') {
      return '';
    }

    if (mapZoom < (minZoom ?? -Infinity) || mapZoom > (maxZoom ?? Infinity)) {
      return 'hidden';
    }
    return '';
  }

  onRemove(): void {
    if (this.canvas_ && this.canvas_.parentNode) {
      this.canvas_.parentNode.removeChild(this.canvas_);
    }
  }
}