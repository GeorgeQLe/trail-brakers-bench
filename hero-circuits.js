(() => {
  const figure = document.querySelector('[data-circuit-rotation]');
  if (!figure) return;

  // Add future hero circuits here. Coordinates are top-down [x, z] centerlines
  // beginning at start/finish; the renderer fits every shape to the same frame.
  const circuits = [
    {
      id: 'silverstone',
      name: 'Silverstone Circuit',
      location: 'Great Britain',
      rotate: true,
      points: [
        [-0.5323, 0.38478], [-0.25463, 0.02126], [-0.23977, 0.00404],
        [-0.22242, -0.00569], [-0.19094, -0.01221], [-0.15982, -0.01309],
        [-0.01916, 0.00621], [0.00881, 0.00414], [0.0404, -0.00397],
        [0.07433, -0.02076], [0.25105, -0.1618], [0.27201, -0.16893],
        [0.28801, -0.16497], [0.29883, -0.15413], [0.33409, -0.04189],
        [0.34031, -0.03134], [0.35359, -0.0221], [0.3629, -0.02094],
        [0.37227, -0.02398], [0.38239, -0.03328], [0.40595, -0.0837],
        [0.42236, -0.14464], [0.42836, -0.21123], [0.42529, -0.23102],
        [0.4187, -0.24445], [-0.13395, -0.74795], [-0.15634, -0.7614],
        [-0.18494, -0.76853], [-0.21451, -0.76616], [-0.2424, -0.75254],
        [-0.25251, -0.74074], [-0.2582, -0.72628], [-0.26985, -0.63044],
        [-0.28342, -0.61009], [-0.31186, -0.59272], [-0.3407, -0.59215],
        [-0.36728, -0.60554], [-0.38427, -0.62866], [-0.3902, -0.65587],
        [-0.38456, -0.6806], [-0.31645, -0.81815], [-0.29933, -0.84568],
        [-0.24929, -0.89824], [-0.21427, -0.92475], [-0.18316, -0.94154],
        [-0.14309, -0.95404], [-0.08067, -0.9629], [0.32585, -0.9989],
        [0.37091, -0.9985], [0.41124, -0.98057], [0.43795, -0.95466],
        [0.45457, -0.92101], [0.48681, -0.81537], [0.50438, -0.73336],
        [0.51576, -0.62942], [0.52697, -0.41287], [0.53835, -0.37345],
        [0.57369, -0.31036], [0.58024, -0.28394], [0.57462, -0.24941],
        [0.54075, -0.15649], [0.53529, -0.12224], [0.53595, -0.10057],
        [0.54565, -0.06891], [0.59279, -0.00316], [0.59898, 0.02085],
        [0.59804, 0.04764], [0.58519, 0.07806], [0.57274, 0.09256],
        [0.47163, 0.15813], [0.44539, 0.18593], [0.13191, 0.76979],
        [0.04875, 0.90079], [-0.00739, 0.97347], [-0.03718, 0.99267],
        [-0.07079, 0.99978], [-0.10254, 0.99629], [-0.13373, 0.98227],
        [-0.15316, 0.96571], [-0.16628, 0.94765], [-0.20247, 0.87197],
        [-0.24991, 0.79986], [-0.41603, 0.61088], [-0.42435, 0.60642],
        [-0.43925, 0.60811], [-0.47636, 0.64173], [-0.49476, 0.64803],
        [-0.51734, 0.64224], [-0.54001, 0.62017], [-0.56105, 0.59442],
        [-0.57992, 0.56165], [-0.59368, 0.52254], [-0.59945, 0.48964],
        [-0.59289, 0.46385],
      ],
    },
    {
      id: 'spa',
      name: 'Circuit de Spa-Francorchamps',
      location: 'Belgium',
      points: [
        [-61, -8], [-61, -2], [-60, 4], [-58, 10], [-53, 14], [-47, 13],
        [-44, 9], [-45, 3], [-42, -5], [-37, -13], [-32, -20], [-26, -27],
        [-18, -32], [-7, -36], [7, -39], [22, -42], [38, -44], [50, -43],
        [58, -39], [61, -33], [58, -27], [52, -26], [48, -30], [43, -28],
        [40, -22], [42, -15], [48, -10], [53, -7], [56, -1], [56, 7],
        [52, 14], [45, 20], [36, 24], [25, 25], [16, 22], [11, 17],
        [8, 11], [3, 7], [-3, 8], [-7, 14], [-12, 20], [-20, 26],
        [-30, 29], [-40, 27], [-48, 22], [-58, 32], [-69, 23], [-76, 12],
        [-78, 2], [-75, -7], [-70, -12], [-66, -14], [-63, -12], [-61, -14],
      ],
    },
  ];

  const layers = [...figure.querySelectorAll('.circuit__track')];
  const caption = figure.querySelector('[data-circuit-caption]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (layers.length < 2 || circuits.length === 0 || !caption) return;

  let activeLayerIndex = 0;
  let activeTrackIndex = 0;
  let lapToken = 0;
  let swapping = false;
  let cancelSwap = null;

  function distance(a, b) {
    return Math.hypot(b[0] - a[0], b[1] - a[1]);
  }

  function timedLerp(a, b, start, end, time) {
    const span = Math.max(end - start, Number.EPSILON);
    const mix = (time - start) / span;
    return [a[0] + (b[0] - a[0]) * mix, a[1] + (b[1] - a[1]) * mix];
  }

  // Sample the same closed centripetal Catmull-Rom curve used by the demos.
  function sampleCurve(points, samplesPerSegment = 5) {
    const sampled = [];
    const count = points.length;

    for (let index = 0; index < count; index += 1) {
      const p0 = points[(index - 1 + count) % count];
      const p1 = points[index];
      const p2 = points[(index + 1) % count];
      const p3 = points[(index + 2) % count];
      const t0 = 0;
      const t1 = t0 + Math.sqrt(Math.max(distance(p0, p1), Number.EPSILON));
      const t2 = t1 + Math.sqrt(Math.max(distance(p1, p2), Number.EPSILON));
      const t3 = t2 + Math.sqrt(Math.max(distance(p2, p3), Number.EPSILON));

      for (let step = 0; step < samplesPerSegment; step += 1) {
        const time = t1 + ((t2 - t1) * step) / samplesPerSegment;
        const a1 = timedLerp(p0, p1, t0, t1, time);
        const a2 = timedLerp(p1, p2, t1, t2, time);
        const a3 = timedLerp(p2, p3, t2, t3, time);
        const b1 = timedLerp(a1, a2, t0, t2, time);
        const b2 = timedLerp(a2, a3, t1, t3, time);
        sampled.push(timedLerp(b1, b2, t1, t2, time));
      }
    }

    return sampled;
  }

  function makePath(circuit) {
    const projected = sampleCurve(circuit.points).map(([x, z]) =>
      circuit.rotate ? [z, x] : [x, z],
    );
    const xs = projected.map(([x]) => x);
    const ys = projected.map(([, y]) => y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const scale = Math.min(350 / (maxX - minX), 238 / (maxY - minY));
    const offsetX = 200 - ((minX + maxX) * scale) / 2;
    const offsetY = 146 - ((minY + maxY) * scale) / 2;
    const fitted = projected.map(([x, y]) => [
      x * scale + offsetX,
      y * scale + offsetY,
    ]);
    const coordinates = fitted.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`);
    return `M${coordinates.join(' L')} Z`;
  }

  const circuitPaths = circuits.map(makePath);

  function placeStartLine(layer) {
    const path = layer.querySelector('.track-base');
    const line = layer.querySelector('.sf');
    const length = path.getTotalLength();
    const sampleDistance = Math.min(2, length * 0.005);
    const before = path.getPointAtLength(length - sampleDistance);
    const after = path.getPointAtLength(sampleDistance);
    const tangentX = after.x - before.x;
    const tangentY = after.y - before.y;
    const tangentLength = Math.hypot(tangentX, tangentY) || 1;
    const normalX = (-tangentY / tangentLength) * 9;
    const normalY = (tangentX / tangentLength) * 9;
    const start = path.getPointAtLength(0);

    line.setAttribute('x1', start.x - normalX);
    line.setAttribute('y1', start.y - normalY);
    line.setAttribute('x2', start.x + normalX);
    line.setAttribute('y2', start.y + normalY);
  }

  function renderLayer(layer, trackIndex) {
    const path = circuitPaths[trackIndex];
    layer.dataset.trackId = circuits[trackIndex].id;
    for (const trackPath of layer.querySelectorAll('path')) {
      trackPath.setAttribute('d', path);
      trackPath.setAttribute('pathLength', '100');
    }
    placeStartLine(layer);
  }

  function updateCaption() {
    const circuit = circuits[activeTrackIndex];
    const position = String(activeTrackIndex + 1).padStart(2, '0');
    const count = String(circuits.length).padStart(2, '0');
    const status = reducedMotion.matches ? 'static circuit' : 'live lap';
    caption.textContent = `Fig. ${position} / ${count} — ${circuit.name} · ${circuit.location} · ${status}`;
    figure.dataset.activeTrack = circuit.id;
    figure.dataset.trackCount = String(circuits.length);
  }

  function setPhase(phase) {
    figure.dataset.phase = phase;
  }

  function cssTimeToMilliseconds(value) {
    const time = Number.parseFloat(value) || 0;
    return value.trim().endsWith('ms') ? time : time * 1000;
  }

  function startLap() {
    const layer = layers[activeLayerIndex];
    const token = ++lapToken;
    layer.classList.remove('is-lapping');

    if (reducedMotion.matches) {
      setPhase('static');
      return;
    }
    if (document.hidden) {
      setPhase('paused');
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (token !== lapToken || reducedMotion.matches || document.hidden) return;
        layer.classList.add('is-lapping');
        setPhase('lapping');
      });
    });
  }

  function advanceTrack() {
    if (swapping || reducedMotion.matches || circuits.length < 2) return;

    swapping = true;
    setPhase('swapping');
    const outgoing = layers[activeLayerIndex];
    const incomingLayerIndex = (activeLayerIndex + 1) % layers.length;
    const incoming = layers[incomingLayerIndex];
    const nextTrackIndex = (activeTrackIndex + 1) % circuits.length;
    renderLayer(incoming, nextTrackIndex);
    outgoing.classList.remove('is-lapping');

    let finished = false;
    const finishSwap = () => {
      if (finished) return;
      finished = true;
      cleanup();
      if (cancelSwap === cleanup) cancelSwap = null;
      outgoing.classList.remove('is-visible');
      incoming.classList.remove('is-arriving');
      incoming.classList.add('is-visible');
      activeLayerIndex = incomingLayerIndex;
      activeTrackIndex = nextTrackIndex;
      swapping = false;
      updateCaption();
      startLap();
    };
    const onTransitionEnd = (event) => {
      if (event.target === outgoing && event.propertyName === 'opacity') finishSwap();
    };
    const transitionDuration = Math.max(
      ...getComputedStyle(outgoing).transitionDuration
        .split(',')
        .map(cssTimeToMilliseconds),
    );
    const fallback = window.setTimeout(finishSwap, transitionDuration + 100);
    const cleanup = () => {
      outgoing.removeEventListener('transitionend', onTransitionEnd);
      window.clearTimeout(fallback);
    };
    cancelSwap = cleanup;
    outgoing.addEventListener('transitionend', onTransitionEnd);

    incoming.classList.add('is-arriving');
    outgoing.classList.remove('is-visible');
  }

  figure.addEventListener('animationend', (event) => {
    if (event.animationName !== 'circuit-lap' || !event.target.matches('.race-line')) return;
    const layer = event.target.closest('.circuit__track');
    if (layer === layers[activeLayerIndex] && layer.classList.contains('is-lapping')) {
      advanceTrack();
    }
  });

  function settleForMotionPreference() {
    lapToken += 1;
    if (cancelSwap) cancelSwap();
    cancelSwap = null;
    swapping = false;
    figure.classList.remove('is-paused');

    layers.forEach((layer, index) => {
      layer.classList.remove('is-arriving', 'is-lapping');
      layer.classList.toggle('is-visible', index === activeLayerIndex);
    });
    updateCaption();
    startLap();
  }

  reducedMotion.addEventListener('change', settleForMotionPreference);
  document.addEventListener('visibilitychange', () => {
    if (reducedMotion.matches) return;
    const activeLayer = layers[activeLayerIndex];
    if (document.hidden) {
      figure.classList.add('is-paused');
      setPhase('paused');
    } else {
      figure.classList.remove('is-paused');
      if (activeLayer.classList.contains('is-lapping')) setPhase('lapping');
      else startLap();
    }
  });

  renderLayer(layers[0], 0);
  renderLayer(layers[1], circuits.length > 1 ? 1 : 0);
  layers[0].classList.add('is-visible');
  layers[1].classList.remove('is-visible', 'is-arriving', 'is-lapping');
  updateCaption();
  startLap();
})();
