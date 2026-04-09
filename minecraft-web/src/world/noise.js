// Simplex-style 2D noise (value noise with smooth interpolation)

const PERM_SIZE = 256;

export function createNoise(seed) {
  const perm = new Uint8Array(PERM_SIZE * 2);
  const grad = new Float32Array(PERM_SIZE * 2);

  let s = seed | 0;
  function rng() {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  }

  const base = new Uint8Array(PERM_SIZE);
  for (let i = 0; i < PERM_SIZE; i++) base[i] = i;
  for (let i = PERM_SIZE - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    [base[i], base[j]] = [base[j], base[i]];
  }
  for (let i = 0; i < PERM_SIZE; i++) {
    perm[i] = perm[i + PERM_SIZE] = base[i];
    const angle = rng() * Math.PI * 2;
    grad[i * 2] = Math.cos(angle);
    grad[i * 2 + 1] = Math.sin(angle);
    grad[(i + PERM_SIZE) * 2] = grad[i * 2];
    grad[(i + PERM_SIZE) * 2 + 1] = grad[i * 2 + 1];
  }

  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function dot(gi, x, y) {
    return grad[gi * 2] * x + grad[gi * 2 + 1] * y;
  }

  function noise2d(x, y) {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const u = fade(xf);
    const v = fade(yf);

    const aa = perm[perm[xi] + yi];
    const ab = perm[perm[xi] + yi + 1];
    const ba = perm[perm[xi + 1] + yi];
    const bb = perm[perm[xi + 1] + yi + 1];

    return lerp(
      lerp(dot(aa, xf, yf), dot(ba, xf - 1, yf), u),
      lerp(dot(ab, xf, yf - 1), dot(bb, xf - 1, yf - 1), u),
      v
    );
  }

  function fbm(x, y, octaves = 4, lacunarity = 2, gain = 0.5) {
    let value = 0, amplitude = 1, frequency = 1, max = 0;
    for (let i = 0; i < octaves; i++) {
      value += noise2d(x * frequency, y * frequency) * amplitude;
      max += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }
    return value / max;
  }

  return { noise2d, fbm };
}
