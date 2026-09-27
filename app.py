from __future__ import annotations

import math
import re
from collections import Counter
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

BASE_DIR = Path(__file__).resolve().parent
app = Flask(__name__, static_folder=None)


@app.after_request
def allow_frontend_preview(response):
    response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response

KNOWLEDGE_BASE = [
    {
        "title": "Phishing and social engineering",
        "text": "Phishing is a social engineering attack that uses deceptive emails, messages, websites, or phone calls to trick people into revealing credentials, opening malware, or transferring money. Verify the sender, inspect links before opening them, avoid urgent requests for secrets, and report suspicious messages through the approved security channel.",
    },
    {
        "title": "Ransomware response",
        "text": "Ransomware is malware that encrypts files or disrupts systems and demands payment. Isolate the affected device from networks immediately, preserve evidence, notify the incident response team, and do not reconnect systems until they are cleared. Recovery should use tested offline backups and documented restoration procedures.",
    },
    {
        "title": "Password and authentication security",
        "text": "Use long, unique passwords or passphrases for every account and store them in an approved password manager. Enable multi-factor authentication, prefer phishing-resistant security keys where available, and never reuse privileged credentials. Rotate credentials when compromise is suspected and review account activity for unusual sign-ins.",
    },
    {
        "title": "Encryption fundamentals",
        "text": "Encryption transforms readable data into ciphertext so unauthorized people cannot understand it. Use TLS to protect data in transit and strong, centrally managed encryption for sensitive data at rest. Protect keys separately, limit key access, rotate keys according to policy, and never treat encryption as a replacement for access control.",
    },
    {
        "title": "Network security and firewalls",
        "text": "Firewalls enforce traffic rules between networks or hosts. Use a default-deny posture where practical, allow only required ports and protocols, segment sensitive systems, log decisions, and review rules regularly. Network monitoring should detect unusual connections, lateral movement, and unexpected data transfer.",
    },
    {
        "title": "Malware prevention",
        "text": "Reduce malware risk with timely patching, endpoint protection, application allowlisting, least privilege, safe email filtering, and regular offline backups. Users should avoid untrusted downloads and macros. Security teams should investigate alerts, quarantine affected hosts, and preserve relevant logs for analysis.",
    },
    {
        "title": "Incident response",
        "text": "A sound incident response process includes preparation, detection and analysis, containment, eradication, recovery, and lessons learned. Record a timeline, preserve logs and evidence, communicate through the incident plan, and document decisions. Test the plan with tabletop exercises so roles and escalation paths are clear.",
    },
    {
        "title": "Security best practices",
        "text": "Apply least privilege, keep operating systems and applications patched, back up critical data, monitor important systems, train users against social engineering, and maintain an inventory of assets. Security controls work best as layers: prevention, detection, response, and recovery should reinforce one another.",
    },
]

STOP_WORDS = {
    "a", "an", "and", "are", "be", "by", "for", "from", "how", "in", "is", "it", "of", "on", "or", "the", "to", "what", "when", "where", "with", "you", "your"
}

def tokens(value: str) -> list[str]:
    return [word for word in re.findall(r"[a-z0-9]+", value.lower()) if len(word) > 2 and word not in STOP_WORDS]


def build_index() -> tuple[list[Counter[str]], Counter[str]]:
    document_terms = [Counter(tokens(f"{item['title']} {item['text']}")) for item in KNOWLEDGE_BASE]
    document_frequency = Counter()
    for term_counts in document_terms:
        document_frequency.update(term_counts.keys())
    return document_terms, document_frequency


DOCUMENT_TERMS, DOCUMENT_FREQUENCY = build_index()


def similarity(query: str, document_terms: Counter[str], document_count: int) -> float:
    query_terms = Counter(tokens(query))
    if not query_terms:
        return 0.0
    query_vector: dict[str, float] = {}
    document_vector: dict[str, float] = {}
    for term, count in query_terms.items():
        inverse_frequency = math.log((1 + document_count) / (1 + DOCUMENT_FREQUENCY.get(term, 0))) + 1
        query_vector[term] = count * inverse_frequency
        document_vector[term] = document_terms.get(term, 0) * inverse_frequency
    numerator = sum(query_vector[term] * document_vector[term] for term in query_vector)
    query_norm = math.sqrt(sum(value * value for value in query_vector.values()))
    document_norm = math.sqrt(sum(value * value for value in document_vector.values()))
    return numerator / (query_norm * document_norm) if query_norm and document_norm else 0.0


def retrieve(query: str) -> list[dict[str, object]]:
    scored = []
    query_terms = set(tokens(query))
    for index, item in enumerate(KNOWLEDGE_BASE):
        title_terms = set(tokens(item["title"]))
        topic_boost = 0.4 if query_terms.intersection(title_terms) else 0.0
        score = similarity(query, DOCUMENT_TERMS[index], len(KNOWLEDGE_BASE)) + topic_boost
        scored.append((score, item))
    return [{"text": item["text"], "distance": round(max(0.0, 1 - score), 4), "title": item["title"]} for score, item in sorted(scored, key=lambda pair: pair[0], reverse=True)[:3] if score > 0]


@app.get("/health")
def health():
    return jsonify({"status": "ok", "service": "CyberRAG", "knowledge_chunks": len(KNOWLEDGE_BASE)})


@app.post("/ask")
def ask():
    payload = request.get_json(silent=True) or {}
    question = str(payload.get("question", "")).strip()
    if not question:
        return jsonify({"answer": "", "sources": [], "error": "A question is required."}), 400
    sources = retrieve(question)
    if not sources:
        return jsonify({"answer": "", "sources": []})
    answer = " ".join(source["text"] for source in sources[:2])
    return jsonify({"answer": answer, "sources": sources})


@app.get("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")


@app.get("/<path:filename>")
def frontend_asset(filename: str):
    requested = BASE_DIR / filename
    if requested.is_file() and BASE_DIR in requested.parents:
        return send_from_directory(BASE_DIR, filename)
    return jsonify({"error": "Not found"}), 404


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
