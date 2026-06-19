# Double Doodle - Web App Specifications & Development Plan

## 1. Overview and Core Concept
"Double Doodle" is a collaborative drawing game originally played on paper, now being adapted into a mobile-first web application. 
- **Player 1 (The Initiator):** Picks their preferred line color and draws a single continuous line (without lifting the pen/finger) to create an abstract, unique starting shape.
- **Player 2 (The Finisher):** Takes the resulting shape and uses unrestricted strokes, colors, and creativity to turn it into a recognizable object, character, or scene. Player 2 cannot choose Player 1's chosen color, but retains access to white and charcoal (unless Charcoal is chosen by Player 1).

## 2. Target Platform
- **Format:** Mobile-first Web Application.
- **Interaction:** Touch-based drawing optimized for smartphones and tablets.

## 3. Core Mechanics & Rules
- **Phase 1: The Continuous Line**
  - Player 1 chooses a starting color from a friendly color palette (default is Charcoal).
  - Input is restricted to a single continuous touch/click event (`touchstart` -> `touchmove` -> `touchend`).
  - Once the user lifts their finger, Phase 1 is locked.
  - A "Clear/Restart" button is available in case Player 1 wants to try their initial stroke again with a new or same color.
- **Phase 2: The Completion**
  - Player 2 receives the canvas.
  - **Dynamic Color Locking:** Player 2's palette dynamically filters out Player 1's selected color so that contributions are easily distinguishable and contrast beautifully. 
  - **Black and White Access:** Player 2 has full access to White (always) and Charcoal/Black (unless Charcoal is chosen by Player 1). Because Player 1's line remains on top, White allows Player 2 to draw positive white space behind the starting doodle!
  - **Custom Color Picker Protection:** If Player 2 attempts to pick Player 1's color using the custom picker, they are block-alerted and returned to a different selection.
  - Player 2 has access to free draw, custom colors, brush sizes, and an eraser. No stroke limits apply.
  - **Eraser Layer Isolation (Advanced UX):** Player 2 can erase their additions, but the eraser is isolated to their layer so they never accidentally wipe out Player 1's starting stroke!
  - **Layer Ordering (Strict Preservation):** Player 1's doodle is always rendered *on top of* Player 2's additions (both live and in the final exported PNG), ensuring it is never covered up or hidden.

## 4. Play Modes
- **Local "Pass the Phone" Mode (Active):** The simplest MVP. Player 1 draws, taps "Done", and hands the device to Player 2.
- **Asynchronous Remote Play via Compact URL Challenge Links (Active):** Player 1 draws, and the system encodes their line vector coordinates into a highly compressed, delta-free Base36 URL query string (e.g., `?doodle=11111100rr10yz...`). Player 1 copies this link and sends it to Player 2. When Player 2 opens the link, the page instantly decodes the vector coordinates, renders the starting line flawlessly on top, and boots directly into Phase 2!
- **Asynchronous Remote Play (Future Database/Server Scale):** Player 1 draws, and the database stores the drawing parameters. This matches our underlying JSON/Vector architecture.

## 5. Technical Stack & Sharing Architecture
- **Frontend:** HTML5, CSS3, vanilla JavaScript.
- **Layered Dual-Canvas Render Engine:** Utilizes offscreen buffers for independent vector drawing and real-time canvas compositing.
- **Mathematical Vector Smoothing (High-DPI Resize Perfect):** Player 1's line is stored as a list of normalized `1000x1000` coordinate vectors. This allows:
  1. **Perfect Screen Responsiveness:** Whether Player 2 opens the challenge on a tiny iPhone or a huge iPad, the vector doodle is mathematically mapped to their screen size perfectly.
  2. **Vector perfect scaling:** On any resize or orientation change, the engine completely re-renders Player 1's doodle from normalized coordinates, resulting in zero raster blurriness or cropping!
- **No-Dependency LZW-Free Compression:** Normalizes lines, applies a distance-threshold simplify algorithm, and serializes each coordinate pair as a padded 4-character base36 block. A 100-point line takes only 400 characters, fitting beautifully within any browser or messaging app URL length safety limits!
- **Cache-Busting Integration:** Query parameters are appended to CSS and JS imports inside `index.html` to bypass aggressive browser caching over local and port-forwarded networks, ensuring code changes deploy seamlessly across separate devices.
- **Backend/Hosting:** Static hosting (like GitHub Pages or Vercel). No database is required for the stateless challenge sharing!

---

## 6. Development Plan Roadmap & Status

### Phase 1: MVP (Minimum Viable Product) - Local Play
- [x] **Setup:** Initialize basic HTML/CSS/JS project files.
- [x] **Canvas Foundation:** Implement a mobile-responsive canvas that prevents default scrolling/zooming gestures while drawing.
- [x] **Phase 1 Logic:** Build the single continuous stroke enforcement mechanism.
- [x] **Phase 2 Logic:** Build the multi-stroke drawing mode, adding a basic color palette and stroke size toggles.
- [x] **Game Flow:** Implement simple state management (Title Screen -> Player 1 turn -> Transition -> Player 2 turn -> Result Screen).
- [x] **Export:** Add functionality to save/download the finished artwork to the device.

### Phase 2: Polish & UX Enhancements
- [x] Add stroke smoothing (using quadratic curve interpolation) so drawings look natural, not jagged.
- [x] Implement robust independent layers for Player 1 and Player 2.
- [x] Add dynamic color palettes (Player 1 picks starting color; Player 2 cannot use Player 1's color, black and white are available).
- [x] Implement strict foreground layering (Player 1's starting line always renders on top of Player 2's background details).
- [x] Polish UI/UX with transitions, animated phone-pass cues, and a clean, minimalist aesthetic with friendly Fredoka typography.

### Phase 3: Separate Devices Remote Play (stateless URL-based)
- [x] **Modularize Vectors:** Record Player 1's stroke as an array of logical coordinates, leaving backend migration fully open.
- [x] **Vector Perfect Scaling:** Re-render Player 1's doodle perfectly from vector points during resize rather than using raster copies.
- [x] **Base36 Coordinate Packing:** Implement custom 4-character base36 coordinate serializers.
- [x] **Coordinate Simplifier:** Build radial distance filter to significantly downsample coordinate sequences before serialization.
- [x] **Dynamic Challenge Boot:** Implement automatic URL parameter detector to launch directly into Phase 2 when opened.
- [x] **Split Transition UI:** Update Screen 3 to offer "Local Pass the Phone" alongside "Separate Device Copy Link" options.
- [x] **Clipboard Sync & Toast feedback:** Add native/fallback clipboard integration and CSS notifications for copied states.
- [x] **Eliminate Temporal Dead Zone (TDZ) Reference Errors:** Hoisted state variable definitions to the top of `initApp()` to support safe instant-booting into Phase 2 during dynamic URL queries.
- [x] **Integrate Cache-Busting Mechanism:** Implemented cache-busting on style and script loading to ensure cross-device consistency.
- [x] **Tight SMS Length Budget (under 140-160 characters):** Configured a strict Ramer-Douglas-Peucker (RDP) limit capping coordinates to exactly 18 critical points, compressing the entire Base36 URL below 130 characters so that it never fragments or breaks when sent via SMS or carrier messaging clients.
- [x] **Progressive URL Shortening Integration (is.gd JSONP):** Implemented client-side JSONP-based automatic link shortening. When copying, the app populates with our 130-char link immediately (fallback) and asynchronously swaps it with a super-short ~19-character is.gd URL within milliseconds, ensuring perfect clickability and SMS delivery.

### Phase 4: Public Live Hosting & Deployment
- [x] **Create Public Git Repository:** Initialized local Git repository, created a public repository on GitHub via `gh` CLI.
- [x] **Enable GitHub Pages:** Configured automated Pages deployments on the root folder of the `main` branch.
- [x] **Live Public Deployment:** Successfully deployed and verified public access.

### Phase 5: Database Gallery (Optional Future Goal)
- [ ] Integrate a backend service (e.g., Firebase, Supabase, or a custom Node/Python backend) to store Player 1's canvas data.
- [ ] Implement URL generation for sharing incomplete doodles with friends.

---

## 7. Running the Project Locally
The web application is active and served locally:
- **Port:** `8003`
- **Command:** `python3 server.py` (zero-cache Python script running in background)
- **Log Location:** `/workspace/double_doodle/game_server.log`

---

## 8. Live Public URL
The web application is hosted publicly and is permanently free to play at:
👉 **[https://spongolo-olo.github.io/double_doodle/](https://spongolo-olo.github.io/double_doodle/)**
