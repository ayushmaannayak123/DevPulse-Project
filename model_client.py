"""
=============================================================
DevPulse -- Phase 2: Backend-agnostic LLM client
Local Ollama (default, free) or cloud Groq -- same interface either way.
=============================================================
"""

import os
import sys


def get_client_and_model():
    """Returns (client, model_name, backend). `client` exposes
    .chat.completions.create(...) with the same signature regardless
    of which backend is selected."""
    backend = os.environ.get(
        "LLM_BACKEND", "ollama" if not os.environ.get("GROQ_API_KEY") else "groq"
    ).lower()

    if backend == "groq":
        from groq import Groq
        client = Groq(api_key=os.environ["GROQ_API_KEY"])
        model = os.environ.get("GROQ_MODEL", "llama-3.1-8b-instant")
        return client, model, "groq"

    # -- Ollama, via its OpenAI-compatible endpoint --------------------------
    from openai import OpenAI
    base_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434/v1")
    client = OpenAI(base_url=base_url, api_key="ollama")  # api_key is a required-but-unchecked placeholder
    model = os.environ.get("OLLAMA_MODEL", "qwen2.5:3b")
    return client, model, "ollama"


def check_connection(client, model, backend) -> bool:
    """Friendly pre-flight check -- fail with a clear, backend-specific
    message instead of a raw connection traceback."""
    try:
        client.chat.completions.create(
            model=model, messages=[{"role": "user", "content": "Say OK in one word"}], max_tokens=5
        )
        return True
    except Exception as e:
        if backend == "ollama":
            print("\nCould not reach Ollama at the configured base_url.", file=sys.stderr)
            print("  1) Is it running?      -> ollama serve", file=sys.stderr)
            print(f"  2) Is the model pulled? -> ollama pull {model}", file=sys.stderr)
        else:
            print("\nCould not reach Groq.", file=sys.stderr)
            print("  Check that GROQ_API_KEY is set correctly.", file=sys.stderr)
        print(f"  Underlying error: {e}\n", file=sys.stderr)
        return False


if __name__ == "__main__":
    c, m, b = get_client_and_model()
    print(f"Backend: {b} | Model: {m}")
    print("Connection OK" if check_connection(c, m, b) else "Connection FAILED")
