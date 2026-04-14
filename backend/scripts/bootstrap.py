import argparse

NLTK_PACKAGES = [
    "wordnet",
    "omw-1.4",
    "punkt",
    "punkt_tab",
    "averaged_perceptron_tagger",
    "averaged_perceptron_tagger_eng",
]
DEFAULT_EMBEDDINGS_MODEL = "glove-wiki-gigaword-100"


def _download_nltk() -> None:
    import nltk

    for pkg in NLTK_PACKAGES:
        print(f"downloading nltk:{pkg}")
        nltk.download(pkg, quiet=True)


def _download_embeddings(model_name: str) -> None:
    try:
        import gensim.downloader as api
    except ImportError as exc:
        raise SystemExit(
            "embeddings dependency missing; reinstall with `pip install -e \".[embeddings]\"` "
            "or pass --skip-embeddings"
        ) from exc

    print(f"downloading embeddings:{model_name}")
    api.load(model_name, return_path=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Download NLTK + embedding assets")
    parser.add_argument(
        "--skip-embeddings",
        action="store_true",
        help="Skip the GloVe download (useful for CI / NLTK-only setups).",
    )
    parser.add_argument(
        "--embeddings-model",
        default=DEFAULT_EMBEDDINGS_MODEL,
        help=f"gensim-downloader model name (default: {DEFAULT_EMBEDDINGS_MODEL}).",
    )
    args = parser.parse_args()

    _download_nltk()
    if not args.skip_embeddings:
        _download_embeddings(args.embeddings_model)
    print("done")


if __name__ == "__main__":
    main()
