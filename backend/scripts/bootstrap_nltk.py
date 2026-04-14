import nltk

PACKAGES = ["wordnet", "omw-1.4", "punkt", "punkt_tab", "averaged_perceptron_tagger", "averaged_perceptron_tagger_eng"]


def main() -> None:
    for pkg in PACKAGES:
        print(f"downloading {pkg}")
        nltk.download(pkg, quiet=True)
    print("done")


if __name__ == "__main__":
    main()
