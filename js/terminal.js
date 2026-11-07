/* Motor compartilhado da tela simulada em monitor (fotografia + perspectiva).
   Requer js/assets.js antes (window.BN_ASSETS = {photo, background, header}).

   Uso:
     const T = BN_Terminal.create(canvasEl, {
       warning: '',                      // texto do aviso de simulação (opcional)
       exportName: 'arquivo.png',        // nome padrão do download
       fields: () => [...],              // itens {x,y,w,rows?,lines|text,pink?}
       drawPartners: (drawText) => {},   // desenhos extras no plano (opcional)
       footerLabel: 'CONS EFETUADA _',
       footerKeys: ['F01 - AJUDA','F03 - RETORNAR','F04 - MENU','F05 - DETALHE'],
       beforeRender() {}, afterRender() {}
     });
     await T.init();
   Cada item de fields é desenhado com clip retangular quando possui w e rows.
*/
(function () {
  'use strict';
  if (window.BN_Terminal) return;
  const CONFIG = Object.freeze({ width: 1321, height: 722, screenWidth: 1100, screenHeight: 700, scale: 2,
    corners: [[104, -8], [1262, 121], [1157, 714], [107, 745]],
    fontSize: 19, charWidth: 11.2, lineHeight: 24, cyan: '#8ebfda', pink: '#d7727c', rule: '#739ab8',
    warning: { x: 718, y: 43, width: 350, size: 24, color: '#ed7588' } });

  function solveLinear(matrix, vector) {
    const a = matrix.map((row, i) => [...row, vector[i]]), n = vector.length;
    for (let column = 0; column < n; column++) {
      let pivot = column;
      for (let row = column + 1; row < n; row++) if (Math.abs(a[row][column]) > Math.abs(a[pivot][column])) pivot = row;
      if (Math.abs(a[pivot][column]) < 1e-12) throw Error('Geometria inválida.');
      [a[column], a[pivot]] = [a[pivot], a[column]];
      const divisor = a[column][column];
      for (let j = column; j <= n; j++) a[column][j] /= divisor;
      for (let row = 0; row < n; row++) if (row !== column) {
        const factor = a[row][column];
        for (let j = column; j <= n; j++) a[row][j] -= factor * a[column][j];
      }
    }
    return a.map(row => row[n]);
  }
  function calculateScreenHomography() {
    const destination = [[0, 0], [CONFIG.screenWidth, 0], [CONFIG.screenWidth, CONFIG.screenHeight], [0, CONFIG.screenHeight]], a = [], b = [];
    CONFIG.corners.forEach(([x, y], i) => {
      const [u, v] = destination[i];
      a.push([x, y, 1, 0, 0, 0, -u * x, -u * y], [0, 0, 0, x, y, 1, -v * x, -v * y]);
      b.push(u, v);
    });
    return solveLinear(a, b);
  }
  function prepareMapping() {
    const h = calculateScreenHomography(), target = [], source = [], weights = [];
    const minX = Math.max(0, Math.floor(Math.min(...CONFIG.corners.map(p => p[0])))), maxX = Math.min(CONFIG.width - 1, Math.ceil(Math.max(...CONFIG.corners.map(p => p[0]))));
    const minY = Math.max(0, Math.floor(Math.min(...CONFIG.corners.map(p => p[1])))), maxY = Math.min(CONFIG.height - 1, Math.ceil(Math.max(...CONFIG.corners.map(p => p[1]))));
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const d = h[6] * x + h[7] * y + 1;
      let u = (h[0] * x + h[1] * y + h[2]) / d, v = (h[3] * x + h[4] * y + h[5]) / d;
      if (u < 0 || v < 0 || u >= CONFIG.screenWidth - 1 || v >= CONFIG.screenHeight - 1) continue;
      u *= CONFIG.scale; v *= CONFIG.scale;
      const ix = Math.floor(u), iy = Math.floor(v);
      target.push((y * CONFIG.width + x) * 4); source.push((iy * planeWidth() + ix) * 4); weights.push(u - ix, v - iy);
    }
    function planeWidth() { return CONFIG.screenWidth * CONFIG.scale; }
    return { target: new Uint32Array(target), source: new Uint32Array(source), weights: new Float32Array(weights) };
  }

  window.BN_Terminal = {
    create(canvas, options) {
      options = options || {};
      const plane = document.createElement('canvas');
      plane.width = CONFIG.screenWidth * CONFIG.scale; plane.height = CONFIG.screenHeight * CONFIG.scale;
      const ctx = plane.getContext('2d', { willReadFrequently: true });
      const out = canvas.getContext('2d', { willReadFrequently: true });
      let assets, basePixels, mapping, ready = false;

      function drawText(text, x, y, color) {
        color = color || CONFIG.cyan;
        ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = .25;
        ctx.font = `${CONFIG.fontSize}px Terminal,monospace`; ctx.textBaseline = 'alphabetic';
        ctx.shadowColor = color; ctx.shadowBlur = .5;
        Array.from(text).forEach((ch, i) => { ctx.fillText(ch, x + i * CONFIG.charWidth, y); ctx.strokeText(ch, x + i * CONFIG.charWidth, y); });
        ctx.shadowBlur = 0;
      }
      function drawRule(y, slope) {
        slope = slope || 0;
        ctx.save(); ctx.strokeStyle = CONFIG.rule; ctx.lineWidth = 1; ctx.setLineDash([7, 4]);
        ctx.beginPath(); ctx.moveTo(57, y); ctx.lineTo(1048, y + slope); ctx.stroke(); ctx.restore();
      }
      function drawScreenBackground() {
        ctx.setTransform(CONFIG.scale, 0, 0, CONFIG.scale, 0, 0);
        ctx.clearRect(0, 0, CONFIG.screenWidth, CONFIG.screenHeight);
        ctx.drawImage(assets.background, 0, 0, CONFIG.screenWidth, CONFIG.screenHeight);
      }
      function drawHeader() {
        ctx.drawImage(assets.header, 0, 0);
        drawText('#CONFIDENCIAL', 56, 122);
        drawText('#SISTEMA INTERNO', 870, 115);
        drawRule(136, -10);
      }
      function drawWarning() {
        const text = options.warning;
        if (!text) return;
        const warning = CONFIG.warning;
        ctx.save();
        ctx.font = `bold ${warning.size}px Warning,monospace`;
        ctx.fillStyle = warning.color; ctx.textBaseline = 'alphabetic';
        ctx.shadowColor = warning.color; ctx.shadowBlur = .7;
        const width = ctx.measureText(text).width;
        ctx.translate(warning.x, warning.y);
        ctx.transform(warning.width / width, .008, 0, 1, 0, 0);
        ctx.fillText(text, 0, 0);
        ctx.restore();
      }
      function drawFooter() {
        drawRule(600, -14);
        drawText(options.footerLabel || 'CONS EFETUADA _', 59, 624);
        drawRule(639, -15);
        (options.footerKeys || ['F01 - AJUDA', 'F03 - RETORNAR', 'F04 - MENU', 'F05 - DETALHE']).forEach((label, i) => drawText(label, [59, 342, 604, 814][i], [666, 660, 655, 650][i]));
      }
      function composeFinalImage() {
        const pixels = ctx.getImageData(0, 0, plane.width, plane.height).data;
        const frame = new ImageData(new Uint8ClampedArray(basePixels), CONFIG.width, CONFIG.height);
        const stride = plane.width * 4;
        for (let i = 0; i < mapping.target.length; i++) {
          const t = mapping.target[i], s = mapping.source[i], u = mapping.weights[i * 2], v = mapping.weights[i * 2 + 1];
          for (let c = 0; c < 3; c++) frame.data[t + c] = (pixels[s + c] * (1 - u) + pixels[s + 4 + c] * u) * (1 - v) + (pixels[s + stride + c] * (1 - u) + pixels[s + stride + 4 + c] * u) * v;
        }
        out.putImageData(frame, 0, 0);
      }
      function render() {
        if (!ready) return;
        if (options.beforeRender) options.beforeRender();
        drawScreenBackground();
        drawHeader();
        const fields = (options.fields && options.fields()) || [];
        for (const field of fields) {
          const lines = field.lines || (field.text != null ? String(field.text).split('\n') : []);
          const pink = !!field.pink ? CONFIG.pink : CONFIG.cyan;
          if (field.w == null || field.rows == null) {
            lines.forEach((line, j) => drawText(line, field.x, field.y + j * CONFIG.lineHeight, pink));
            continue;
          }
          ctx.save();
          ctx.beginPath();
          ctx.rect(field.x - 1, field.y - 21, field.w * CONFIG.charWidth + 2, field.rows * CONFIG.lineHeight + 2);
          ctx.clip();
          lines.forEach((line, j) => drawText(line, field.x, field.y + j * CONFIG.lineHeight, pink));
          ctx.restore();
        }
        if (options.drawPartners) options.drawPartners({ drawText: drawText, LINE_H: CONFIG.lineHeight, CHAR_W: CONFIG.charWidth, CYAN: CONFIG.cyan, PINK: CONFIG.pink });
        drawFooter();
        drawWarning();
        composeFinalImage();
        canvas.dataset.ready = 'true';
        if (options.afterRender) options.afterRender();
      }
      async function init() {
        const entries = await Promise.all(Object.entries(window.BN_ASSETS).map(async ([key, src]) => {
          const image = new Image();
          image.src = src;
          await image.decode();
          return [key, image];
        }));
        await Promise.all([document.fonts.load('20px Terminal'), document.fonts.load('bold 24px Warning')]);
        assets = Object.fromEntries(entries);
        out.drawImage(assets.photo, 0, 0);
        basePixels = out.getImageData(0, 0, CONFIG.width, CONFIG.height).data;
        mapping = prepareMapping();
        ready = true;
        render();
      }
      function wrapText(value, width) {
        const output = [];
        for (const paragraph of String(value || '—').split(/\r?\n/)) {
          let chars = Array.from(paragraph);
          while (chars.length > width) {
            let split = chars.slice(0, width + 1).lastIndexOf(' ');
            if (split < 1) split = width;
            output.push(chars.slice(0, split).join(''));
            chars = chars.slice(split);
            while (chars[0] === ' ') chars.shift();
          }
          output.push(chars.join(''));
        }
        return output;
      }
      function exportPNG(filename, done) {
        if (!ready) { if (done) done(false); return; }
        render();
        canvas.toBlob(blob => {
          try {
            if (!blob) throw Error('PNG indisponível.');
            const url = URL.createObjectURL(blob), link = document.createElement('a');
            link.href = url; link.download = filename || (options.exportName || 'monitor-pj-imagem.png');
            document.body.append(link); link.click(); link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 15000);
            if (done) done(true);
          } catch (error) { if (done) done(false); }
        }, 'image/png');
      }
      const api = {
        init, render,
        ready: () => ready,
        exportPNG,
        wrapText,
        drawText,
        save() { ctx.save(); }, restore() { ctx.restore(); },
        beginPath() { ctx.beginPath(); }, rect(...args) { ctx.rect(...args); }, clip() { ctx.clip(); },
        CHAR_W: CONFIG.charWidth, LINE_H: CONFIG.lineHeight,
        CYAN: CONFIG.cyan, PINK: CONFIG.pink
      };
      return api;
    }
  };
})();
