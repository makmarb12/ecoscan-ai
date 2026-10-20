import io

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from transformers import pipeline

MODEL_NAME = "watersplash/waste-classification"
MAX_IMAGE_BYTES = 5 * 1024 * 1024

app = FastAPI(title="EcoScan AI Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

classifier = None


@app.on_event("startup")
def load_model():
    global classifier

    print(f"Loading EcoScan AI image model: {MODEL_NAME}")
    classifier = pipeline("image-classification", model=MODEL_NAME)
    print("Image model loaded successfully.")


@app.get("/")
def home():
    return {"message": "EcoScan AI service is running"}


@app.get("/health")
def health():
    return {
        "status": "running",
        "model_loaded": classifier is not None,
    }


@app.post("/predict")
async def predict(image: UploadFile = File(...)):
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload an image file.")

    contents = await image.read()
    if len(contents) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Image must be 5 MB or smaller.",
        )

    if classifier is None:
        raise HTTPException(
            status_code=503,
            detail="The image classification model is not ready.",
        )

    try:
        img = Image.open(io.BytesIO(contents)).convert("RGB")
        results = classifier(img)
    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=f"Could not process image: {error}",
        ) from error

    if not results:
        raise HTTPException(
            status_code=502,
            detail="The image model returned no classification.",
        )

    raw_label = results[0]["label"].lower()
    confidence = round(results[0]["score"] * 100, 2)

    if "plastic" in raw_label:
        category = "Plastic"
    elif "paper" in raw_label or "cardboard" in raw_label:
        category = "Paper"
    elif "glass" in raw_label:
        category = "Glass"
    elif "metal" in raw_label:
        category = "Metal"
    elif any(word in raw_label for word in ("biological", "brown-grass", "organic")):
        category = "Organic"
    elif "battery" in raw_label:
        category = "E-Waste"
    else:
        category = "Other Waste"

    return {
        "category": category,
        "confidence": confidence,
        "model": MODEL_NAME,
        "original_label": raw_label,
    }
