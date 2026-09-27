# CyberRAG Assistant

CyberRAG is a cybersecurity-focused Retrieval-Augmented Generation assistant with a Flask API and a responsive dark dashboard frontend.

## Run the complete app

From this folder:

```powershell
python -m pip install -r requirements.txt
python app.py
```

Open [http://127.0.0.1:5000](http://127.0.0.1:5000).

The API exposes:

- `GET /health` for service status and knowledge-base count
- `POST /ask` with `{ "question": "..." }`
- `/` and frontend assets for the CyberRAG dashboard

The frontend also supports the existing static preview command:

```powershell
npm start
```

When served on port 3000, it automatically calls the Flask API on port 5000. The Flask-served version uses relative `/health` and `/ask` requests.

## Included RAG flow

1. Tokenize the question and cybersecurity knowledge documents.
2. Rank documents using weighted term similarity with topic-title relevance boosting.
3. Return the generated context-aware answer plus the top retrieved sources and distance values.
4. Display the answer, evidence, pipeline, and live health state in the CyberRAG UI.
