
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const db = require("./db");
require("dotenv").config();

const app = express();
const PORT = 5000;
const uploadsDirectory = path.join(__dirname, "uploads");

fs.mkdirSync(uploadsDirectory, { recursive: true });

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only JPG, PNG, and WEBP images are allowed."));
        }
    }
});

app.use(cors({
    origin: [
        "http://localhost:5173",
        "http://localhost:5174"
    ]
}));
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is missing in the .env file");
}

// Test route
app.get("/", (req, res) => {
    res.json({ message: "EcoScan AI API is running!" });
});

// Signup
app.post("/api/auth/signup", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                message: "Name, email, and password are required."
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                message: "Password must be at least 8 characters."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const existingUser = db
            .prepare("SELECT id FROM users WHERE email = ?")
            .get(normalizedEmail);

        if (existingUser) {
            return res.status(409).json({
                message: "This email is already registered."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const result = db.prepare(
            "INSERT INTO users (name, email, password) VALUES (?, ?, ?)"
        ).run(name.trim(), normalizedEmail, hashedPassword);

        const user = {
            id: result.lastInsertRowid,
            name: name.trim(),
            email: normalizedEmail
        };

        const token = jwt.sign(
            { id: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: "1d" }
        );

        return res.status(201).json({
            message: "Account created successfully!",
            user,
            token
        });
    } catch (error) {
        console.error("Signup error:", error);
        return res.status(500).json({
            message: "Unable to create account."
        });
    }
});

// Login
app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const user = db.prepare(
            "SELECT id, name, email, password FROM users WHERE email = ?"
        ).get(normalizedEmail);

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: "1d" }
        );

        return res.json({
            message: "Login successful!",
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            },
            token
        });
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({
            message: "Unable to log in."
        });
    }
});

/* Verify JWT token */
function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;

    const token = authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : null;

    if (!token) {
        return res.status(401).json({
            message: "Authentication required. Please log in."
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({
            message: "Invalid or expired token. Please log in again."
        });
    }
}

/* Protected route: get the logged-in user */
app.get("/api/auth/me", authenticateToken, (req, res) => {
    const user = db.prepare(
        "SELECT id, name, email FROM users WHERE id = ?"
    ).get(req.user.id);

    if (!user) {
        return res.status(404).json({
            message: "User not found."
        });
    }

    return res.json({ user });
});

app.post(
    "/api/scans",
    authenticateToken,
    upload.single("image"),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    message: "Please upload an image."
                });
            }

            // Send the uploaded image to the Python AI server
            const formData = new FormData();

            const imageBlob = new Blob(
                [req.file.buffer],
                { type: req.file.mimetype }
            );

            formData.append(
                "image",
                imageBlob,
                req.file.originalname
            );

            let aiResponse;
            try {
                aiResponse = await fetch(
                    "http://127.0.0.1:8000/predict",
                    {
                        method: "POST",
                        body: formData
                    }
                );
            } catch (error) {
                console.error("AI service connection error:", error);
                return res.status(503).json({
                    message: "The AI classification service is unavailable. Start the AI service on port 8000 and try again."
                });
            }

            if (!aiResponse.ok) {
                const errorText = await aiResponse.text();

                console.error("AI server error:", errorText);

                return res.status(502).json({
                    message: "AI image classification failed.",
                    detail: errorText
                });
            }

            const aiResult = await aiResponse.json();
            console.log("Python AI result:", aiResult);

            const rawLabel = String(
                aiResult.original_label || aiResult.category || "Unknown"
            ).toLowerCase();

            // Map common model labels to EcoScan categories.
            // Unknown labels remain Unknown rather than being guessed.
            let category = "Unknown";

            if (/plastic|plastic bottle/.test(rawLabel)) {
                category = "Plastic";
            } else if (/paper|cardboard|carton|envelope/.test(rawLabel)) {
                category = "Paper";
            } else if (/glass|jar|wine bottle/.test(rawLabel)) {
                category = "Glass";
            } else if (/metal|can|tin|foil/.test(rawLabel)) {
                category = "Metal";
            } else if (/battery|electronic|computer|mobile phone/.test(rawLabel)) {
                category = "E-Waste";
            } else if (/organic|food waste|compost/.test(rawLabel)) {
                category = "Organic";
            }

            console.log("Final EcoScan category:", category);

            const confidence = `${aiResult.confidence}%`;

            const extensionByMimeType = {
                "image/jpeg": ".jpg",
                "image/png": ".png",
                "image/webp": ".webp"
            };
            const imagePath = `${randomUUID()}${extensionByMimeType[req.file.mimetype]}`;
            const storedImagePath = path.join(uploadsDirectory, imagePath);

            await fs.promises.writeFile(storedImagePath, req.file.buffer, {
                flag: "wx"
            });

            let saved;
            let pointsAwarded = 0;
            try {
                const saveScan = db.transaction(() => {
                    const insertScan = db.prepare(`
                        INSERT INTO scans
                        (user_id, image_name, category, confidence, image_path)
                        VALUES (?, ?, ?, ?, ?)
                    `);

                    const scan = insertScan.run(
                        req.user.id,
                        req.file.originalname,
                        category,
                        confidence,
                        imagePath
                    );

                    const eligibleCategories = [
                        "Plastic",
                        "Paper",
                        "Glass",
                        "Metal",
                        "Organic",
                        "E-Waste"
                    ];

                    let awarded = 0;
                    if (eligibleCategories.includes(category)) {
                        const reward = db.prepare(`
                            INSERT OR IGNORE INTO reward_transactions
                            (user_id, scan_id, points, reason)
                            VALUES (?, ?, ?, ?)
                        `).run(
                            req.user.id,
                            scan.lastInsertRowid,
                            10,
                            `Successful ${category} classification`
                        );

                        if (reward.changes > 0) {
                            awarded = 10;
                        }
                    }

                    return { scan, awarded };
                });

                const savedResult = saveScan();
                saved = savedResult.scan;
                pointsAwarded = savedResult.awarded;
            } catch (error) {
                await fs.promises.unlink(storedImagePath);
                throw error;
            }

            return res.status(201).json({
                message: "AI scan completed and saved successfully.",
                scan: {
                    id: saved.lastInsertRowid,
                    name: req.file.originalname,
                    category,
                    confidence,
                    model: aiResult.model,
                    imageUrl: `/api/scans/${saved.lastInsertRowid}/image`
                },
                pointsAwarded
            });
        } catch (error) {
            console.error("Scan error:", error);

            return res.status(500).json({
                message: "Failed to classify or save scan."
            });
        }
    }
);

app.get("/api/scans/:id/image", authenticateToken, (req, res) => {
    const scan = db.prepare(`
        SELECT image_path
        FROM scans
        WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.id);

    if (!scan || !scan.image_path) {
        return res.status(404).json({
            message: "Scan image was not found."
        });
    }

    return res.sendFile(scan.image_path, { root: uploadsDirectory }, (error) => {
        if (error) {
            console.error("Scan image delivery error:", error);
            if (!res.headersSent) {
                res.status(error.statusCode || 500).json({
                    message: "Failed to load scan image."
                });
            }
        }
    });
});

app.get("/api/scans", authenticateToken, (req, res) => {
    try {
        const getScans = db.prepare(`
            SELECT id, image_name, category, confidence, created_at, image_path
            FROM scans
            WHERE user_id = ?
            ORDER BY id DESC
        `);

        const scans = getScans.all(req.user.id).map((scan) => ({
            id: scan.id,
            image_name: scan.image_name,
            category: scan.category,
            confidence: scan.confidence,
            created_at: scan.created_at,
            imageUrl: scan.image_path
                ? `/api/scans/${scan.id}/image`
                : null
        }));

        return res.status(200).json({
            message: "Scan history retrieved successfully.",
            scans
        });
    } catch (error) {
        console.error("History error:", error);

        return res.status(500).json({
            message: "Failed to retrieve scan history."
        });
    }
});


// Get Eco Points and Rewards History
app.get("/api/rewards", authenticateToken, (req, res) => {
    try {
        const userId = req.user.id;

        const total = db.prepare(`
            SELECT COALESCE(SUM(points), 0) AS totalPoints
            FROM reward_transactions
            WHERE user_id = ?
        `).get(userId);

        const history = db.prepare(`
            SELECT id, scan_id, points, reason, created_at
            FROM reward_transactions
            WHERE user_id = ?
            ORDER BY id DESC
        `).all(userId);

        const totalPoints = total.totalPoints;

        let level = "Beginner";
        if (totalPoints >= 500) {
            level = "Eco Champion";
        } else if (totalPoints >= 200) {
            level = "Green Hero";
        } else if (totalPoints >= 50) {
            level = "Eco Friend";
        }

        return res.json({
            totalPoints,
            level,
            history
        });
    } catch (error) {
        console.error("Rewards error:", error);
        return res.status(500).json({
            message: "Failed to load rewards."
        });
    }
});

app.get("/api/reports", authenticateToken, (req, res) => {
    try {
        const userId = req.user.id;

        const totalResult = db.prepare(`
            SELECT COUNT(*) AS totalScans
            FROM scans
            WHERE user_id = ?
        `).get(userId);

        const categoryResults = db.prepare(`
            SELECT category, COUNT(*) AS count
            FROM scans
            WHERE user_id = ?
            GROUP BY category
            ORDER BY count DESC
        `).all(userId);

        const confidenceResult = db.prepare(`
            SELECT AVG(
                CAST(REPLACE(confidence, '%', '') AS REAL)
            ) AS averageConfidence
            FROM scans
            WHERE user_id = ?
        `).get(userId);

        return res.status(200).json({
            totalScans: totalResult.totalScans,
            categories: categoryResults,
            averageConfidence: Number(
                confidenceResult.averageConfidence || 0
            ).toFixed(2)
        });
    } catch (error) {
        console.error("Reports error:", error);

        return res.status(500).json({
            message: "Failed to load reports."
        });
    }
});



app.listen(PORT, () => {
    console.log(`EcoScan AI server running at http://localhost:${PORT}`);
});
