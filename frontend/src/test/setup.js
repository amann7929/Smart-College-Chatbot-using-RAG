import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => { cleanup(); localStorage.clear(); document.documentElement.className = ''; });

// jsdom lacks these browser APIs
window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent() { return false; } }));
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || vi.fn();
window.scrollTo = window.scrollTo || vi.fn();
class RO { observe() {} unobserve() {} disconnect() {} }
window.ResizeObserver = window.ResizeObserver || RO;

// framer-motion's whileInView needs IntersectionObserver (not in jsdom)
class IO { constructor() {} observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } }
window.IntersectionObserver = window.IntersectionObserver || IO;
