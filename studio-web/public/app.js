document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const apiKeyInput = document.getElementById("apiKeyInput");
  const saveKeyBtn = document.getElementById("saveKeyBtn");
  const modelSelect = document.getElementById("modelSelect");
  const voiceSelect = document.getElementById("voiceSelect");
  const previewVoiceBtn = document.getElementById("previewVoiceBtn");
  const sampleAudioPlayer = document.getElementById("sampleAudioPlayer");
  const previewIcon = document.getElementById("previewIcon");

  const formatPills = document.querySelectorAll("#formatPills .pill-btn");
  const enginePills = document.querySelectorAll("#enginePills .pill-btn");
  const engineHint = document.getElementById("engineHint");
  const durationPills = document.querySelectorAll("#durationPills .pill-btn");
  const durationSlider = document.getElementById("durationSlider");
  const durationDisplay = document.getElementById("durationDisplay");
  const durationCategory = document.getElementById("durationCategory");
  const musicSelect = document.getElementById("musicSelect");
  const previewMusicBtn = document.getElementById("previewMusicBtn");
  const previewMusicIcon = document.getElementById("previewMusicIcon");
  const paletteSelect = document.getElementById("paletteSelect");
  const customPaletteRow = document.getElementById("customPaletteRow");

  const customBg = document.getElementById("customBg");
  const customText = document.getElementById("customText");
  const customAccent = document.getElementById("customAccent");
  const customCard = document.getElementById("customCard");

  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabTopic = document.getElementById("tabTopic");
  const tabUrl = document.getElementById("tabUrl");
  const tabScript = document.getElementById("tabScript");
  const tabPdf = document.getElementById("tabPdf");
  const sourceTopicInput = document.getElementById("sourceTopicInput");
  const topicStyleSelect = document.getElementById("topicStyleSelect");
  const sourceUrlInput = document.getElementById("sourceUrlInput");
  const sourceScriptInput = document.getElementById("sourceScriptInput");
  const pdfDropZone = document.getElementById("pdfDropZone");
  const pdfFileInput = document.getElementById("pdfFileInput");
  const pdfDropInner = document.getElementById("pdfDropInner");
  const generateBtn = document.getElementById("generateBtn");

  const livePill = document.getElementById("livePill");
  const liveStatusText = document.getElementById("liveStatusText");
  const consoleTimestamp = document.getElementById("consoleTimestamp");
  const consoleMessage = document.getElementById("consoleMessage");

  const cinemaPanel = document.getElementById("cinemaPanel");
  const videoTheatre = document.getElementById("videoTheatre");
  const playerVideo = document.getElementById("playerVideo");
  const downloadLink = document.getElementById("downloadLink");
  const videoMetaText = document.getElementById("videoMetaText");

  // State
  let currentFormat = "landscape";
  let currentEngine = "combined";
  let currentDuration = 30;
  let currentSourceType = "topic";
  let currentPdfBase64 = null;
  let currentPdfName = null;
  let activeEventSource = null;
  let isVoiceSamplePlaying = false;
  let isMusicSamplePlaying = false;
  const musicAudioPlayer = new Audio();

  // Engine-aware production line. Stage ids match the events the server broadcasts
  // (ingest -> narrative -> audio -> composition -> validation -> render).
  const FLOW_STAGES = {
    ingest: { name: "Ingest", sub: "Read the source" },
    narrative: { name: "Director", sub: "Write the storyboard" },
    audio: { name: "Voice", sub: "Narrate & score" },
    composition: { name: "Compose", sub: "Build every scene" },
    validation: { name: "Quality gate", sub: "Contrast & timing" },
    render: { name: "Master render", sub: "Frame capture & mux" },
  };
  const ENGINE_COMPOSE = {
    manim: { name: "Manim render", sub: "3Blue1Brown maths clips" },
    html: { name: "HTML motion", sub: "GSAP scene templates" },
    combined: { name: "Manim + HTML", sub: "Route each scene" },
  };
  const ENGINE_LINE_TITLE = {
    manim: "Manim pipeline: maths scenes rendered as Python animations",
    html: "HTML pipeline: GSAP motion templates, no Python",
    combined: "Combined pipeline: maths scenes to Manim, the rest to HTML",
  };

  let nodes = [];
  function buildFlow(engine) {
    const track = document.getElementById("flowTrack");
    if (!track) return;
    const compose = ENGINE_COMPOSE[engine] || ENGINE_COMPOSE.combined;
    const order = [
      ["ingest", FLOW_STAGES.ingest],
      ["narrative", FLOW_STAGES.narrative],
      ["audio", FLOW_STAGES.audio],
      ["composition", compose],
      ["validation", FLOW_STAGES.validation],
      ["render", FLOW_STAGES.render],
    ];
    track.innerHTML = "";
    nodes = [];
    order.forEach(([id, meta], i) => {
      const el = document.createElement("div");
      el.className = "flow-node";
      el.dataset.stage = id;
      el.innerHTML = `
        <div class="node-badge">${String(i + 1).padStart(2, "0")}</div>
        <div class="node-dot"></div>
        <div class="node-info">
          <span class="node-name">${meta.name}</span>
          <span class="node-sub">${meta.sub}</span>
        </div>`;
      track.appendChild(el);
      let conn = null;
      if (i < order.length - 1) {
        conn = document.createElement("div");
        conn.className = "flow-connector";
        conn.innerHTML = '<div class="flow-pulse"></div>';
        track.appendChild(conn);
      }
      nodes.push({ id, el, conn });
    });
    const title = document.getElementById("lineTitle");
    if (title) title.textContent = ENGINE_LINE_TITLE[engine] || ENGINE_LINE_TITLE.combined;
  }
  buildFlow(currentEngine);

  // 0. Light / dark theme toggle (persisted; the first-paint script in index.html applies it)
  const themeToggle = document.getElementById("themeToggle");
  const themeToggleLabel = document.getElementById("themeToggleLabel");
  const applyTheme = (theme) => {
    document.documentElement.setAttribute("data-theme", theme);
    const isLight = theme === "light";
    if (themeToggle) {
      themeToggle.setAttribute("aria-checked", String(isLight));
      themeToggle.setAttribute("aria-label", isLight ? "Light theme" : "Dark theme");
    }
    if (themeToggleLabel) themeToggleLabel.textContent = isLight ? "Light" : "Dark";
  };
  applyTheme(document.documentElement.getAttribute("data-theme") || "dark");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const next =
        document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
      applyTheme(next);
      try {
        localStorage.setItem("chalkframes_theme", next);
      } catch {
        // storage can be blocked (private mode); the toggle still works for this session
      }
    });
  }

  // 0b. Director model: show the exact OpenRouter id and copy it to the clipboard.
  const copyModelBtn = document.getElementById("copyModelBtn");
  const copyModelLabel = document.getElementById("copyModelLabel");
  const modelIdText = document.getElementById("modelIdText");
  const showModelId = () => {
    if (modelIdText) modelIdText.textContent = modelSelect.value;
  };
  modelSelect.addEventListener("change", showModelId);
  showModelId();

  const copyText = async (text) => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback for non-secure origins: select and copy through a hidden textarea.
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  };

  if (copyModelBtn) {
    copyModelBtn.addEventListener("click", async () => {
      const id = modelSelect.value;
      let ok = false;
      try {
        ok = await copyText(id);
      } catch {
        ok = false;
      }
      if (copyModelLabel) copyModelLabel.textContent = ok ? "Copied" : "Copy failed";
      setTimeout(() => {
        if (copyModelLabel) copyModelLabel.textContent = "Copy";
      }, 1600);
    });
  }

  // 1. Restore API Key from localStorage
  const savedKey = localStorage.getItem("openrouter_api_key");
  if (savedKey) {
    apiKeyInput.value = savedKey;
    saveKeyBtn.textContent = "Saved";
  }
  let hasServerKey = false;
  fetch("/api/config")
    .then((r) => r.json())
    .then((cfg) => {
      if (cfg && cfg.hasServerKey) {
        hasServerKey = true;
        if (!apiKeyInput.value) {
          apiKeyInput.placeholder = "Loaded from .env (or override here)";
        }
      }
    })
    .catch(() => {});

  saveKeyBtn.addEventListener("click", () => {
    const key = apiKeyInput.value.trim();
    if (key) {
      localStorage.setItem("openrouter_api_key", key);
      saveKeyBtn.textContent = "Saved";
      setTimeout(() => {
        saveKeyBtn.textContent = "Save";
      }, 2000);
    } else {
      localStorage.removeItem("openrouter_api_key");
      saveKeyBtn.textContent = "Cleared";
      setTimeout(() => {
        saveKeyBtn.textContent = "Save";
      }, 2000);
    }
  });

  // 2. Format Selector (Landscape vs Square)
  formatPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      formatPills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      currentFormat = pill.dataset.format;
      if (videoTheatre) {
        videoTheatre.classList.remove("portrait", "square");
        if (currentFormat === "square") {
          videoTheatre.classList.add("square");
        } else if (currentFormat === "portrait") {
          videoTheatre.classList.add("portrait");
        }
      }
    });
  });

  // 2b. Engine Selector (Manim, HTML, Combined)
  enginePills.forEach((pill) => {
    pill.addEventListener("click", () => {
      enginePills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      currentEngine = pill.dataset.engine;
      buildFlow(currentEngine);
      if (engineHint) {
        if (currentEngine === "manim") {
          engineHint.textContent = "Every scene is a bespoke 3Blue1Brown-style Manim animation";
        } else if (currentEngine === "html") {
          engineHint.textContent = "Every scene is an HTML + GSAP motion graphic, no Python";
        } else {
          engineHint.textContent = "Maths scenes route to Manim; product and system scenes to HTML";
        }
      }
    });
  });

  // 3. Duration & Timeline Management (15s up to 15m / 900s)
  function formatDuration(sec) {
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }

  function getDurationCategory(sec) {
    if (sec <= 60) return "Shorts / Reels";
    if (sec <= 180) return "Quick Explainer";
    if (sec <= 360) return "In-Depth Guide";
    return "Masterclass (10m Max)";
  }

  function updateDurationUI(sec) {
    currentDuration = sec;
    if (durationSlider) {
      durationSlider.value = sec;
      const min = parseInt(durationSlider.min, 10) || 15;
      const max = parseInt(durationSlider.max, 10) || 600;
      const percentage = ((sec - min) / (max - min)) * 100;
      durationSlider.style.background = `linear-gradient(to right, var(--accent-gold) ${percentage}%, rgba(255, 255, 255, 0.12) ${percentage}%)`;
    }
    if (durationDisplay) durationDisplay.textContent = formatDuration(sec);
    if (durationCategory) durationCategory.textContent = getDurationCategory(sec);

    // Sync active state on preset pill buttons
    durationPills.forEach((pill) => {
      const pillSec = parseInt(pill.dataset.duration, 10);
      if (pillSec === sec) {
        pill.classList.add("active");
      } else {
        pill.classList.remove("active");
      }
    });
  }

  if (durationSlider) {
    durationSlider.addEventListener("input", (e) => {
      const sec = parseInt(e.target.value, 10) || 30;
      updateDurationUI(sec);
    });
  }

  durationPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      const sec = parseInt(pill.dataset.duration, 10) || 30;
      updateDurationUI(sec);
    });
  });

  // Initialize duration slider on boot
  updateDurationUI(currentDuration);

  // 4. Voice Sample Audio Preview
  previewVoiceBtn.addEventListener("click", () => {
    const selectedVoice = voiceSelect.value;
    const sampleSrc = `/samples/${selectedVoice}.wav`;

    if (isVoiceSamplePlaying) {
      sampleAudioPlayer.pause();
      sampleAudioPlayer.currentTime = 0;
      isVoiceSamplePlaying = false;
      previewVoiceBtn.classList.remove("playing");
      previewIcon.textContent = "▶";
      return;
    }

    // Stop music preview if running
    if (isMusicSamplePlaying) {
      musicAudioPlayer.pause();
      musicAudioPlayer.currentTime = 0;
      isMusicSamplePlaying = false;
      if (previewMusicBtn) previewMusicBtn.classList.remove("playing");
      if (previewMusicIcon) previewMusicIcon.textContent = "▶";
    }

    sampleAudioPlayer.src = sampleSrc;
    sampleAudioPlayer
      .play()
      .then(() => {
        isVoiceSamplePlaying = true;
        previewVoiceBtn.classList.add("playing");
        previewIcon.textContent = "■";
      })
      .catch((e) => {
        console.warn("Could not play audio sample:", e);
      });
  });

  sampleAudioPlayer.addEventListener("ended", () => {
    isVoiceSamplePlaying = false;
    previewVoiceBtn.classList.remove("playing");
    previewIcon.textContent = "▶";
  });

  voiceSelect.addEventListener("change", () => {
    if (isVoiceSamplePlaying) {
      sampleAudioPlayer.pause();
      sampleAudioPlayer.currentTime = 0;
      isVoiceSamplePlaying = false;
      previewVoiceBtn.classList.remove("playing");
      previewIcon.textContent = "▶";
    }
  });

  // 5. Soundtrack Audio Preview
  if (previewMusicBtn) {
    previewMusicBtn.addEventListener("click", () => {
      const selectedMusic = musicSelect.value;
      if (selectedMusic === "none") return;

      const musicSrc = `/soundtracks/${selectedMusic}.mp3`;

      if (isMusicSamplePlaying) {
        musicAudioPlayer.pause();
        musicAudioPlayer.currentTime = 0;
        isMusicSamplePlaying = false;
        previewMusicBtn.classList.remove("playing");
        if (previewMusicIcon) previewMusicIcon.textContent = "▶";
        return;
      }

      // Stop voice preview if running
      if (isVoiceSamplePlaying) {
        sampleAudioPlayer.pause();
        sampleAudioPlayer.currentTime = 0;
        isVoiceSamplePlaying = false;
        previewVoiceBtn.classList.remove("playing");
        previewIcon.textContent = "▶";
      }

      musicAudioPlayer.src = musicSrc;
      musicAudioPlayer
        .play()
        .then(() => {
          isMusicSamplePlaying = true;
          previewMusicBtn.classList.add("playing");
          if (previewMusicIcon) previewMusicIcon.textContent = "■";
        })
        .catch((e) => {
          console.warn("Could not play music sample:", e);
        });
    });

    musicAudioPlayer.addEventListener("ended", () => {
      isMusicSamplePlaying = false;
      previewMusicBtn.classList.remove("playing");
      if (previewMusicIcon) previewMusicIcon.textContent = "▶";
    });

    musicSelect.addEventListener("change", () => {
      if (isMusicSamplePlaying) {
        musicAudioPlayer.pause();
        musicAudioPlayer.currentTime = 0;
        isMusicSamplePlaying = false;
        previewMusicBtn.classList.remove("playing");
        if (previewMusicIcon) previewMusicIcon.textContent = "▶";
      }
    });
  }

  // 5. Palette Toggle
  paletteSelect.addEventListener("change", () => {
    if (paletteSelect.value === "custom") {
      customPaletteRow.classList.remove("hidden");
    } else {
      customPaletteRow.classList.add("hidden");
    }
  });

  // 6. Tab Switching (Topic / URL / Script / PDF)
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentSourceType = btn.dataset.tab;

      tabTopic.classList.add("hidden");
      tabUrl.classList.add("hidden");
      tabScript.classList.add("hidden");
      tabPdf.classList.add("hidden");

      if (currentSourceType === "topic") tabTopic.classList.remove("hidden");
      else if (currentSourceType === "url") tabUrl.classList.remove("hidden");
      else if (currentSourceType === "script") tabScript.classList.remove("hidden");
      else if (currentSourceType === "pdf") tabPdf.classList.remove("hidden");
    });
  });

  // 6b. PDF Drop Zone
  function setPdfFile(file) {
    if (!file || file.type !== "application/pdf") {
      alert("Please select a PDF file");
      return;
    }
    if (file.size > 25 * 1024 * 1024 || file.size === 0) {
      alert("PDF must be between 1 byte and 25 MB");
      return;
    }
    currentPdfName = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      currentPdfBase64 = dataUrl.split(",")[1];
      pdfDropZone.classList.add("has-file");
      pdfDropInner.innerHTML = `
        <div class="pdf-file-ready">
          <div class="pdf-check">✓</div>
          <span class="pdf-ready-name"></span>
        </div>
        <p class="pdf-drop-hint" style="margin-top:8px">${(file.size / 1024).toFixed(1)} KB · Click to replace</p>
      `;
      pdfDropInner.querySelector(".pdf-ready-name").textContent = file.name;
    };
    reader.readAsDataURL(file);
  }

  pdfDropZone.addEventListener("click", (e) => {
    if (
      e.target.classList.contains("pdf-browse-link") ||
      !pdfDropZone.classList.contains("has-file")
    ) {
      pdfFileInput.click();
    } else {
      pdfFileInput.click();
    }
  });

  pdfFileInput.addEventListener("change", () => {
    if (pdfFileInput.files.length > 0) setPdfFile(pdfFileInput.files[0]);
  });

  pdfDropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    pdfDropZone.classList.add("drag-over");
  });

  pdfDropZone.addEventListener("dragleave", () => {
    pdfDropZone.classList.remove("drag-over");
  });

  pdfDropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    pdfDropZone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) setPdfFile(file);
  });

  function updateTimestamp() {
    const now = new Date();
    consoleTimestamp.textContent = now.toTimeString().split(" ")[0];
  }

  function resetFlowchart() {
    nodes.forEach((n) => {
      n.el.classList.remove("active", "complete");
      if (n.conn) n.conn.classList.remove("active", "complete");
    });
  }

  function setNodeState(nodeId, status) {
    const nodeIndex = nodes.findIndex((n) => n.id === nodeId);
    if (nodeIndex === -1) return;

    for (let i = 0; i < nodeIndex; i++) {
      nodes[i].el.classList.remove("active");
      nodes[i].el.classList.add("complete");
      if (nodes[i].conn) {
        nodes[i].conn.classList.remove("active");
        nodes[i].conn.classList.add("complete");
      }
    }

    const current = nodes[nodeIndex];
    if (status === "active") {
      current.el.classList.remove("complete");
      current.el.classList.add("active");
      if (current.conn) current.conn.classList.add("active");
    } else if (status === "complete") {
      current.el.classList.remove("active");
      current.el.classList.add("complete");
      if (current.conn) {
        current.conn.classList.remove("active");
        current.conn.classList.add("complete");
      }
    }
  }

  // 7. Produce Video Trigger
  generateBtn.addEventListener("click", async () => {
    const apiKey = apiKeyInput.value.trim();
    const model = modelSelect.value;
    const voice = voiceSelect.value;
    const format = currentFormat;
    const duration = currentDuration;
    const musicEngine = musicSelect.value;
    const paletteKey = paletteSelect.value;

    let customColors = null;
    if (paletteKey === "custom") {
      customColors = {
        background: customBg.value,
        text: customText.value,
        accent: customAccent.value,
        card: customCard.value,
        muted: "#888899",
        border: "#303039",
      };
    }

    const sourceTopic = currentSourceType === "topic" ? sourceTopicInput.value.trim() : "";
    const topicStyle = topicStyleSelect ? topicStyleSelect.value : "explainer";
    const sourceUrl = currentSourceType === "url" ? sourceUrlInput.value.trim() : "";
    const sourceScript = currentSourceType === "script" ? sourceScriptInput.value.trim() : "";
    const sourcePdf = currentSourceType === "pdf" ? currentPdfBase64 : null;
    const sourcePdfName = currentSourceType === "pdf" ? currentPdfName : null;

    if (currentSourceType === "topic" && !sourceTopic) {
      alert("Please enter a topic in the world");
      sourceTopicInput.focus();
      return;
    }
    if (currentSourceType === "url" && !sourceUrl) {
      alert("Please provide a product website URL");
      sourceUrlInput.focus();
      return;
    }
    if (currentSourceType === "script" && !sourceScript) {
      alert("Please provide a product script or brief");
      sourceScriptInput.focus();
      return;
    }
    if (currentSourceType === "pdf" && !sourcePdf) {
      alert("Please upload a PDF document");
      return;
    }
    if (!apiKey && !hasServerKey) {
      alert("Add an OpenRouter API key to create a video grounded in your source.");
      apiKeyInput.focus();
      return;
    }

    // UI state
    generateBtn.disabled = true;
    generateBtn.querySelector(".btn-text").textContent = "Producing...";
    livePill.classList.add("active");
    liveStatusText.textContent = "Running";
    cinemaPanel.classList.add("hidden");

    resetFlowchart();
    updateTimestamp();
    consoleMessage.textContent = `Initializing production pipeline (${format}, ${duration}s)...`;

    if (activeEventSource) {
      activeEventSource.close();
      activeEventSource = null;
    }

    try {
      const resp = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          model,
          voice,
          format,
          duration,
          musicEngine,
          paletteKey,
          customColors,
          engineMode: currentEngine,
          sourceTopic,
          topicStyle,
          sourceUrl,
          sourceScript,
          sourcePdf,
          sourcePdfName,
        }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || "Failed to start production");
      }

      const jobId = data.jobId;
      activeEventSource = new EventSource(`/api/events?id=${jobId}`);

      activeEventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          updateTimestamp();
          if (payload.message) {
            consoleMessage.textContent = payload.message;
          }

          if (payload.node) {
            setNodeState(payload.node, payload.status);
          }

          if (payload.node === "composition" && payload.storyboard) {
            renderFilmstrip(payload.storyboard, `prod-${jobId}`);
          }

          // Production Complete
          if (payload.node === "complete" && payload.status === "complete") {
            nodes.forEach((n) => {
              n.el.classList.remove("active");
              n.el.classList.add("complete");
              if (n.conn) {
                n.conn.classList.remove("active");
                n.conn.classList.add("complete");
              }
            });

            livePill.classList.remove("active");
            liveStatusText.textContent = "Finished";
            generateBtn.disabled = false;
            generateBtn.querySelector(".btn-text").textContent = "Produce Video";

            if (payload.videoUrl) {
              playerVideo.src = payload.videoUrl;
              downloadLink.href = payload.videoUrl;
              downloadLink.setAttribute("download", `${jobId}.mp4`);

              // Adapt aspect ratio of player
              videoTheatre.classList.remove("portrait", "square");
              if (format === "portrait") {
                videoTheatre.classList.add("portrait");
              } else if (format === "square") {
                videoTheatre.classList.add("square");
              }

              videoMetaText.textContent = `${payload.resolution || (format === "portrait" ? "1080x1920" : format === "square" ? "1080x1080" : "1920x1080")} · 30 fps · Stereo · ${payload.duration || duration + "s"}`;
              cinemaPanel.classList.remove("hidden");
              const emptyState = document.getElementById("screenEmpty");
              if (emptyState) emptyState.classList.add("hidden");
              playerVideo.classList.add("ready");
              playerVideo.play().catch(() => {});
            }

            if (payload.storyboard) {
              renderFilmstrip(payload.storyboard, payload.projectId || `prod-${jobId}`);
            }

            activeEventSource.close();
            activeEventSource = null;
          }

          if (payload.status === "error") {
            livePill.classList.remove("active");
            liveStatusText.textContent = "Error";
            generateBtn.disabled = false;
            generateBtn.querySelector(".btn-text").textContent = "Produce Video";
            consoleMessage.textContent = `Error: ${payload.message}`;
            if (activeEventSource) {
              activeEventSource.close();
              activeEventSource = null;
            }
          }
        } catch (e) {
          console.error("Failed to parse event", e);
        }
      };
    } catch (err) {
      alert(`Could not initiate production: ${err.message}`);
      generateBtn.disabled = false;
      generateBtn.querySelector(".btn-text").textContent = "Produce Video";
      livePill.classList.remove("active");
      liveStatusText.textContent = "Standby";
    }
  });

  const escapeHtml = (str) =>
    String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  function renderFilmstrip(storyboard, currentProjId) {
    const filmstripSection = document.getElementById("filmstripSection");
    const filmstripTrack = document.getElementById("filmstripTrack");
    const filmstripSceneCount = document.getElementById("filmstripSceneCount");
    if (!filmstripSection || !filmstripTrack || !storyboard?.scenes) return;

    filmstripSection.style.display = "flex";
    filmstripSceneCount.textContent = `${storyboard.scenes.length} Scenes`;
    filmstripTrack.innerHTML = "";

    storyboard.scenes.forEach((scene, idx) => {
      const card = document.createElement("div");
      card.className = "filmstrip-card";
      const dur = typeof scene.duration === "number" ? scene.duration.toFixed(1) + "s" : "~5s";
      // Scenes that lost their Manim visuals are marked so the swap is visible, not silent.
      if (scene.degraded) {
        card.classList.add("degraded");
      }
      const degradedNote = scene.degraded
        ? `<div class="filmstrip-card-narration" title="${escapeHtml(scene.degradeDetail || scene.degradeReason || "")}">Manim fallback: ${escapeHtml(scene.degradedFrom || "scene")} → ${escapeHtml(scene.archetype || "html")}</div>`
        : "";
      card.innerHTML = `
        <div class="filmstrip-card-top">
          <span class="filmstrip-index">SCENE ${String(idx + 1).padStart(2, "0")}</span>
          <span class="filmstrip-archetype">${escapeHtml(scene.archetype || "html")}</span>
        </div>
        <div class="filmstrip-card-title">${escapeHtml(scene.title || "Untitled Scene")}</div>
        <div class="filmstrip-card-narration">${escapeHtml(scene.narration || "")}</div>
        ${degradedNote}
        <div class="filmstrip-card-footer">
          <span class="filmstrip-duration">⏱ ${dur}</span>
          <button type="button" class="btn-rerender" data-index="${idx}">Tweak Scene</button>
        </div>
      `;

      const rerenderBtn = card.querySelector(".btn-rerender");
      rerenderBtn.addEventListener("click", async () => {
        const newNarration = prompt(
          "Edit voiceover narration for this scene:",
          scene.narration || "",
        );
        if (newNarration === null) return;
        rerenderBtn.textContent = "Rendering...";
        rerenderBtn.disabled = true;
        try {
          const res = await fetch(`/api/projects/${currentProjId}/rerender-scene`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sceneIndex: idx, newNarration }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Re-render failed");
          if (data.videoUrl) {
            playerVideo.src = data.videoUrl;
            playerVideo.play().catch(() => {});
          }
          rerenderBtn.textContent = "Updated ✓";
          setTimeout(() => {
            rerenderBtn.textContent = "Tweak Scene";
            rerenderBtn.disabled = false;
          }, 2000);
        } catch (err) {
          alert("Failed to re-render scene: " + err.message);
          rerenderBtn.textContent = "Tweak Scene";
          rerenderBtn.disabled = false;
        }
      });

      filmstripTrack.appendChild(card);
    });
  }
});
