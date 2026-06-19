/* ==========================================
   Double Doodle - Application Engine
   ========================================== */

function initApp() {
  // --- UI Elements ---
  const screens = {
    welcome: document.getElementById('screen-welcome'),
    game: document.getElementById('screen-game'),
    transition: document.getElementById('screen-transition'),
    result: document.getElementById('screen-result')
  };

  const buttons = {
    startGame: document.getElementById('btn-start-game'),
    p1Clear: document.getElementById('btn-p1-clear'),
    p1Done: document.getElementById('btn-p1-done'),
    transitionReady: document.getElementById('btn-transition-ready'),
    toggleEraser: document.getElementById('btn-toggle-eraser'),
    p2Reset: document.getElementById('btn-p2-reset'),
    p2Done: document.getElementById('btn-p2-done'),
    download: document.getElementById('btn-download'),
    restartAll: document.getElementById('btn-restart-all'),
    btnShareLink: document.getElementById('btn-share-link')
  };

  const shareToast = document.getElementById('share-toast');
  const shareLinkInput = document.getElementById('share-link-input');

  const instructionSteps = {
    p1: document.getElementById('p1-instructions'),
    p2: document.getElementById('p2-instructions')
  };

  const controlGroups = {
    phase1: document.getElementById('controls-phase1'),
    phase2: document.getElementById('controls-phase2')
  };

  const canvasWrapper = document.querySelector('.canvas-wrapper');
  const mainCanvas = document.getElementById('doodle-canvas');
  const mainCtx = mainCanvas.getContext('2d');

  const p1FinishedOverlay = document.getElementById('p1-finished-overlay');
  const finalImage = document.getElementById('final-image');
  const brushSizeInput = document.getElementById('brush-size');
  const brushSizeVal = document.getElementById('brush-size-val');
  const customColorPicker = document.getElementById('custom-color-picker');
  const customColorWrapper = customColorPicker.parentElement;

  // --- Offscreen Layer Canvases for Dual-Canvas Architecture ---
  // This allows Player 2 to draw/erase independently without affecting Player 1's starting stroke.
  const p1Canvas = document.createElement('canvas');
  const p1Ctx = p1Canvas.getContext('2d');

  const p2Canvas = document.createElement('canvas');
  const p2Ctx = p2Canvas.getContext('2d');

  // --- Game State variables ---
  let gamePhase = 1; // 1 = Player 1 (Continuous Line), 2 = Player 2 (Free Addition)
  let isDrawing = false;
  let p1StrokeStarted = false;
  let p1StrokeFinished = false;
  let isEraserMode = false;
  
  let p1SelectedColor = '#111111'; // Default Player 1 starting color (Charcoal)
  let currentBrushColor = '#e63946'; // Default Player 2 starting color (Red)
  let currentBrushSize = 5;
  let lastX = 0;
  let lastY = 0;

  // Track coordinates for active interpolation smoothing
  let points = [];

  // Track coordinates for Player 1's complete doodle vector
  let p1StrokePoints = []; 
  let p1StrokePointsNormalized = []; // Normalized 1000x1000 coordinates for scaling/sharing
  let generatedChallengeURL = '';
  let canvasLogicalWidth = 0;
  let canvasLogicalHeight = 0;

  // --- Initialize Event Listeners & Challenge Checking ---
  initEvents();
  checkIncomingChallenge();

  // --- Functions ---

  function initEvents() {
    // Screen transitions
    buttons.startGame.addEventListener('click', () => switchScreen('game'));
    buttons.p1Done.addEventListener('click', () => {
      // Transition from P1 to P2 (Screen 3)
      switchScreen('transition');
    });
    buttons.transitionReady.addEventListener('click', () => {
      // Enter Phase 2
      gamePhase = 2;
      switchScreen('game');
      setupPhase2UI();
    });
    buttons.p2Done.addEventListener('click', showResultScreen);
    buttons.download.addEventListener('click', downloadArtwork);
    buttons.restartAll.addEventListener('click', resetToWelcome);

    // Brush adjustments
    brushSizeInput.addEventListener('input', (e) => {
      currentBrushSize = parseInt(e.target.value);
      brushSizeVal.textContent = currentBrushSize;
    });

    // Player 1 Color Swatches
    document.querySelectorAll('#p1-color-palette .color-swatch').forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        // Prevent color changes once stroke has already been completed
        if (p1StrokeFinished) return;
        
        document.querySelectorAll('#p1-color-palette .color-swatch').forEach(s => s.classList.remove('active'));
        e.target.classList.add('active');
        p1SelectedColor = e.target.getAttribute('data-color');
      });
    });

    // Player 2 Color Swatches
    document.querySelectorAll('#p2-color-palette .color-swatch').forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        deactivateP2ColorControls();
        e.target.classList.add('active');
        currentBrushColor = e.target.getAttribute('data-color');
        disableEraser();
      });
    });

    // Player 2 Custom Color Picker
    customColorPicker.addEventListener('input', (e) => {
      const selectedColor = e.target.value.toLowerCase();
      
      // Block Player 1's chosen color to prevent color confusion
      if (selectedColor === p1SelectedColor.toLowerCase()) {
        alert("🎨 That color is reserved for Player 1's starting doodle! Try picking a slightly different shade so your contributions stand out. ✨");
        // Revert to first available swatch
        const firstAvailable = Array.from(document.querySelectorAll('#p2-color-palette .color-swatch')).find(s => s.style.display !== 'none');
        if (firstAvailable) {
          firstAvailable.click();
        }
        return;
      }
      
      deactivateP2ColorControls();
      customColorWrapper.classList.add('active');
      currentBrushColor = e.target.value;
      disableEraser();
    });

    // Eraser toggle
    buttons.toggleEraser.addEventListener('click', toggleEraser);

    // Select URL in input on click/focus for easy manual copy
    if (shareLinkInput) {
      shareLinkInput.addEventListener('click', () => {
        shareLinkInput.select();
      });
      shareLinkInput.addEventListener('focus', () => {
        shareLinkInput.select();
      });
    }

    // Resets
    buttons.p1Clear.addEventListener('click', resetPhase1);
    buttons.p2Reset.addEventListener('click', resetPhase2);

    // Copy Invite Link (Option 1 Share button)
    if (buttons.btnShareLink) {
      buttons.btnShareLink.addEventListener('click', () => {
        if (!generatedChallengeURL) return;

        // Try modern clipboard API or fallback
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(generatedChallengeURL)
            .then(showToast)
            .catch(() => fallbackCopy(generatedChallengeURL));
        } else {
          fallbackCopy(generatedChallengeURL);
        }
      });
    }

    // Drawing Interaction (Mouse & Touch)
    const startDrawingEvent = (e) => {
      e.preventDefault(); // Prevents touch scrolling on the canvas wrapper
      if (gamePhase === 1 && p1StrokeFinished) return; // Prevent further drawings in Phase 1 once lifted

      isDrawing = true;
      const coords = getEventCoords(e);
      lastX = coords.x;
      lastY = coords.y;
      
      points = [{ x: lastX, y: lastY }];

      if (gamePhase === 1) {
        p1StrokeStarted = true;
        p1StrokePoints = [{ x: lastX, y: lastY }];
      }

      // Draw initial dot
      drawSegment(lastX, lastY, lastX + 0.1, lastY + 0.1);
    };

    const drawEvent = (e) => {
      if (!isDrawing) return;
      e.preventDefault();

      if (gamePhase === 1 && p1StrokeFinished) return;

      const coords = getEventCoords(e);
      points.push({ x: coords.x, y: coords.y });

      if (gamePhase === 1) {
        p1StrokePoints.push({ x: coords.x, y: coords.y });
      }

      // Curve smoothing using midpoints for high-quality lines
      if (points.length > 2) {
        const lastTwo = points.slice(-3);
        const xc = (lastTwo[1].x + lastTwo[2].x) / 2;
        const yc = (lastTwo[1].y + lastTwo[2].y) / 2;
        
        drawSmoothCurve(lastTwo[0].x, lastTwo[0].y, lastTwo[1].x, lastTwo[1].y, xc, yc);
      } else {
        drawSegment(lastX, lastY, coords.x, coords.y);
      }

      lastX = coords.x;
      lastY = coords.y;
    };

    const stopDrawingEvent = (e) => {
      if (!isDrawing) return;
      isDrawing = false;
      points = [];

      if (gamePhase === 1 && p1StrokeStarted) {
        // Player 1 lifted their pen/finger -> Phase 1 is locked!
        p1StrokeFinished = true;
        p1FinishedOverlay.classList.remove('hidden');
        buttons.p1Done.disabled = false;

        // Save normalized vector coordinates and generate share link
        p1StrokePointsNormalized = getNormalizedStrokePoints();
        generateChallengeLink();
      }
    };

    // Standard mouse events
    mainCanvas.addEventListener('mousedown', startDrawingEvent);
    mainCanvas.addEventListener('mousemove', drawEvent);
    window.addEventListener('mouseup', stopDrawingEvent);

    // Mobile touch events
    mainCanvas.addEventListener('touchstart', startDrawingEvent, { passive: false });
    mainCanvas.addEventListener('touchmove', drawEvent, { passive: false });
    window.addEventListener('touchend', stopDrawingEvent);
    window.addEventListener('touchcancel', stopDrawingEvent);

    // Dynamic responsive sizing of canvas
    window.addEventListener('resize', handleResize);
    // Initial size setup
    handleResize();
  }

  // --- Screens Swapping ---
  function switchScreen(screenKey) {
    Object.keys(screens).forEach(key => {
      if (key === screenKey) {
        screens[key].classList.add('active');
      } else {
        screens[key].classList.remove('active');
      }
    });

    // Setup callback hooks for screen activation
    if (screenKey === 'game') {
      setTimeout(handleResize, 50); // Recalculate canvas sizes if screen changed
    }
  }

  // --- Canvas High-DPI Responsiveness ---

  function handleResize() {
    if (!screens.game.classList.contains('active')) return;

    // Get the logical CSS dimensions of the parent wrapper
    const rect = canvasWrapper.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // If dimensions are zero, wait until the browser has finished rendering layout
    if (width === 0 || height === 0) {
      console.log('handleResize: canvas wrapper size is 0, scheduling retry...');
      setTimeout(handleResize, 100);
      return;
    }

    // If size hasn't actually changed, return to avoid flashing/wiping
    if (Math.abs(canvasLogicalWidth - width) < 1 && Math.abs(canvasLogicalHeight - height) < 1) {
      return;
    }

    canvasLogicalWidth = width;
    canvasLogicalHeight = height;

    const ratio = window.devicePixelRatio || 1;

    // Save existing pixel state for Player 2 additions (raster restore is perfect since P2 is unrestricted)
    const tempP2 = document.createElement('canvas');
    tempP2.width = p2Canvas.width;
    tempP2.height = p2Canvas.height;
    tempP2.getContext('2d').drawImage(p2Canvas, 0, 0);

    // Scale main canvas
    mainCanvas.width = width * ratio;
    mainCanvas.height = height * ratio;
    mainCtx.scale(ratio, ratio);

    // Scale offscreen canvases
    p1Canvas.width = width * ratio;
    p1Canvas.height = height * ratio;
    p1Ctx.scale(ratio, ratio);

    p2Canvas.width = width * ratio;
    p2Canvas.height = height * ratio;
    p2Ctx.scale(ratio, ratio);

    // Re-render Player 1's starting line perfectly from vector points (no pixel blurriness!)
    if (p1StrokePointsNormalized && p1StrokePointsNormalized.length > 0) {
      renderDecodedP1Stroke();
    }

    // Restore Player 2's raster additions smoothly
    if (tempP2.width > 0) {
      p2Ctx.save();
      p2Ctx.scale(1/ratio, 1/ratio);
      p2Ctx.drawImage(tempP2, 0, 0, p2Canvas.width, p2Canvas.height);
      p2Ctx.restore();
    }

    // Refresh composited screen
    compositeCanvas();
  }

  // --- Compositing Layers ---
  function compositeCanvas() {
    // 1. Clear main screen to solid white background
    mainCtx.fillStyle = '#ffffff';
    mainCtx.fillRect(0, 0, canvasLogicalWidth, canvasLogicalHeight);

    // 2. Draw Player 2's canvas layer (background additions) first so it stays behind Player 1's line
    mainCtx.drawImage(p2Canvas, 0, 0, canvasLogicalWidth, canvasLogicalHeight);

    // 3. Draw Player 1's canvas layer (continuous line) on top so it is never covered up
    mainCtx.drawImage(p1Canvas, 0, 0, canvasLogicalWidth, canvasLogicalHeight);
  }

  // --- Drawing Helpers ---

  function getEventCoords(e) {
    const rect = mainCanvas.getBoundingClientRect();
    let clientX, clientY;
    
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Map the coordinate back to canvas relative space
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  // Draw basic straight segment
  function drawSegment(x1, y1, x2, y2) {
    const activeCtx = (gamePhase === 1) ? p1Ctx : p2Ctx;

    activeCtx.beginPath();
    activeCtx.moveTo(x1, y1);
    activeCtx.lineTo(x2, y2);
    
    applyDrawingStyles(activeCtx);
    activeCtx.stroke();

    compositeCanvas();
  }

  // Draw smooth quadratic curves (interpolation)
  function drawSmoothCurve(xStart, yStart, xControl, yControl, xEnd, yEnd) {
    const activeCtx = (gamePhase === 1) ? p1Ctx : p2Ctx;

    activeCtx.beginPath();
    activeCtx.moveTo(xStart, yStart);
    activeCtx.quadraticCurveTo(xControl, yControl, xEnd, yEnd);

    applyDrawingStyles(activeCtx);
    activeCtx.stroke();

    compositeCanvas();
  }

  function applyDrawingStyles(ctx) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (gamePhase === 1) {
      // Player 1 has a permanent thick stylish line in their selected color
      ctx.strokeStyle = p1SelectedColor;
      ctx.lineWidth = 6;
      ctx.globalCompositeOperation = 'source-over';
    } else {
      // Player 2 settings
      ctx.lineWidth = currentBrushSize;
      if (isEraserMode) {
        // Genuine subtraction erases P2's canvas layer only
        ctx.strokeStyle = '#000000'; // Color is ignored in destination-out, but must be set
        ctx.globalCompositeOperation = 'destination-out';
      } else {
        ctx.strokeStyle = currentBrushColor;
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }

  // --- Toolbar & Swatch UI Controls ---

  function deactivateP2ColorControls() {
    document.querySelectorAll('#p2-color-palette .color-swatch').forEach(s => s.classList.remove('active'));
    customColorWrapper.classList.remove('active');
  }

  function toggleEraser() {
    if (isEraserMode) {
      disableEraser();
      
      // Select the first visible swatch to restore the active brush color
      const firstAvailable = Array.from(document.querySelectorAll('#p2-color-palette .color-swatch')).find(s => s.style.display !== 'none');
      if (firstAvailable) {
        firstAvailable.click();
      }
    } else {
      enableEraser();
    }
  }

  function enableEraser() {
    isEraserMode = true;
    buttons.toggleEraser.classList.add('active');
    deactivateP2ColorControls();
  }

  function disableEraser() {
    isEraserMode = false;
    buttons.toggleEraser.classList.remove('active');
  }

  // --- Reset Methods ---

  function resetPhase1() {
    // Clear the offscreen P1 canvas
    p1Ctx.clearRect(0, 0, canvasLogicalWidth, canvasLogicalHeight);
    
    // Reset control variables
    p1StrokeStarted = false;
    p1StrokeFinished = false;
    isDrawing = false;
    points = [];
    p1StrokePoints = [];
    p1StrokePointsNormalized = [];
    generatedChallengeURL = '';

    // Reset UI buttons & hide lock overlay
    p1FinishedOverlay.classList.add('hidden');
    buttons.p1Done.disabled = true;

    compositeCanvas();
  }

  function resetPhase2() {
    // Clear Player 2's additions completely
    p2Ctx.clearRect(0, 0, canvasLogicalWidth, canvasLogicalHeight);
    compositeCanvas();
  }

  function setupPhase2UI() {
    // Shift top banner steps
    instructionSteps.p1.classList.remove('active');
    instructionSteps.p2.classList.add('active');

    // Swap toolboxes
    controlGroups.phase1.classList.remove('active');
    controlGroups.phase2.classList.add('active');

    // Remove P1 locks
    p1FinishedOverlay.classList.add('hidden');

    // Configure Player 2's palette dynamically (Player 2 cannot use Player 1's chosen color)
    const p2Swatches = document.querySelectorAll('#p2-color-palette .color-swatch');
    let firstAvailableSwatch = null;

    p2Swatches.forEach(swatch => {
      const swatchColor = swatch.getAttribute('data-color');
      if (swatchColor === p1SelectedColor) {
        swatch.style.display = 'none';
      } else {
        swatch.style.display = 'block';
        if (!firstAvailableSwatch) {
          firstAvailableSwatch = swatch;
        }
      }
    });

    // Make sure eraser mode starts as disabled
    disableEraser();

    // Automatically click/apply the first available non-conflicting color swatch for Player 2
    if (firstAvailableSwatch) {
      firstAvailableSwatch.click();
    }
  }

  // --- Result Generation & Saving ---

  function showResultScreen() {
    // Convert canvas to a high resolution final PNG
    // Create a temporary canvas that consolidates our drawings on a white backdrop
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = mainCanvas.width;
    finalCanvas.height = mainCanvas.height;
    const finalCtx = finalCanvas.getContext('2d');

    // Fill white background (necessary for clean JPEG/PNG share outputs)
    finalCtx.fillStyle = '#ffffff';
    finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

    // Composite layers: Draw Player 2's additions first, then Player 1's starting line on top
    finalCtx.drawImage(p2Canvas, 0, 0);
    finalCtx.drawImage(p1Canvas, 0, 0);

    const dataURL = finalCanvas.toDataURL('image/png');
    finalImage.src = dataURL;

    switchScreen('result');
  }

  function downloadArtwork() {
    const dataURL = finalImage.src;
    if (!dataURL) return;

    // Trigger physical browser image file download
    const link = document.createElement('a');
    link.download = 'double-doodle-masterpiece.png';
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function resetToWelcome() {
    gamePhase = 1;
    p1StrokeStarted = false;
    p1StrokeFinished = false;
    isDrawing = false;
    points = [];
    p1StrokePoints = [];
    p1StrokePointsNormalized = [];
    generatedChallengeURL = '';
    isEraserMode = false;
    p1SelectedColor = '#111111';
    currentBrushColor = '#e63946';
    currentBrushSize = 5;

    // Clean up URL parameters so a refresh starts fresh
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Reset brush range input slider UI
    brushSizeInput.value = 5;
    brushSizeVal.textContent = 5;

    // Clear both offscreen canvases
    p1Ctx.clearRect(0, 0, p1Canvas.width, p1Canvas.height);
    p2Ctx.clearRect(0, 0, p2Canvas.width, p2Canvas.height);

    // Reset Player 1's swatches UI
    document.querySelectorAll('#p1-color-palette .color-swatch').forEach(s => s.classList.remove('active'));
    const defaultP1Swatch = document.querySelector('#p1-color-palette .color-swatch[data-color="#111111"]');
    if (defaultP1Swatch) defaultP1Swatch.classList.add('active');

    // Reset Player 2's swatches UI and custom color picker
    document.querySelectorAll('#p2-color-palette .color-swatch').forEach(s => s.classList.remove('active'));
    customColorWrapper.classList.remove('active');
    customColorPicker.value = '#e63946';

    // UI elements reset
    p1FinishedOverlay.classList.add('hidden');
    buttons.p1Done.disabled = true;
    
    instructionSteps.p2.classList.remove('active');
    instructionSteps.p1.classList.add('active');
    controlGroups.phase2.classList.remove('active');
    controlGroups.phase1.classList.add('active');

    compositeCanvas();
    switchScreen('welcome');
  }

  // --- Option 1: URL Sharing Core System (Vector Coordinate Normalizer & Simplifier) ---

  function encodeValue(v) {
    v = Math.max(0, Math.min(999, Math.round(v)));
    let str = v.toString(36);
    return str.length === 1 ? '0' + str : str;
  }

  function decodeValue(str) {
    return parseInt(str, 36);
  }

  function getNormalizedStrokePoints() {
    if (!p1StrokePoints || p1StrokePoints.length === 0) return [];
    return p1StrokePoints.map(pt => ({
      x: Math.round((pt.x / canvasLogicalWidth) * 1000),
      y: Math.round((pt.y / canvasLogicalHeight) * 1000)
    }));
  }

  function simplifyPoints(normalizedPts, threshold = 5) {
    if (normalizedPts.length <= 2) return normalizedPts;
    const simplified = [normalizedPts[0]];
    let lastKept = normalizedPts[0];
    
    for (let i = 1; i < normalizedPts.length - 1; i++) {
      const pt = normalizedPts[i];
      const dx = pt.x - lastKept.x;
      const dy = pt.y - lastKept.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= threshold) {
        simplified.push(pt);
        lastKept = pt;
      }
    }
    simplified.push(normalizedPts[normalizedPts.length - 1]);
    return simplified;
  }

  function getSqSegDist(p, p1, p2) {
    let x = p1.x, y = p1.y, dx = p2.x - x, dy = p2.y - y;
    if (dx !== 0 || dy !== 0) {
      const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) {
        x = p2.x;
        y = p2.y;
      } else if (t > 0) {
        x += dx * t;
        y += dy * t;
      }
    }
    dx = p.x - x;
    dy = p.y - y;
    return dx * dx + dy * dy;
  }

  function rdpSimplify(points, epsilon) {
    if (points.length <= 2) return points;
    let maxSqDist = 0;
    let index = 0;
    const end = points.length - 1;
    for (let i = 1; i < end; i++) {
      const sqDist = getSqSegDist(points[i], points[0], points[end]);
      if (sqDist > maxSqDist) {
        index = i;
        maxSqDist = sqDist;
      }
    }
    if (maxSqDist > epsilon * epsilon) {
      const results1 = rdpSimplify(points.slice(0, index + 1), epsilon);
      const results2 = rdpSimplify(points.slice(index), epsilon);
      return results1.slice(0, results1.length - 1).concat(results2);
    } else {
      return [points[0], points[end]];
    }
  }

  function compressAndSimplifyStroke(points) {
    if (points.length <= 2) return points;
    // Step 1: Pre-simplify with low radial distance filter to clean up minor noise
    const preSimplified = simplifyPoints(points, 1.5);
    
    // Step 2: Ramer-Douglas-Peucker (RDP) algorithm with dynamic epsilon target
    let epsilon = 1.5;
    let rdpResult = rdpSimplify(preSimplified, epsilon);
    
    // Step 3: Budget guard loop (force point count to <= 80 to prevent excessive URL length)
    while (rdpResult.length > 80 && epsilon < 100) {
      epsilon += 0.5;
      rdpResult = rdpSimplify(preSimplified, epsilon);
    }
    return rdpResult;
  }

  function shortenURLisGd(longUrl, callback) {
    const callbackName = 'isgd_callback_' + Math.round(Math.random() * 1000000);
    window[callbackName] = function(data) {
      delete window[callbackName];
      const scriptTag = document.getElementById(callbackName);
      if (scriptTag && scriptTag.parentNode) {
        scriptTag.parentNode.removeChild(scriptTag);
      }
      if (data && data.shorturl) {
        callback(data.shorturl);
      }
    };
    const script = document.createElement('script');
    script.id = callbackName;
    script.src = 'https://is.gd/create.php?format=json&url=' + encodeURIComponent(longUrl) + '&callback=' + callbackName;
    document.body.appendChild(script);
  }

  function generateChallengeLink() {
    console.log('generateChallengeLink called');
    if (!p1StrokePointsNormalized || p1StrokePointsNormalized.length === 0) {
      console.warn('generateChallengeLink: p1StrokePointsNormalized is empty');
      return;
    }

    // 1. Simplify points using Ramer-Douglas-Peucker (RDP) hybrid compression to guarantee SMS friendly link
    const simplified = compressAndSimplifyStroke(p1StrokePointsNormalized);
    console.log('Simplified points count:', simplified.length, 'from:', p1StrokePointsNormalized.length);

    // 2. Serialize to base36 compact coordinate payload
    // Format: colorHex (6 characters) + [x (2 chars) + y (2 chars)] per point
    const colorHex = p1SelectedColor.replace('#', '');
    let coordsPayload = '';
    simplified.forEach(pt => {
      coordsPayload += encodeValue(pt.x) + encodeValue(pt.y);
    });

    const doodlePayload = colorHex + coordsPayload;

    // 3. Construct share link
    const baseUrl = window.location.origin + window.location.pathname;
    generatedChallengeURL = `${baseUrl}?doodle=${doodlePayload}`;
    console.log('Generated challenge URL successfully:', generatedChallengeURL);

    // 4. Update the input field in UI with compressed URL
    if (shareLinkInput) {
      shareLinkInput.value = generatedChallengeURL;
    }

    // 5. Asynchronously fetch an even shorter is.gd link as a progressive upgrade
    try {
      generateShortenedLink(generatedChallengeURL);
    } catch (e) {
      console.warn('is.gd shortening setup failed:', e);
    }
  }

  function generateShortenedLink(longUrl) {
    shortenURLisGd(longUrl, function(shortUrl) {
      console.log('Successfully shortened URL via is.gd:', shortUrl);
      generatedChallengeURL = shortUrl;
      if (shareLinkInput) {
        shareLinkInput.value = shortUrl;
      }
    });
  }

  function checkIncomingChallenge() {
    console.log('checkIncomingChallenge running');
    const urlParams = new URLSearchParams(window.location.search);
    const doodleCode = urlParams.get('doodle');
    console.log('Incoming doodle code from URL:', doodleCode);

    if (doodleCode && doodleCode.length >= 10) {
      try {
        // Decode hex color (first 6 chars)
        p1SelectedColor = '#' + doodleCode.slice(0, 6);
        console.log('Decoded starting color:', p1SelectedColor);

        // Decode point coordinates (remaining 4-char sequences)
        const coordsStr = doodleCode.slice(6);
        const decoded = [];
        for (let i = 0; i < coordsStr.length; i += 4) {
          const xStr = coordsStr.slice(i, i + 2);
          const yStr = coordsStr.slice(i + 2, i + 4);
          if (xStr.length === 2 && yStr.length === 2) {
            decoded.push({
              x: decodeValue(xStr),
              y: decodeValue(yStr)
            });
          }
        }

        console.log('Parsed coordinates count:', decoded.length);
        if (decoded.length > 0) {
          p1StrokePointsNormalized = decoded;

          // Configure state immediately for Player 2
          gamePhase = 2;
          p1StrokeStarted = true;
          p1StrokeFinished = true;

          // Transition directly into the game on load
          switchScreen('game');

          setTimeout(() => {
            console.log('Executing post-load challenge rendering...');
            try {
              handleResize();
              renderDecodedP1Stroke();
              setupPhase2UI();
            } catch (err) {
              console.error('CRITICAL TIMEOUT ERROR:', err.message, err.stack);
            }
          }, 100);

          return true;
        }
      } catch (err) {
        console.error('Failed to parse incoming doodle challenge:', err);
      }
    } else {
      console.log('No valid doodle parameter in URL or code length < 10');
    }
    return false;
  }

  function renderDecodedP1Stroke() {
    if (!p1StrokePointsNormalized || p1StrokePointsNormalized.length === 0) return;

    // Scale normalized 1000x1000 vector coords back to actual responsive physical screen dimensions
    p1StrokePoints = p1StrokePointsNormalized.map(pt => ({
      x: (pt.x / 1000) * canvasLogicalWidth,
      y: (pt.y / 1000) * canvasLogicalHeight
    }));

    // Perform vector stroke re-draw on P1 offscreen layer canvas
    p1Ctx.clearRect(0, 0, canvasLogicalWidth, canvasLogicalHeight);

    if (p1StrokePoints.length > 0) {
      p1Ctx.lineCap = 'round';
      p1Ctx.lineJoin = 'round';
      p1Ctx.strokeStyle = p1SelectedColor;
      p1Ctx.lineWidth = 6;
      p1Ctx.globalCompositeOperation = 'source-over';

      // 1. Draw starting dot
      const first = p1StrokePoints[0];
      p1Ctx.beginPath();
      p1Ctx.moveTo(first.x, first.y);
      p1Ctx.lineTo(first.x + 0.1, first.y + 0.1);
      p1Ctx.stroke();

      // 2. Interpolate quadratic curves through points for vector perfect smoothing
      if (p1StrokePoints.length > 1) {
        p1Ctx.beginPath();
        p1Ctx.moveTo(p1StrokePoints[0].x, p1StrokePoints[0].y);

        if (p1StrokePoints.length === 2) {
          p1Ctx.lineTo(p1StrokePoints[1].x, p1StrokePoints[1].y);
        } else {
          let i;
          for (i = 1; i < p1StrokePoints.length - 2; i++) {
            const xc = (p1StrokePoints[i].x + p1StrokePoints[i+1].x) / 2;
            const yc = (p1StrokePoints[i].y + p1StrokePoints[i+1].y) / 2;
            p1Ctx.quadraticCurveTo(p1StrokePoints[i].x, p1StrokePoints[i].y, xc, yc);
          }
          p1Ctx.quadraticCurveTo(
            p1StrokePoints[i].x,
            p1StrokePoints[i].y,
            p1StrokePoints[i+1].x,
            p1StrokePoints[i+1].y
          );
        }
        p1Ctx.stroke();
      }
    }

    compositeCanvas();
  }

  function fallbackCopy(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      showToast();
    } catch (err) {
      console.error('Fallback copy failed:', err);
      alert("Could not copy link automatically. Please copy it manually:\n\n" + text);
    }
    document.body.removeChild(textArea);
  }

  function showToast() {
    if (shareToast) {
      shareToast.classList.remove('hidden');
      setTimeout(() => {
        shareToast.classList.add('hidden');
      }, 3500);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}