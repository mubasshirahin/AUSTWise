import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { MousePointer2 } from 'lucide-react';

/**
 * ImageTrailShowcase — the whole AUSTWise feature set trails your cursor.
 *
 * A port of the premium GSAP ImageTrail system (8 animation variants),
 * adapted so each trail item is a theme-styled "feature card" (icon +
 * label + accent colour) instead of a raw photo — so it reads as native
 * to the landing page and stays fully offline.
 *
 * Mechanics (unchanged from the original engine):
 *  - A rAF loop tracks the pointer inside the frame.
 *  - Moving more than `threshold` px pops the next card at the lerped
 *    cursor position; each variant animates it differently
 *    (lerp, bloom, ejection, motion blur, rotation, speed blur,
 *    depth stacking, 3D perspective).
 *  - The engine is imperative DOM + GSAP only; React renders the cards
 *    and the effect wires/unwires the engine per variant.
 */

// ─── Math helpers ───
function lerp(a, b, n) {
  return (1 - n) * a + n * b;
}

function getLocalPointerPos(e, rect) {
  let clientX = 0;
  let clientY = 0;
  if ('touches' in e && e.touches.length > 0) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else if ('clientX' in e) {
    clientX = e.clientX;
    clientY = e.clientY;
  }
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

function getMouseDistance(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.hypot(dx, dy);
}

// ─── A single trail card ───
class ImageItem {
  constructor(DOM_el) {
    this.DOM = {
      el: DOM_el,
      inner: DOM_el.querySelector('.content__img-inner'),
    };
    this.defaultStyle = { scale: 1, x: 0, y: 0, opacity: 0 };
    this.rect = null;
    this.onResize = () => {
      gsap.set(this.DOM.el, this.defaultStyle);
      this.getRect();
    };
    window.addEventListener('resize', this.onResize);
    gsap.set(this.DOM.el, { scale: 1, x: 0, y: 0, opacity: 0, rotation: 0, rotationZ: 0, zIndex: 1 });
    this.getRect();
  }

  getRect() {
    this.rect = this.DOM.el.getBoundingClientRect();
  }

  destroy() {
    window.removeEventListener('resize', this.onResize);
  }
}

// ─── Engine base — pointer tracking + rAF loop ───
class ImageTrailBase {
  constructor(container) {
    this.container = container;
    this.images = [...container.querySelectorAll('.content__img')].map((img) => new ImageItem(img));
    this.imagesTotal = this.images.length;

    this.imgPosition = 0;
    this.zIndexVal = 1;
    this.activeImagesCount = 0;
    this.isIdle = true;
    this.threshold = 80;
    this.mousePos = { x: 0, y: 0 };
    this.lastMousePos = { x: 0, y: 0 };
    this.cacheMousePos = { x: 0, y: 0 };
    this.rafId = null;

    this.onPointerMove = (ev) => {
      const rect = this.container.getBoundingClientRect();
      this.mousePos = getLocalPointerPos(ev, rect);
    };
    this.onInitRender = (ev) => {
      const rect = this.container.getBoundingClientRect();
      this.mousePos = getLocalPointerPos(ev, rect);
      this.cacheMousePos = { ...this.mousePos };
      this.rafId = requestAnimationFrame(() => this.render());
      this.container.removeEventListener('mousemove', this.onInitRender);
      this.container.removeEventListener('touchmove', this.onInitRender);
    };

    container.addEventListener('mousemove', this.onPointerMove);
    container.addEventListener('touchmove', this.onPointerMove);
    container.addEventListener('mousemove', this.onInitRender);
    container.addEventListener('touchmove', this.onInitRender);
  }

  onImageActivated() {
    this.activeImagesCount++;
    this.isIdle = false;
  }

  getFrameSize() {
    const r = this.container.getBoundingClientRect();
    return { width: r.width, height: r.height };
  }

  clampCardPos(x, y, img, scale = 1, angle = 0) {
    const w = (img.rect?.width ?? 0) * scale;
    const h = (img.rect?.height ?? 0) * scale;
    const a = (angle * Math.PI) / 180;
    const rw = Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a));
    const rh = Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a));
    const baseW = img.rect?.width ?? 0;
    const baseH = img.rect?.height ?? 0;
    const { width, height } = this.getFrameSize();
    const margin = 8;
    const cx = x + baseW / 2;
    const cy = y + baseH / 2;
    const cxC = rw > width ? width / 2 : Math.max(rw / 2 + margin, Math.min(width - rw / 2 - margin, cx));
    const cyC = rh > height ? height / 2 : Math.max(rh / 2 + margin, Math.min(height - rh / 2 - margin, cy));
    return [cxC - baseW / 2, cyC - baseH / 2];
  }

  anchorFrom(img, scale = 1) {
    return this.clampCardPos(
      this.cacheMousePos.x - (img.rect?.width ?? 0) / 2,
      this.cacheMousePos.y - (img.rect?.height ?? 0) / 2,
      img,
      scale,
    );
  }

  anchorTo(img, scale = 1) {
    return this.clampCardPos(
      this.mousePos.x - (img.rect?.width ?? 0) / 2,
      this.mousePos.y - (img.rect?.height ?? 0) / 2,
      img,
      scale,
    );
  }


  onImageDeactivated() {
    this.activeImagesCount--;
    if (this.activeImagesCount === 0) this.isIdle = true;
  }

  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.container.removeEventListener('mousemove', this.onPointerMove);
    this.container.removeEventListener('touchmove', this.onPointerMove);
    this.container.removeEventListener('mousemove', this.onInitRender);
    this.container.removeEventListener('touchmove', this.onInitRender);
    this.images.forEach((img) => img.destroy());
  }
}

// ─── Variant 1 · Classic Lerp ───
class ImageTrailVariant1 extends ImageTrailBase {
  render() {
    const distance = getMouseDistance(this.mousePos, this.lastMousePos);
    this.cacheMousePos.x = lerp(this.cacheMousePos.x, this.mousePos.x, 0.1);
    this.cacheMousePos.y = lerp(this.cacheMousePos.y, this.mousePos.y, 0.1);
    if (distance > this.threshold) {
      this.showNextImage();
      this.lastMousePos = { ...this.mousePos };
    }
    if (this.isIdle && this.zIndexVal !== 1) this.zIndexVal = 1;
    this.rafId = requestAnimationFrame(() => this.render());
  }

  showNextImage() {
    ++this.zIndexVal;
    this.imgPosition = this.imgPosition < this.imagesTotal - 1 ? this.imgPosition + 1 : 0;
    const img = this.images[this.imgPosition];
    gsap.killTweensOf(img.DOM.el);
    gsap.timeline({
      onStart: () => this.onImageActivated(),
      onComplete: () => this.onImageDeactivated(),
    })
      .fromTo(
        img.DOM.el,
        {
          opacity: 1, scale: 1, zIndex: this.zIndexVal,
          x: this.anchorFrom(img)[0],
          y: this.anchorFrom(img)[1],
        },
        {
          duration: 0.4, ease: 'power1',
          x: this.anchorTo(img)[0],
          y: this.anchorTo(img)[1],
        },
        0,
      )
      .to(img.DOM.el, { duration: 0.4, ease: 'power3', opacity: 0, scale: 0.2 }, 0.4);
  }
}

// ─── Variant 2 · Luminous Bloom ───
class ImageTrailVariant2 extends ImageTrailBase {
  render() {
    const distance = getMouseDistance(this.mousePos, this.lastMousePos);
    this.cacheMousePos.x = lerp(this.cacheMousePos.x, this.mousePos.x, 0.1);
    this.cacheMousePos.y = lerp(this.cacheMousePos.y, this.mousePos.y, 0.1);
    if (distance > this.threshold) {
      this.showNextImage();
      this.lastMousePos = { ...this.mousePos };
    }
    if (this.isIdle && this.zIndexVal !== 1) this.zIndexVal = 1;
    this.rafId = requestAnimationFrame(() => this.render());
  }

  showNextImage() {
    ++this.zIndexVal;
    this.imgPosition = this.imgPosition < this.imagesTotal - 1 ? this.imgPosition + 1 : 0;
    const img = this.images[this.imgPosition];
    gsap.killTweensOf(img.DOM.el);
    gsap.timeline({
      onStart: () => this.onImageActivated(),
      onComplete: () => this.onImageDeactivated(),
    })
      .fromTo(
        img.DOM.el,
        {
          opacity: 1, scale: 0, zIndex: this.zIndexVal,
          x: this.anchorFrom(img)[0],
          y: this.anchorFrom(img)[1],
        },
        {
          duration: 0.4, ease: 'power1', scale: 1,
          x: this.anchorTo(img)[0],
          y: this.anchorTo(img)[1],
        },
        0,
      )
      .fromTo(
        img.DOM.inner,
        { scale: 2.8, filter: 'brightness(250%)' },
        { duration: 0.4, ease: 'power1', scale: 1, filter: 'brightness(100%)' },
        0,
      )
      .to(img.DOM.el, { duration: 0.4, ease: 'power2', opacity: 0, scale: 0.2 }, 0.45);
  }
}

// ─── Variant 3 · Ethereal Ascent ───
class ImageTrailVariant3 extends ImageTrailBase {
  render() {
    const distance = getMouseDistance(this.mousePos, this.lastMousePos);
    this.cacheMousePos.x = lerp(this.cacheMousePos.x, this.mousePos.x, 0.1);
    this.cacheMousePos.y = lerp(this.cacheMousePos.y, this.mousePos.y, 0.1);
    if (distance > this.threshold) {
      this.showNextImage();
      this.lastMousePos = { ...this.mousePos };
    }
    if (this.isIdle && this.zIndexVal !== 1) this.zIndexVal = 1;
    this.rafId = requestAnimationFrame(() => this.render());
  }

  showNextImage() {
    ++this.zIndexVal;
    this.imgPosition = this.imgPosition < this.imagesTotal - 1 ? this.imgPosition + 1 : 0;
    const img = this.images[this.imgPosition];
    const [driftBaseX, driftBaseY] = this.anchorTo(img);
    gsap.killTweensOf(img.DOM.el);
    gsap.timeline({
      onStart: () => this.onImageActivated(),
      onComplete: () => this.onImageDeactivated(),
    })
      .fromTo(
        img.DOM.el,
        {
          opacity: 1, scale: 0, zIndex: this.zIndexVal,
          xPercent: 0, yPercent: 0,
          x: this.anchorFrom(img)[0],
          y: this.anchorFrom(img)[1],
        },
        {
          duration: 0.4, ease: 'power1', scale: 1,
          x: this.anchorTo(img)[0],
          y: this.anchorTo(img)[1],
        },
        0,
      )
      .to(
        img.DOM.el,
        {
          duration: 0.6, ease: 'power2', opacity: 0, scale: 0.2,
          x: this.clampCardPos(driftBaseX + gsap.utils.random(-80, 80), driftBaseY - gsap.utils.random(40, 110), img)[0],
          y: this.clampCardPos(driftBaseX + gsap.utils.random(-80, 80), driftBaseY - gsap.utils.random(40, 110), img)[1],
        },
        0.6,
      );
  }
}

// ─── Variant 4 · Motion Drift ───
class ImageTrailVariant4 extends ImageTrailBase {
  render() {
    const distance = getMouseDistance(this.mousePos, this.lastMousePos);
    if (distance > this.threshold) {
      this.showNextImage();
      this.lastMousePos = { ...this.mousePos };
    }
    this.cacheMousePos.x = lerp(this.cacheMousePos.x, this.mousePos.x, 0.1);
    this.cacheMousePos.y = lerp(this.cacheMousePos.y, this.mousePos.y, 0.1);
    if (this.isIdle && this.zIndexVal !== 1) this.zIndexVal = 1;
    this.rafId = requestAnimationFrame(() => this.render());
  }

  showNextImage() {
    ++this.zIndexVal;
    this.imgPosition = this.imgPosition < this.imagesTotal - 1 ? this.imgPosition + 1 : 0;
    const img = this.images[this.imgPosition];
    const [driftBaseX, driftBaseY] = this.anchorTo(img);
    gsap.killTweensOf(img.DOM.el);

    let dx = this.mousePos.x - this.cacheMousePos.x;
    let dy = this.mousePos.y - this.cacheMousePos.y;
    const dist = Math.hypot(dx, dy);
    if (dist !== 0) {
      dx /= dist;
      dy /= dist;
    }
    dx *= dist / 100;
    dy *= dist / 100;

    gsap.timeline({
      onStart: () => this.onImageActivated(),
      onComplete: () => this.onImageDeactivated(),
    })
      .fromTo(
        img.DOM.el,
        {
          opacity: 1, scale: 0, zIndex: this.zIndexVal,
          x: this.anchorFrom(img)[0],
          y: this.anchorFrom(img)[1],
        },
        {
          duration: 0.4, ease: 'power1', scale: 1,
          x: this.anchorTo(img)[0],
          y: this.anchorTo(img)[1],
        },
        0,
      )
      .fromTo(
        img.DOM.inner,
        {
          scale: 2,
          filter: `brightness(${Math.max((400 * dist) / 100, 100)}%) contrast(${Math.max((400 * dist) / 100, 100)}%)`,
        },
        { duration: 0.4, ease: 'power1', scale: 1, filter: 'brightness(100%) contrast(100%)' },
        0,
      )
      .to(img.DOM.el, { duration: 0.4, ease: 'power3', opacity: 0 }, 0.4)
      .to(img.DOM.el, {
        duration: 1.5, ease: 'power4',
        x: this.clampCardPos(driftBaseX + dx * 110, driftBaseY + dy * 110, img)[0],
        y: this.clampCardPos(driftBaseX + dx * 110, driftBaseY + dy * 110, img)[1],
      }, 0.05);
  }
}

// ─── Variant 5 · Angular Flow ───
class ImageTrailVariant5 extends ImageTrailBase {
  constructor(container) {
    super(container);
    this.lastAngle = 0;
  }

  render() {
    const distance = getMouseDistance(this.mousePos, this.lastMousePos);
    if (distance > this.threshold) {
      this.showNextImage();
      this.lastMousePos = { ...this.mousePos };
    }
    this.cacheMousePos.x = lerp(this.cacheMousePos.x, this.mousePos.x, 0.1);
    this.cacheMousePos.y = lerp(this.cacheMousePos.y, this.mousePos.y, 0.1);
    if (this.isIdle && this.zIndexVal !== 1) this.zIndexVal = 1;
    this.rafId = requestAnimationFrame(() => this.render());
  }

  showNextImage() {
    let dx = this.mousePos.x - this.cacheMousePos.x;
    let dy = this.mousePos.y - this.cacheMousePos.y;
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (angle < 0) angle += 360;
    if (angle > 90 && angle <= 270) angle += 180;
    const isMovingClockwise = angle >= this.lastAngle;
    this.lastAngle = angle;
    const startAngle = isMovingClockwise ? angle - 10 : angle + 10;
    const dist = Math.hypot(dx, dy);
    if (dist !== 0) {
      dx /= dist;
      dy /= dist;
    }
    dx *= dist / 150;
    dy *= dist / 150;

    ++this.zIndexVal;
    this.imgPosition = this.imgPosition < this.imagesTotal - 1 ? this.imgPosition + 1 : 0;
    const img = this.images[this.imgPosition];
    const [driftBaseX, driftBaseY] = this.anchorTo(img);
    gsap.killTweensOf(img.DOM.el);
    gsap.timeline({
      onStart: () => this.onImageActivated(),
      onComplete: () => this.onImageDeactivated(),
    })
      .fromTo(
        img.DOM.el,
        {
          opacity: 1, filter: 'brightness(80%)', scale: 0.1, zIndex: this.zIndexVal,
          x: this.anchorFrom(img)[0],
          y: this.anchorFrom(img)[1],
          rotation: startAngle,
        },
        {
          duration: 1, ease: 'power2', scale: 1, filter: 'brightness(100%)',
          x: this.clampCardPos(driftBaseX + dx * 70, driftBaseY + dy * 70, img)[0],
          y: this.clampCardPos(driftBaseX + dx * 70, driftBaseY + dy * 70, img)[1],
          rotation: this.lastAngle,
        },
        0,
      )
      .to(img.DOM.el, { duration: 0.4, ease: 'expo', opacity: 0 }, 0.5)
      .to(img.DOM.el, {
        duration: 1.5, ease: 'power4',
        x: this.clampCardPos(driftBaseX + dx * 190, driftBaseY + dy * 190, img)[0],
        y: this.clampCardPos(driftBaseX + dx * 190, driftBaseY + dy * 190, img)[1],
      }, 0.05);
  }
}

// ─── Variant 6 · Kinetic Blur ───
class ImageTrailVariant6 extends ImageTrailBase {
  render() {
    const distance = getMouseDistance(this.mousePos, this.lastMousePos);
    this.cacheMousePos.x = lerp(this.cacheMousePos.x, this.mousePos.x, 0.3);
    this.cacheMousePos.y = lerp(this.cacheMousePos.y, this.mousePos.y, 0.3);
    if (distance > this.threshold) {
      this.showNextImage();
      this.lastMousePos = { ...this.mousePos };
    }
    if (this.isIdle && this.zIndexVal !== 1) this.zIndexVal = 1;
    this.rafId = requestAnimationFrame(() => this.render());
  }

  showNextImage() {
    const dx = this.mousePos.x - this.cacheMousePos.x;
    const dy = this.mousePos.y - this.cacheMousePos.y;
    const speed = Math.hypot(dx, dy);
    ++this.zIndexVal;
    this.imgPosition = this.imgPosition < this.imagesTotal - 1 ? this.imgPosition + 1 : 0;
    const img = this.images[this.imgPosition];

    const scaleFactor = 0.3 + 1.3 * Math.min(speed / 200, 1);
    const brightnessValue = 1 + 0.3 * Math.min(speed / 70, 1);
    const blurValue = 20 * (1 - Math.min(speed / 90, 1));
    const grayscaleValue = 1 * (1 - Math.min(speed / 90, 1));

    gsap.killTweensOf(img.DOM.el);
    gsap.timeline({
      onStart: () => this.onImageActivated(),
      onComplete: () => this.onImageDeactivated(),
    })
      .fromTo(
        img.DOM.el,
        {
          opacity: 1, scale: 0, zIndex: this.zIndexVal,
          x: this.anchorFrom(img, scaleFactor)[0],
          y: this.anchorFrom(img, scaleFactor)[1],
        },
        {
          duration: 0.8, ease: 'power3', scale: scaleFactor,
          filter: `grayscale(${grayscaleValue * 100}%) brightness(${brightnessValue * 100}%) blur(${blurValue}px)`,
          x: this.anchorTo(img, scaleFactor)[0],
          y: this.anchorTo(img, scaleFactor)[1],
        },
        0,
      )
      .to(img.DOM.el, { duration: 0.4, ease: 'power3.in', opacity: 0, scale: 0.2 }, 0.45);
  }
}

// ─── Variant 7 · Depth Stack ───
class ImageTrailVariant7 extends ImageTrailBase {
  constructor(container) {
    super(container);
    this.visibleImagesCount = 0;
    this.visibleImagesTotal = Math.max(1, Math.min(6, this.imagesTotal - 1));
  }

  render() {
    const distance = getMouseDistance(this.mousePos, this.lastMousePos);
    this.cacheMousePos.x = lerp(this.cacheMousePos.x, this.mousePos.x, 0.3);
    this.cacheMousePos.y = lerp(this.cacheMousePos.y, this.mousePos.y, 0.3);
    if (distance > this.threshold) {
      this.showNextImage();
      this.lastMousePos = { ...this.mousePos };
    }
    if (this.isIdle && this.zIndexVal !== 1) this.zIndexVal = 1;
    this.rafId = requestAnimationFrame(() => this.render());
  }

  showNextImage() {
    ++this.zIndexVal;
    this.imgPosition = this.imgPosition < this.imagesTotal - 1 ? this.imgPosition + 1 : 0;
    const img = this.images[this.imgPosition];
    ++this.visibleImagesCount;
    gsap.killTweensOf(img.DOM.el);
    const scaleValue = gsap.utils.random(0.5, 1.35);
    const rotZ = gsap.utils.random(-3, 3);

    gsap.timeline({
      onStart: () => this.onImageActivated(),
      onComplete: () => this.onImageDeactivated(),
    })
      .fromTo(
        img.DOM.el,
        {
          scale: scaleValue - 0.4, rotationZ: 0, opacity: 1, zIndex: this.zIndexVal,
          x: this.anchorFrom(img, scaleValue, rotZ)[0],
          y: this.anchorFrom(img, scaleValue, rotZ)[1],
        },
        {
          duration: 0.4, ease: 'power3', scale: scaleValue,
          rotationZ: rotZ,
          x: this.anchorTo(img, scaleValue, rotZ)[0],
          y: this.anchorTo(img, scaleValue, rotZ)[1],
        },
        0,
      );

    if (this.visibleImagesCount >= this.visibleImagesTotal) {
      const lastInQueue = (this.imgPosition - this.visibleImagesTotal + this.imagesTotal) % this.imagesTotal;
      const oldImg = this.images[lastInQueue];
      gsap.to(oldImg.DOM.el, { duration: 0.4, ease: 'power4', opacity: 0, scale: 1.3 });
    }
  }
}

// ─── Variant 8 · 3D Perspective ───
class ImageTrailVariant8 extends ImageTrailBase {
  render() {
    const distance = getMouseDistance(this.mousePos, this.lastMousePos);
    this.cacheMousePos.x = lerp(this.cacheMousePos.x, this.mousePos.x, 0.1);
    this.cacheMousePos.y = lerp(this.cacheMousePos.y, this.mousePos.y, 0.1);
    if (distance > this.threshold) {
      this.showNextImage();
      this.lastMousePos = { ...this.mousePos };
    }
    if (this.isIdle && this.zIndexVal !== 1) this.zIndexVal = 1;
    this.rafId = requestAnimationFrame(() => this.render());
  }

  showNextImage() {
    const rect = this.container.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const relX = this.mousePos.x - centerX;
    const relY = this.mousePos.y - centerY;

    const rotX = -(relY / centerY) * 30;
    const rotY = (relX / centerX) * 30;
    const distFromCenter = Math.hypot(relX, relY);
    const maxDist = Math.hypot(centerX, centerY);
    const zValue = (distFromCenter / maxDist) * 1200 - 600;
    const brightness = 0.2 + ((zValue + 600) / 1200) * 2.3;

    ++this.zIndexVal;
    this.imgPosition = this.imgPosition < this.imagesTotal - 1 ? this.imgPosition + 1 : 0;
    const img = this.images[this.imgPosition];
    gsap.killTweensOf(img.DOM.el);
    gsap.timeline({
      onStart: () => this.onImageActivated(),
      onComplete: () => this.onImageDeactivated(),
    })
      .set(this.container, { perspective: 1000 })
      .fromTo(
        img.DOM.el,
        {
          opacity: 1, z: 0, scale: 1 + zValue / 1000, zIndex: this.zIndexVal,
          x: this.anchorFrom(img, 1 + zValue / 1000)[0],
          y: this.anchorFrom(img, 1 + zValue / 1000)[1],
          rotationX: rotX, rotationY: rotY, filter: `brightness(${brightness})`,
        },
        {
          duration: 1, ease: 'expo', scale: 1 + zValue / 1000,
          x: this.anchorTo(img, 1 + zValue / 1000)[0],
          y: this.anchorTo(img, 1 + zValue / 1000)[1],
          rotationX: rotX, rotationY: rotY,
        },
        0,
      )
      .to(img.DOM.el, { duration: 0.4, ease: 'power2', opacity: 0, z: -800 }, 0.3);
  }
}

const variantMap = {
  1: ImageTrailVariant1,
  2: ImageTrailVariant2,
  3: ImageTrailVariant3,
  4: ImageTrailVariant4,
  5: ImageTrailVariant5,
  6: ImageTrailVariant6,
  7: ImageTrailVariant7,
  8: ImageTrailVariant8,
};

const VARIANT_NAMES = [
  { id: 1, name: 'Classic Lerp' },
  { id: 2, name: 'Luminous Bloom' },
  { id: 3, name: 'Ethereal Ascent' },
  { id: 4, name: 'Motion Drift' },
  { id: 5, name: 'Angular Flow' },
  { id: 6, name: 'Kinetic Blur' },
  { id: 7, name: 'Depth Stack' },
  { id: 8, name: '3D Perspective' },
];

/**
 * @param {Array<{ icon: object, title: string, tagline: string, color: string }>} items
 * @param {number} [variant] initial animation style (1–8)
 * @param {number} [threshold] pointer distance (px) that triggers the next card
 */
export default function ImageTrailShowcase({ items = [], variant: initialVariant = 1, threshold = 50 }) {
  const frameRef = useRef(null);
  const [variant, setVariant] = useState(initialVariant);
  const [moved, setMoved] = useState(false);
  const movedRef = useRef(false);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || items.length === 0) return;

    const Cls = variantMap[variant] || variantMap[1];
    const engine = new Cls(frame);
    if (threshold !== 80) engine.threshold = threshold;

    return () => engine.destroy();
  }, [variant, items, threshold]);

  const handleFramePointer = () => {
    if (!movedRef.current) {
      movedRef.current = true;
      setMoved(true);
    }
  };

  const activeName = (VARIANT_NAMES.find((v) => v.id === variant) || VARIANT_NAMES[0]).name;

  return (
    <section className="landing-trail-section">
      <div className="landing-trail-inner">
        <header className="landing-trail-header">
          <div className="landing-badge pulse-badge">
            <MousePointer2 size={12} />
            <span>Play With It</span>
          </div>
          <h2 className="landing-trail-title">
            The Whole Feature Set, <span className="landing-hero-highlight">Right Behind Your Cursor</span>
          </h2>
          <p className="landing-trail-sub">
            Move your cursor across the frame — every AUSTWise feature trails behind it.
            Try all eight motion styles.
          </p>
        </header>

        <div className="landing-trail-controls">
          <div className="landing-trail-variants" role="group" aria-label="Trail animation style">
            {VARIANT_NAMES.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`landing-trail-variant${variant === v.id ? ' active' : ''}`}
                aria-pressed={variant === v.id}
                title={v.name}
                onClick={() => setVariant(v.id)}
              >
                {v.id}
              </button>
            ))}
          </div>
          <span className="landing-trail-variant-name">{activeName}</span>
        </div>

        <div className="landing-trail-frame" ref={frameRef} onPointerMove={handleFramePointer}>
          <div className="landing-trail-stage" aria-hidden="true">
            {items.map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="content__img trail-card" style={{ '--card-color': item.color }}>
                  <div className="content__img-inner trail-card-inner">
                    <span className="trail-card-icon">
                      <Icon size={22} />
                    </span>
                    <span className="trail-card-label">{item.title}</span>
                    <span className="trail-card-tag">{item.tagline}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={`landing-trail-prompt${moved ? ' hidden' : ''}`} aria-hidden="true">
            <MousePointer2 size={18} />
            <span>Move your cursor to start the trail</span>
          </div>

          <div className="landing-trail-hint">Interactive Motion Showcase — {activeName}</div>
        </div>
      </div>
    </section>
  );
}
