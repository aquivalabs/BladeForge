# scripts/validate_eval.test.py
import json, subprocess, sys, tempfile, unittest
from pathlib import Path

SCRIPT = str(Path(__file__).with_name("validate_eval.py"))

def run(path):
    return subprocess.run([sys.executable, SCRIPT, str(path)],
                          capture_output=True, text=True)

def write(cases):
    f = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False)
    json.dump(cases, f); f.close()
    return Path(f.name)

VALID = ([{"query": f"q{i}", "should_trigger": True} for i in range(3)] +
         [{"query": f"n{i}", "should_trigger": False} for i in range(3)])

class T(unittest.TestCase):
    def test_valid_prints_hash_exit0(self):
        r = run(write(VALID))
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertRegex(r.stdout.strip(), r"^[0-9a-f]{64}$")

    def test_missing_file_blocks(self):
        r = run(Path("/no/such/trigger-eval.json"))
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("missing", r.stderr)

    def test_not_array_blocks(self):
        r = run(write({"query": "x", "should_trigger": True}))
        self.assertNotEqual(r.returncode, 0)

    def test_too_few_cases_blocks(self):
        r = run(write(VALID[:5]))
        self.assertNotEqual(r.returncode, 0)
        self.assertIn(">= 6", r.stderr)

    def test_all_positive_blocks(self):
        r = run(write([{"query": f"q{i}", "should_trigger": True} for i in range(6)]))
        self.assertNotEqual(r.returncode, 0)

    def test_bad_item_shape_blocks(self):
        bad = VALID[:5] + [{"query": "x", "should_trigger": "yes"}]
        r = run(write(bad))
        self.assertNotEqual(r.returncode, 0)

if __name__ == "__main__":
    unittest.main()
