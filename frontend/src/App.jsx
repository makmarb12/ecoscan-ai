
import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard, Camera, History, BarChart3, BookOpen,
  Settings, Recycle, Leaf, Upload, CheckCircle2, Trash2,
  Menu, X, UserRound, Mail, Sun, Moon, Server,
  ShieldCheck, RefreshCw, LogOut, Search, Image as ImageIcon
} from "lucide-react";
import "./App.css";
import Auth from "./Auth";

const navItems = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Classify Waste", icon: Camera },
  { name: "History", icon: History },
  { name: "Reports", icon: BarChart3 },
  { name: "Recycling Guide", icon: BookOpen },
  { name: "Settings", icon: Settings },
];

const guides = [
  {
    name: "Plastic",
    desc: "Bottles, bags, containers",
    color: "#287cff",
    aliases: ["plastic"],
    tip: "Rinse containers and check local rules for accepted plastic types.",
  },
  {
    name: "Paper",
    desc: "Newspapers, boxes, cartons",
    color: "#f59e0b",
    aliases: ["paper", "cardboard"],
    tip: "Keep paper clean and dry; flatten cardboard before recycling.",
  },
  {
    name: "Glass",
    desc: "Bottles and jars",
    color: "#0dbaa5",
    aliases: ["glass"],
    tip: "Empty and rinse jars and bottles; separate lids when required locally.",
  },
  {
    name: "Metal",
    desc: "Cans and foil",
    color: "#64748b",
    aliases: ["metal"],
    tip: "Empty cans and rinse food residue before placing them in recycling.",
  },
  {
    name: "Organic",
    desc: "Food and garden waste",
    color: "#40a829",
    aliases: ["organic", "biological", "brown-grass"],
    tip: "Use a local compost or organics collection program where available.",
  },
  {
    name: "E-Waste",
    desc: "Batteries and electronic devices",
    color: "#8b5cf6",
    aliases: ["e-waste", "ewaste", "electronic"],
    tip: "Take electronics and batteries to a dedicated collection point.",
  },
];

function countCategoryScans(records, aliases) {
  return records
    .filter((item) => aliases.includes(String(item.category).toLowerCase()))
    .reduce((sum, item) => sum + (Number(item.count) || 0), 0);
}

function App() {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [active, setActive] = useState("Dashboard");
  const [theme, setTheme] = useState(
    () => localStorage.getItem("ecoscan_theme") || "light"
  );
  const [serverStatus, setServerStatus] = useState({
    backend: "Not checked",
    ai: "Not checked"
  });
  const [checkingServers, setCheckingServers] = useState(false);
  const [classifyMode, setClassifyMode] = useState("upload");
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState("");
  const [startingCamera, setStartingCamera] = useState(false);
  const videoRef = useRef(null);
  const cameraRequestRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function verifyLogin() {
      const token = localStorage.getItem("ecoscan_token");

      if (!token) {
        if (!cancelled) setCheckingAuth(false);
        return;
      }

      try {
        const response = await fetch(
          "http://localhost:5000/api/auth/me",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          localStorage.removeItem("ecoscan_token");
          if (!cancelled) setUser(null);
          return;
        }

        if (!cancelled) {
          setUser(data.user);
        }
      } catch (error) {
        console.error("Session verification failed:", error);
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setCheckingAuth(false);
        }
      }
    }

    verifyLogin();

    return () => {
      cancelled = true;
    };
  }, []);

  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [historyFilter, setHistoryFilter] = useState("");
  const [reports, setReports] = useState({
    totalScans: 0,
    categories: [],
    averageConfidence: "0.00",
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (!cameraStream || !videoRef.current) return undefined;

    const video = videoRef.current;
    video.srcObject = cameraStream;
    video.play().catch((error) => {
      console.error("Camera preview failed:", error);
      setCameraError("The camera opened, but its preview could not be started.");
    });

    return () => {
      cameraStream.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    };
  }, [cameraStream]);

  useEffect(() => {
    let cancelled = false;

    async function loadReports() {
      const token = localStorage.getItem("ecoscan_token");
      if (!token) return;

      try {
        const response = await fetch(
          "http://localhost:5000/api/reports",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to load reports");
        }

        const data = await response.json();

        if (!cancelled) {
          setReports({
            totalScans: Number(data.totalScans) || 0,
            categories: data.categories || [],
            averageConfidence: data.averageConfidence ?? "0.00",
          });
        }
      } catch (error) {
        console.error("Reports loading error:", error);
      }
    }

    loadReports();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadScanHistory() {
      const token = localStorage.getItem("ecoscan_token");

      if (!token) {
        setHistoryLoading(false);
        return;
      }

      try {
        setHistoryError("");
        const response = await fetch("http://localhost:5000/api/scans", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to load scan history");
        }

        const data = await response.json();

        if (!cancelled) {
          setHistory(
            (data.scans || []).map((scan) => ({
              id: scan.id,
              name: scan.image_name,
              type: scan.category,
              confidence: scan.confidence,
              createdAt: scan.created_at,
              imageUrl: scan.imageUrl,
            }))
          );
        }
      } catch (error) {
        console.error("History loading error:", error);
        if (!cancelled) {
          setHistoryError("Could not load your saved classifications.");
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    }

    loadScanHistory();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("ecoscan_theme", theme);
  }, [theme]);

  async function checkServers() {
    setCheckingServers(true);

    const check = async (url) => {
      try {
        const response = await fetch(url);
        return response.ok ? "Online" : "Error";
      } catch {
        return "Offline";
      }
    };

    const [backend, ai] = await Promise.all([
      check("http://localhost:5000/api/auth/me"),
      check("http://127.0.0.1:8000/health")
    ]);

    setServerStatus({ backend, ai });
    setCheckingServers(false);
  }

  function handleImage(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setImage(file);
    setPreview(URL.createObjectURL(file));
    setResult(null);
  }

  async function startCamera() {
    const requestId = ++cameraRequestRef.current;
    setClassifyMode("camera");
    setCameraError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is unavailable. Use a supported browser on HTTPS or localhost.");
      return;
    }

    setStartingCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      if (cameraRequestRef.current !== requestId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      setCameraStream(stream);
    } catch (error) {
      console.error("Camera access failed:", error);
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        setCameraError("Camera permission was denied. Allow camera access in your browser settings and try again.");
      } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        setCameraError("No camera was found on this device.");
      } else {
        setCameraError("Could not open the camera. Check that it is connected and not being used by another app.");
      }
    } finally {
      setStartingCamera(false);
    }
  }

  function stopCamera() {
    cameraRequestRef.current += 1;
    setCameraStream(null);
  }

  function navigateTo(page) {
    if (page !== "Classify Waste") {
      stopCamera();
    }
    setActive(page);
  }

  async function captureCameraImage() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError("The camera is not ready yet. Please wait a moment and try again.");
      return;
    }

    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Could not prepare the captured image.");
      }
      context.drawImage(video, 0, 0);
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (capturedBlob) => capturedBlob
            ? resolve(capturedBlob)
            : reject(new Error("The captured image could not be created.")),
          "image/jpeg",
          0.92
        );
      });

      handleImage(new File([blob], "ecoscan-capture.jpg", {
        type: "image/jpeg",
      }));
      stopCamera();
      setCameraError("");
    } catch (error) {
      console.error("Camera capture failed:", error);
      setCameraError("Could not capture the image. Please try again.");
    }
  }

  async function classifyDemo() {
    if (!image) {
      alert("Please upload a waste image first.");
      return;
    }

    try {
      // Send the image to the EcoScan AI backend.
      const token = localStorage.getItem("ecoscan_token");

      const formData = new FormData();
      formData.append("image", image);

      const response = await fetch("http://localhost:5000/api/scans", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || "Image analysis failed");
      }

      const scan = result.scan || result;
      const item = {
        id: scan.id,
        name: image.name,
        type: scan.category,
        confidence: scan.confidence,
        createdAt: new Date().toISOString(),
        imageUrl: scan.imageUrl,
      };

      setResult(item);
      setHistory(previous => [item, ...previous]);
    } catch (error) {
      alert(error.message || "Image analysis failed");
    }
  }

  const getCategoryCount = (names) =>
    countCategoryScans(reports.categories, names);

  const recyclableCount = getCategoryCount([
    "plastic",
    "paper",
    "glass",
    "metal",
  ]);

  const recyclingRate =
    reports.totalScans > 0
      ? Math.round(
          (recyclableCount / reports.totalScans) * 100
        )
      : 0;

  const otherWasteCount = getCategoryCount([
    "other waste",
    "other",
  ]);

  if (checkingAuth) {
    return <div style={{ padding: "40px", textAlign: "center" }}>
      Verifying your login...
    </div>;
  }

  if (!user) {
    return <Auth onLogin={setUser} />;
  }

  return (
    <div className={`app-shell theme-${theme}`}>
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-icon"><Recycle size={34} /></div>
          <div>
            <h2>EcoScan <span>AI</span></h2>
            <small>Sort · Recycle · Renew</small>
          </div>
          <button className="close-menu" onClick={() => setMenuOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <div className="nav-label">WORKSPACE</div>
        <nav>
          {navItems.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={`nav-item ${active === name ? "active" : ""}`}
              onClick={() => {
                navigateTo(name);
                setMenuOpen(false);
              }}
            >
              <Icon size={19} />
              <span>{name}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <Leaf size={27} />
          <h3>A greener future starts with you.</h3>
          <p>Small actions make a big difference.</p>
        </div>
      </aside>

      {menuOpen && (
        <button className="mobile-overlay" onClick={() => setMenuOpen(false)} />
      )}

      <main className="main-content">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMenuOpen(true)}>
            <Menu size={23} />
          </button>
          <div>
            <h1>Hello, {user.name.split(" ")[0]}!</h1>
            <p>Here's your environmental impact today.</p>
          </div>
          <div className="profile-container">
            <button
              type="button"
              className="profile-trigger"
              onClick={() => setProfileOpen((open) => !open)}
              aria-expanded={profileOpen}
            >
              <div className="avatar">
                {user.name.charAt(0).toUpperCase()}
              </div>

              <div className="profile-info">
                <strong>{user.name}</strong>
              </div>

              <span className="profile-arrow">
                {profileOpen ? "▲" : "▼"}
              </span>
            </button>

            {profileOpen && (
              <>
                <button
                  className="profile-dismiss"
                  aria-label="Close profile menu"
                  onClick={() => setProfileOpen(false)}
                />

                <div className="profile-dropdown">
                  <div className="dropdown-user">
                    <div className="avatar">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="profile-info">
                      <strong>{user.name}</strong>
                      <small>{user.email}</small>
                    </div>
                  </div>

                  <div className="dropdown-divider" />

                  <button
                    type="button"
                    className="dropdown-action"
                    onClick={() => {
                      navigateTo("Settings");
                      setProfileOpen(false);
                    }}
                  >
                    <UserRound size={17} />
                    Account Settings
                  </button>

                  <button
                    type="button"
                    className="dropdown-logout"
                    onClick={() => {
                      localStorage.removeItem("ecoscan_token");
                      setProfileOpen(false);
                      setUser(null);
                      navigateTo("Dashboard");
                      setMenuOpen(false);
                      setImage(null);
                      setPreview("");
                      setResult(null);
                    }}
                  >
                    <span>↪</span>
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {active === "Dashboard" && (
          <section className="hero-banner">
            <div className="hero-content">
              <span className="hero-label">
                <Leaf size={16} />
                EcoScan AI
              </span>

              <h2>Small Steps, <span>Big Impact</span></h2>

              <p>
                Turn waste into a cleaner, greener tomorrow.
                <br />
                Scan. Sort. Make a difference.
              </p>

              <button
                className="hero-button"
                onClick={() => navigateTo("Classify Waste")}
              >
                <Camera size={18} />
                Classify Waste
              </button>
            </div>

            <div className="hero-image">
              <img
                src="https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=1600&q=85"
                alt="A greener future through recycling and sustainable waste management"
              />
            </div>
          </section>
        )}

        {active === "Dashboard" ? (
          <>
            <section className="stats-grid">
              <Stat
                icon={<Trash2 />}
                title="Waste Classified"
                value={reports.totalScans}
                color="green"
              />

              <Stat
                icon={<Recycle />}
                title="Recyclable Waste"
                value={recyclableCount}
                color="blue"
              />

              <Stat
                icon={<Leaf />}
                title="Other Waste"
                value={otherWasteCount}
                color="orange"
              />

              <Stat
                icon={<CheckCircle2 />}
                title="Recycling Rate"
                value={`${recyclingRate}%`}
                color="purple"
              />
            </section>

            <section className="content-grid">
              <div className="panel guide-panel">
                <PanelTitle icon={<BookOpen />} title="Recycling Guide" />
                {guides.map(guide => (
                  <div className="guide-item" key={guide.name}>
                    <div className="guide-icon" style={{ background: guide.color }}>
                      <Recycle size={19} />
                    </div>
                    <div><strong>{guide.name}</strong><small>{guide.desc}</small></div>
                  </div>
                ))}
              </div>

              <div className="panel chart-panel">
                <PanelTitle icon={<BarChart3 />} title="Waste Statistics" />
                <CategoryDistributionChart categories={reports.categories} compact />

                <p className="muted chart-note">
                  Statistics are based on your saved waste classifications.
                </p>
              </div>

              <div className="panel history-panel">
                <PanelTitle icon={<History />} title="Recent Classifications" />
                {history.slice(0, 5).map((item, index) => (
                  <div className="history-item" key={`${item.name}-${index}`}>
                    <div className="history-dot"><Recycle size={17} /></div>
                    <div className="history-name">
                      <strong>{item.name}</strong><small>{item.type}</small>
                    </div>
                    <span className="confidence">{item.confidence}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : active === "Reports" ? (
          <section className="reports-page">
            <div className="reports-heading">
              <div>
                <h2>Waste Management Reports</h2>
                <p>
                  Review your saved AI waste classifications and recycling statistics.
                </p>
              </div>
              <BarChart3 size={32} />
            </div>

            <section className="stats-grid">
              <Stat
                icon={<Trash2 />}
                title="Total Classifications"
                value={reports.totalScans}
                color="green"
              />

              <Stat
                icon={<Recycle />}
                title="Recyclable Waste"
                value={recyclableCount}
                color="blue"
              />

              <Stat
                icon={<Leaf />}
                title="Other Waste"
                value={otherWasteCount}
                color="orange"
              />

              <Stat
                icon={<CheckCircle2 />}
                title="Recycling Rate"
                value={`${recyclingRate}%`}
                color="purple"
              />
            </section>

            <div className="panel reports-chart-panel">
              <PanelTitle
                icon={<BarChart3 />}
                title="Classifications by Waste Category"
              />
              <p className="muted">
                Number of images classified in each category.
              </p>
              <CategoryDistributionChart categories={reports.categories} />
            </div>

            <div className="panel reports-table-panel">
              <PanelTitle
                icon={<History />}
                title="Waste Category Breakdown"
              />

              {reports.categories.length === 0 ? (
                <p className="muted">
                  No saved classification data is available yet.
                </p>
              ) : (
                <div className="reports-table-wrapper">
                  <table className="reports-table">
                    <thead>
                      <tr>
                        <th>Waste Category</th>
                        <th>Number of Scans</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.categories.map((item) => (
                        <tr key={item.category}>
                          <td>{item.category}</td>
                          <td>{item.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        ) : active === "Classify Waste" ? (
          <section className="classify-page">
            <div className="classify-heading">
              <h2>Classify Your Waste</h2>
              <p>Upload or capture an image to get AI-powered disposal recommendations.</p>
            </div>

            <div className="classify-grid">
              <section className="panel classify-card">
                <h3>Capture or Upload</h3>

                <div className="classify-modes" role="group" aria-label="Image source">
                  <button
                    type="button"
                    className={`classify-mode ${classifyMode === "upload" ? "selected" : ""}`}
                    onClick={() => {
                      stopCamera();
                      setCameraError("");
                      setClassifyMode("upload");
                    }}
                  >
                    <Upload size={18} />
                    Upload
                  </button>
                  <button
                    type="button"
                    className={`classify-mode ${classifyMode === "camera" ? "selected" : ""}`}
                    onClick={startCamera}
                    disabled={startingCamera}
                  >
                    <Camera size={18} />
                    {startingCamera ? "Opening..." : "Camera"}
                  </button>
                </div>

                {cameraStream ? (
                  <div className="camera-capture">
                    <video ref={videoRef} className="camera-preview" autoPlay muted playsInline />
                    <div className="camera-actions">
                      <button type="button" className="camera-capture-button" onClick={captureCameraImage}>
                        <Camera size={18} />
                        Capture Photo
                      </button>
                      <button type="button" className="camera-cancel-button" onClick={stopCamera}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : classifyMode === "camera" ? (
                  <div className="camera-message">
                    {startingCamera
                      ? "Waiting for camera permission..."
                      : "Select Camera to open your device camera."}
                  </div>
                ) : (
                  <label
                    className={`classify-dropzone ${isDraggingImage ? "dragging" : ""} ${preview ? "has-image" : ""}`}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setIsDraggingImage(true);
                    }}
                    onDragLeave={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget)) {
                        setIsDraggingImage(false);
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      setIsDraggingImage(false);
                      handleImage(event.dataTransfer.files?.[0]);
                    }}
                  >
                    {preview ? (
                      <>
                        <img src={preview} className="classify-preview" alt="Selected waste" />
                        <span className="classify-file-name">{image?.name}</span>
                      </>
                    ) : (
                      <>
                        <Upload size={42} />
                        <strong>Click or drag to upload an image</strong>
                        <span>Supports JPG, PNG, JPEG</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => handleImage(event.target.files?.[0])}
                    />
                  </label>
                )}

                {cameraError && <p className="camera-error" role="alert">{cameraError}</p>}

                {preview && !cameraStream && (
                  <button className="primary-button classify-submit" onClick={classifyDemo}>
                    <Camera size={18} />
                    Classify Image
                  </button>
                )}
              </section>

              <section className="panel classify-card analysis-card">
                <h3>Analysis Results</h3>
                {result ? (
                  <div className="classify-result">
                    {preview && <img src={preview} alt="Classified waste" />}
                    <div>
                      <span className="result-tag">Classification complete</span>
                      <h4>{result.type}</h4>
                      {result.confidence != null && (
                        <p>Confidence: {result.confidence}</p>
                      )}
                      <p>Check your local recycling guidelines for disposal recommendations.</p>
                    </div>
                  </div>
                ) : (
                  <div className="analysis-empty">
                    <div className="analysis-empty-icon"><Recycle size={48} /></div>
                    <p>Upload or capture an image to get started</p>
                    <ol>
                      <li><span>1</span>Take a photo or upload an image</li>
                      <li><span>2</span>AI analyzes items in the frame</li>
                      <li><span>3</span>Get personalized disposal tips</li>
                      <li><span>4</span>See your environmental impact</li>
                    </ol>
                  </div>
                )}
              </section>
            </div>
          </section>
        ) : active === "History" ? (
          <section className="history-page">
            <div className="history-page-heading">
              <div>
                <h2>Classification History</h2>
                <p>Review your saved waste scans, results, and confidence scores.</p>
              </div>
              <History size={32} />
            </div>

            <div className="history-summary">
              <div className="panel history-summary-card">
                <span>Total saved scans</span>
                <strong>{history.length}</strong>
              </div>
              <div className="panel history-summary-card">
                <span>Categories found</span>
                <strong>{new Set(history.map((item) => item.type)).size}</strong>
              </div>
            </div>

            <section className="panel history-list-panel">
              <div className="history-list-heading">
                <PanelTitle icon={<History />} title="Your Scans" />
                <label className="history-search">
                  <Search size={17} />
                  <input
                    type="search"
                    value={historyFilter}
                    onChange={(event) => setHistoryFilter(event.target.value)}
                    placeholder="Search images or categories"
                    aria-label="Search scan history"
                  />
                </label>
              </div>

              {historyError ? (
                <p className="history-empty" role="alert">{historyError}</p>
              ) : historyLoading ? (
                <p className="history-empty">Loading saved classifications...</p>
              ) : history.filter((item) => (
                `${item.name} ${item.type}`.toLowerCase().includes(historyFilter.trim().toLowerCase())
              )).length === 0 ? (
                <div className="history-empty-state">
                  <History size={36} />
                  <h3>{history.length ? "No matching scans" : "No scans saved yet"}</h3>
                  <p>
                    {history.length
                      ? "Try a different search term."
                      : "Classify a waste image and your saved result will appear here."}
                  </p>
                  {!history.length && (
                    <button
                      className="primary-button history-start-button"
                      onClick={() => navigateTo("Classify Waste")}
                    >
                      <Camera size={17} />
                      Classify Waste
                    </button>
                  )}
                </div>
              ) : (
                <div className="history-scan-list">
                  {history
                    .filter((item) => (
                      `${item.name} ${item.type}`.toLowerCase().includes(historyFilter.trim().toLowerCase())
                    ))
                    .map((item, index) => (
                      <article className="history-scan-card" key={item.id ?? `${item.name}-${index}`}>
                        <ScanImage scan={item} className="history-scan-image" />
                        <div className="history-scan-details">
                          <h3>{item.name}</h3>
                          <span className="history-category-tag">{item.type}</span>
                          <time dateTime={item.createdAt || undefined}>
                            {formatScanDate(item.createdAt)}
                          </time>
                        </div>
                        <div className="history-confidence">
                          <span>Confidence</span>
                          <strong>{item.confidence || "—"}</strong>
                        </div>
                      </article>
                    ))}
                </div>
              )}
            </section>
          </section>
        ) : active === "Recycling Guide" ? (
          <section className="guide-page">
            <div className="guide-page-heading">
              <div>
                <h2>Recycling Guide</h2>
                <p>Explore your classified waste and learn how to dispose of each category responsibly.</p>
              </div>
              <BookOpen size={32} />
            </div>

            <div className="panel guide-distribution-panel">
              <PanelTitle
                icon={<BarChart3 />}
                title="Your Classifications by Category"
              />
              <p className="muted">
                This graph updates from your saved image classifications.
              </p>
              <CategoryDistributionChart categories={reports.categories} />
            </div>

            <div className="guide-cards">
              {guides.map((guide) => {
                const categoryScans = history.filter((scan) =>
                  guide.aliases.includes(String(scan.type).toLowerCase())
                );

                return (
                <article className="panel guide-detail-card" key={guide.name}>
                  <div className="guide-detail-heading">
                    <div className="guide-icon" style={{ background: guide.color }}>
                      <Recycle size={19} />
                    </div>
                    <div>
                      <h3>{guide.name}</h3>
                      <p>{guide.desc}</p>
                    </div>
                    <strong className="guide-scan-count">
                      {countCategoryScans(reports.categories, guide.aliases)}
                      <small>scans</small>
                    </strong>
                  </div>
                  <div className="guide-scan-list">
                    {categoryScans.length ? categoryScans.map((scan, index) => (
                      <div className="guide-scan-item" key={scan.id ?? `${scan.name}-${index}`}>
                        <ScanImage scan={scan} className="guide-scan-image" />
                        <div>
                          <strong title={scan.name}>{scan.name}</strong>
                          <small>{formatScanDate(scan.createdAt)}</small>
                        </div>
                      </div>
                    )) : (
                      <p className="guide-no-scans">No classified products in this category yet.</p>
                    )}
                  </div>
                  <p className="guide-tip">{guide.tip}</p>
                </article>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="settings-page">
            <div className="settings-heading">
              <div>
                <h2>Settings</h2>
                <p>Manage your account, appearance, and application status.</p>
              </div>
              <span className="settings-heading-icon"><Settings size={25} /></span>
            </div>

            <section className="panel settings-account-card">
              <div className="account-avatar">
                {user.name?.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="settings-account-info">
                <span className="settings-eyebrow">SIGNED-IN ACCOUNT</span>
                <h3>{user.name || "EcoScan User"}</h3>
                <p><Mail size={15} /> {user.email || "Email not available"}</p>
              </div>
              <span className="settings-account-badge">
                <ShieldCheck size={15} />
                Active session
              </span>
            </section>

            <div className="settings-grid">
              <section className="panel settings-card">
                <PanelTitle icon={<Sun />} title="Appearance" />
                <p className="settings-description">Choose a theme for this browser. Your preference is saved automatically.</p>

                <div className="theme-options" role="group" aria-label="Color theme">
                  <button
                    type="button"
                    className={`theme-option ${theme === "light" ? "selected" : ""}`}
                    onClick={() => setTheme("light")}
                    aria-pressed={theme === "light"}
                  >
                    <Sun size={20} />
                    <span><strong>Light</strong><small>Bright and clear</small></span>
                    {theme === "light" && <CheckCircle2 size={18} />}
                  </button>

                  <button
                    type="button"
                    className={`theme-option ${theme === "dark" ? "selected" : ""}`}
                    onClick={() => setTheme("dark")}
                    aria-pressed={theme === "dark"}
                  >
                    <Moon size={20} />
                    <span><strong>Dark</strong><small>Comfortable in low light</small></span>
                    {theme === "dark" && <CheckCircle2 size={18} />}
                  </button>
                </div>
              </section>

              <section className="panel settings-card system-card">
                <PanelTitle icon={<Server />} title="System Status" />
                <p className="settings-description">Check whether the app services are reachable from this browser.</p>

                <div className="system-status-row">
                  <span><i className={`status-indicator status-${serverStatus.backend.toLowerCase().replace(/\s+/g, "-")}`} />Node.js Backend</span>
                  <strong className={`status-${serverStatus.backend.toLowerCase().replace(/\s+/g, "-")}`}>
                    {serverStatus.backend}
                  </strong>
                </div>

                <div className="system-status-row">
                  <span><i className={`status-indicator status-${serverStatus.ai.toLowerCase().replace(/\s+/g, "-")}`} />Python AI Server</span>
                  <strong className={`status-${serverStatus.ai.toLowerCase().replace(/\s+/g, "-")}`}>
                    {serverStatus.ai}
                  </strong>
                </div>

                <button
                  className="primary-button status-button"
                  onClick={checkServers}
                  disabled={checkingServers}
                  type="button"
                >
                  <RefreshCw size={17} className={checkingServers ? "settings-spinning" : ""} />
                  {checkingServers ? "Checking..." : "Check Connections"}
                </button>
                <p className="settings-footnote">A reachable server may still have a separate model or database issue.</p>
              </section>

              <section className="panel settings-card settings-security-card">
                <PanelTitle icon={<ShieldCheck />} title="Security & Session" />

                <div className="session-detail">
                  <span className="session-detail-icon"><ShieldCheck size={18} /></span>
                  <div>
                    <strong>You are signed in</strong>
                    <p>Your account session is active on this device.</p>
                  </div>
                </div>

                <button
                  type="button"
                  className="dropdown-action settings-logout"
                  onClick={() => {
                    localStorage.removeItem("ecoscan_token");
                    setProfileOpen(false);
                    setUser(null);
                    navigateTo("Dashboard");
                    setMenuOpen(false);
                    setImage(null);
                    setPreview("");
                    setResult(null);
                  }}
                >
                  <LogOut size={17} />
                  Log Out
                </button>
                <p className="settings-footnote">You can sign back in at any time with your account credentials.</p>
              </section>
            </div>
          </section>
        )}

        <footer>EcoScan AI · Smart Waste Management System <span>Reduce · Reuse · Recycle</span></footer>
      </main>
    </div>
  );
}

function Stat({ icon, title, value, color }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}>{icon}</div>
      <div><p>{title}</p><h2>{value}</h2><small>EcoScan AI overview</small></div>
    </div>
  );
}

function CategoryDistributionChart({ categories, compact = false }) {
  const values = guides.map((guide) => ({
    ...guide,
    count: countCategoryScans(categories, guide.aliases),
  }));
  const maxCount = Math.max(1, ...values.map((item) => item.count));
  const total = values.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className={`category-chart ${compact ? "compact" : ""}`}>
      {values.map((item) => {
        const percentage = item.count === 0 ? 0 : (item.count / maxCount) * 100;

        return (
          <div className="category-chart-row" key={item.name}>
            <div className="category-chart-label">
              <span>{item.name}</span>
              <strong>{item.count}</strong>
            </div>
            <div
              className="category-chart-track"
              role="progressbar"
              aria-label={`${item.name} classifications`}
              aria-valuemin={0}
              aria-valuemax={maxCount}
              aria-valuenow={item.count}
            >
              <span
                className="category-chart-fill"
                style={{ width: `${percentage}%`, backgroundColor: item.color }}
              />
            </div>
          </div>
        );
      })}
      {total === 0 && (
        <p className="muted category-chart-empty">
          No saved classifications yet. Classify an image to see category totals here.
        </p>
      )}
    </div>
  );
}

function formatScanDate(value) {
  if (!value) return "Date unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function ScanImage({ scan, className = "" }) {
  const [imageSource, setImageSource] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!scan.imageUrl) return undefined;

    const controller = new AbortController();
    let cancelled = false;
    let objectUrl;

    async function loadImage() {
      try {
        const response = await fetch(
          `http://localhost:5000${scan.imageUrl}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("ecoscan_token")}`,
            },
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(`Image request failed with status ${response.status}`);
        }

        objectUrl = URL.createObjectURL(await response.blob());
        if (!cancelled) {
          setImageSource(objectUrl);
        }
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error(`Failed to load scan image ${scan.id}:`, error);
          if (!cancelled) setLoadFailed(true);
        }
      }
    }

    loadImage();

    return () => {
      cancelled = true;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [scan.id, scan.imageUrl]);

  if (imageSource && !loadFailed) {
    return <img className={className} src={imageSource} alt={scan.name} loading="lazy" />;
  }

  return (
    <div className={`${className} scan-image-placeholder`} aria-label={loadFailed ? "Image unavailable" : "No image"}>
      <ImageIcon size={20} />
      <span>{loadFailed ? "Unavailable" : "No photo"}</span>
    </div>
  );
}

function PanelTitle({ icon, title }) {
  return <div className="panel-title"><span>{icon}</span><h3>{title}</h3></div>;
}

export default App;
