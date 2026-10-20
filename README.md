# EcoScan AI

## Run locally

Start each service in a separate terminal from the project root.

1. Start the AI service:

   ```powershell
   cd ai_server
   py -m venv .venv
   .\.venv\Scripts\python.exe -m pip install -r requirements.txt
   .\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
   ```

   The model downloads the first time it starts. Wait until it reports that the
   model loaded; `http://127.0.0.1:8000/health` should then report
   `"model_loaded": true`.

2. Start the backend in another terminal:

   ```powershell
   cd backend
   npm install
   node server.js
   ```

3. From the project root, start the frontend:

   ```powershell
   npm install
   npm run dev
   ```

The frontend and backend must both be running, and the AI service must be
available on port 8000, before image classification can complete. If it is
unavailable, the app will show an instruction to start the AI service.
