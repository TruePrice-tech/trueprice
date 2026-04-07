"""
Top-level test chainer.

Runs the full QA suite in order and aborts on the first failing step. Use
this before any commit that touches an analyzer endpoint, an OCR helper,
a comparison page, or a parser prompt.

Steps:
  1. Counter pollution audit (must be 0)
  2. Single-quote test pass per vertical (parser detection rates)
  3. Comparison test pass per vertical (clean + messy + verdict)
  4. Counter pollution audit AGAIN (defense in depth — confirms the
     test pass itself didn't pollute the live counter)

Each step prints its summary and exits non-zero on failure. The chainer
captures every output to test-results/run-YYYY-MM-DD-HHMM.md so you have
a history.

Usage: python scripts/run-all-tests.py
"""
import subprocess, sys, os, io, time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

STEPS = [
    ("Counter pollution audit (pre)", ["python", "scripts/audit-counter-pollution.py"]),
    ("Single-quote test pass", ["python", "scripts/test-all-vertical-fixtures.py"]),
    ("Comparison test pass (clean+messy+verdict)", ["python", "scripts/test-comparisons.py"]),
    ("Counter pollution audit (post)", ["python", "scripts/audit-counter-pollution.py"]),
]


def main():
    os.makedirs("test-results", exist_ok=True)
    stamp = time.strftime("%Y-%m-%d-%H%M")
    log_path = f"test-results/run-{stamp}.md"
    log = open(log_path, "w", encoding="utf-8")
    log.write(f"# TruePrice full test run — {stamp}\n\n")

    failures = []
    for name, cmd in STEPS:
        print(f"\n{'=' * 70}\n  STEP: {name}\n{'=' * 70}")
        log.write(f"\n## {name}\n\n```\n")
        t0 = time.time()
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=3600)
            out = (r.stdout or "") + ("\n" + r.stderr if r.stderr else "")
            print(out[-2000:])  # tail
            log.write(out)
            log.write(f"\n```\n\nExit code: {r.returncode}, elapsed: {round(time.time() - t0)}s\n")
            if r.returncode != 0:
                failures.append(name)
                print(f"\nFAILED: {name} (exit {r.returncode})")
        except subprocess.TimeoutExpired:
            failures.append(name + " (timeout)")
            log.write("\nTIMEOUT after 1 hour\n")
            print(f"TIMEOUT: {name}")

    log.write("\n## Summary\n\n")
    if failures:
        log.write("FAILURES:\n")
        for f in failures:
            log.write(f"  - {f}\n")
        print(f"\n\n{len(failures)} step(s) failed:")
        for f in failures:
            print(f"  - {f}")
        log.close()
        print(f"\nFull log: {log_path}")
        return 1

    log.write("All steps passed.\n")
    log.close()
    print(f"\n\nALL STEPS PASSED. Log: {log_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
