import argparse

BASE_COSTS = {
    "brave": 0.001,
    "exa": 0.06,
    "tavily": 0.06,
    "firecrawl": 0.04,
    "llm": 0.03,
}


def estimate(snippets: int, firecrawl_retries: int = 1):
    cost = BASE_COSTS["brave"] + BASE_COSTS["exa"] + BASE_COSTS["tavily"] + BASE_COSTS["llm"]
    cost += BASE_COSTS["firecrawl"] * max(1, firecrawl_retries)
    # Adjust LLM cost slightly for larger snippet batches
    if snippets > 21:
        cost += 0.01
    return cost


def main():
    parser = argparse.ArgumentParser(description="Estimate per-query cost for snippet flows.")
    parser.add_argument("--snippets", type=int, default=21, help="snippet limit (21 or 33)")
    parser.add_argument("--retries", type=int, default=1, help="firecrawl retries (default 1)")
    args = parser.parse_args()

    cost = estimate(args.snippets, args.retries)
    print(f"Estimated cost for {args.snippets} snippets (retries={args.retries}): ${cost:.3f}")


if __name__ == "__main__":
    main()
