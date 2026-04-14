from dataclasses import dataclass


@dataclass(frozen=True)
class Prompt:
    id: str
    text: str


PROMPTS: list[Prompt] = [
    Prompt("sky-blue", "Explain why the sky is blue."),
    Prompt("list-vs-tuple", "What is the difference between a list and a tuple in Python?"),
    Prompt("photosynthesis", "How does photosynthesis work?"),
    Prompt("dreams", "Why do we dream?"),
    Prompt("neural-net", "Explain how a neural network learns."),
    Prompt("ocean-tides", "What causes ocean tides?"),
    Prompt("encryption", "How does encryption keep data safe?"),
    Prompt("black-holes", "What is a black hole?"),
    Prompt("dna", "What does DNA do inside a cell?"),
    Prompt("rainbows", "Why do rainbows form after rain?"),
    Prompt("earthquakes", "What causes earthquakes?"),
    Prompt("muscle-growth", "How do muscles grow from exercise?"),
    Prompt("volcanoes", "Why do volcanoes erupt?"),
    Prompt("compiler", "What does a compiler do?"),
    Prompt("recursion", "Explain recursion in simple terms."),
    Prompt("git-branches", "What is a branch in Git?"),
    Prompt("vaccines", "How do vaccines work?"),
    Prompt("inflation", "What causes inflation in an economy?"),
    Prompt("tcp-vs-udp", "What is the difference between TCP and UDP?"),
    Prompt("evolution", "How does natural selection drive evolution?"),
    Prompt("seasons", "Why does Earth have seasons?"),
    Prompt("memory-hierarchy", "What is the memory hierarchy in a computer?"),
    Prompt("gravity", "What is gravity?"),
    Prompt("sleep-cycles", "Why do humans need sleep?"),
    Prompt("blockchain", "How does a blockchain work?"),
    Prompt("climate-change", "What are the main causes of climate change today?"),
    Prompt("dark-matter", "What is dark matter and why is it important?"),
    Prompt("quantum-basics", "What are the basic ideas behind quantum mechanics?"),
    Prompt("ai-ethics", "What ethical concerns arise from modern AI systems?"),
    Prompt("privacy", "Why is personal data privacy important online?"),
    Prompt("antibiotic-resistance", "How does antibiotic resistance develop in bacteria?"),
    Prompt("renewable-energy", "How does solar energy generate electricity?"),

    Prompt("cats-secret", "Why do cats stare at nothing?"),
    Prompt("banana-lawyer", "Defend a banana in court."),
    Prompt("time-cafe", "Describe a café across time periods."),
    Prompt("ai-dreams", "What would AI dream about?"),
    Prompt("toaster-revolt", "Story of a rebellious toaster."),
    Prompt("alien-review", "Write a restaurant review by an alien visiting Earth."),
    Prompt("parallel-job", "What job might you have in a reversed universe?"),
    Prompt("music-colors", "What if music were experienced as colors instead of sound?"),
    Prompt("internet-city", "What would the internet look like as a physical city?"),
    Prompt("book-reads-you", "What would happen if a book could read its reader?"),
    Prompt("gravity-jealous", "If gravity had emotions, what might it be jealous of?"),
    Prompt("silent-week", "What would change if the world lost sound for a week?"),
    Prompt("smart-fridge", "Write a diary entry from a smart fridge judging its owner."),
    Prompt("code-poem", "How can a poem also be valid and runnable Python code?"),
    Prompt("robot-jobs", "Which jobs might robots refuse to do in the future?"),
    Prompt("shadow-life", "What might your shadow do when you are not looking?"),
    Prompt("time-person", "If time were a person, what traits would it have?"),
    Prompt("bug-report-human", "How would you write a bug report about a human?"),
    Prompt("ai-standup", "What jokes would an AI tell about humans?"),
    Prompt("memory-market", "How would a marketplace for buying and selling memories work?"),
    Prompt("sleep-review", "How would you review sleep as if it were a product?"),
    Prompt("brain-os", "What features would a brain operating system include?"),
    Prompt("parallel-self", "What would you discuss with your parallel universe self?"),
    Prompt("keyboard-war", "What would a war between keyboard layouts look like?"),
    Prompt("emoji-debate", "How could a serious debate happen using only emojis?"),
    Prompt("future-archaeology", "How might future archaeologists interpret smartphones?"),
    Prompt("thought-speed", "What if human thoughts had a maximum speed limit?"),
    Prompt("history-meme", "Summarize world history as if it were a series of memes."),
    Prompt("fish-internet", "What would the internet look like if fish had invented it?"),
    Prompt("email-apology", "Write an apology email from a spam email to humanity."),
]


def get(prompt_id: str) -> Prompt | None:
    return next((p for p in PROMPTS if p.id == prompt_id), None)
