(() => {
  "use strict";

  const slides = [...document.querySelectorAll(".story-slide")];
  const nextButton = document.querySelector("#next-button");
  const prevButton = document.querySelector("#prev-button");
  const stage = document.querySelector("#book-stage");
  const progressBar = document.querySelector("#progress-bar");
  const progressLabel = document.querySelector("#progress-label");
  const pageCount = document.querySelector("#page-count");
  const toast = document.querySelector("#toast");
  const pagerButtons = [...document.querySelectorAll("[data-pager]")];
  const slideLabels = ["Supplies", "The garage", "Blast off", "Mars", "Snack finale"];
  let currentSlide = 0;
  let toastTimer;

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2200);
  }

  function goToSlide(target) {
    const destination = Math.max(0, Math.min(slides.length - 1, target));
    if (destination === currentSlide) return;
    slides[currentSlide].hidden = true;
    slides[currentSlide].classList.remove("is-active");
    currentSlide = destination;
    slides[currentSlide].hidden = false;
    void slides[currentSlide].offsetWidth;
    slides[currentSlide].classList.add("is-active");
    progressBar.style.width = `${((currentSlide + 1) / slides.length) * 100}%`;
    progressLabel.textContent = slideLabels[currentSlide];
    pageCount.textContent = `${currentSlide + 1} / ${slides.length}`;
    pagerButtons.forEach((button, index) => {
      button.toggleAttribute("aria-current", index === currentSlide);
    });
    prevButton.disabled = currentSlide === 0;
    nextButton.disabled = currentSlide === slides.length - 1;
    stage.focus({ preventScroll: true });
    window.location.hash = `story-${currentSlide}`;
  }

  nextButton.addEventListener("click", () => goToSlide(currentSlide + 1));
  prevButton.addEventListener("click", () => goToSlide(currentSlide - 1));
  pagerButtons.forEach((button) => button.addEventListener("click", () => goToSlide(Number(button.dataset.pager))));
  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === "PageDown") goToSlide(currentSlide + 1);
    if (event.key === "ArrowLeft" || event.key === "PageUp") goToSlide(currentSlide - 1);
  });

  let touchStartX = null;
  stage.addEventListener("touchstart", (event) => {
    touchStartX = event.changedTouches[0].clientX;
  }, { passive: true });
  stage.addEventListener("touchend", (event) => {
    if (touchStartX === null) return;
    const distance = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(distance) > 65) goToSlide(currentSlide + (distance < 0 ? 1 : -1));
    touchStartX = null;
  }, { passive: true });

  // Supplies: each named item can be packed by click, drag, or keyboard.
  const supplyItems = [...document.querySelectorAll(".supply-item")];
  const supplyCrate = document.querySelector("#supply-crate");
  function packSupply(item) {
    if (!item || item.classList.contains("is-packed")) return;
    item.classList.add("is-packed");
    const count = supplyItems.filter((supply) => supply.classList.contains("is-packed")).length;
    document.querySelector("#supply-count").textContent = count;
    if (count === supplyItems.length) showToast("The blanket, boots, wrench, and blueprint are packed! 📦");
  }
  supplyItems.forEach((item) => {
    item.addEventListener("click", () => packSupply(item));
    item.addEventListener("dragstart", (event) => event.dataTransfer?.setData("text/plain", item.dataset.supply));
  });
  supplyCrate.addEventListener("dragover", (event) => event.preventDefault());
  supplyCrate.addEventListener("drop", (event) => {
    event.preventDefault();
    const item = supplyItems.find((supply) => supply.dataset.supply === event.dataTransfer?.getData("text/plain"));
    packSupply(item);
  });
  supplyCrate.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      packSupply(supplyItems.find((item) => !item.classList.contains("is-packed")));
    }
  });

  // Garage: draw and save four named rocket pieces in sequence.
  const drawingSteps = [
    { key: "nose", label: "nose", instruction: "draw the nose" },
    { key: "body", label: "body", instruction: "draw the body" },
    { key: "window", label: "window", instruction: "draw the window" },
    { key: "fins", label: "fins", instruction: "draw the fins" }
  ];
  const drawingCanvas = document.querySelector("#rocket-canvas");
  const drawingContext = drawingCanvas.getContext("2d");
  const garageRocketCanvas = document.querySelector("#garage-rocket-canvas");
  const garageRocketContext = garageRocketCanvas.getContext("2d");
  const snackRocketCanvas = document.querySelector("#snack-rocket-canvas");
  const snackRocketContext = snackRocketCanvas.getContext("2d");
  const launchCanvas = document.querySelector("#launch-rocket-canvas");
  const launchContext = launchCanvas.getContext("2d");
  const drawingStepCount = document.querySelector("#drawing-step-count");
  const drawingStepLabels = [...document.querySelectorAll("[data-drawing-step]")];
  const colorSwatches = [...document.querySelectorAll(".color-swatch")];
  const clearDrawingButton = document.querySelector("#clear-rocket-drawing");
  const clearAllDrawingButton = document.querySelector("#clear-all-rocket-drawing");
  const savePartButton = document.querySelector("#save-rocket-part");
  const drawingMessage = document.querySelector("#rocket-save-message");
  const rocketStorageKey = "johnny-builds-to-mars-rocket-drawing";
  let drawingStep = 0;
  let selectedColor = "#f06460";
  let activeStroke = null;
  let drawingState = {
    saved: { nose: [], body: [], window: [], fins: [] },
    current: []
  };

  function loadRocketDrawing() {
    try {
      const stored = JSON.parse(window.localStorage.getItem(rocketStorageKey));
      if (!stored || !stored.saved) return;
      drawingSteps.forEach(({ key }) => {
        if (Array.isArray(stored.saved[key])) drawingState.saved[key] = stored.saved[key];
      });
      if (Array.isArray(stored.current)) drawingState.current = stored.current;
      if (Number.isInteger(stored.step)) drawingStep = Math.max(0, Math.min(drawingSteps.length - 1, stored.step));
    } catch (error) {
      // A private browsing context may deny storage; drawing still works for this visit.
    }
  }

  function saveRocketDrawing() {
    try {
      window.localStorage.setItem(rocketStorageKey, JSON.stringify({ saved: drawingState.saved, current: drawingState.current, step: drawingStep }));
    } catch (error) {
      // Automatic saving is best effort when storage is unavailable.
    }
  }

  function drawStroke(context, stroke) {
    if (!stroke.points.length) return;
    context.beginPath();
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = stroke.width;
    context.strokeStyle = stroke.color;
    context.moveTo(stroke.points[0].x, stroke.points[0].y);
    stroke.points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
    if (stroke.points.length === 1) context.lineTo(stroke.points[0].x + 0.01, stroke.points[0].y + 0.01);
    context.stroke();
  }

  function allSavedStrokes() {
    return drawingSteps.flatMap(({ key }) => drawingState.saved[key]);
  }

  function renderRocketArtwork() {
    drawingContext.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    [...allSavedStrokes(), ...drawingState.current].forEach((stroke) => drawStroke(drawingContext, stroke));
    garageRocketContext.clearRect(0, 0, garageRocketCanvas.width, garageRocketCanvas.height);
    allSavedStrokes().forEach((stroke) => drawStroke(garageRocketContext, stroke));
    snackRocketContext.clearRect(0, 0, snackRocketCanvas.width, snackRocketCanvas.height);
    allSavedStrokes().forEach((stroke) => drawStroke(snackRocketContext, stroke));
    launchContext.clearRect(0, 0, launchCanvas.width, launchCanvas.height);
    allSavedStrokes().forEach((stroke) => drawStroke(launchContext, stroke));
    const completed = drawingSteps.every(({ key }) => drawingState.saved[key].length > 0);
    document.querySelector("#blast-rocket").classList.toggle("has-custom-rocket", completed);
  }

  function updateDrawingUI() {
    const step = drawingSteps[drawingStep];
    const completed = drawingSteps.every(({ key }) => drawingState.saved[key].length > 0);
    drawingStepCount.textContent = completed ? "Rocket complete: every piece is saved." : `Step ${drawingStep + 1} of ${drawingSteps.length}: ${step.instruction}`;
    drawingStepLabels.forEach((label, index) => {
      label.classList.toggle("is-current", index === drawingStep && !completed);
      label.classList.toggle("is-saved", drawingState.saved[drawingSteps[index].key].length > 0);
    });
    savePartButton.textContent = completed ? "Rocket saved" : `Save ${step.label}`;
    savePartButton.disabled = completed || drawingState.current.length === 0;
    clearDrawingButton.disabled = drawingState.current.length === 0;
    if (completed) drawingMessage.textContent = "Saved automatically. Your rocket is ready for launch!";
  }

  function drawingPoint(event) {
    const rect = drawingCanvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * drawingCanvas.width / rect.width, y: (event.clientY - rect.top) * drawingCanvas.height / rect.height };
  }

  colorSwatches.forEach((swatch) => swatch.addEventListener("click", () => {
    selectedColor = swatch.dataset.color;
    colorSwatches.forEach((item) => item.classList.toggle("is-selected", item === swatch));
  }));
  drawingCanvas.addEventListener("pointerdown", (event) => {
    if (drawingStep >= drawingSteps.length) return;
    event.preventDefault();
    drawingCanvas.setPointerCapture(event.pointerId);
    activeStroke = { color: selectedColor, width: 7, points: [drawingPoint(event)] };
    drawingState.current.push(activeStroke);
    renderRocketArtwork();
    updateDrawingUI();
  });
  drawingCanvas.addEventListener("pointermove", (event) => {
    if (!activeStroke) return;
    activeStroke.points.push(drawingPoint(event));
    renderRocketArtwork();
  });
  drawingCanvas.addEventListener("pointerup", () => {
    if (!activeStroke) return;
    activeStroke = null;
    saveRocketDrawing();
    drawingMessage.textContent = `Your ${drawingSteps[drawingStep].label} sketch is saved automatically. Click Save when it is ready.`;
    updateDrawingUI();
  });
  drawingCanvas.addEventListener("pointercancel", () => {
    activeStroke = null;
    saveRocketDrawing();
  });
  clearDrawingButton.addEventListener("click", () => {
    drawingState.current = [];
    saveRocketDrawing();
    renderRocketArtwork();
    drawingMessage.textContent = `Draw the ${drawingSteps[drawingStep].label} again.`;
    updateDrawingUI();
  });
  clearAllDrawingButton.addEventListener("click", () => {
    drawingState = {
      saved: { nose: [], body: [], window: [], fins: [] },
      current: []
    };
    drawingStep = 0;
    activeStroke = null;
    try {
      window.localStorage.removeItem(rocketStorageKey);
    } catch (error) {
      // The visible pad still clears if local storage is unavailable.
    }
    renderRocketArtwork();
    updateDrawingUI();
    drawingMessage.textContent = "The entire pad is clear. Start with the nose.";
    showToast("Drawing pad cleared.");
  });
  savePartButton.addEventListener("click", () => {
    if (!drawingState.current.length || savePartButton.disabled) return;
    const step = drawingSteps[drawingStep];
    drawingState.saved[step.key] = drawingState.current;
    drawingState.current = [];
    if (drawingStep < drawingSteps.length - 1) {
      drawingStep += 1;
      drawingMessage.textContent = `${step.label.charAt(0).toUpperCase() + step.label.slice(1)} saved. Next, ${drawingSteps[drawingStep].instruction}.`;
    } else {
      drawingMessage.textContent = "All four pieces saved. Your rocket is ready for launch!";
      showToast("Your rocket is ready! 🚀");
    }
    saveRocketDrawing();
    renderRocketArtwork();
    updateDrawingUI();
  });
  loadRocketDrawing();
  renderRocketArtwork();
  updateDrawingUI();

  document.querySelector("#judging-dog").addEventListener("click", () => {
    const bubble = document.querySelector("#dog-bubble");
    const nextLine = bubble.textContent === "Hmm." ? "Is that supposed to fly?" : "...I’ll allow it.";
    bubble.textContent = nextLine;
    bubble.classList.remove("is-talking");
    void bubble.offsetWidth;
    bubble.classList.add("is-talking");
  });

  // Blastoff: hold to charge, then keep the rocket fully visible on the way up.
  const launchLever = document.querySelector("#launch-lever");
  const launchBar = document.querySelector("#launch-bar");
  const launchMessage = document.querySelector("#launch-message");
  const blastRocket = document.querySelector("#blast-rocket");
  const countdown = document.querySelector("#countdown");
  let launchPower = 0;
  let launchTimer;
  let countdownTimer;
  function stopCharging() {
    window.clearInterval(launchTimer);
    launchTimer = null;
  }
  function startCharging() {
    if (launchPower >= 100) return;
    stopCharging();
    launchTimer = window.setInterval(() => {
      launchPower = Math.min(100, launchPower + 3.5);
      launchBar.style.width = `${launchPower}%`;
      if (launchPower >= 100) {
        stopCharging();
        launchMessage.textContent = "Full power! Let’s go!";
        launchLever.classList.add("is-ready");
        showToast("Blast off! 🚀");
        let count = 3;
        countdown.textContent = count;
        countdownTimer = window.setInterval(() => {
          count -= 1;
          if (count > 0) countdown.textContent = count;
          else {
            window.clearInterval(countdownTimer);
            countdownTimer = null;
            countdown.textContent = "GO!";
            blastRocket.classList.remove("is-flying");
            void blastRocket.offsetWidth;
            blastRocket.classList.add("is-flying");
          }
        }, 430);
      }
    }, 45);
  }
  launchLever.addEventListener("pointerdown", (event) => {
    launchLever.setPointerCapture(event.pointerId);
    startCharging();
  });
  launchLever.addEventListener("pointerup", stopCharging);
  launchLever.addEventListener("pointercancel", stopCharging);
  launchLever.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      startCharging();
    }
  });
  launchLever.addEventListener("keyup", stopCharging);

  // Mars landing: tap three discoveries.
  const exploreSpots = [...document.querySelectorAll(".explore-spot")];
  exploreSpots.forEach((spot) => spot.addEventListener("click", () => {
    if (spot.classList.contains("is-explored")) return;
    spot.classList.add("is-explored");
    const count = exploreSpots.filter((item) => item.classList.contains("is-explored")).length;
    document.querySelector("#explore-count").textContent = count;
    const discoveries = { rock: "A very red rock!", hill: "A hill shaped like a hat!", dust: "Mars dust tickles!" };
    document.querySelector("#mars-speech").textContent = discoveries[spot.dataset.explore];
    if (count === exploreSpots.length) showToast("Mars explored! 🪐");
  }));

  // Finale: slide the pouch open to reveal one crumb and the ending.
  const snackPouch = document.querySelector("#snack-pouch");
  const snackReveal = document.querySelector("#snack-reveal");
  let snackProgress = 0;
  let snackDragging = false;
  let snackStartX = 0;
  let snackStartProgress = 0;
  function updateSnackPouch(value) {
    snackProgress = Math.max(0, Math.min(100, value));
    snackPouch.style.setProperty("--pouch-progress", `${snackProgress}%`);
    snackPouch.setAttribute("aria-valuenow", String(Math.round(snackProgress)));
    const opened = snackProgress >= 100;
    snackPouch.classList.toggle("is-open", opened);
    snackReveal.textContent = opened ? "One tiny crumb. Johnny forgot the snacks!" : "Slide the pouch from left to right.";
    if (opened && !snackPouch.dataset.celebrated) {
      snackPouch.dataset.celebrated = "true";
      showToast("One crumb… THE END! 🍪");
    }
  }
  snackPouch.addEventListener("pointerdown", (event) => {
    snackDragging = true;
    snackStartX = event.clientX;
    snackStartProgress = snackProgress;
    snackPouch.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  snackPouch.addEventListener("pointermove", (event) => {
    if (!snackDragging) return;
    const travel = Math.max(1, snackPouch.clientWidth - 56);
    updateSnackPouch(snackStartProgress + ((event.clientX - snackStartX) / travel) * 100);
  });
  snackPouch.addEventListener("pointerup", () => { snackDragging = false; });
  snackPouch.addEventListener("pointercancel", () => { snackDragging = false; });
  snackPouch.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      updateSnackPouch(snackProgress + 20);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      updateSnackPouch(snackProgress - 20);
    } else if (event.key === "Home") {
      event.preventDefault();
      updateSnackPouch(0);
    } else if (event.key === "End") {
      event.preventDefault();
      updateSnackPouch(100);
    }
  });

  function resetStory() {
    window.clearInterval(launchTimer);
    window.clearInterval(countdownTimer);
    launchTimer = null;
    countdownTimer = null;
    supplyItems.forEach((item) => item.classList.remove("is-packed"));
    exploreSpots.forEach((spot) => spot.classList.remove("is-explored"));
    launchPower = 0;
    launchBar.style.width = "0%";
    launchLever.classList.remove("is-ready");
    blastRocket.classList.remove("is-flying");
    countdown.textContent = "";
    launchMessage.textContent = "Ready when you are!";
    document.querySelector("#supply-count").textContent = "0";
    document.querySelector("#dog-bubble").textContent = "Hmm.";
    document.querySelector("#explore-count").textContent = "0";
    document.querySelector("#mars-speech").textContent = "What a planet!";
    snackPouch.dataset.celebrated = "";
    updateSnackPouch(0);
  }

  const hashSlide = window.location.hash.match(/story-(\d+)/);
  if (hashSlide) currentSlide = Math.max(0, Math.min(slides.length - 1, Number(hashSlide[1])));
  slides.forEach((slide, index) => {
    slide.hidden = index !== currentSlide;
    slide.classList.toggle("is-active", index === currentSlide);
  });
  progressBar.style.width = `${((currentSlide + 1) / slides.length) * 100}%`;
  progressLabel.textContent = slideLabels[currentSlide];
  pageCount.textContent = `${currentSlide + 1} / ${slides.length}`;
  pagerButtons.forEach((button, index) => {
    button.toggleAttribute("aria-current", index === currentSlide);
  });
  prevButton.disabled = currentSlide === 0;
  nextButton.disabled = currentSlide === slides.length - 1;
  window.history.replaceState(null, "", `#story-${currentSlide}`);

  // A fresh read begins on the first slide when the brand is clicked.
  document.querySelector(".brand").addEventListener("click", () => {
    if (currentSlide === 0) return;
    resetStory();
    goToSlide(0);
  });
})();
