# scripts/validate_eval.test.py — validate_eval reads rubric.json's trigger half
import json, subprocess, sys, tempfile, unittest
from pathlib import Path

SCRIPT = str(Path(__file__).with_name("validate_eval.py"))

def run(path):
    return subprocess.run([sys.executable, SCRIPT, str(path)],
                          capture_output=True, text=True)

def write(trigger, acceptance=None):
    """Write a rubric.json with the given trigger half (+ a valid acceptance half)."""
    f = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False)
    json.dump({"trigger": trigger, "acceptance": acceptance or ["it works"]}, f); f.close()
    return Path(f.name)

def write_raw(obj):
    f = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False)
    json.dump(obj, f); f.close()
    return Path(f.name)

VALID = ([{"query": f"q{i}", "should_trigger": True} for i in range(3)] +
         [{"query": f"n{i}", "should_trigger": False} for i in range(3)])

class T(unittest.TestCase):
    def test_valid_prints_hash_exit0(self):
        r = run(write(VALID))
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertRegex(r.stdout.strip(), r"^[0-9a-f]{64}$")

    def test_missing_file_blocks(self):
        r = run(Path("/no/such/rubric.json"))
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("missing", r.stderr)

    def test_not_object_with_trigger_blocks(self):
        r = run(write_raw([{"query": "x", "should_trigger": True}]))  # bare array, no trigger key
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("trigger", r.stderr)

    def test_trigger_not_array_blocks(self):
        r = run(write_raw({"trigger": {"query": "x"}, "acceptance": ["a"]}))
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
