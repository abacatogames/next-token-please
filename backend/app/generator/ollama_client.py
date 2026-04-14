import httpx

from app.config import settings


async def is_reachable(timeout: float = 2.0) -> bool:
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.get(f"{settings.ollama_url}/api/tags")
            return r.status_code == 200
    except httpx.HTTPError:
        return False


async def generate(prompt: str, system: str, *, temperature: float = 0.7,
                   top_p: float = 0.9, num_predict: int = 140,
                   stop: list[str] | None = None, timeout: float = 60.0) -> str:
    payload = {
        "model": settings.ollama_model,
        "prompt": prompt,
        "system": system,
        "stream": False,
        "options": {
            "temperature": temperature,
            "top_p": top_p,
            "num_predict": num_predict,
            **({"stop": stop} if stop else {}),
        },
    }
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.post(f"{settings.ollama_url}/api/generate", json=payload)
        r.raise_for_status()
        data = r.json()
    return data.get("response", "").strip()
